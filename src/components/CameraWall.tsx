import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, LogOut, Maximize, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LiveCameraVideo, type LiveStatus } from './LiveCameraVideo';

// Camera-only screen for the helm tablets (Galaxy Tab Active, landscape, kiosk mode).
// Shows the latest snapshot the M5 Tough uploaded for each camera and refreshes on a timer.
// Cameras with a live_url (the boat's go2rtc video box) play live video, with the
// snapshot underneath as the fallback while live view connects or drops out.

const REFRESH_SECONDS = 15;
const STALE_SECONDS = 120;
const BUCKET = 'vessel-camera-snapshots';

interface VesselCamera {
  id: string;
  yacht_id: string;
  camera_name: string;
  sort_order: number;
  camera_slot: number;
  last_snapshot_path: string | null;
  last_snapshot_at: string | null;
  live_url: string | null;
  yachts: { name: string } | null;
}

interface CameraWallProps {
  onBack?: () => void;
  // Show only this yacht's cameras (helm tablet Security Cameras tab)
  yachtId?: string;
  // Render inside another screen: no page-height layout, title or sign out
  embedded?: boolean;
}

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function CameraWall({ onBack, yachtId, embedded = false }: CameraWallProps) {
  const { signOut } = useAuth();
  const [cameras, setCameras] = useState<VesselCamera[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedYachtId, setSelectedYachtId] = useState<string | null>(null);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
  const loadedAt = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    let query = supabase
      .from('vessel_cameras')
      .select('id, yacht_id, camera_name, sort_order, camera_slot, last_snapshot_path, last_snapshot_at, live_url, yachts(name)')
      .eq('is_enabled', true);
    if (yachtId) query = query.eq('yacht_id', yachtId);
    const { data, error: fetchError } = await query
      .order('sort_order')
      .order('camera_slot');

    if (fetchError) {
      setError('Could not load cameras. Check the boat\'s internet connection.');
      setLoading(false);
      return;
    }
    setError(null);

    const rows = (data || []) as unknown as VesselCamera[];
    setCameras(rows);

    // Only sign URLs for snapshots that changed, so unchanged pictures don't flicker
    const changed = rows.filter(
      c => c.last_snapshot_path && c.last_snapshot_at && loadedAt.current[c.id] !== c.last_snapshot_at
    );
    if (changed.length > 0) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(changed.map(c => c.last_snapshot_path as string), 300);
      if (signed) {
        const next: Record<string, string> = {};
        changed.forEach((c, i) => {
          const url = signed[i]?.signedUrl;
          if (url) {
            next[c.id] = url;
            loadedAt.current[c.id] = c.last_snapshot_at as string;
          }
        });
        setImageUrls(prev => ({ ...prev, ...next }));
      }
    }
    setLoading(false);
  }, [yachtId]);

  useEffect(() => {
    load();
    const refresh = setInterval(load, REFRESH_SECONDS * 1000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [load]);

  // Keep the helm tablet screen on while this page is open
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
        lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        lock = null;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  const yachts = useMemo(() => {
    const map = new Map<string, string>();
    cameras.forEach(c => map.set(c.yacht_id, c.yachts?.name || 'Vessel'));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [cameras]);

  const activeYachtId = selectedYachtId && yachts.some(y => y.id === selectedYachtId)
    ? selectedYachtId
    : yachts[0]?.id ?? null;
  const visible = cameras.filter(c => c.yacht_id === activeYachtId);
  const fullscreenCamera = visible.find(c => c.id === fullscreenId) || null;

  const ageSeconds = (c: VesselCamera) =>
    c.last_snapshot_at ? Math.max(0, Math.floor((now - new Date(c.last_snapshot_at).getTime()) / 1000)) : null;

  const gridCols = visible.length <= 1 ? 'grid-cols-1' : visible.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const renderStatus = (c: VesselCamera, large = false) => {
    if (c.live_url && liveStatus[c.id] === 'live') {
      return (
        <span className={`${large ? 'text-sm' : 'text-xs'} flex items-center gap-1.5 font-semibold text-emerald-400`}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      );
    }
    if (c.live_url) {
      const age = ageSeconds(c);
      return (
        <span className={`${large ? 'text-sm' : 'text-xs'} tabular-nums text-amber-400`}>
          {liveStatus[c.id] === 'reconnecting' ? 'Live view reconnecting' : 'Connecting live view'}
          {age !== null && ` · picture ${formatAge(age)}`}
        </span>
      );
    }
    const age = ageSeconds(c);
    const stale = age === null || age > STALE_SECONDS;
    return (
      <span className={`${large ? 'text-sm' : 'text-xs'} tabular-nums ${stale ? 'text-amber-400' : 'text-slate-300'}`}>
        {age === null ? 'No picture yet' : `${stale ? 'No new picture · ' : 'Updated '}${formatAge(age)}`}
      </span>
    );
  };

  const renderSnapshot = (c: VesselCamera, className: string) =>
    imageUrls[c.id] ? (
      <img src={imageUrls[c.id]} alt={c.camera_name} className={className} />
    ) : (
      <div className={`${className} flex flex-col items-center justify-center gap-2 text-slate-500`}>
        <Camera className="w-10 h-10" />
        <span className="text-sm">Waiting for first picture</span>
      </div>
    );

  const renderImage = (c: VesselCamera, className: string) =>
    c.live_url ? (
      <div className="relative w-full h-full">
        {renderSnapshot(c, className)}
        <LiveCameraVideo
          url={c.live_url}
          className={`absolute inset-0 bg-black ${className}`}
          onStatusChange={status => setLiveStatus(prev => (prev[c.id] === status ? prev : { ...prev, [c.id]: status }))}
        />
      </div>
    ) : (
      renderSnapshot(c, className)
    );

  return (
    <div
      className={`${
        embedded ? 'h-[calc(100vh-15rem)] min-h-[24rem] rounded-xl border border-slate-800' : 'h-screen'
      } flex flex-col bg-slate-950 text-white select-none overflow-hidden`}
    >
      <header className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-800">
        <div className="flex items-center gap-4 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {embedded ? (
            <h2 className="text-lg font-semibold">Security Cameras</h2>
          ) : yachts.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto">
              {yachts.map(y => (
                <button
                  key={y.id}
                  onClick={() => setSelectedYachtId(y.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                    y.id === activeYachtId ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {y.name}
                </button>
              ))}
            </div>
          ) : (
            <h1 className="text-xl font-bold tracking-wide uppercase truncate">
              {yachts[0]?.name || 'Cameras'}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm tabular-nums">
            {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => load()}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            aria-label="Refresh now"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={enterFullscreen}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            aria-label="Full screen"
          >
            <Maximize className="w-5 h-5" />
          </button>
          {!embedded && (
            <button
              onClick={signOut}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-amber-400 text-lg">{error}</div>
        ) : visible.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <Camera className="w-12 h-12" />
            <p className="text-lg">No cameras are set up for this vessel yet.</p>
          </div>
        ) : (
          <div className={`h-full grid ${gridCols} auto-rows-fr gap-3`}>
            {visible.map(c => (
              <button
                key={c.id}
                onClick={() => setFullscreenId(c.id)}
                className="relative min-h-0 rounded-xl overflow-hidden bg-black border border-slate-800 hover:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
              >
                {renderImage(c, 'w-full h-full object-contain')}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 py-2 bg-gradient-to-t from-black/85 to-transparent">
                  <span className="text-base font-semibold uppercase tracking-wide">{c.camera_name}</span>
                  {renderStatus(c)}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {fullscreenCamera && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black" onClick={() => setFullscreenId(null)}>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-xl font-bold uppercase tracking-wide">{fullscreenCamera.camera_name}</span>
            <div className="flex items-center gap-4">
              {renderStatus(fullscreenCamera, true)}
              <button
                onClick={() => setFullscreenId(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
                All cameras
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 p-3">
            {renderImage(fullscreenCamera, 'w-full h-full object-contain')}
          </div>
        </div>
      )}
    </div>
  );
}
