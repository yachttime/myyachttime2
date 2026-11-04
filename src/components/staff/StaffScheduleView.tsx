import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatLocalDate, startOfWeek, addDays, formatShortTime } from './staffDates';

type Person = { user_id: string; first_name: string | null; last_name: string | null };
type Shift = { user_id: string; day_of_week: number; start_time: string; end_time: string };
type Override = { user_id: string; override_date: string; status: 'approved_day_off' | 'sick_leave' | 'working'; start_time: string | null; end_time: string | null };
type TimeOff = { user_id: string; start_date: string; end_date: string; time_off_type: string; is_partial_day: boolean; start_time: string | null; end_time: string | null };

type TeamSchedule = { people: Person[]; shifts: Shift[]; overrides: Override[]; time_off: TimeOff[] };

type DayEntry =
  | { kind: 'working'; name: string; detail: string }
  | { kind: 'off'; name: string; detail: string };

const TIME_OFF_LABELS: Record<string, string> = { vacation: 'Vacation', personal_day: 'Personal day' };

function buildDayEntries(schedule: TeamSchedule, dateStr: string, dayOfWeek: number): DayEntry[] {
  return schedule.people.map((person): DayEntry => {
    const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Team member';
    const timeOff = schedule.time_off.find(t =>
      t.user_id === person.user_id && t.start_date <= dateStr && t.end_date >= dateStr
    );
    const override = schedule.overrides.find(o => o.user_id === person.user_id && o.override_date === dateStr);

    if (timeOff && !timeOff.is_partial_day) {
      return { kind: 'off', name, detail: TIME_OFF_LABELS[timeOff.time_off_type] ?? 'Time off' };
    }
    if (override?.status === 'sick_leave') {
      return { kind: 'off', name, detail: 'Sick' };
    }
    if (override?.status === 'approved_day_off') {
      return { kind: 'off', name, detail: 'Day off' };
    }
    if (override?.status === 'working' && override.start_time && override.end_time) {
      return { kind: 'working', name, detail: `${formatShortTime(override.start_time)} - ${formatShortTime(override.end_time)}` };
    }
    const shift = schedule.shifts.find(s => s.user_id === person.user_id && s.day_of_week === dayOfWeek);
    if (override?.status !== 'working' && shift) {
      const partial = timeOff?.is_partial_day && timeOff.start_time && timeOff.end_time
        ? ` (off ${formatShortTime(timeOff.start_time)} - ${formatShortTime(timeOff.end_time)})`
        : '';
      return { kind: 'working', name, detail: `${formatShortTime(shift.start_time)} - ${formatShortTime(shift.end_time)}${partial}` };
    }
    if (override?.status === 'working') {
      return { kind: 'working', name, detail: 'Working' };
    }
    return { kind: 'off', name, detail: 'Off' };
  });
}

export function StaffScheduleView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [schedule, setSchedule] = useState<TeamSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('get_team_schedule', {
      p_start: formatLocalDate(weekStart),
      p_end: formatLocalDate(addDays(weekStart, 6)),
    });
    if (rpcError || !data || !Array.isArray((data as TeamSchedule).people)) {
      setError('Could not load the schedule. Please try again.');
      setSchedule(null);
    } else {
      setSchedule(data as TeamSchedule);
    }
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const weekLabel = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          aria-label="Previous week"
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="font-semibold">Team schedule</h2>
          <p className="text-xs text-slate-400">{weekLabel}</p>
        </div>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          aria-label="Next week"
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading && <p className="text-center text-slate-400 text-sm py-8">Loading schedule...</p>}

      {!loading && error && (
        <div className="space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors">
            Retry
          </button>
        </div>
      )}

      {!loading && schedule && days.map(day => {
        const dateStr = formatLocalDate(day);
        const entries = buildDayEntries(schedule, dateStr, day.getDay());
        const working = entries.filter(e => e.kind === 'working');
        const off = entries.filter(e => e.kind === 'off' && e.detail !== 'Off');
        const isToday = formatLocalDate(new Date()) === dateStr;
        return (
          <section key={dateStr} className={`rounded-xl border p-4 ${isToday ? 'border-amber-500/50 bg-slate-800' : 'border-slate-800 bg-slate-800/60'}`}>
            <h3 className="font-semibold mb-2">
              {day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              {isToday && <span className="ml-2 text-xs text-amber-400">Today</span>}
            </h3>
            {working.length === 0 && off.length === 0 && <p className="text-sm text-slate-500">Nothing scheduled</p>}
            <ul className="space-y-1.5 text-sm">
              {working.map(e => (
                <li key={`w-${e.name}`} className="flex justify-between gap-3">
                  <span>{e.name}</span>
                  <span className="text-slate-300 whitespace-nowrap">{e.detail}</span>
                </li>
              ))}
              {off.map(e => (
                <li key={`o-${e.name}`} className="flex justify-between gap-3 text-slate-400">
                  <span>{e.name}</span>
                  <span className="whitespace-nowrap">{e.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
