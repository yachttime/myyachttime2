import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Coffee, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { calculateElapsedTime, formatTime, getClientIP } from '../utils/timeClockHelpers';

interface TimeEntry {
  id: string;
  punch_in_time: string;
  punch_out_time: string | null;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  total_hours: number;
  yacht_id: string | null;
  notes: string | null;
}

interface UserProfile {
  employee_type: 'hourly' | 'salary';
}

export function TimeClockPanel() {
  const { user, userProfile } = useAuth();
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [elapsedTime, setElapsedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user) {
      loadCurrentEntry();
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (currentEntry && !currentEntry.punch_out_time) {
      const interval = setInterval(() => {
        setElapsedTime(calculateElapsedTime(currentEntry.punch_in_time));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentEntry]);

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('employee_type')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const loadCurrentEntry = async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('staff_time_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('punch_in_time', today.toISOString())
      .is('punch_out_time', null)
      .order('punch_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error loading current entry:', error);
      return;
    }

    setCurrentEntry(data);
    if (data) {
      setNotes(data.notes || '');
    }
  };

  const handlePunchIn = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_time_entries')
        .insert({
          user_id: user.id,
          yacht_id: null,
          punch_in_time: new Date().toISOString(),
          notes: notes || null,
          punch_in_ip: getClientIP()
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentEntry(data);
      showMessage('success', 'Punched in successfully');
    } catch (error) {
      console.error('Error punching in:', error);
      showMessage('error', 'Failed to punch in');
    } finally {
      setLoading(false);
    }
  };

  const handlePunchOut = async () => {
    if (!currentEntry) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff_time_entries')
        .update({
          punch_out_time: new Date().toISOString(),
          notes: notes || null,
          punch_out_ip: getClientIP()
        })
        .eq('id', currentEntry.id);

      if (error) throw error;

      setCurrentEntry(null);
      setNotes('');
      showMessage('success', 'Punched out successfully');
    } catch (error) {
      console.error('Error punching out:', error);
      showMessage('error', 'Failed to punch out');
    } finally {
      setLoading(false);
    }
  };

  const handleStartLunch = async () => {
    if (!currentEntry) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff_time_entries')
        .update({
          lunch_break_start: new Date().toISOString()
        })
        .eq('id', currentEntry.id);

      if (error) throw error;

      await loadCurrentEntry();
      showMessage('success', 'Lunch break started');
    } catch (error) {
      console.error('Error starting lunch:', error);
      showMessage('error', 'Failed to start lunch break');
    } finally {
      setLoading(false);
    }
  };

  const handleEndLunch = async () => {
    if (!currentEntry) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff_time_entries')
        .update({
          lunch_break_end: new Date().toISOString()
        })
        .eq('id', currentEntry.id);

      if (error) throw error;

      await loadCurrentEntry();
      showMessage('success', 'Lunch break ended');
    } catch (error) {
      console.error('Error ending lunch:', error);
      showMessage('error', 'Failed to end lunch break');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const isHourlyEmployee = profile?.employee_type === 'hourly';
  const isPunchedIn = currentEntry && !currentEntry.punch_out_time;
  const isOnLunch = currentEntry?.lunch_break_start && !currentEntry.lunch_break_end;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-amber-500">Time Clock</h2>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {isPunchedIn ? (
        <div className="space-y-6">
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
            <div className="text-green-800 font-semibold mb-2">Currently Clocked In</div>
            <div className="text-4xl font-bold text-green-900 mb-2">{elapsedTime}</div>
            <div className="text-sm text-green-700">
              Started at {formatTime(currentEntry.punch_in_time)}
            </div>
            {isOnLunch && (
              <div className="mt-3 text-orange-700 font-semibold flex items-center justify-center gap-2">
                <Coffee className="w-4 h-4" />
                On Lunch Break
              </div>
            )}
          </div>

          {isHourlyEmployee && (
            <div className="flex gap-3">
              {!currentEntry.lunch_break_start ? (
                <button
                  onClick={handleStartLunch}
                  disabled={loading}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 px-6 rounded-lg flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
                >
                  <Coffee className="w-5 h-5" />
                  Start Lunch
                </button>
              ) : !currentEntry.lunch_break_end ? (
                <button
                  onClick={handleEndLunch}
                  disabled={loading}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 px-6 rounded-lg flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
                >
                  <Coffee className="w-5 h-5" />
                  End Lunch
                </button>
              ) : (
                <div className="flex-1 bg-gray-100 text-gray-600 py-3 px-6 rounded-lg flex items-center justify-center gap-2 font-semibold">
                  <CheckCircle className="w-5 h-5" />
                  Lunch Completed
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What are you working on today?"
            />
          </div>

          <button
            onClick={handlePunchOut}
            disabled={loading || (isHourlyEmployee && isOnLunch)}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-lg flex items-center justify-center gap-2 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-6 h-6" />
            Punch Out
          </button>
          {isHourlyEmployee && isOnLunch && (
            <p className="text-sm text-center text-orange-600">
              Please end your lunch break before punching out
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What will you be working on?"
            />
          </div>

          <button
            onClick={handlePunchIn}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-lg flex items-center justify-center gap-2 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="w-6 h-6" />
            Punch In
          </button>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <strong>Employee Type:</strong>{' '}
            {profile?.employee_type === 'hourly' ? 'Hourly' : 'Salary'}
          </p>
          {profile?.employee_type === 'salary' && (
            <p className="text-xs text-gray-500">
              Note: 1 hour will be automatically deducted for lunch
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
