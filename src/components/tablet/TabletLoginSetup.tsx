import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface YachtRow {
  id: string;
  name: string;
}

interface CreatedLogin {
  yachtName: string;
  email: string;
  password: string;
}

export function TabletLoginSetup({ onSignOut }: { onSignOut: () => void }) {
  const [yachts, setYachts] = useState<YachtRow[]>([]);
  const [withLogin, setWithLogin] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyYachtId, setBusyYachtId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [created, setCreated] = useState<CreatedLogin | null>(null);

  const load = async () => {
    const [yachtsRes, loginsRes] = await Promise.all([
      supabase.from('yachts').select('id, name').order('name'),
      supabase.from('user_profiles').select('yacht_id').eq('role', 'tablet'),
    ]);
    if (yachtsRes.error || loginsRes.error) {
      setLoadError('Yachts could not be loaded.');
    } else {
      setLoadError('');
      setYachts((yachtsRes.data as YachtRow[]) ?? []);
      setWithLogin(new Set((loginsRes.data ?? []).map((row) => row.yacht_id).filter(Boolean)));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const createLogin = async (yacht: YachtRow) => {
    setBusyYachtId(yacht.id);
    setActionError('');
    const { data, error } = await supabase.functions.invoke('create-tablet-login', {
      body: { yacht_id: yacht.id },
    });
    setBusyYachtId(null);

    if (error || !data?.email || !data?.password) {
      setActionError(`The tablet login for ${yacht.name} could not be created. Check that it does not already exist.`);
      return;
    }
    setCreated({ yachtName: yacht.name, email: data.email, password: data.password });
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Helm Tablet Logins</h1>
            <p className="text-sm text-slate-400">Each yacht has one shared login for its helm tablets.</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>

        {created && (
          <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-5 space-y-3">
            <p className="font-semibold text-amber-300">Login created for {created.yachtName}</p>
            <p className="text-sm text-slate-300">Enter these on the helm tablet. The password will not be shown again.</p>
            <p className="text-sm">Email: <span className="font-mono break-all">{created.email}</span></p>
            <p className="text-sm">Password: <span className="font-mono break-all">{created.password}</span></p>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="text-sm text-slate-300 hover:text-white underline"
            >
              I have saved these
            </button>
          </div>
        )}

        {loadError && <p role="alert" className="text-red-400">{loadError}</p>}
        {actionError && <p role="alert" className="text-red-400">{actionError}</p>}

        {loading ? (
          <p className="text-slate-400">Loading yachts...</p>
        ) : yachts.length === 0 ? (
          <p className="text-slate-400">No yachts are set up yet.</p>
        ) : (
          <ul className="divide-y divide-slate-700 rounded-xl border border-slate-700 bg-slate-800">
            {yachts.map((yacht) => {
              const hasLogin = withLogin.has(yacht.id);
              return (
                <li key={yacht.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-medium">{yacht.name}</p>
                    <p className={`text-sm ${hasLogin ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {hasLogin ? 'Tablet login set up' : 'No tablet login yet'}
                    </p>
                  </div>
                  {!hasLogin && (
                    <button
                      type="button"
                      onClick={() => void createLogin(yacht)}
                      disabled={busyYachtId !== null}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {busyYachtId === yacht.id ? 'Creating...' : 'Create tablet login'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
