import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Eye, X, Image, Upload, CheckCircle, AlertCircle, Camera, Trash2, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
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

interface LightboxPhoto {
  url: string;
  category: string;
  caption?: string;
}

const PhotoLightbox = ({ photos, startIndex, onClose }: {
  photos: LightboxPhoto[];
  startIndex: number;
  onClose: () => void;
}) => {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const current = photos[index];

  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const go = (dir: number) => {
    setIndex(i => (i + dir + photos.length) % photos.length);
    resetZoom();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.5, 5));
    if (e.key === '-') setZoom(z => Math.max(z - 0.5, 1));
  }, [index]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  };

  const onMouseUp = () => { setDragging(false); dragStart.current = null; };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)',
        zIndex: 20000, display: 'flex', flexDirection: 'column',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.625rem 1rem', backgroundColor: 'rgba(0,0,0,0.6)', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.15)', color: 'white',
            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
            borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {CAT_LABELS[current.category] || current.category}
          </span>
          {current.caption && (
            <span style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>{current.caption}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            {index + 1} / {photos.length}
          </span>
          {/* Zoom controls */}
          <button onClick={() => setZoom(z => Math.max(z - 0.5, 1))} title="Zoom out"
            style={{ ...btnStyle, opacity: zoom <= 1 ? 0.4 : 1 }} disabled={zoom <= 1}>
            <ZoomOut style={{ width: '1rem', height: '1rem' }} />
          </button>
          <span style={{ color: 'white', fontSize: '0.75rem', minWidth: '2.5rem', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(z + 0.5, 5))} title="Zoom in"
            style={{ ...btnStyle, opacity: zoom >= 5 ? 0.4 : 1 }} disabled={zoom >= 5}>
            <ZoomIn style={{ width: '1rem', height: '1rem' }} />
          </button>
          <button onClick={resetZoom} title="Reset zoom"
            style={{ ...btnStyle, opacity: zoom === 1 ? 0.4 : 1 }} disabled={zoom === 1}>
            <RotateCcw style={{ width: '1rem', height: '1rem' }} />
          </button>
          <div style={{ width: '1px', height: '1.25rem', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />
          <button onClick={onClose} title="Close (Esc)" style={btnStyle}>
            <X style={{ width: '1rem', height: '1rem' }} />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
          cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <img
          src={current.url}
          alt={current.caption || current.category}
          draggable={false}
          style={{
            maxWidth: zoom === 1 ? '90%' : 'none',
            maxHeight: zoom === 1 ? '90%' : 'none',
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease',
            borderRadius: zoom === 1 ? '0.5rem' : 0,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />

        {/* Prev / Next arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              style={{
                position: 'absolute', left: '0.75rem',
                backgroundColor: 'rgba(0,0,0,0.5)', color: 'white',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '9999px',
                width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <ChevronLeft style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
            <button
              onClick={() => go(1)}
              style={{
                position: 'absolute', right: '0.75rem',
                backgroundColor: 'rgba(0,0,0,0.5)', color: 'white',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '9999px',
                width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <ChevronRight style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div style={{
          display: 'flex', gap: '0.375rem', padding: '0.625rem', overflowX: 'auto',
          backgroundColor: 'rgba(0,0,0,0.5)', flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          {photos.map((p, i) => (
            <img
              key={i}
              src={p.url}
              alt=""
              onClick={() => { setIndex(i); resetZoom(); }}
              style={{
                width: '3.5rem', height: '3.5rem', objectFit: 'cover',
                borderRadius: '0.25rem', flexShrink: 0, cursor: 'pointer',
                opacity: i === index ? 1 : 0.5,
                border: i === index ? '2px solid white' : '2px solid transparent',
                transition: 'opacity 0.15s, border-color 0.15s',
              }}
            />
          ))}
        </div>
      )}

      {/* Keyboard hint */}
      <div style={{
        textAlign: 'center', padding: '0.375rem',
        color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', flexShrink: 0,
      }}>
        Arrow keys to navigate &nbsp;·&nbsp; +/- to zoom &nbsp;·&nbsp; Drag to pan &nbsp;·&nbsp; Esc to close
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.1)', color: 'white',
  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.375rem',
  width: '2rem', height: '2rem', display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer',
};

export const InspectionPDFView = ({ inspection, onClose }: InspectionPDFViewProps) => {
  const { user, userProfile } = useAuth();
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<PendingPhoto['category']>('general');
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);

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
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Failed to generate PDF preview.');
    } finally {
      setGenerating(false);
    }
  };

  const closePdfPreview = () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
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
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: '0.5rem 0.5rem 0 0', padding: '0.5rem 0.875rem',
            }}>
              <Image style={{ width: '1rem', height: '1rem', color: '#16a34a', flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', color: '#15803d' }}>
                {photos.length} photo{photos.length !== 1 ? 's' : ''} attached &mdash; click to zoom
              </span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem',
              padding: '0.625rem', backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0', borderTop: 'none', borderRadius: '0 0 0.5rem 0.5rem',
            }}>
              {photos.map((p, i) => (
                <div
                  key={i}
                  onClick={() => setLightbox({
                    photos: photos.map(ph => ({ url: ph.photo_url, category: ph.category, caption: ph.caption })),
                    index: i,
                  })}
                  style={{ position: 'relative', cursor: 'pointer', borderRadius: '0.25rem', overflow: 'hidden' }}
                  title="Click to zoom"
                >
                  <img
                    src={p.photo_url}
                    alt={p.caption || p.category}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0)', transition: 'background-color 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.35)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0)')}
                  >
                    <Maximize2 style={{ width: '1.1rem', height: '1.1rem', color: 'white', opacity: 0, transition: 'opacity 0.15s' }}
                      className="zoom-icon" />
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', color: 'white',
                    fontSize: '0.6rem', padding: '2px 4px', textAlign: 'center',
                  }}>
                    {CAT_LABELS[p.category] || p.category}
                  </div>
                </div>
              ))}
            </div>
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
                      onClick={() => setLightbox({
                        photos: pendingPhotos.map(ph => ({ url: ph.preview, category: ph.category, caption: ph.caption })),
                        index: idx,
                      })}
                      style={{ width: '100%', aspectRatio: (p.category === 'port_prop' || p.category === 'starboard_prop') ? '5/6' : '1', objectFit: 'cover', borderRadius: '0.375rem', cursor: 'pointer' }}
                      title="Click to zoom"
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

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {pdfPreviewUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 10000,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem', backgroundColor: '#1e293b', flexShrink: 0,
          }}>
            <span style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>
              Trip Inspection Report — {inspection.yachts?.name}
            </span>
            <button
              onClick={closePdfPreview}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.5rem 1rem', backgroundColor: '#475569', color: 'white',
                border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              <X style={{ width: '1rem', height: '1rem' }} /> Close Preview
            </button>
          </div>
          <iframe
            src={pdfPreviewUrl}
            style={{ flex: 1, border: 'none', width: '100%' }}
            title="PDF Preview"
          />
        </div>
      )}
    </div>
  );
};
