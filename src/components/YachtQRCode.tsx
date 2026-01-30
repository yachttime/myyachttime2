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

      const baseUrl = window.location.origin;
      const qrUrl = `${baseUrl}?yacht=${yachtId}`;

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

    const printDiv = document.createElement('div');
    printDiv.id = 'qr-print-content';
    printDiv.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <h1 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem; color: #0f172a;">Welcome Aboard!</h1>
        <h2 style="font-size: 1.75rem; font-weight: 600; margin-bottom: 1.5rem; color: #334155;">${yachtName}</h2>
        <div style="margin: 2rem auto; display: inline-block; padding: 20px; background: white; border: 3px solid #0891b2; border-radius: 12px;">
          <img src="${qrDataUrl}" alt="QR Code" style="display: block; width: 400px; height: auto;" />
        </div>
        <div style="font-size: 1.25rem; line-height: 1.8; color: #475569; margin-top: 1.5rem; max-width: 600px; margin-left: auto; margin-right: auto;">
          <p><strong style="color: #0f172a;">Scan this QR code</strong> with your smartphone to access the My Yacht Time portal and view your yacht information, schedule trips, and submit maintenance requests.</p>
        </div>
        <div style="font-size: 1.5rem; font-weight: bold; color: #0891b2; margin-top: 2rem;">My Yacht Time</div>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'qr-print-style';
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        #qr-print-content, #qr-print-content * {
          visibility: visible;
        }
        #qr-print-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        @page {
          margin: 0.5in;
        }
      }
      #qr-print-content {
        display: none;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(printDiv);

    window.print();

    setTimeout(() => {
      document.body.removeChild(printDiv);
      document.head.removeChild(style);
    }, 100);
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
