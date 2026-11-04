import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatLocalDate } from './staffDates';

type TimeOffRow = {
  id: string;
  start_date: string;
  end_date: string;
  time_off_type: string;
  reason: string | null;
  status: string;
};

const TYPE_OPTIONS = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'personal_day', label: 'Personal day' },
];

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-500/15 text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-300',
  denied: 'bg-red-500/15 text-red-300',
};

const inputClass = 'w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-3 text-white focus:outline-none focus:border-amber-500';

export function StaffTimeOffView() {
  const { user } = useAuth();
  const today = formatLocalDate(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [timeOffType, setTimeOffType] = useState('vacation');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [requests, setRequests] = useState<TimeOffRow[]>([]);
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(true);

  const loadRequests = async () => {
    if (!user) return;
    setListLoading(true);
    setListError('');
    const { data, error } = await supabase
      .from('staff_time_off_requests')
      .select('id, start_date, end_date, time_off_type, reason, status')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });
    if (error || !data) {
      setListError('Could not load your requests.');
    } else {
      setRequests(data as TimeOffRow[]);
    }
    setListLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (endDate < startDate) {
      setFormError('The end date must be on or after the start date.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    setSuccessMessage('');
    const { error } = await supabase.from('staff_time_off_requests').insert({
      user_id: user.id,
      start_date: startDate,
      end_date: endDate,
      time_off_type: timeOffType,
      is_partial_day: false,
      reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setFormError('Could not submit your request. Please try again.');
      return;
    }
    setReason('');
    setSuccessMessage('Request submitted. You will see the status here once it is reviewed.');
    loadRequests();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-slate-800/60 border border-slate-800 p-4">
        <h2 className="font-semibold">Request time off</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-400">From</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} required />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">To</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} required />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-400">Type</span>
          <select value={timeOffType} onChange={e => setTimeOffType(e.target.value)} className={inputClass}>
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Note (optional)</span>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className={inputClass} />
        </label>
        {formError && <p className="text-red-400 text-sm">{formError}</p>}
        {successMessage && <p className="text-emerald-400 text-sm">{successMessage}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit request'}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">My requests</h2>
        {listLoading && <p className="text-slate-400 text-sm">Loading...</p>}
        {!listLoading && listError && (
          <div className="space-y-2">
            <p className="text-red-400 text-sm">{listError}</p>
            <button onClick={loadRequests} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors">Retry</button>
          </div>
        )}
        {!listLoading && !listError && requests.length === 0 && (
          <p className="text-slate-500 text-sm">You have not requested any time off yet.</p>
        )}
        <ul className="space-y-2">
          {requests.map(r => (
            <li key={r.id} className="rounded-lg bg-slate-800/60 border border-slate-800 p-3 flex items-start justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium">{r.start_date === r.end_date ? r.start_date : `${r.start_date} to ${r.end_date}`}</p>
                <p className="text-slate-400">{TYPE_OPTIONS.find(o => o.value === r.time_off_type)?.label ?? 'Time off'}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? 'bg-slate-700 text-slate-300'}`}>
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
