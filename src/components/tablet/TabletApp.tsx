import { useAuth } from '../../contexts/AuthContext';
import { TabletSignIn } from './TabletSignIn';
import { TabletScreen } from './TabletScreen';
import { TabletLoginSetup } from './TabletLoginSetup';

function TabletMessage({ title, body, onSignOut }: { title: string; body: string; onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-slate-400">{body}</p>
        <button
          type="button"
          onClick={onSignOut}
          className="px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function TabletApp() {
  const { user, userProfile, yacht, signOut } = useAuth();

  if (!user) return <TabletSignIn />;

  if (!userProfile) {
    return (
      <TabletMessage
        title="Could not load the tablet profile"
        body="Sign out and sign in again. If this keeps happening, tell the office."
        onSignOut={signOut}
      />
    );
  }

  if (userProfile.role === 'master') {
    return <TabletLoginSetup onSignOut={signOut} />;
  }

  if (userProfile.role !== 'tablet') {
    return (
      <TabletMessage
        title="This page is for the helm tablet"
        body="Sign out here and use the normal YachtTime sign-in instead."
        onSignOut={signOut}
      />
    );
  }

  if (!yacht) {
    return (
      <TabletMessage
        title="This tablet is not linked to a yacht"
        body="Ask the office to check the tablet login."
        onSignOut={signOut}
      />
    );
  }

  return <TabletScreen yacht={yacht} tabletUserId={user.id} />;
}
