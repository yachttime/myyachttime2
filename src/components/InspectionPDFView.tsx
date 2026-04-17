import { useState, useEffect } from 'react';
import { Download, Eye, X, Image } from 'lucide-react';
import { TripInspection, supabase } from '../lib/supabase';
import { generateTripInspectionPDF, InspectionPhoto } from '../utils/pdfGenerator';

interface InspectionPDFViewProps {
  inspection: TripInspection & {
    yachts?: { name: string };
    user_profiles?: { first_name: string; last_name: string };
  };
  onClose: () => void;
}

export const InspectionPDFView = ({ inspection, onClose }: InspectionPDFViewProps) => {
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchPhotos = async () => {
      setLoadingPhotos(true);
      try {
        const { data } = await supabase
          .from('inspection_photos')
          .select('photo_url, caption, category')
          .eq('inspection_id', inspection.id)
          .order('created_at');
        setPhotos((data as InspectionPhoto[]) || []);
      } catch {
        setPhotos([]);
      } finally {
        setLoadingPhotos(false);
      }
    };
    fetchPhotos();
  }, [inspection.id]);

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const pdf = await generateTripInspectionPDF(inspection, photos);
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Failed to generate PDF preview. Please check the console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const pdf = await generateTripInspectionPDF(inspection, photos);
      const yachtName = inspection.yachts?.name || 'Unknown';
      const date = new Date(inspection.inspection_date).toISOString().split('T')[0];
      const fileName = `Trip_Inspection_${yachtName.replace(/[^a-zA-Z0-9]/g, '_')}_${date}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    } finally {
      setGenerating(false);
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
          marginBottom: '0.5rem',
          color: '#1e293b'
        }}>
          Export Trip Inspection Report
        </h2>

        {loadingPhotos ? (
          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Loading photos...
          </p>
        ) : photos.length > 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            padding: '0.625rem 0.875rem',
            marginBottom: '1rem'
          }}>
            <Image style={{ width: '1rem', height: '1rem', color: '#16a34a', flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', color: '#15803d' }}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''} will be included in the PDF
            </span>
          </div>
        ) : (
          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.875rem' }}>
            No photos attached to this inspection.
          </p>
        )}

        <p style={{
          color: '#64748b',
          marginBottom: '1.5rem',
          fontSize: '0.875rem'
        }}>
          Choose an option to export the inspection report as a PDF document.
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <button
            onClick={handlePreview}
            disabled={generating || loadingPhotos}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: generating ? '#7dd3fc' : '#0891b2',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: generating || loadingPhotos ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              opacity: generating || loadingPhotos ? 0.7 : 1,
            }}
          >
            <Eye style={{ width: '1.25rem', height: '1.25rem' }} />
            {generating ? 'Generating...' : 'Preview PDF'}
          </button>
          <button
            onClick={handleDownload}
            disabled={generating || loadingPhotos}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: generating ? '#6ee7b7' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: generating || loadingPhotos ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              opacity: generating || loadingPhotos ? 0.7 : 1,
            }}
          >
            <Download style={{ width: '1.25rem', height: '1.25rem' }} />
            {generating ? 'Generating...' : 'Download PDF'}
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
};
