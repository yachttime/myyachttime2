import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { RoleImpersonationProvider } from './contexts/RoleImpersonationContext';
import { YachtImpersonationProvider } from './contexts/YachtImpersonationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Welcome } from './components/Welcome';
import { SignIn } from './components/SignIn';
import { Dashboard } from './components/Dashboard';
import { MaintenanceRequest } from './components/MaintenanceRequest';
import { Education } from './components/Education';
import { PasswordChange } from './components/PasswordChange';
import { StaffCalendar } from './components/StaffCalendar';
import { PublicAgreementSigner } from './components/PublicAgreementSigner';

function ProfileLoadFallback({ onSignOut, onRetry }: { onSignOut: () => void; onRetry: () => Promise<void> }) {
  const [countdown, setCountdown] = useState(8);
  const [retrying, setRetrying] = useState(false);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (countdown <= 0) {
      handleRetry();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleRetry = async () => {
    if (retrying) return;
    attemptRef.current += 1;
    setRetrying(true);
    try {
      await onRetry();
    } catch {}
    setRetrying(false);
    setCountdown(10);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          {retrying ? (
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
          ) : (
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Connecting to server...</h2>
        <p className="text-slate-400 text-sm mb-2">
          {retrying ? 'Retrying...' : `Retrying automatically in ${countdown}s`}
        </p>
        {attemptRef.current > 0 && (
          <p className="text-slate-500 text-xs mb-6">Attempt {attemptRef.current + 1} — server may be temporarily slow</p>
        )}
        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {retrying ? 'Retrying...' : 'Retry Now'}
          </button>
          <button onClick={onSignOut} className="px-6 py-3 text-slate-400 hover:text-white transition-colors text-sm">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// Check for public signing token before any auth logic
const _signingToken = new URLSearchParams(window.location.search).get('sign');

type Page = 'welcome' | 'signin' | 'dashboard' | 'maintenance' | 'education' | 'staffCalendar';

function AppContent() {
  const { user, userProfile, loading, isPasswordRecovery, signOut } = useAuth();
  const [page, setPage] = useState<Page>('welcome');
  const [mounted, setMounted] = useState(false);

  // Handle yacht QR code from URL parameter BEFORE routing
  useEffect(() => {
    const handleYachtQRParameter = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const yachtId = params.get('yacht');

        // Never strip the URL if it contains a Supabase auth code or recovery params
        const hasAuthCode = params.has('code') || params.has('token') ||
          window.location.hash.includes('type=recovery') ||
          window.location.hash.includes('access_token');

        if (yachtId) {
          localStorage.setItem('qr_scanned_yacht_id', yachtId);
          setPage('welcome');

          if (!hasAuthCode) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      } catch (error) {
        console.error('[App QR] Error handling yacht QR parameter:', error);
      }
    };

    handleYachtQRParameter();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Initializing...</p>
        </div>
      </div>
    );
  }

  // Public signing route — no auth required
  if (_signingToken) {
    return <PublicAgreementSigner token={_signingToken} />;
  }

  if (isPasswordRecovery) {
    if (loading || !user) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      );
    }
    return <PasswordChange />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (page === 'welcome') {
      return <Welcome onGetStarted={() => setPage('signin')} />;
    }
    return <SignIn />;
  }

  // User is authenticated but profile failed to load — auto-retry
  if (!userProfile) {
    return <ProfileLoadFallback onSignOut={signOut} onRetry={refreshProfile} />;
  }

  if (userProfile?.must_change_password) {
    return <PasswordChange />;
  }

  if (page === 'maintenance') {
    return <MaintenanceRequest onBack={() => setPage('dashboard')} />;
  }

  if (page === 'education') {
    return <Education onBack={() => setPage('dashboard')} />;
  }

  if (page === 'staffCalendar') {
    return <StaffCalendar onBack={() => setPage('dashboard')} />;
  }

  return <Dashboard onNavigate={(newPage) => setPage(newPage)} />;
}

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <NotificationProvider>
          <RoleImpersonationProvider>
            <YachtImpersonationProvider>
              <AppContent />
            </YachtImpersonationProvider>
          </RoleImpersonationProvider>
        </NotificationProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}


export default App;
