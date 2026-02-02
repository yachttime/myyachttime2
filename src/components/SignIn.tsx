import { useState, useEffect, useRef } from 'react';
import { Anchor, Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Yacht {
  id: string;
  name: string;
}

interface EducationVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  order_index: number;
  created_at: string;
}

export const SignIn = () => {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [signInVideo, setSignInVideo] = useState<EducationVideo | null>(null);
  const [scannedYachtName, setScannedYachtName] = useState<string | null>(null);
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  const [welcomeVideo, setWelcomeVideo] = useState<EducationVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { signIn } = useAuth();

  useEffect(() => {
    handleYachtQRCode();
    fetchSignInVideo();
  }, []);

  const handleYachtQRCode = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const yachtId = params.get('yacht');

      if (yachtId) {
        const { data: yacht, error } = await supabase
          .from('yachts')
          .select('id, name')
          .eq('id', yachtId)
          .maybeSingle();

        if (!error && yacht) {
          localStorage.setItem('qr_scanned_yacht_id', yacht.id);
          setScannedYachtName(yacht.name);

          // Fetch yacht-specific welcome video
          await fetchYachtWelcomeVideo(yacht.id);
        }

        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      console.error('Error handling yacht QR code:', err);
    }
  };

  const fetchYachtWelcomeVideo = async (yachtId: string) => {
    try {
      setVideoLoading(true);
      const { data, error } = await supabase
        .from('education_videos')
        .select('*')
        .eq('category', 'SignIn')
        .eq('yacht_id', yachtId)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching yacht welcome video:', error);
        setVideoLoading(false);
        return;
      }

      if (data) {
        setWelcomeVideo(data);
        setShowWelcomeVideo(true);
        setVideoLoading(false);
      } else {
        setVideoLoading(false);
      }
    } catch (err) {
      console.error('Exception while fetching yacht welcome video:', err);
      setVideoLoading(false);
    }
  };

  const fetchSignInVideo = async () => {
    try {
      const { data, error } = await supabase
        .from('education_videos')
        .select('*')
        .eq('category', 'SignIn')
        .is('yacht_id', null)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sign-in video:', error);
        return;
      }

      if (data) {
        setSignInVideo(data);
      }
    } catch (err) {
      console.error('Exception while fetching sign-in video:', err);
    }
  };

  const handleSkipVideo = () => {
    setShowWelcomeVideo(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleVideoEnded = () => {
    setShowWelcomeVideo(false);
  };

  const handleVideoError = () => {
    setVideoError(true);
    setTimeout(() => {
      setShowWelcomeVideo(false);
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        if (!email || !email.includes('@')) {
          throw new Error('Please enter a valid email address');
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });

        if (error) {
          console.error('Password reset error:', error);
          throw new Error('Unable to send password reset email. Please contact support or verify your email address is correct.');
        }

        setSuccess('Password reset link sent! Please check your email (including spam folder).');
        setEmail('');
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {showWelcomeVideo && welcomeVideo && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-3">
              <Anchor className="w-6 h-6 text-amber-500" />
              <div>
                <h2 className="text-xl font-bold">Welcome to {scannedYachtName}</h2>
                <p className="text-sm text-slate-300">{welcomeVideo.title}</p>
              </div>
            </div>
            <button
              onClick={handleSkipVideo}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-all duration-300 shadow-lg"
            >
              Skip to Login
              <X className="w-4 h-4" />
            </button>
          </div>

          {videoLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                <p className="text-slate-300">Loading welcome video...</p>
              </div>
            </div>
          )}

          {videoError && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-500 mb-2">Video could not be loaded</p>
                <p className="text-slate-400 text-sm">Redirecting to login...</p>
              </div>
            </div>
          )}

          {!videoLoading && !videoError && (
            <video
              ref={videoRef}
              src={welcomeVideo.video_url}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              poster={welcomeVideo.thumbnail_url || undefined}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
            >
              Your browser does not support the video tag.
            </video>
          )}

          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-center">
            <p className="text-sm text-slate-400">Video will auto-advance to login when complete</p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-12">
          <Anchor className="w-8 h-8 text-amber-500" />
          <h1 className="text-2xl font-bold tracking-wide">MY YACHT TIME</h1>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700">
            <h2 className="text-3xl font-bold mb-8 text-center">
              {isForgotPassword ? 'Reset Password' : 'Sign In'}
            </h2>

            {scannedYachtName && (
              <div className="bg-blue-500/10 border border-blue-500 text-blue-400 px-4 py-3 rounded-lg text-sm mb-6 text-center">
                <p className="font-semibold">QR Code Scanned</p>
                <p className="text-xs mt-1">Signing in for: {scannedYachtName}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="sr-only">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400"
                  required
                  autoComplete="email"
                />
              </div>

              {!isForgotPassword && (
                <div className="relative">
                  <label htmlFor="password" className="sr-only">Password</label>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Please wait...' : isForgotPassword ? 'Send Reset Link' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsForgotPassword(!isForgotPassword);
                  setError('');
                  setSuccess('');
                }}
                className="block w-full text-slate-400 hover:text-amber-400 transition-colors text-sm"
              >
                {isForgotPassword ? 'Back to sign in' : 'Forgot your password?'}
              </button>
            </div>
          </div>

          {signInVideo && (
            <div className="mt-8 rounded-2xl overflow-hidden shadow-2xl">
              <video
                key={signInVideo.video_url}
                src={signInVideo.video_url}
                className="w-full h-64 object-cover bg-slate-800"
                controls
                autoPlay
                muted
                loop
                playsInline
                poster={signInVideo.thumbnail_url || undefined}
                onError={(e) => {
                  console.error('Video failed to load:', e);
                }}
              >
                Your browser does not support the video tag.
              </video>
              <div className="bg-slate-800/80 p-4">
                <h4 className="font-semibold text-white text-sm mb-1">{signInVideo.title}</h4>
                {signInVideo.description && (
                  <p className="text-xs text-slate-400 leading-relaxed">{signInVideo.description}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
