import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Coffee, AlertCircle, CheckCircle, Wrench } from 'lucide-react';
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

interface AssignedWorkOrder {
  id: string;
  work_order_number: string;
  status: string;
  is_retail_customer: boolean;
  customer_name: string | null;
  yacht_name: string | null;
}

export function TimeClockPanel() {
  const { user, userProfile } = useAuth();
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [elapsedTime, setElapsedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assignedWorkOrders, setAssignedWorkOrders] = useState<AssignedWorkOrder[]>([]);

  useEffect(() => {
    if (user) {
      loadCurrentEntry();
      loadProfile();
      loadAssignedWorkOrders();
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

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('work_order_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'work_orders'
        },
        () => {
          loadAssignedWorkOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_order_task_assignments'
        },
        () => {
          loadAssignedWorkOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

  const loadAssignedWorkOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('work_order_task_assignments')
      .select(`
        task_id,
        work_order_tasks!inner (
          work_order_id,
          work_orders!inner (
            id,
            work_order_number,
            status,
            is_retail_customer,
            customer_name,
            yachts (
              name
            )
          )
        )
      `)
      .eq('employee_id', user.id);

    if (error) {
      console.error('Error loading assigned work orders:', error);
      return;
    }

    if (data) {
      const workOrders: AssignedWorkOrder[] = data
        .map((assignment: any) => {
          const workOrder = assignment.work_order_tasks?.work_orders;
          if (!workOrder) return null;

          return {
            id: workOrder.id,
            work_order_number: workOrder.work_order_number,
            status: workOrder.status,
            is_retail_customer: workOrder.is_retail_customer,
            customer_name: workOrder.customer_name,
            yacht_name: workOrder.yachts?.name || null
          };
        })
        .filter((wo): wo is AssignedWorkOrder =>
          wo !== null && wo.status !== 'completed'
        )
        .reduce((unique: AssignedWorkOrder[], wo: AssignedWorkOrder) => {
          if (!unique.find(u => u.id === wo.id)) {
            unique.push(wo);
          }
          return unique;
        }, []);

      setAssignedWorkOrders(workOrders);
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

          {assignedWorkOrders.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Assigned Work Orders</h3>
              </div>
              <div className="space-y-2">
                {assignedWorkOrders.map((wo) => (
                  <div
                    key={wo.id}
                    className="bg-white rounded p-3 border border-blue-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{wo.work_order_number}</div>
                        <div className="text-sm text-gray-600">
                          {wo.is_retail_customer ? wo.customer_name : wo.yacht_name}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        wo.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        wo.status === 'waiting_for_parts' ? 'bg-orange-100 text-orange-800' :
                        wo.status === 'in_process' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {wo.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
          {assignedWorkOrders.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Assigned Work Orders</h3>
              </div>
              <div className="space-y-2">
                {assignedWorkOrders.map((wo) => (
                  <div
                    key={wo.id}
                    className="bg-white rounded p-3 border border-blue-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{wo.work_order_number}</div>
                        <div className="text-sm text-gray-600">
                          {wo.is_retail_customer ? wo.customer_name : wo.yacht_name}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        wo.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        wo.status === 'waiting_for_parts' ? 'bg-orange-100 text-orange-800' :
                        wo.status === 'in_process' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {wo.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
