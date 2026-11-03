import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Yacht } from '../../lib/supabase';
import { TabletSignIn } from './TabletSignIn';
import { TabletScreen } from './TabletScreen';
import { TabletYachtPicker } from './TabletYachtPicker';

function TabletMessage({ title, body, onSignOut }: { title: string; body: string; onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-slate-400">{body}</p>
        <button
          type="button"
          onClick={() => onSignOut()}
          className="px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function TabletApp() {
  const { user, userProfile, signOut } = useAuth();
  const [selectedYacht, setSelectedYacht] = useState<Yacht | null>(null);

  if (!user) return <TabletSignIn />;

  if (!userProfile) {
    return (
      <TabletMessage
        title="Could not load your profile"
        body="Sign out and sign in again. If this keeps happening, tell the office."
        onSignOut={() => void signOut()}
      />
    );
  }

  if (userProfile.role !== 'master') {
    return (
      <TabletMessage
        title="Only a master can use the helm tablet"
        body="Sign out and sign in with your master account."
        onSignOut={() => void signOut()}
      />
    );
  }

  if (!selectedYacht) {
    return <TabletYachtPicker onSelect={setSelectedYacht} onSignOut={() => void signOut()} />;
  }

  return (
    <>
      <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium truncate">{selectedYacht.name}</span>
          <span className="text-xs text-slate-400 truncate">Powered by Myyachttime</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedYacht(null)}
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            Change yacht
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-slate-300 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
      <TabletScreen yacht={selectedYacht} tabletUserId={user.id} />
    </>
  );
}
