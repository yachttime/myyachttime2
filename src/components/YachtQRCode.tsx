import { useEffect, useRef, useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';

export async function printAllQRCodesAvery5168(yachts: { id: string; name: string }[]) {
  if (yachts.length === 0) return;

  let baseUrl = (import.meta as any).env?.VITE_APP_URL || window.location.origin;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  const qrDataUrls: { name: string; dataUrl: string }[] = await Promise.all(
    yachts.map(async (yacht) => {
      const canvas = document.createElement('canvas');
      const url = `${baseUrl}?yacht=${yacht.id}`;
      await QRCode.toCanvas(canvas, url, {
        width: 300,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      return { name: yacht.name, dataUrl: canvas.toDataURL('image/png') };
    })
  );

  // Per-cell absolute positions (left, top) in inches
  // Row 1: top=1.5in, left col=0.81in, right col=0.81+3.5+0.19=4.5in
  // Row 2: top=1.5+5=6.5in, left col=1.31in (+1" extra), right col=1.31+3.5+0.19=5.0in
  const labelPositions = [
    { left: 0.81, top: 1.5 },
    { left: 4.50, top: 1.5 },
    { left: 1.31, top: 6.5 },
    { left: 5.00, top: 6.5 },
  ];

  const sheets: string[] = [];
  for (let i = 0; i < qrDataUrls.length; i += 4) {
    const group = qrDataUrls.slice(i, i + 4);
    while (group.length < 4) group.push({ name: '', dataUrl: '' });
    const cells = group.map((item, idx) => {
      const pos = labelPositions[idx];
      if (!item.dataUrl) return `<div style="position:absolute;left:${pos.left}in;top:${pos.top}in;width:3.5in;height:5in;"></div>`;
      return `
        <div style="position:absolute;left:${pos.left}in;top:${pos.top}in;width:3.5in;height:5in;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0.2in;">
          <div class="yacht-title">${item.name}</div>
          <div class="qr-wrap"><img src="${item.dataUrl}" alt="QR Code" /></div>
          <div class="label-sub">Scan to access My Yacht Time</div>
          <div class="label-brand">My Yacht Time</div>
        </div>
      `;
    }).join('');
    sheets.push(`<div class="sheet">${cells}</div>`);
  }
  const allSheetsHtml = sheets.join('');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Yacht QR Codes - Avery 5168</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: 8.5in 11in;
            margin: 0;
          }
          body {
            width: 8.5in;
            font-family: Arial, sans-serif;
            background: white;
          }
          .sheet {
            position: relative;
            width: 8.5in;
            height: 11in;
            page-break-after: always;
          }
          .yacht-title {
            font-size: 22pt;
            font-weight: bold;
            color: #0f172a;
            line-height: 1.2;
            word-break: break-word;
            margin-bottom: 0.12in;
          }
          .qr-wrap {
            display: block;
            border: 3px solid #0891b2;
            border-radius: 10px;
            padding: 8px;
            background: white;
            margin-bottom: 0.12in;
            line-height: 0;
          }
          .qr-wrap img {
            display: block;
            width: 2.4in;
            height: 2.4in;
          }
          .label-sub {
            font-size: 10pt;
            color: #475569;
            line-height: 1.4;
            margin-bottom: 0.06in;
          }
          .label-brand {
            font-size: 12pt;
            font-weight: bold;
            color: #0891b2;
          }
        </style>
      </head>
      <body>
        ${allSheetsHtml}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 500);
  }, 400);
}

interface YachtQRCodeProps {
  yachtId: string;
  yachtName: string;
  onClose: () => void;
}

export function YachtQRCode({ yachtId, yachtName, onClose }: YachtQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const generateQRCode = async () => {
      if (!canvasRef.current) return;

      // Get base URL and ensure it has the protocol
      let baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

      // Ensure the URL starts with https:// or http://
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }

      // Remove trailing slash if present
      baseUrl = baseUrl.replace(/\/$/, '');

      const qrUrl = `${baseUrl}?yacht=${yachtId}`;

      console.log('QR Code URL:', qrUrl);

      try {
        await QRCode.toCanvas(canvasRef.current, qrUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        const dataUrl = canvasRef.current.toDataURL('image/png');
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    };

    generateQRCode();
  }, [yachtId]);

  const handlePrint = () => {
    if (!qrDataUrl) {
      alert('QR code is still generating. Please wait a moment and try again.');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${yachtName}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            .container {
              max-width: 400px;
              margin: 0 auto;
              text-align: center;
            }
            h1 {
              font-size: 1.5rem;
              font-weight: bold;
              margin-bottom: 0.75rem;
              color: #0f172a;
            }
            h2 {
              font-size: 1.125rem;
              font-weight: 600;
              margin-bottom: 1rem;
              color: #334155;
            }
            .qr-container {
              margin: 1rem auto;
              display: inline-block;
              padding: 12px;
              background: white;
              border: 2px solid #0891b2;
              border-radius: 8px;
            }
            .qr-container img {
              display: block;
              width: 125px;
              height: auto;
            }
            .description {
              font-size: 0.875rem;
              line-height: 1.6;
              color: #475569;
              margin-top: 1rem;
              max-width: 350px;
              margin-left: auto;
              margin-right: auto;
            }
            .description strong {
              color: #0f172a;
            }
            .footer {
              font-size: 1rem;
              font-weight: bold;
              color: #0891b2;
              margin-top: 1.5rem;
            }
            @media print {
              @page {
                margin: 0.5in;
                size: portrait;
              }
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Welcome Aboard!</h1>
            <h2>${yachtName}</h2>
            <div class="qr-container">
              <img src="${qrDataUrl}" alt="QR Code" />
            </div>
            <div class="description">
              <p><strong>Scan this QR code</strong> with your smartphone to access the My Yacht Time portal and view your yacht information, schedule trips, and submit maintenance requests.</p>
            </div>
            <div class="footer">My Yacht Time</div>
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    }, 250);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `${yachtName.replace(/[^a-zA-Z0-9]/g, '_')}_QR_Code.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '2rem',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
            QR Code - {yachtName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#64748b',
            }}
          >
            <X style={{ width: '1.5rem', height: '1.5rem' }} />
          </button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '1.5rem',
              backgroundColor: '#f8fafc',
              borderRadius: '0.75rem',
              border: '3px solid #0891b2',
              marginBottom: '1.5rem',
            }}
          >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>

          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Print this QR code and place it on the yacht. When owners scan it with their smartphone, they'll be directed
            to the My Yacht Time login page.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1.25rem',
                backgroundColor: '#0891b2',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              <Printer style={{ width: '1.25rem', height: '1.25rem' }} />
              Print QR Code
            </button>

            <button
              onClick={handleDownload}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1.25rem',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              <Download style={{ width: '1.25rem', height: '1.25rem' }} />
              Download QR Code
            </button>

            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1.25rem',
                backgroundColor: '#475569',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              <X style={{ width: '1.25rem', height: '1.25rem' }} />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
