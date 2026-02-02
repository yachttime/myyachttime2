import { useEffect, useRef, useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';

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
              padding: 40px;
            }
            .container {
              max-width: 100%;
              text-align: center;
            }
            h1 {
              font-size: 2.5rem;
              font-weight: bold;
              margin-bottom: 1rem;
              color: #0f172a;
            }
            h2 {
              font-size: 1.75rem;
              font-weight: 600;
              margin-bottom: 1.5rem;
              color: #334155;
            }
            .qr-container {
              margin: 2rem auto;
              display: inline-block;
              padding: 20px;
              background: white;
              border: 3px solid #0891b2;
              border-radius: 12px;
            }
            .qr-container img {
              display: block;
              width: 200px;
              height: auto;
            }
            .description {
              font-size: 1.25rem;
              line-height: 1.8;
              color: #475569;
              margin-top: 1.5rem;
              max-width: 600px;
              margin-left: auto;
              margin-right: auto;
            }
            .description strong {
              color: #0f172a;
            }
            .footer {
              font-size: 1.5rem;
              font-weight: bold;
              color: #0891b2;
              margin-top: 2rem;
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
