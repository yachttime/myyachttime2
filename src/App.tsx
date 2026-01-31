import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Welcome } from './components/Welcome';
import { SignIn } from './components/SignIn';
import { Dashboard } from './components/Dashboard';
import { MaintenanceRequest } from './components/MaintenanceRequest';
import { Education } from './components/Education';
import { PasswordChange } from './components/PasswordChange';
import { StaffCalendar } from './components/StaffCalendar';

type Page = 'welcome' | 'signin' | 'dashboard' | 'maintenance' | 'education' | 'staffCalendar';

function AppContent() {
  const { user, userProfile, loading } = useAuth();
  const [page, setPage] = useState<Page>('welcome');

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
      <AppContent />
    </AuthProvider>
  );
}


export default App;
