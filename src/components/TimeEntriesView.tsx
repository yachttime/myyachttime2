import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertCircle, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  groupEntriesByDate,
  formatTime,
  formatDuration,
  calculatePayrollSummary,
  TimeEntry,
  DailyTimeEntry
} from '../utils/timeClockHelpers';

interface TimeEntriesViewProps {
  userId?: string;
  onEditEntry?: (entry: TimeEntry) => void;
  showEditButton?: boolean;
}

export function TimeEntriesView({ userId, onEditEntry, showEditButton = false }: TimeEntriesViewProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('week');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [yachtNames, setYachtNames] = useState<Record<string, string>>({});

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      loadEntries();
      loadYachtNames();
    }
  }, [targetUserId, dateRange]);

  const loadYachtNames = async () => {
    const { data } = await supabase
      .from('yachts')
      .select('id, name');

    if (data) {
      const names: Record<string, string> = {};
      data.forEach(yacht => {
        names[yacht.id] = yacht.name;
      });
      setYachtNames(names);
    }
  };

  const loadEntries = async () => {
    if (!targetUserId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('staff_time_entries')
        .select('*')
        .eq('user_id', targetUserId)
        .order('punch_in_time', { ascending: false });

      if (dateRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('punch_in_time', weekAgo.toISOString());
      } else if (dateRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte('punch_in_time', monthAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      setEntries(data || []);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const dailyEntries = groupEntriesByDate(entries);
  const summary = calculatePayrollSummary(entries);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Time Entries</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setDateRange('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              dateRange === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              dateRange === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setDateRange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              dateRange === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-blue-600 font-medium">Total Hours</div>
              <div className="text-2xl font-bold text-blue-900">{summary.totalHours}</div>
            </div>
            <div>
              <div className="text-sm text-blue-600 font-medium">Standard Hours</div>
              <div className="text-2xl font-bold text-blue-900">{summary.totalStandardHours}</div>
            </div>
            <div>
              <div className="text-sm text-orange-600 font-medium">Overtime Hours</div>
              <div className="text-2xl font-bold text-orange-900">{summary.totalOvertimeHours}</div>
            </div>
            <div>
              <div className="text-sm text-blue-600 font-medium">Days Worked</div>
              <div className="text-2xl font-bold text-blue-900">{summary.dayCount}</div>
            </div>
          </div>
        </div>
      )}

      {dailyEntries.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No time entries found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dailyEntries.map((day) => (
            <div key={day.date} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleDate(day.date)}
                className="w-full bg-gray-50 hover:bg-gray-100 px-4 py-3 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">{day.date}</div>
                    <div className="text-sm text-gray-600">
                      {day.entries.length} {day.entries.length === 1 ? 'entry' : 'entries'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Total</div>
                    <div className="font-bold text-gray-900">
                      {formatDuration(day.totalHours)}
                    </div>
                  </div>
                  {day.overtimeHours > 0 && (
                    <div className="text-right">
                      <div className="text-sm text-orange-600">OT</div>
                      <div className="font-bold text-orange-900">
                        {formatDuration(day.overtimeHours)}
                      </div>
                    </div>
                  )}
                  {expandedDates.has(day.date) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedDates.has(day.date) && (
                <div className="bg-white divide-y divide-gray-100">
                  {day.entries.map((entry) => (
                    <div key={entry.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <div className="font-medium text-gray-900">
                              {formatTime(entry.punch_in_time)}
                              {entry.punch_out_time ? (
                                <> - {formatTime(entry.punch_out_time)}</>
                              ) : (
                                <span className="ml-2 text-green-600 text-sm">(Active)</span>
                              )}
                            </div>
                          </div>

                          {entry.yacht_id && yachtNames[entry.yacht_id] && (
                            <div className="text-sm text-gray-600 ml-7 mb-1">
                              Yacht: {yachtNames[entry.yacht_id]}
                            </div>
                          )}

                          {entry.lunch_break_start && entry.lunch_break_end && (
                            <div className="text-sm text-orange-600 ml-7 mb-1">
                              Lunch: {formatTime(entry.lunch_break_start)} -{' '}
                              {formatTime(entry.lunch_break_end)}
                            </div>
                          )}

                          {entry.notes && (
                            <div className="text-sm text-gray-600 ml-7 mb-1">
                              {entry.notes}
                            </div>
                          )}

                          {entry.is_edited && (
                            <div className="flex items-center gap-1 text-xs text-orange-600 ml-7">
                              <AlertCircle className="w-3 h-3" />
                              <span>Edited by admin</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right ml-4">
                          {entry.punch_out_time && (
                            <>
                              <div className="font-bold text-gray-900">
                                {formatDuration(entry.total_hours)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Std: {formatDuration(entry.standard_hours)}
                              </div>
                              {entry.overtime_hours > 0 && (
                                <div className="text-xs text-orange-600">
                                  OT: {formatDuration(entry.overtime_hours)}
                                </div>
                              )}
                            </>
                          )}
                          {showEditButton && onEditEntry && (
                            <button
                              onClick={() => onEditEntry(entry)}
                              className="mt-2 p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit entry"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
