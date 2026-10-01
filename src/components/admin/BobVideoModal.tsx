import { X } from 'lucide-react';
import { useBob } from '../../contexts/BobContext';

export function BobVideoModal() {
  const { videoAction, closeVideo } = useBob();
  if (!videoAction) return null;

  const isYouTube = videoAction.video_url.includes('youtube.com') || videoAction.video_url.includes('youtu.be');
  const isVimeo = videoAction.video_url.includes('vimeo.com');
  const isExternal = isYouTube || isVimeo;

  let embedUrl = videoAction.video_url;
  if (isYouTube) {
    const match = videoAction.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
  } else if (isVimeo) {
    const match = videoAction.video_url.match(/vimeo\.com\/(\d+)/);
    if (match) embedUrl = `https://player.vimeo.com/video/${match[1]}`;
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white truncate">{videoAction.title}</h2>
          <button
            onClick={closeVideo}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="w-full bg-black flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
          {isExternal ? (
            <iframe
              src={embedUrl}
              title={videoAction.title}
              className="w-full h-full"
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
            />
          ) : (
            <video
              src={videoAction.video_url}
              controls
              autoPlay
              className="w-full h-full"
              onEnded={closeVideo}
            />
          )}
        </div>
      </div>
    </div>
  );
}
