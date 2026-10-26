import { Anchor } from 'lucide-react';

const VIDEO_URL =
  'https://eqiecntollhfxmmbize.supabase.co/storage/v1/object/public/myyachttime-media/remote-monitoring/bob-karen-remote-monitoring.mp4';

export const WatchPresentation = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <Anchor className="w-8 h-8 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-wide">MY YACHT TIME</h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold leading-tight text-center mb-10">
            Bob and Karen show how MyYachtTime Remote Monitoring works
          </h2>

          <div className="flex justify-center">
            <video
              src={VIDEO_URL}
              controls
              playsInline
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl bg-slate-900"
              style={{ aspectRatio: '9 / 16' }}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="text-center mt-12 mb-8 space-y-3">
            <p className="text-lg text-slate-300">Ask us about Remote Monitoring today.</p>
            <p className="text-lg">
              <a
                href="tel:480-250-6270"
                className="text-amber-500 hover:text-amber-400 transition-colors font-semibold"
              >
                480-250-6270
              </a>
              {'  ·  '}
              <a
                href="mailto:info@myyachttime.com"
                className="text-amber-500 hover:text-amber-400 transition-colors font-semibold"
              >
                info@myyachttime.com
              </a>
            </p>
            <p>
              <a
                href="/"
                className="text-slate-300 hover:text-white transition-colors underline underline-offset-4"
              >
                Back to home
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
