import { useEffect, useRef, useState } from 'react';

// Plays one camera live from the boat's go2rtc video box.
// `url` is the box's WHEP address for the camera (vessel_cameras.live_url),
// e.g. https://orion-cams.example.com/<secret>/api/webrtc?src=cam1
//
// Two routes, tried in order:
// 1. WebRTC (WHEP): video goes straight from the box to the device over the
//    boat's own WiFi — sub-second delay, no Starlink data. Only works on the
//    boat's network (Starlink's router blocks inbound video from the internet).
// 2. MSE over WebSocket, through the box's Cloudflare tunnel: works from
//    anywhere (office/phone/laptop), a couple of seconds behind live, and
//    uses the boat's internet. Requires the tunnel to allow /api/ws.
//
// The direct route is capped at WHEP_TIMEOUT_MS: remotely it can never deliver
// video (the browser's own timeout would take ~40s), so we cut it off early
// and switch to the tunnel route. Once the direct route has failed for a
// camera's host in this browsing session, later cameras and reopens skip it
// entirely and start on the tunnel route.

// 'unreachable' = the browser could not reach the video box at all (usually the
// viewing device is not on the boat's network, or the box/tunnel is offline)
export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'unreachable';

interface LiveCameraVideoProps {
  url: string;
  className?: string;
  onStatusChange?: (status: LiveStatus) => void;
}

const RETRY_MS = 3000;
const ICE_GATHER_TIMEOUT_MS = 1500;
const WHEP_TIMEOUT_MS = 6000;
// Hosts where the direct route already failed in this browsing session
const whepBlockedHosts = new Set<string>();

// Codecs requested from the box for MSE: H.264 video (camera sub stream) + AAC audio
const MSE_CODECS = 'avc1.640029,avc1.64002A,mp4a.40.2';
const MSE_MAX_LAG_SECONDS = 4;
const MSE_TRIM_SECONDS = 60;

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>(resolve => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    // Local network candidates arrive almost at once; don't wait on slow STUN lookups
    const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

function wsUrlFromWhep(url: string): string | null {
  if (!url.includes('/api/webrtc')) return null;
  return url.replace('/api/webrtc', '/api/ws');
}

export function LiveCameraVideo({ url, className, onStatusChange }: LiveCameraVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const statusCallback = useRef(onStatusChange);
  statusCallback.current = onStatusChange;

  useEffect(() => {
    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let ws: WebSocket | null = null;
    let objectUrl: string | null = null;
    let sourceBuffer: SourceBuffer | null = null;
    const pendingChunks: ArrayBuffer[] = [];
    let usingFallback = false;
    let reportedLive = false;
    const host = hostFromUrl(url);

    const report = (next: LiveStatus) => {
      if (cancelled) return;
      if (next === 'live') reportedLive = true;
      if (reportedLive && (next === 'connecting' || next === 'unreachable')) return;
      setStatus(next);
      statusCallback.current?.(next);
    };

    const scheduleRetry = (silent = false) => {
      if (cancelled || retryTimer) return;
      if (!silent) report('reconnecting');
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (usingFallback) connectFallback();
        else connectWhep();
      }, RETRY_MS);
    };

    // ---- Route 2: MSE over WebSocket through the Cloudflare tunnel ----
    const cleanupFallbackVideo = () => {
      if (ws) { try { ws.close(); } catch { /* already closed */ } ws = null; }
      if (sourceBuffer) { try { sourceBuffer.abort(); } catch { /* not initialized */ } sourceBuffer = null; }
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      pendingChunks.length = 0;
      const video = videoRef.current;
      if (video) video.removeAttribute('src');
    };

    // Drop the failed direct (WebRTC) connection. Its stream stays attached to
    // the <video> as srcObject even though no video ever arrives, and srcObject
    // takes priority over src, so the tunnel video would play into a black box.
    const dropWhep = () => {
      controller?.abort();
      controller = null;
      if (pc) { pc.onconnectionstatechange = null; pc.ontrack = null; pc.close(); pc = null; }
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };

    const connectFallback = () => {
      if (cancelled) return;
      usingFallback = true;
      dropWhep();
      cleanupFallbackVideo();
      const video = videoRef.current;
      const wsUrl = wsUrlFromWhep(url);
      if (!video || !wsUrl || typeof MediaSource === 'undefined') {
        // No tunnel route available (old box config or Safari without MSE): stay unreachable
        report('unreachable');
        scheduleRetry(true);
        return;
      }

      report('connecting');
      const socket = new WebSocket(wsUrl);
      ws = socket;
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        if (cancelled || socket !== ws) return;
        socket.send(JSON.stringify({ type: 'mse', value: MSE_CODECS }));
      };

      socket.onmessage = event => {
        if (cancelled || socket !== ws) return;
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as { type?: string; value?: string };
            if (msg.type !== 'mse' || !msg.value) return;
            const mime = msg.value.includes('/')
              ? msg.value
              : `video/mp4; codecs="${msg.value}"`;
            if (!MediaSource.isTypeSupported(mime)) {
              report('unreachable');
              scheduleRetry(true);
              return;
            }
            const media = new MediaSource();
            objectUrl = URL.createObjectURL(media);
            video.src = objectUrl;
            video.play().catch(() => {});
            media.addEventListener('sourceopen', () => {
              if (cancelled || socket !== ws) return;
              try {
                sourceBuffer = media.addSourceBuffer(mime);
                sourceBuffer.addEventListener('updateend', pump);
                pump();
              } catch {
                report('unreachable');
                scheduleRetry(true);
              }
            });
          } catch {
            // ignore malformed control messages
          }
          return;
        }
        // Binary message = a media segment
        pendingChunks.push(event.data as ArrayBuffer);
        report('live');
        pump();
      };

      socket.onerror = () => {
        if (cancelled || socket !== ws) return;
        report('unreachable');
      };

      socket.onclose = () => {
        if (cancelled || socket !== ws) return;
        scheduleRetry(true);
      };
    };

    const pump = () => {
      const sb = sourceBuffer;
      if (!sb || sb.updating || pendingChunks.length === 0) return;
      const chunk = pendingChunks.shift();
      if (!chunk) return;
      try {
        sb.appendBuffer(chunk);
      } catch {
        pendingChunks.unshift(chunk);
        return;
      }
      // Keep playback near the live edge and discard old data
      if (sb.buffered.length > 0) {
        const end = sb.buffered.end(sb.buffered.length - 1);
        if (videoRef.current && end - videoRef.current.currentTime > MSE_MAX_LAG_SECONDS) {
          videoRef.current.currentTime = end - 0.5;
        }
        const start = sb.buffered.start(0);
        if (videoRef.current && videoRef.current.currentTime - start > MSE_TRIM_SECONDS) {
          try { sb.remove(start, videoRef.current.currentTime - MSE_TRIM_SECONDS); } catch { /* not critical */ }
        }
      }
    };

    const noteWhepFailure = () => {
      if (host) whepBlockedHosts.add(host);
      connectFallback();
    };

    // ---- Route 1: WebRTC (WHEP), direct over the boat WiFi ----
    const connectWhep = async () => {
      pc?.close();
      controller?.abort();
      controller = new AbortController();
      const peer = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
      pc = peer;

      // Remotely the direct route never delivers video; without a deadline the
      // browser would sit on it for ~40s before giving up. Cap the attempt.
      let attemptDone = false;
      const finishAttempt = () => {
        if (attemptDone) return false;
        attemptDone = true;
        clearTimeout(whepTimer);
        return true;
      };
      const whepTimer = setTimeout(() => {
        if (cancelled || peer !== pc || !finishAttempt()) return;
        console.warn('[LiveCameraVideo] direct connect timed out');
        noteWhepFailure();
      }, WHEP_TIMEOUT_MS);

      peer.addTransceiver('video', { direction: 'recvonly' });
      peer.ontrack = event => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        video.play().catch(() => {});
      };
      peer.onconnectionstatechange = () => {
        if (peer !== pc) return;
        if (peer.connectionState === 'connected') {
          finishAttempt();
          report('live');
        }
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          report('reconnecting');
          if (finishAttempt()) noteWhepFailure();
        }
      };

      try {
        await peer.setLocalDescription(await peer.createOffer());
        await waitForIceGathering(peer);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: peer.localDescription?.sdp,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Video box answered ${response.status}`);
        const answer = await response.text();
        if (cancelled || peer !== pc) return;
        await peer.setRemoteDescription({ type: 'answer', sdp: answer });
      } catch (err) {
        if (cancelled || peer !== pc || !finishAttempt()) return;
        console.warn('[LiveCameraVideo] direct connect failed:', err);
        noteWhepFailure();
      }
    };

    report('connecting');
    if (host && whepBlockedHosts.has(host)) connectFallback();
    else connectWhep();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
      pc?.close();
      if (ws) { try { ws.close(); } catch { /* already closed */ } }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const video = videoRef.current;
      if (video && !video.srcObject) video.removeAttribute('src');
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      className={`${className ?? ''} ${status === 'live' ? '' : 'opacity-0'}`}
      autoPlay
      muted
      playsInline
      disablePictureInPicture
    />
  );
}
