import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CreditCard as Edit2, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatTime, TimeEntry } from '../utils/timeClockHelpers';
import { TimeEntryEditor } from './TimeEntryEditor';

interface TimecardViewProps {
  userId?: string;
  userName?: string;
}

interface DayRow {
  label: string;
  date: Date;
  dateStr: string;
  entry: TimeEntry | null;
  isMissedPunchOut: boolean;
}

interface WeekBlock {
  label: string;
  days: DayRow[];
  totalHours: number;
  standardHours: number;
  overtimeHours: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getPayPeriodBounds(referenceDate: Date): { start: Date; end: Date } {
  const d = referenceDate.getDate();
  const m = referenceDate.getMonth();
  const y = referenceDate.getFullYear();

  if (d <= 11) {
    const prevMonth = m === 0 ? 11 : m - 1;
    const prevYear = m === 0 ? y - 1 : y;
    return {
      start: new Date(prevYear, prevMonth, 27),
      end: new Date(y, m, 11)
    };
  } else {
    return {
      start: new Date(y, m, 12),
      end: new Date(y, m, 26)
    };
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatHours(h: number): string {
  if (h === 0) return '0.00';
  return h.toFixed(2);
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

export function TimecardView({ userId, userName }: TimecardViewProps) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  const [periodStart, setPeriodStart] = useState<Date>(() => {
    const { start } = getPayPeriodBounds(new Date());
    return start;
  });
  const [periodEnd, setPeriodEnd] = useState<Date>(() => {
    const { end } = getPayPeriodBounds(new Date());
    return end;
  });

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadEntries = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const startISO = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate(), 0, 0, 0).toISOString();
      const endISO = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate(), 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('staff_time_entries')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('punch_in_time', startISO)
        .lte('punch_in_time', endISO)
        .order('punch_in_time', { ascending: true });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error('Error loading timecard entries:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, periodStart, periodEnd, refreshKey]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const goToPrevPeriod = () => {
    const newEnd = addDays(periodStart, -1);
    const { start, end } = getPayPeriodBounds(newEnd);
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const goToNextPeriod = () => {
    const newStart = addDays(periodEnd, 1);
    const { start, end } = getPayPeriodBounds(newStart);
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const goToCurrentPeriod = () => {
    const { start, end } = getPayPeriodBounds(new Date());
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const entriesByDate = new Map<string, TimeEntry[]>();
  entries.forEach(e => {
    const ds = toDateStr(new Date(e.punch_in_time));
    if (!entriesByDate.has(ds)) entriesByDate.set(ds, []);
    entriesByDate.get(ds)!.push(e);
  });

  const buildWeeks = (): WeekBlock[] => {
    const weeks: WeekBlock[] = [];
    let current = new Date(periodStart);
    let weekNum = 1;

    while (current <= periodEnd) {
      const days: DayRow[] = [];
      for (let i = 0; i < 7; i++) {
        if (current > periodEnd) break;
        const ds = toDateStr(current);
        const dayEntries = entriesByDate.get(ds) || [];
        const entry = dayEntries[0] || null;
        days.push({
          label: DAY_LABELS[current.getDay()],
          date: new Date(current),
          dateStr: ds,
          entry,
          isMissedPunchOut: !!entry && !entry.punch_out_time
        });
        current = addDays(current, 1);
      }

      const totalHours = days.reduce((s, d) => s + (d.entry?.total_hours || 0), 0);
      const standardHours = days.reduce((s, d) => s + (d.entry?.standard_hours || 0), 0);
      const overtimeHours = days.reduce((s, d) => s + (d.entry?.overtime_hours || 0), 0);

      weeks.push({
        label: `Week ${weekNum}`,
        days,
        totalHours,
        standardHours,
        overtimeHours
      });
      weekNum++;
    }
    return weeks;
  };

  const weeks = buildWeeks();

  const periodTotalHours = weeks.reduce((s, w) => s + w.totalHours, 0);
  const periodStandardHours = weeks.reduce((s, w) => s + w.standardHours, 0);
  const periodOvertimeHours = weeks.reduce((s, w) => s + w.overtimeHours, 0);

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry);
  };

  const handleAddEntry = (dateStr: string) => {
    setAddingForDate(dateStr);
  };

  const handleSave = () => {
    setEditingEntry(null);
    setAddingForDate(null);
    setRefreshKey(k => k + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPeriod}
            className="p-2 rounded-lg border border-gray-400 bg-white hover:bg-gray-100 transition-colors"
            title="Previous pay period"
          >
            <ChevronLeft className="w-4 h-4 text-gray-800" />
          </button>
          <div className="text-sm font-bold text-white min-w-[200px] text-center">
            {formatDateLabel(periodStart)} &ndash; {formatDateLabel(periodEnd)}
          </div>
          <button
            onClick={goToNextPeriod}
            className="p-2 rounded-lg border border-gray-400 bg-white hover:bg-gray-100 transition-colors"
            title="Next pay period"
          >
            <ChevronRight className="w-4 h-4 text-gray-800" />
          </button>
          <button
            onClick={goToCurrentPeriod}
            className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Current Period
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-400 bg-white rounded-lg hover:bg-gray-100 transition-colors text-gray-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {userName && (
        <div className="text-sm font-semibold text-gray-300">
          Viewing timecard for <span className="font-bold text-blue-400">{userName}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm bg-white">
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-12" />
            <col className="w-24" />
            <col className="w-44" />
            <col className="w-28" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr className="bg-gray-200 border-b-2 border-gray-300">
              <th className="px-3 py-2.5 text-left font-bold text-gray-700 text-xs uppercase tracking-wide"></th>
              <th className="px-3 py-2.5 text-left font-bold text-gray-700 text-xs uppercase tracking-wide">Date</th>
              <th className="px-3 py-2.5 text-left font-bold text-gray-700 text-xs uppercase tracking-wide">In &ndash; Out</th>
              <th className="px-3 py-2.5 text-left font-bold text-gray-700 text-xs uppercase tracking-wide">Lunch</th>
              <th className="px-3 py-2.5 text-right font-bold text-gray-700 text-xs uppercase tracking-wide">Hours</th>
              <th className="px-3 py-2.5 text-right font-bold text-gray-700 text-xs uppercase tracking-wide">Regular</th>
              <th className="px-3 py-2.5 text-right font-bold text-gray-700 text-xs uppercase tracking-wide">OT</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <React.Fragment key={wi}>
                <tr className="bg-gray-100 border-t-2 border-b border-gray-300">
                  <td colSpan={7} className="px-3 py-2 font-bold text-gray-800 text-xs uppercase tracking-wide">
                    {week.label}
                  </td>
                </tr>

                {week.days.map((day, di) => {
                  const isToday = toDateStr(new Date()) === day.dateStr;
                  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

                  return (
                    <tr
                      key={di}
                      className={`border-b border-gray-200 transition-colors group ${
                        isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-semibold text-gray-600 text-xs">
                        {day.label}
                      </td>
                      <td className="px-3 py-2.5 text-gray-800 text-xs font-semibold">
                        {day.date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                      </td>
                      <td className="px-3 py-2.5">
                        {day.entry ? (
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-xs ${day.isMissedPunchOut ? 'text-amber-700' : 'text-gray-900'}`}>
                              {formatTime(day.entry.punch_in_time)}
                              {' \u2013 '}
                              {day.entry.punch_out_time ? (
                                formatTime(day.entry.punch_out_time)
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                                  <AlertCircle className="w-3 h-3" />
                                  Missing
                                </span>
                              )}
                            </span>
                            {day.entry.is_edited && (
                              <span className="text-[10px] text-orange-700 font-bold bg-orange-100 border border-orange-300 px-1.5 py-0.5 rounded">
                                Edited
                              </span>
                            )}
                            <button
                              onClick={() => handleEditEntry(day.entry!)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-blue-100 text-blue-700 transition-all ml-auto"
                              title="Edit this entry"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs font-medium">&ndash;</span>
                            <button
                              onClick={() => handleAddEntry(day.dateStr)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-green-100 text-green-700 transition-all ml-auto flex items-center gap-1 text-[11px] font-semibold"
                              title="Add time entry"
                            >
                              <Plus className="w-3 h-3" />
                              Add
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 font-medium">
                        {day.entry?.lunch_break_start && day.entry?.lunch_break_end ? (
                          <span>
                            {formatTime(day.entry.lunch_break_start)} &ndash; {formatTime(day.entry.lunch_break_end)}
                          </span>
                        ) : (
                          <span className="text-gray-400">&ndash;</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-800">
                        {day.entry?.punch_out_time ? formatHours(day.entry.total_hours) : (
                          <span className="text-gray-400 font-normal">0.00</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700">
                        {day.entry?.punch_out_time ? formatHours(day.entry.standard_hours) : (
                          <span className="text-gray-400 font-normal">0.00</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        {day.entry?.overtime_hours && day.entry.overtime_hours > 0 ? (
                          <span className="font-bold text-orange-700">{formatHours(day.entry.overtime_hours)}</span>
                        ) : (
                          <span className="text-gray-400">0.00</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                <tr className="bg-gray-200 border-t border-b-2 border-gray-300">
                  <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    {week.label} Totals
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">
                    {formatHours(week.totalHours)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">
                    {formatHours(week.standardHours)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-orange-700">
                    {week.overtimeHours > 0 ? formatHours(week.overtimeHours) : (
                      <span className="text-gray-500 font-normal">0.00</span>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            ))}

            <tr className="bg-blue-700 border-t-2 border-blue-800">
              <td colSpan={4} className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wide">
                Pay Period Total
              </td>
              <td className="px-3 py-3 text-right text-sm font-bold text-white">
                {formatHours(periodTotalHours)}
              </td>
              <td className="px-3 py-3 text-right text-sm font-bold text-white">
                {formatHours(periodStandardHours)}
              </td>
              <td className="px-3 py-3 text-right text-sm font-bold text-yellow-300">
                {formatHours(periodOvertimeHours)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-300 font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-400"></div>
          Today
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          Missing punch out
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-orange-700 font-bold bg-orange-100 px-1.5 py-0.5 rounded border border-orange-300">Edited</span>
          Admin edited
        </div>
      </div>

      {editingEntry && (
        <TimeEntryEditor
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={handleSave}
        />
      )}

      {addingForDate && (
        <AddEntryModal
          dateStr={addingForDate}
          userId={targetUserId!}
          onClose={() => setAddingForDate(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

interface AddEntryModalProps {
  dateStr: string;
  userId: string;
  onClose: () => void;
  onSave: () => void;
}

function AddEntryModal({ dateStr, userId, onClose, onSave }: AddEntryModalProps) {
  const { user } = useAuth();
  const [punchInTime, setPunchInTime] = useState('08:00');
  const [punchOutTime, setPunchOutTime] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const displayDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const handleSave = async () => {
    if (!editReason.trim()) {
      setError('Please provide a reason for adding this entry');
      return;
    }
    if (!punchInTime || !punchOutTime) {
      setError('Punch in and punch out times are required');
      return;
    }

    const punchIn = new Date(`${dateStr}T${punchInTime}`);
    const punchOut = new Date(`${dateStr}T${punchOutTime}`);

    if (punchOut <= punchIn) {
      setError('Punch out must be after punch in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const diffMs = punchOut.getTime() - punchIn.getTime();
      const totalHours = diffMs / (1000 * 60 * 60);
      const standardHours = Math.min(totalHours, 8);
      const overtimeHours = Math.max(0, totalHours - 8);

      const { error: insertError } = await supabase
        .from('staff_time_entries')
        .insert({
          user_id: userId,
          punch_in_time: punchIn.toISOString(),
          punch_out_time: punchOut.toISOString(),
          total_hours: Math.round(totalHours * 100) / 100,
          standard_hours: Math.round(standardHours * 100) / 100,
          overtime_hours: Math.round(overtimeHours * 100) / 100,
          notes: notes || null,
          is_edited: true,
          edited_by: user?.id,
          edited_at: new Date().toISOString(),
          edit_reason: editReason
        });

      if (insertError) throw insertError;
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to add entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Add Time Entry</h2>
            <p className="text-sm text-gray-500 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Punch In</label>
              <input
                type="time"
                value={punchInTime}
                onChange={e => setPunchInTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Punch Out</label>
              <input
                type="time"
                value={punchOutTime}
                onChange={e => setPunchOutTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Reason for Adding <span className="text-red-500">*</span>
            </label>
            <textarea
              value={editReason}
              onChange={e => setEditReason(e.target.value)}
              rows={2}
              placeholder="Explain why you are manually adding this entry..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Add Entry
          </button>
        </div>
      </div>
    </div>
  );
}
