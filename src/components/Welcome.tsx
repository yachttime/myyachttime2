import { useState, useEffect } from 'react';
import { Anchor } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WelcomeProps {
  onGetStarted: () => void;
}

interface EducationVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  order_index: number;
}

export const Welcome = ({ onGetStarted }: WelcomeProps) => {
  const [signInVideo, setSignInVideo] = useState<EducationVideo | null>(null);

  useEffect(() => {
    const fetchSignInVideo = async () => {
      const { data, error } = await supabase
        .from('education_videos')
        .select('*')
        .eq('category', 'SignIn')
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sign in video:', error);
      } else if (data) {
        setSignInVideo(data);
      }
    };

    fetchSignInVideo();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <Anchor className="w-8 h-8 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-wide">MY YACHT TIME</h1>
          </div>
          <div className="text-sm font-semibold text-amber-500 bg-amber-500/10 px-3 py-1 rounded">v2026.01.28.A</div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl mb-8">
            <img
              src="https://images.squarespace-cdn.com/content/v1/56af9a288a65e24490953e94/1455039460129-YF764M9HSVWY0SDBUV7O/DJI_0014.JPG"
              alt="Adonia yacht"
              className="w-full h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
          </div>

          <div className="text-center space-y-6 mb-12">
            <h2 className="text-5xl font-bold leading-tight">
              Welcome to<br />My Yacht Time
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              The premier platform for yacht owners with time shares. Manage your trips,
              coordinate maintenance, and access essential yacht information all in one place.
            </p>
          </div>

          <div className="flex justify-center mb-16">
            <button
              onClick={onGetStarted}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-12 py-4 rounded-lg text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              Get Started
            </button>
          </div>

          {signInVideo && (
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <video
                key={signInVideo.video_url}
                src={signInVideo.video_url}
                className="w-full aspect-video object-contain bg-slate-900"
                controls
                autoPlay
                muted
                loop
                playsInline
                poster={signInVideo.thumbnail_url || undefined}
                onError={(e) => {
                  console.error('Video failed to load on Welcome page:', e);
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          <div className="text-center mt-12 mb-8">
            <p className="text-lg text-slate-300">
              For more information contact{' '}
              <a href="mailto:sales@azmarine.net" className="text-amber-500 hover:text-amber-400 transition-colors">
                sales@azmarine.net
              </a>
              {' '}or{' '}
              <a href="tel:928-637-6500" className="text-amber-500 hover:text-amber-400 transition-colors">
                928-637-6500
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500 mb-2">Trip Management</div>
              <p className="text-slate-400">Schedule and track your yacht time</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500 mb-2">Maintenance</div>
              <p className="text-slate-400">Submit requests directly to management</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500 mb-2">Education</div>
              <p className="text-slate-400">Learn about your yacht's systems</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
