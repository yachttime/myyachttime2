import { Download, Eye, X } from 'lucide-react';
import { Yacht } from '../lib/supabase';
import { generateActiveYachtsPDF } from '../utils/pdfGenerator';

interface PrintableYachtsListProps {
  yachts: Yacht[];
  onClose: () => void;
}

export function PrintableYachtsList({ yachts, onClose }: PrintableYachtsListProps) {
  const handlePreview = () => {
    try {
      const pdf = generateActiveYachtsPDF(yachts);
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Failed to generate PDF preview. Please check the console for details.');
    }
  };

  const handleDownload = () => {
    try {
      const pdf = generateActiveYachtsPDF(yachts);
      const fileName = `Active_Yachts_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        maxWidth: '32rem',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: '#1e293b'
        }}>
          Export Active Yachts
        </h2>
        <p style={{
          color: '#64748b',
          marginBottom: '1.5rem'
        }}>
          Choose an option to export the active yachts list as a PDF document.
        </p>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <button
            onClick={handlePreview}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#0891b2',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            <Eye style={{ width: '1.25rem', height: '1.25rem' }} />
            Preview PDF
          </button>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            <Download style={{ width: '1.25rem', height: '1.25rem' }} />
            Download PDF
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#475569',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
