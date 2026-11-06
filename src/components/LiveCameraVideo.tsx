import { useEffect, useRef, useState } from 'react';

// Plays one camera live over WebRTC from the boat's go2rtc video box.
// `url` is the box's WHEP address for the camera (vessel_cameras.live_url),
// e.g. https://orion-cams.example.com/<secret>/api/webrtc?src=cam1
//
// On the boat's own WiFi the video goes straight from the box to the tablet,
// so the delay stays low enough to use the cameras for blind spots.

export type LiveStatus = 'connecting' | 'live' | 'reconnecting';

interface LiveCameraVideoProps {
  url: string;
  className?: string;
  onStatusChange?: (status: LiveStatus) => void;
}

const RETRY_MS = 3000;
const ICE_GATHER_TIMEOUT_MS = 1500;

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

    const report = (next: LiveStatus) => {
      if (cancelled) return;
      setStatus(next);
      statusCallback.current?.(next);
    };

    const scheduleRetry = () => {
      if (cancelled || retryTimer) return;
      report('reconnecting');
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, RETRY_MS);
    };

    const connect = async () => {
      pc?.close();
      controller?.abort();
      controller = new AbortController();
      const peer = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
      pc = peer;

      peer.addTransceiver('video', { direction: 'recvonly' });
      peer.ontrack = event => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        video.play().catch(() => {});
      };
      peer.onconnectionstatechange = () => {
        if (peer !== pc) return;
        if (peer.connectionState === 'connected') report('live');
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') scheduleRetry();
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
        if (cancelled || peer !== pc) return;
        console.warn('[LiveCameraVideo] connect failed:', err);
        scheduleRetry();
      }
    };

    report('connecting');
    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
      pc?.close();
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
