import { useState, useEffect, useRef } from 'react';
import { Download, Eye, X, Image, Upload, CheckCircle, AlertCircle, Camera, Trash2 } from 'lucide-react';
import { TripInspection, supabase } from '../lib/supabase';
import { generateTripInspectionPDF, InspectionPhoto } from '../utils/pdfGenerator';
import { useAuth } from '../contexts/AuthContext';

interface InspectionPDFViewProps {
  inspection: TripInspection & {
    yachts?: { name: string };
    user_profiles?: { first_name: string; last_name: string };
  };
  onClose: () => void;
}

interface PendingPhoto {
  file: File;
  preview: string;
  category: 'port_prop' | 'starboard_prop' | 'damage' | 'general';
  caption: string;
}

const CAT_LABELS: Record<string, string> = {
  port_prop: 'Port Prop',
  starboard_prop: 'Stbd Prop',
  damage: 'Damage',
  general: 'General',
};

export const InspectionPDFView = ({ inspection, onClose }: InspectionPDFViewProps) => {
  const { user, userProfile } = useAuth();
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<PendingPhoto['category']>('general');

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

  useEffect(() => {
    fetchPhotos();
  }, [inspection.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newPhotos: PendingPhoto[] = Array.from(e.target.files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      category: selectedCategory,
      caption: '',
    }));
    setPendingPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const removePending = (idx: number) => {
    setPendingPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUpload = async () => {
    if (!user || pendingPhotos.length === 0) return;
    setUploading(true);
    setUploadMessage(null);

    try {
      const companyId = (userProfile as any)?.company_id ?? (inspection as any)?.company_id ?? null;

      const results = await Promise.allSettled(
        pendingPhotos.map(async (photo) => {
          const fileExt = photo.file.name.split('.').pop() || 'jpg';
          const filePath = `${user.id}/${inspection.id}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

          const { error: storageError } = await supabase.storage
            .from('inspection-photos')
            .upload(filePath, photo.file, { cacheControl: '3600', upsert: false });

          if (storageError) throw storageError;

          const { data: urlData } = supabase.storage
            .from('inspection-photos')
            .getPublicUrl(filePath);

          const { error: dbError } = await supabase.from('inspection_photos').insert({
            inspection_id: inspection.id,
            photo_url: urlData.publicUrl,
            caption: photo.caption,
            category: photo.category,
            company_id: companyId,
            created_by: user.id,
          });

          if (dbError) throw dbError;
        })
      );

      const failed = results.filter(r => r.status === 'rejected');
      const succeeded = results.filter(r => r.status === 'fulfilled').length;

      if (failed.length > 0) {
        const firstErr = (failed[0] as PromiseRejectedResult).reason;
        setUploadMessage({
          type: 'error',
          text: `${succeeded} photo${succeeded !== 1 ? 's' : ''} uploaded, ${failed.length} failed: ${firstErr?.message || 'Unknown error'}`,
        });
      } else {
        setPendingPhotos([]);
        setUploadMessage({ type: 'success', text: `${succeeded} photo${succeeded !== 1 ? 's' : ''} attached successfully.` });
        await fetchPhotos();
      }
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const pdf = await generateTripInspectionPDF(inspection, photos);
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Failed to generate PDF preview.');
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
      alert('Failed to generate PDF.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflowY: 'auto', padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '0.75rem', padding: '2rem',
        maxWidth: '36rem', width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem', color: '#1e293b' }}>
          Trip Inspection Report
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
          {inspection.yachts?.name} &mdash; {new Date(inspection.created_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>

        {/* Attached photos status */}
        {loadingPhotos ? (
          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.875rem' }}>Loading photos...</p>
        ) : photos.length > 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: '0.5rem', padding: '0.625rem 0.875rem', marginBottom: '1rem',
          }}>
            <Image style={{ width: '1rem', height: '1rem', color: '#16a34a', flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', color: '#15803d' }}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''} attached &mdash; will be included in PDF
            </span>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            backgroundColor: '#fefce8', border: '1px solid #fde047',
            borderRadius: '0.5rem', padding: '0.625rem 0.875rem', marginBottom: '1rem',
          }}>
            <Image style={{ width: '1rem', height: '1rem', color: '#ca8a04', flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', color: '#854d0e' }}>
              No photos attached to this inspection.
            </span>
          </div>
        )}

        {/* Add photos section */}
        <div style={{
          backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem',
        }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>
            Attach Photos to This Inspection
          </p>

          {/* Category selector */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {(['port_prop', 'starboard_prop', 'damage', 'general'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.375rem 0.75rem', borderRadius: '9999px',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: 'none',
                  backgroundColor: selectedCategory === cat ? '#0f172a' : '#e2e8f0',
                  color: selectedCategory === cat ? 'white' : '#475569',
                }}
              >
                {CAT_LABELS[cat]}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', backgroundColor: '#e2e8f0', color: '#334155',
              border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
            }}
          >
            <Camera style={{ width: '1rem', height: '1rem' }} />
            Select Photos ({CAT_LABELS[selectedCategory]})
          </button>

          {/* Pending preview grid */}
          {pendingPhotos.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                {pendingPhotos.length} photo{pendingPhotos.length !== 1 ? 's' : ''} ready to upload
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {pendingPhotos.map((p, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img
                      src={p.preview}
                      alt=""
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '0.375rem' }}
                    />
                    <div style={{
                      position: 'absolute', top: '2px', left: '2px',
                      backgroundColor: 'rgba(0,0,0,0.6)', color: 'white',
                      fontSize: '0.6rem', padding: '1px 5px', borderRadius: '9999px',
                    }}>
                      {CAT_LABELS[p.category]}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePending(idx)}
                      style={{
                        position: 'absolute', top: '2px', right: '2px',
                        backgroundColor: 'rgba(239,68,68,0.85)', color: 'white',
                        border: 'none', borderRadius: '9999px', cursor: 'pointer',
                        width: '20px', height: '20px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 style={{ width: '10px', height: '10px' }} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload message */}
              {uploadMessage && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  marginTop: '0.75rem', padding: '0.625rem 0.875rem',
                  backgroundColor: uploadMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${uploadMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '0.375rem',
                }}>
                  {uploadMessage.type === 'success'
                    ? <CheckCircle style={{ width: '1rem', height: '1rem', color: '#16a34a', flexShrink: 0 }} />
                    : <AlertCircle style={{ width: '1rem', height: '1rem', color: '#dc2626', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: '0.8rem', color: uploadMessage.type === 'success' ? '#15803d' : '#b91c1c' }}>
                    {uploadMessage.text}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.625rem 1.25rem', backgroundColor: uploading ? '#7dd3fc' : '#0284c7',
                  color: 'white', border: 'none', borderRadius: '0.5rem',
                  cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600,
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                <Upload style={{ width: '1rem', height: '1rem' }} />
                {uploading ? 'Uploading...' : `Upload ${pendingPhotos.length} Photo${pendingPhotos.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {uploadMessage && pendingPhotos.length === 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              marginTop: '0.75rem', padding: '0.625rem 0.875rem',
              backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.375rem',
            }}>
              <CheckCircle style={{ width: '1rem', height: '1rem', color: '#16a34a' }} />
              <span style={{ fontSize: '0.8rem', color: '#15803d' }}>{uploadMessage.text}</span>
            </div>
          )}
        </div>

        {/* Export buttons */}
        <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Export the inspection report as a PDF document.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handlePreview}
            disabled={generating || loadingPhotos}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem', backgroundColor: generating ? '#7dd3fc' : '#0891b2',
              color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600,
              cursor: generating || loadingPhotos ? 'not-allowed' : 'pointer', fontSize: '1rem',
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem', backgroundColor: generating ? '#6ee7b7' : '#059669',
              color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600,
              cursor: generating || loadingPhotos ? 'not-allowed' : 'pointer', fontSize: '1rem',
              opacity: generating || loadingPhotos ? 0.7 : 1,
            }}
          >
            <Download style={{ width: '1.25rem', height: '1.25rem' }} />
            {generating ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem', backgroundColor: '#475569', color: 'white',
              border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem',
            }}
          >
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
