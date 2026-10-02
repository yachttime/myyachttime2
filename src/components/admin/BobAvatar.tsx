import { useRef, useEffect, useState } from 'react';

export type BobAvatarState = 'idle' | 'talking' | 'thinking';

const IDLE_URL = 'https://eqiecntollhgfxmmbize.supabase.co/storage/v1/object/public/education-videos/bob-avatar/idle.mp4';
const TALKING_URL = 'https://eqiecntollhgfxmmbize.supabase.co/storage/v1/object/public/education-videos/bob-avatar/talking.mp4';
const POSTER_URL = 'https://eqiecntollhgfxmmbize.supabase.co/storage/v1/object/public/education-videos/bob-avatar/bob-portrait.jpg';

interface BobAvatarProps {
  size: number;
  state?: BobAvatarState;
  className?: string;
  borderClass?: string;
}

export function BobAvatar({ size, state = 'idle', className = '', borderClass = 'border-2 border-amber-500/60' }: BobAvatarProps) {
  const idleRef = useRef<HTMLVideoElement>(null);
  const talkingRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Pause videos when tab is hidden
  useEffect(() => {
    const onVis = () => {
      setHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Control playback based on visibility
  useEffect(() => {
    if (hidden) {
      idleRef.current?.pause();
      talkingRef.current?.pause();
    } else {
      idleRef.current?.play().catch(() => {});
      talkingRef.current?.play().catch(() => {});
    }
  }, [hidden]);

  // When switching to talking, restart talking video from random point 0-6s
  useEffect(() => {
    if (state === 'talking' && talkingRef.current && !hidden) {
      const v = talkingRef.current;
      try {
        v.currentTime = Math.random() * 6;
        v.play().catch(() => {});
      } catch { /* noop */ }
    }
  }, [state, hidden]);

  const showTalking = state === 'talking' && !failed;
  const showThinking = state === 'thinking';

  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${borderClass} ${className}`}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <img
          src={POSTER_URL}
          alt="Bob"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 20%' }}
        />
      ) : (
        <>
          <video
            ref={idleRef}
            src={IDLE_URL}
            poster={POSTER_URL}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            className="absolute inset-0 w-full h-full transition-opacity duration-200"
            style={{
              objectFit: 'cover',
              objectPosition: 'center 20%',
              transform: 'scale(1.25)',
              opacity: showTalking ? 0 : 1,
            }}
            onError={() => setFailed(true)}
          />
          <video
            ref={talkingRef}
            src={TALKING_URL}
            poster={POSTER_URL}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            className="absolute inset-0 w-full h-full transition-opacity duration-200"
            style={{
              objectFit: 'cover',
              objectPosition: 'center 20%',
              transform: 'scale(1.25)',
              opacity: showTalking ? 1 : 0,
            }}
            onError={() => setFailed(true)}
          />
        </>
      )}
      {showThinking && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none animate-pulse"
          style={{ boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.6), 0 0 12px 4px rgba(245, 158, 11, 0.3)' }}
        />
      )}
    </div>
  );
}
