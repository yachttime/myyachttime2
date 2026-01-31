import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, User, X, Check, Clock, AlertCircle, Plus, Briefcase } from 'lucide-react';
import { supabase, StaffTimeOffRequest, StaffSchedule, UserProfile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StaffCalendarProps {
  onBack: () => void;
}

export function StaffCalendar({ onBack }: StaffCalendarProps) {
  const { user, userProfile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeOffRequests, setTimeOffRequests] = useState<StaffTimeOffRequest[]>([]);
  const [allStaff, setAllStaff] = useState<UserProfile[]>([]);
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [showWorkScheduleModal, setShowWorkScheduleModal] = useState(false);
  const [showScheduleView, setShowScheduleView] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StaffTimeOffRequest | null>(null);

  const isStaff = userProfile?.role === 'staff' || userProfile?.role === 'master';
  const canAccessCalendar = userProfile?.role === 'staff' || userProfile?.role === 'mechanic' || userProfile?.role === 'master';
  const canManageSchedules = canAccessCalendar;

  if (!canAccessCalendar) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-4">You do not have permission to access the staff calendar.</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (userProfile) {
      loadData();
    }
  }, [currentDate, user, userProfile]);

  useEffect(() => {
    const cleanup = subscribeToChanges();
    return cleanup;
  }, []);

  const subscribeToChanges = () => {
    const timeOffChannel = supabase
      .channel('staff_time_off_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_time_off_requests'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const userProfilesChannel = supabase
      .channel('user_profiles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const schedulesChannel = supabase
      .channel('staff_schedules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_schedules'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(timeOffChannel);
      supabase.removeChannel(userProfilesChannel);
      supabase.removeChannel(schedulesChannel);
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      let requestsQuery = supabase
        .from('staff_time_off_requests')
        .select(`
          *,
          user_profiles:user_id (
            first_name,
            last_name,
            role
          )
        `)
        .gte('start_date', startOfMonth.toISOString().split('T')[0])
        .lte('end_date', endOfMonth.toISOString().split('T')[0])
        .order('start_date', { ascending: true });

      if (!isStaff && !canManageSchedules) {
        requestsQuery = requestsQuery.eq('user_id', user?.id);
      }

      const { data: requestsData, error: requestsError } = await requestsQuery;

      if (requestsError) throw requestsError;
      setTimeOffRequests(requestsData || []);

      if (canManageSchedules) {
        const { data: staffData, error: staffError } = await supabase
          .from('user_profiles')
          .select('*')
          .in('role', ['staff', 'mechanic', 'master'])
          .eq('is_active', true)
          .order('first_name', { ascending: true });

        if (staffError) {
          console.error('Error loading staff:', staffError);
          throw staffError;
        }
        setAllStaff(staffData || []);

        const { data: schedulesData, error: schedulesError } = await supabase
          .from('staff_schedules')
          .select(`
            *,
            user_profiles:user_id (
              first_name,
              last_name,
              role
            )
          `)
          .order('user_id', { ascending: true })
          .order('day_of_week', { ascending: true });

        if (schedulesError) {
          console.error('Error loading schedules:', schedulesError);
        } else {
          setStaffSchedules(schedulesData || []);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFederalHolidays = (year: number) => {
    const holidays: { date: string; name: string }[] = [];

    const getNthWeekdayOfMonth = (year: number, month: number, weekday: number, n: number) => {
      const firstDay = new Date(year, month, 1);
      const firstWeekday = firstDay.getDay();
      const offset = (weekday - firstWeekday + 7) % 7;
      const day = 1 + offset + (n - 1) * 7;
      return new Date(year, month, day);
    };

    const getLastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
      const lastDay = new Date(year, month + 1, 0);
      const lastWeekday = lastDay.getDay();
      const offset = (lastWeekday - weekday + 7) % 7;
      const day = lastDay.getDate() - offset;
      return new Date(year, month, day);
    };

    holidays.push({ date: `${year}-01-01`, name: "New Year's Day" });
    holidays.push({ date: getNthWeekdayOfMonth(year, 0, 1, 3).toISOString().split('T')[0], name: "MLK Jr. Day" });
    holidays.push({ date: getNthWeekdayOfMonth(year, 1, 1, 3).toISOString().split('T')[0], name: "Presidents' Day" });
    holidays.push({ date: getLastWeekdayOfMonth(year, 4, 1).toISOString().split('T')[0], name: "Memorial Day" });
    holidays.push({ date: `${year}-06-19`, name: "Juneteenth" });
    holidays.push({ date: `${year}-07-04`, name: "Independence Day" });
    holidays.push({ date: getNthWeekdayOfMonth(year, 8, 1, 1).toISOString().split('T')[0], name: "Labor Day" });
    holidays.push({ date: getNthWeekdayOfMonth(year, 9, 1, 2).toISOString().split('T')[0], name: "Columbus Day" });
    holidays.push({ date: `${year}-11-11`, name: "Veterans Day" });
    holidays.push({ date: getNthWeekdayOfMonth(year, 10, 4, 4).toISOString().split('T')[0], name: "Thanksgiving" });
    holidays.push({ date: `${year}-12-25`, name: "Christmas Day" });

    return holidays;
  };

  const getHolidayForDate = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString()
      .split('T')[0];

    const holidays = getFederalHolidays(currentDate.getFullYear());
    return holidays.find(h => h.date === dateStr);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getRequestsForDate = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString()
      .split('T')[0];

    return timeOffRequests.filter(request => {
      return dateStr >= request.start_date && dateStr <= request.end_date;
    });
  };

  const getSchedulesForDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayOfWeek = date.getDay();

    return staffSchedules.filter(schedule =>
      schedule.day_of_week === dayOfWeek && schedule.is_working_day
    );
  };

  const getDateColor = (day: number) => {
    return 'bg-blue-50 hover:bg-blue-100';
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getPendingRequestsCount = () => {
    return timeOffRequests.filter(r => r.status === 'pending').length;
  };

  const formatTimeOffType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-8 h-8 text-amber-500" />
            Staff Calendar
          </h1>
          <div className="flex gap-2">
            {canManageSchedules && getPendingRequestsCount() > 0 && (
              <button
                onClick={() => setShowApprovalPanel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                <AlertCircle className="w-5 h-5" />
                Pending Approvals ({getPendingRequestsCount()})
              </button>
            )}
            {canManageSchedules && (
              <button
                onClick={() => setShowScheduleView(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
              >
                <Clock className="w-5 h-5" />
                View Work Schedules
              </button>
            )}
            {canManageSchedules && (
              <button
                onClick={() => setShowWorkScheduleModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <Briefcase className="w-5 h-5" />
                Schedule Work Shifts
              </button>
            )}
            <button
              onClick={() => setShowRequestForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Request Time Off
            </button>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Color Legend</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded"></div>
              <span>Federal Holiday</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-teal-500 rounded"></div>
              <span>Staff Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded"></div>
              <span>Approved Time Off</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-500 rounded"></div>
              <span>Pending Request</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded"></div>
              <span>Rejected Request</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-600 rounded"></div>
              <span>Regular Day</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {dayNames.map(day => (
              <div key={day} className="text-center font-semibold text-slate-400 py-2">
                {day}
              </div>
            ))}

            {getDaysInMonth().map((day, index) => {
              const holiday = day ? getHolidayForDate(day) : null;
              const schedules = day ? getSchedulesForDate(day) : [];
              return (
                <div
                  key={index}
                  className={`min-h-24 p-2 rounded-lg border border-slate-700 ${
                    day ? getDateColor(day) : 'bg-slate-900'
                  } ${day ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (day) {
                      const requests = getRequestsForDate(day);
                      if (requests.length > 0) {
                        setSelectedRequest(requests[0]);
                      }
                    }
                  }}
                >
                  {day && (
                    <>
                      <div className="font-bold text-slate-900 mb-1">{day}</div>
                      {holiday && (
                        <div className="text-xs font-semibold text-blue-800 mb-1 truncate">
                          {holiday.name}
                        </div>
                      )}
                      {schedules.map((schedule, idx) => (
                        <div key={`schedule-${idx}`} className="text-xs font-semibold text-slate-900 truncate">
                          {schedule.user_profiles?.first_name} {schedule.user_profiles?.last_name}
                        </div>
                      ))}
                      {getRequestsForDate(day).map((request, idx) => (
                        <div key={idx} className="text-xs font-semibold text-slate-900 truncate">
                          {canManageSchedules ? (
                            <>
                              {request.user_profiles?.first_name} {request.user_profiles?.last_name}
                            </>
                          ) : (
                            formatTimeOffType(request.time_off_type)
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showRequestForm && (
          <TimeOffRequestModal
            onClose={() => setShowRequestForm(false)}
            onSuccess={() => {
              setShowRequestForm(false);
              loadData();
            }}
          />
        )}

        {showApprovalPanel && canManageSchedules && (
          <ApprovalPanel
            requests={timeOffRequests.filter(r => r.status === 'pending')}
            onClose={() => setShowApprovalPanel(false)}
            onSuccess={loadData}
          />
        )}

        {selectedRequest && (
          <RequestDetailsModal
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            canManage={canManageSchedules}
            onUpdate={loadData}
          />
        )}

        {showWorkScheduleModal && canManageSchedules && (
          <WorkScheduleModal
            staff={allStaff}
            onClose={() => {
              setShowWorkScheduleModal(false);
              loadData();
            }}
          />
        )}

        {showScheduleView && canManageSchedules && (
          <ScheduleViewModal
            schedules={staffSchedules}
            staff={allStaff}
            onClose={() => setShowScheduleView(false)}
          />
        )}
      </div>
    </div>
  );
}

function TimeOffRequestModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    time_off_type: 'vacation' as const,
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.start_date || !formData.end_date) {
      setError('Please select start and end dates');
      return;
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      setError('End date must be after start date');
      return;
    }

    try {
      setSubmitting(true);
      const { error: insertError } = await supabase
        .from('staff_time_off_requests')
        .insert({
          user_id: user?.id,
          ...formData
        });

      if (insertError) throw insertError;
      onSuccess();
    } catch (err) {
      console.error('Error submitting request:', err);
      setError('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Request Time Off</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <input
              type="date"
              value={formData.start_date}
              onChange={e => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">End Date</label>
            <input
              type="date"
              value={formData.end_date}
              onChange={e => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Type of Time Off</label>
            <select
              value={formData.time_off_type}
              onChange={e => setFormData({ ...formData, time_off_type: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="vacation">Vacation</option>
              <option value="sick_leave">Sick Leave</option>
              <option value="personal_day">Personal Day</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reason (Optional)</label>
            <textarea
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApprovalPanel({ requests, onClose, onSuccess }: { requests: StaffTimeOffRequest[]; onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<{ [key: string]: string }>({});

  const handleApprove = async (requestId: string) => {
    try {
      setProcessing(requestId);
      const { error } = await supabase
        .from('staff_time_off_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes[requestId] || null
        })
        .eq('id', requestId);

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!reviewNotes[requestId]) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(requestId);
      const { error } = await supabase
        .from('staff_time_off_requests')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes[requestId]
        })
        .eq('id', requestId);

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Failed to reject request');
    } finally {
      setProcessing(null);
    }
  };

  const formatTimeOffType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Pending Time Off Requests</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {requests.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No pending requests</p>
        ) : (
          <div className="space-y-4">
            {requests.map(request => (
              <div key={request.id} className="bg-slate-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {request.user_profiles?.first_name} {request.user_profiles?.last_name}
                      <span className="text-xs text-slate-400 ml-2">
                        ({request.user_profiles?.role})
                      </span>
                    </h4>
                    <p className="text-sm text-slate-300 mt-1">
                      {formatTimeOffType(request.time_off_type)}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(request.submitted_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-slate-400">Start Date</p>
                    <p className="font-medium">{new Date(request.start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">End Date</p>
                    <p className="font-medium">{new Date(request.end_date).toLocaleDateString()}</p>
                  </div>
                </div>

                {request.reason && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-400">Reason</p>
                    <p className="text-sm">{request.reason}</p>
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">Review Notes</label>
                  <textarea
                    value={reviewNotes[request.id] || ''}
                    onChange={e => setReviewNotes({ ...reviewNotes, [request.id]: e.target.value })}
                    placeholder="Add notes (required for rejection)"
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(request.id)}
                    disabled={processing === request.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(request.id)}
                    disabled={processing === request.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestDetailsModal({
  request,
  onClose,
  canManage,
  onUpdate
}: {
  request: StaffTimeOffRequest;
  onClose: () => void;
  canManage: boolean;
  onUpdate: () => void;
}) {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this time-off request?')) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('staff_time_off_requests')
        .delete()
        .eq('id', request.id);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error deleting request:', err);
      alert('Failed to delete request');
    } finally {
      setDeleting(false);
    }
  };

  const formatTimeOffType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-400';
      case 'pending': return 'text-yellow-400';
      case 'rejected': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const canDelete = canManage || (request.user_id === user?.id && request.status === 'pending');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Time Off Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {canManage && (
            <div>
              <p className="text-xs text-slate-400">Employee</p>
              <p className="font-medium">
                {request.user_profiles?.first_name} {request.user_profiles?.last_name}
                <span className="text-xs text-slate-400 ml-2">({request.user_profiles?.role})</span>
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-400">Status</p>
            <p className={`font-medium ${getStatusColor(request.status)}`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Type</p>
            <p className="font-medium">{formatTimeOffType(request.time_off_type)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">Start Date</p>
              <p className="font-medium">{new Date(request.start_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">End Date</p>
              <p className="font-medium">{new Date(request.end_date).toLocaleDateString()}</p>
            </div>
          </div>

          {request.reason && (
            <div>
              <p className="text-xs text-slate-400">Reason</p>
              <p className="text-sm">{request.reason}</p>
            </div>
          )}

          {request.review_notes && (
            <div>
              <p className="text-xs text-slate-400">Review Notes</p>
              <p className="text-sm">{request.review_notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-400">Submitted</p>
            <p className="text-sm">{new Date(request.submitted_at).toLocaleString()}</p>
          </div>

          {request.reviewed_at && (
            <div>
              <p className="text-xs text-slate-400">Reviewed</p>
              <p className="text-sm">{new Date(request.reviewed_at).toLocaleString()}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Close
            </button>
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkScheduleModal({ staff, onClose }: { staff: UserProfile[]; onClose: () => void }) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [schedules, setSchedules] = useState<{ [key: number]: { isWorking: boolean; startTime: string; endTime: string; notes: string } }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (selectedStaffId) {
      loadSchedules();
    }
  }, [selectedStaffId]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('staff_schedules')
        .select('*')
        .eq('user_id', selectedStaffId);

      if (error) throw error;

      const scheduleMap: { [key: number]: { isWorking: boolean; startTime: string; endTime: string; notes: string } } = {};

      for (let i = 0; i < 7; i++) {
        const existingSchedule = data?.find(s => s.day_of_week === i);
        scheduleMap[i] = {
          isWorking: existingSchedule?.is_working_day ?? false,
          startTime: existingSchedule?.start_time || '08:00',
          endTime: existingSchedule?.end_time || '17:00',
          notes: existingSchedule?.notes || ''
        };
      }

      setSchedules(scheduleMap);
    } catch (err) {
      console.error('Error loading schedules:', err);
      alert('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStaffId) {
      alert('Please select a staff member');
      return;
    }

    try {
      setSaving(true);

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const schedule = schedules[dayOfWeek];

        const { error } = await supabase
          .from('staff_schedules')
          .upsert({
            user_id: selectedStaffId,
            day_of_week: dayOfWeek,
            is_working_day: schedule.isWorking,
            start_time: schedule.isWorking ? schedule.startTime : null,
            end_time: schedule.isWorking ? schedule.endTime : null,
            notes: schedule.notes || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,day_of_week'
          });

        if (error) throw error;
      }

      alert('Work schedule saved successfully!');
      onClose();
    } catch (err) {
      console.error('Error saving schedules:', err);
      alert('Failed to save schedules');
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkingDay = (dayOfWeek: number) => {
    setSchedules({
      ...schedules,
      [dayOfWeek]: {
        ...schedules[dayOfWeek],
        isWorking: !schedules[dayOfWeek]?.isWorking
      }
    });
  };

  const updateSchedule = (dayOfWeek: number, field: 'startTime' | 'endTime' | 'notes', value: string) => {
    setSchedules({
      ...schedules,
      [dayOfWeek]: {
        ...schedules[dayOfWeek],
        [field]: value
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-green-500" />
            Schedule Work Shifts
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Staff Member</label>
          <select
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">-- Select Staff Member --</option>
            {staff.map(member => (
              <option key={member.user_id} value={member.user_id}>
                {member.first_name} {member.last_name} ({member.role})
              </option>
            ))}
          </select>
        </div>

        {selectedStaffId && !loading && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 mb-4">
              Set the weekly work schedule. Toggle days on/off and set work hours.
            </p>

            {dayNames.map((dayName, dayOfWeek) => (
              <div key={dayOfWeek} className="bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={schedules[dayOfWeek]?.isWorking || false}
                      onChange={() => toggleWorkingDay(dayOfWeek)}
                      className="w-5 h-5 rounded border-slate-500 text-green-600 focus:ring-green-500"
                    />
                    <h4 className="font-semibold text-lg">{dayName}</h4>
                  </div>
                  {schedules[dayOfWeek]?.isWorking && (
                    <span className="text-xs bg-green-600 px-2 py-1 rounded">Working Day</span>
                  )}
                </div>

                {schedules[dayOfWeek]?.isWorking && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={schedules[dayOfWeek]?.startTime || '08:00'}
                        onChange={e => updateSchedule(dayOfWeek, 'startTime', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">End Time</label>
                      <input
                        type="time"
                        value={schedules[dayOfWeek]?.endTime || '17:00'}
                        onChange={e => updateSchedule(dayOfWeek, 'endTime', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Notes (Optional)</label>
                      <input
                        type="text"
                        value={schedules[dayOfWeek]?.notes || ''}
                        onChange={e => updateSchedule(dayOfWeek, 'notes', e.target.value)}
                        placeholder="e.g., Remote"
                        className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading schedule...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleViewModal({ schedules, staff, onClose }: {
  schedules: StaffSchedule[];
  staff: UserProfile[];
  onClose: () => void;
}) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getSchedulesForDay = (dayOfWeek: number) => {
    return schedules.filter(s => s.day_of_week === dayOfWeek && s.is_working_day);
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStaffName = (userId: string) => {
    const staffMember = staff.find(s => s.user_id === userId);
    if (!staffMember) return 'Unknown';
    return `${staffMember.first_name} ${staffMember.last_name}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-8 h-8 text-teal-500" />
            Staff Work Schedules
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {schedules.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-xl text-slate-400 mb-2">No schedules found</p>
            <p className="text-slate-500">Use the "Schedule Work Shifts" button to create work schedules for staff members.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dayNames.map((dayName, dayOfWeek) => {
              const daySchedules = getSchedulesForDay(dayOfWeek);

              return (
                <div key={dayOfWeek} className="bg-slate-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3 text-teal-400">{dayName}</h4>

                  {daySchedules.length === 0 ? (
                    <p className="text-slate-500 italic">No staff scheduled</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {daySchedules.map((schedule) => (
                        <div key={schedule.id} className="bg-slate-600 rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-teal-400" />
                            <span className="font-medium">{getStaffName(schedule.user_id)}</span>
                          </div>
                          <div className="text-sm text-slate-300">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </div>
                            {schedule.notes && (
                              <div className="mt-2 text-slate-400 italic text-xs">
                                {schedule.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-600">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
