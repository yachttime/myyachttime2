import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type HistoryRow = {
  id: string;
  punch_in_time: string;
  punch_out_time: string | null;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  total_hours: number | null;
};

const dateFormat: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
const timeFormat: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

function formatLunch(start: string | null, end: string | null): string {
  if (!start) return '-';
  const startText = new Date(start).toLocaleTimeString(undefined, timeFormat);
  if (!end) return `${startText} (in progress)`;
  return `${startText} - ${new Date(end).toLocaleTimeString(undefined, timeFormat)}`;
}

export function StaffHistoryView() {
  const { user } = useAuth();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('staff_time_entries')
      .select('id, punch_in_time, punch_out_time, lunch_break_start, lunch_break_end, total_hours')
      .eq('user_id', user.id)
      .order('punch_in_time', { ascending: false });
    if (queryError || !data) {
      setError('Could not load your history.');
    } else {
      setRows(data as HistoryRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  if (loading) return <p className="text-center text-slate-400 text-sm py-8">Loading history...</p>;

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors">Retry</button>
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-center text-slate-500 text-sm py-8">No clock entries yet.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">My hours</h2>
      <ul className="space-y-2">
        {rows.map(row => {
          const punchIn = new Date(row.punch_in_time);
          return (
            <li key={row.id} className="rounded-lg bg-slate-800/60 border border-slate-800 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-medium">{punchIn.toLocaleDateString(undefined, dateFormat)}</p>
                <p className="text-amber-400 font-semibold">
                  {row.total_hours != null ? `${Number(row.total_hours).toFixed(2)} h` : 'Open'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-300">
                <span className="text-slate-400">In</span>
                <span>{punchIn.toLocaleTimeString(undefined, timeFormat)}</span>
                <span className="text-slate-400">Out</span>
                <span>{row.punch_out_time ? new Date(row.punch_out_time).toLocaleTimeString(undefined, timeFormat) : 'Still clocked in'}</span>
                <span className="text-slate-400">Lunch</span>
                <span>{formatLunch(row.lunch_break_start, row.lunch_break_end)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
