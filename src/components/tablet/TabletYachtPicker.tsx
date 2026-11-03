import { useEffect, useState } from 'react';
import { supabase, Yacht } from '../../lib/supabase';

export function TabletYachtPicker({ onSelect, onSignOut }: { onSelect: (yacht: Yacht) => void; onSignOut: () => void }) {
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('yachts')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (cancelled) return;
      if (error) {
        setLoadError('Yachts could not be loaded. Try again.');
      } else {
        setYachts((data as Yacht[]) ?? []);
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Choose a Yacht</h1>
            <p className="text-sm text-slate-400">Pick the yacht this helm tablet is on.</p>
          </div>
          <button
            type="button"
            onClick={() => onSignOut()}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>

        {loadError && <p role="alert" className="text-red-400">{loadError}</p>}

        {loading ? (
          <p className="text-slate-400">Loading yachts...</p>
        ) : yachts.length === 0 && !loadError ? (
          <p className="text-slate-400">No yachts are set up yet.</p>
        ) : (
          <ul className="divide-y divide-slate-700 rounded-xl border border-slate-700 bg-slate-800">
            {yachts.map((yacht) => (
              <li key={yacht.id}>
                <button
                  type="button"
                  onClick={() => onSelect(yacht)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-700/60 transition-colors"
                >
                  <span className="font-medium">{yacht.name}</span>
                  <span className="text-sm text-amber-400">Open</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
