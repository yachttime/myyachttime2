import { useState, useEffect } from 'react';
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

type Page = 'welcome' | 'signin' | 'dashboard' | 'maintenance' | 'education' | 'staffCalendar';

function AppContent() {
  const { user, userProfile, loading, isPasswordRecovery } = useAuth();
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
