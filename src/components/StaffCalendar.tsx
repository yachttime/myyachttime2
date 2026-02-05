import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, User, X, Check, Clock, AlertCircle, Plus, Briefcase, Sun, BarChart3, Edit3 } from 'lucide-react';
import { supabase, StaffTimeOffRequest, StaffSchedule, UserProfile, canAccessAllYachts, isStaffRole } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRoleImpersonation } from '../contexts/RoleImpersonationContext';

interface StaffScheduleOverride {
  id: string;
  user_id: string;
  override_date: string;
  status: 'working' | 'approved_day_off' | 'sick_leave';
  notes: string | null;
  start_time: string | null;
  end_time: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

function isInSeason(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();

  if (month === 4 && day >= 25) return true;
  if (month >= 5 && month <= 8) return true;
  if (month === 9 && day <= 30) return true;

  return false;
}

function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function getCurrentSeasonStatus(): { inSeason: boolean; label: string; dateRange: string; className: string } {
  const now = new Date();
  const inSeason = isInSeason(now);

  return {
    inSeason,
    label: inSeason ? 'ON SEASON' : 'OFF SEASON',
    dateRange: inSeason ? 'May 25 - September 30' : 'October 1 - May 24',
    className: inSeason ? 'bg-green-600' : 'bg-orange-600'
  };
}

interface StaffCalendarProps {
  onBack: () => void;
}

export function StaffCalendar({ onBack }: StaffCalendarProps) {
  const { user, userProfile } = useAuth();
  const { getEffectiveRole } = useRoleImpersonation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeOffRequests, setTimeOffRequests] = useState<StaffTimeOffRequest[]>([]);
  const [allTimeOffRequests, setAllTimeOffRequests] = useState<StaffTimeOffRequest[]>([]);
  const [allStaff, setAllStaff] = useState<UserProfile[]>([]);
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>([]);
  const [scheduleOverrides, setScheduleOverrides] = useState<StaffScheduleOverride[]>([]);
  const [allScheduleOverrides, setAllScheduleOverrides] = useState<StaffScheduleOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [showWorkScheduleModal, setShowWorkScheduleModal] = useState(false);
  const [showScheduleView, setShowScheduleView] = useState(false);
  const [showWeekendApprovalPanel, setShowWeekendApprovalPanel] = useState(false);
  const [showDateEditModal, setShowDateEditModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<StaffTimeOffRequest | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'working' | 'off'>('working');

  const effectiveRole = getEffectiveRole(userProfile?.role);
  const isStaff = canAccessAllYachts(effectiveRole);
  const canAccessCalendar = isStaffRole(effectiveRole);
  const canManageSchedules = canAccessCalendar;
  const isMaster = effectiveRole === 'master';

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

  const loadDataRef = useRef<() => Promise<void>>();

  useEffect(() => {
    if (userProfile) {
      loadData();
    }
  }, [currentDate, user, userProfile]);

  useEffect(() => {
    loadDataRef.current = loadData;
  });

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
          loadDataRef.current?.();
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
          loadDataRef.current?.();
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
          loadDataRef.current?.();
        }
      )
      .subscribe();

    const overridesChannel = supabase
      .channel('staff_schedule_overrides_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_schedule_overrides'
        },
        () => {
          loadDataRef.current?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(timeOffChannel);
      supabase.removeChannel(userProfilesChannel);
      supabase.removeChannel(schedulesChannel);
      supabase.removeChannel(overridesChannel);
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

      // Load all time off requests if user can manage schedules
      if (canManageSchedules) {
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
        const endOfYear = new Date(currentDate.getFullYear(), 11, 31);

        const { data: allRequestsData, error: allRequestsError } = await supabase
          .from('staff_time_off_requests')
          .select(`
            *,
            user_profiles:user_id (
              first_name,
              last_name,
              role
            )
          `)
          .gte('start_date', startOfYear.toISOString().split('T')[0])
          .lte('end_date', endOfYear.toISOString().split('T')[0])
          .order('start_date', { ascending: true });

        if (allRequestsError) {
          console.error('Error loading all requests:', allRequestsError);
        } else {
          setAllTimeOffRequests(allRequestsData || []);
        }

        // Load all schedule overrides for the year (for calendar filtering)
        const { data: allOverridesData, error: allOverridesError } = await supabase
          .from('staff_schedule_overrides')
          .select(`
            *,
            user_profiles:user_id (
              first_name,
              last_name,
              role
            )
          `)
          .gte('override_date', startOfYear.toISOString().split('T')[0])
          .lte('override_date', endOfYear.toISOString().split('T')[0])
          .order('override_date', { ascending: true });

        if (allOverridesError) {
          console.error('Error loading all schedule overrides:', allOverridesError);
        } else {
          setAllScheduleOverrides(allOverridesData || []);
        }
      } else {
        // For non-managers, just use the month's requests
        setAllTimeOffRequests(requestsData || []);
      }

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
            ),
            approver:approved_by (
              first_name,
              last_name
            )
          `)
          .order('user_id', { ascending: true })
          .order('day_of_week', { ascending: true });

        if (schedulesError) {
          console.error('Error loading schedules:', schedulesError);
        } else {
          setStaffSchedules(schedulesData || []);
        }

        // Load schedule overrides for the current month
        const { data: overridesData, error: overridesError } = await supabase
          .from('staff_schedule_overrides')
          .select(`
            *,
            user_profiles:user_id (
              first_name,
              last_name,
              role
            )
          `)
          .gte('override_date', startOfMonth.toISOString().split('T')[0])
          .lte('override_date', endOfMonth.toISOString().split('T')[0])
          .order('override_date', { ascending: true });

        if (overridesError) {
          console.error('Error loading schedule overrides:', overridesError);
        } else {
          setScheduleOverrides(overridesData || []);
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

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
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

  const getStaffOffForDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];

    // Get all staff with approved time off (excluding partial day requests)
    const staffWithTimeOff = allTimeOffRequests.filter(request =>
      request.status === 'approved' &&
      !request.is_partial_day &&
      dateStr >= request.start_date &&
      dateStr <= request.end_date &&
      request.user_profiles
    );

    // Get all staff with schedule overrides marking them as off
    const dateOverrides = allScheduleOverrides.filter(override =>
      override.override_date === dateStr &&
      (override.status === 'sick_leave' || override.status === 'approved_day_off') &&
      override.user_profiles
    );

    return [...staffWithTimeOff, ...dateOverrides];
  };

  const getPartialDayInfoForUser = (userId: string, day: number): string | null => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];

    const partialDayRequest = allTimeOffRequests.find(request =>
      request.user_id === userId &&
      request.status === 'approved' &&
      request.is_partial_day &&
      dateStr >= request.start_date &&
      dateStr <= request.end_date
    );

    if (!partialDayRequest || !partialDayRequest.start_time || !partialDayRequest.end_time) {
      return null;
    }

    const formatTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    return `Off ${formatTime(partialDayRequest.start_time)}-${formatTime(partialDayRequest.end_time)}`;
  };

  const getSchedulesForDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const today = new Date();
    const currentYear = today.getFullYear();
    const isDateInSeason = isInSeason(date);
    const isDateWeekend = isWeekend(dayOfWeek);

    // Get overrides for this date from ALL overrides
    const dateOverrides = allScheduleOverrides.filter(override => override.override_date === dateStr);

    return staffSchedules.filter(schedule => {
      // Check if there's an approved time-off request for this user on this date from ALL requests
      // Exclude partial day time off - they should still show as working
      const hasApprovedFullDayTimeOff = allTimeOffRequests.some(request =>
        request.user_id === schedule.user_id &&
        request.status === 'approved' &&
        !request.is_partial_day &&
        dateStr >= request.start_date &&
        dateStr <= request.end_date
      );

      if (hasApprovedFullDayTimeOff) {
        return false;
      }

      // Check if there's an override for this user on this date
      const override = dateOverrides.find(o => o.user_id === schedule.user_id);

      // If override exists and is sick_leave or approved_day_off, hide this employee
      if (override && (override.status === 'sick_leave' || override.status === 'approved_day_off')) {
        return false;
      }

      // If override exists and is 'working', show this employee regardless of regular schedule
      if (override && override.status === 'working') {
        return true;
      }

      if (!schedule.is_working_day || schedule.day_of_week !== dayOfWeek) {
        return false;
      }

      const scheduleCreatedDate = new Date(schedule.created_at);
      scheduleCreatedDate.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);

      const isAfterScheduleCreated = date >= scheduleCreatedDate;
      const isCurrentYear = date.getFullYear() === currentYear;

      if (!isAfterScheduleCreated || !isCurrentYear) {
        return false;
      }

      if (isDateWeekend && !isDateInSeason) {
        const approvalStatus = schedule.approval_status;
        if (approvalStatus === 'approved') {
          return true;
        }
        if (approvalStatus === 'denied' && schedule.user_id === user?.id) {
          return true;
        }
        return false;
      }

      return true;
    });
  };

  const getDateColor = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayOfWeek = date.getDay();

    const holiday = getHolidayForDate(day);
    if (holiday) {
      return 'bg-blue-500 hover:bg-blue-600';
    }

    const dateInSeason = isInSeason(date);
    const dateIsWeekend = isWeekend(dayOfWeek);

    const requestsForDate = getRequestsForDate(day);
    const hasApprovedTimeOff = requestsForDate.some(r => r.status === 'approved');
    const hasPendingRequest = requestsForDate.some(r => r.status === 'pending');
    const hasRejectedRequest = requestsForDate.some(r => r.status === 'rejected');

    if (hasApprovedTimeOff) {
      return 'bg-green-500 hover:bg-green-600';
    }

    if (hasPendingRequest) {
      return 'bg-amber-600 hover:bg-amber-700';
    }

    if (hasRejectedRequest) {
      return 'bg-red-500 hover:bg-red-600';
    }

    const weekendSchedules = staffSchedules.filter(s =>
      isWeekend(s.day_of_week) &&
      s.day_of_week === dayOfWeek &&
      s.is_working_day
    );

    if (dateIsWeekend && !dateInSeason && weekendSchedules.length > 0) {
      const hasPendingWeekend = weekendSchedules.some(s => s.approval_status === 'pending');
      const hasApprovedWeekend = weekendSchedules.some(s => s.approval_status === 'approved');

      if (hasPendingWeekend) {
        return 'bg-purple-500 hover:bg-purple-600';
      }
      if (hasApprovedWeekend) {
        return 'bg-emerald-500 hover:bg-emerald-600';
      }
    }

    const schedulesWorking = getSchedulesForDate(day);
    if (schedulesWorking.length > 0) {
      return 'bg-teal-500 hover:bg-teal-600';
    }

    return 'bg-slate-600 hover:bg-slate-700';
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getPendingRequestsCount = () => {
    return allTimeOffRequests.filter(r => r.status === 'pending').length;
  };

  const getPendingWeekendApprovalsCount = () => {
    return staffSchedules.filter(s =>
      s.approval_status === 'pending' &&
      s.is_working_day &&
      isWeekend(s.day_of_week)
    ).length;
  };

  const formatTimeOffType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDateOnly = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString();
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calculateDaysBetween = (request: StaffTimeOffRequest): number => {
    if (request.is_partial_day && request.hours_taken) {
      return request.hours_taken / 8;
    }

    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const calculateStaffStats = () => {
    const stats: { [userId: string]: {
      name: string;
      role: string;
      approvedDays: number;
      requestedDays: number;
      sickDays: number;
      approvedByType: { [type: string]: number };
      requestedByType: { [type: string]: number };
    }} = {};

    // Initialize stats for all staff members
    allStaff.forEach(staff => {
      stats[staff.user_id] = {
        name: `${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
        role: staff.role,
        approvedDays: 0,
        requestedDays: 0,
        sickDays: 0,
        approvedByType: {},
        requestedByType: {}
      };
    });

    // Calculate stats from all time off requests
    allTimeOffRequests.forEach(request => {
      const days = calculateDaysBetween(request);
      const userId = request.user_id;

      if (!stats[userId]) return;

      if (request.status === 'approved') {
        stats[userId].approvedDays += days;
        stats[userId].approvedByType[request.time_off_type] =
          (stats[userId].approvedByType[request.time_off_type] || 0) + days;
      } else if (request.status === 'pending') {
        stats[userId].requestedDays += days;
        stats[userId].requestedByType[request.time_off_type] =
          (stats[userId].requestedByType[request.time_off_type] || 0) + days;
      }
    });

    // Calculate sick days from schedule overrides
    allScheduleOverrides.forEach(override => {
      const userId = override.user_id;
      if (!stats[userId]) return;

      if (override.status === 'sick_leave') {
        stats[userId].sickDays += 1;
      } else if (override.status === 'approved_day_off') {
        // Count approved day off overrides separately
        stats[userId].approvedDays += 1;
        stats[userId].approvedByType['approved_day_off'] =
          (stats[userId].approvedByType['approved_day_off'] || 0) + 1;
      }
    });

    return stats;
  };

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

  const seasonStatus = getCurrentSeasonStatus();

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
            {isStaff && getPendingWeekendApprovalsCount() > 0 && (
              <button
                onClick={() => setShowWeekendApprovalPanel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                <Sun className="w-5 h-5" />
                Weekend Approvals ({getPendingWeekendApprovalsCount()})
              </button>
            )}
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

        <div className={`${seasonStatus.className} rounded-lg p-4 mb-6 text-center`}>
          <div className="flex items-center justify-center gap-3">
            <Sun className="w-6 h-6" />
            <div>
              <h3 className="text-xl font-bold">{seasonStatus.label}</h3>
              <p className="text-sm opacity-90">{seasonStatus.dateRange}</p>
              {!seasonStatus.inSeason && (
                <p className="text-xs mt-1 opacity-80">Weekend work requires staff approval during off-season</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-3 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">Calendar Legend</h2>
            {(userProfile?.role === 'master' || userProfile?.role === 'staff') && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Edit3 className="w-3 h-3" />
                Click dates to edit staff schedules
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-xs">Federal Holiday</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-teal-500 rounded"></div>
              <span className="text-xs">Staff Scheduled</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-xs">Approved Time Off</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span className="text-xs">Pending Request</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-xs">Rejected Request</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-slate-600 rounded"></div>
              <span className="text-xs">Regular Day</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span className="text-xs">Weekend Pending Approval</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-emerald-500 rounded"></div>
              <span className="text-xs">Weekend Approved</span>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-2">
            <div className="text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Employee Display:</span>
                <span className="text-white px-2 py-0.5 rounded">Working</span>
                <span className="text-slate-300 line-through">Scheduled Off</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
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

          <div className="mb-6 flex justify-center gap-2">
            <button
              onClick={() => setViewFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                viewFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Show All Employees
            </button>
            <button
              onClick={() => setViewFilter('working')}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                viewFilter === 'working'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Show Employees Working
            </button>
            <button
              onClick={() => setViewFilter('off')}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                viewFilter === 'off'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Show Employees Off
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
              const schedulesWorking = day ? getSchedulesForDate(day) : [];
              const staffOff = day ? getStaffOffForDate(day) : [];
              const canEditDate = (userProfile?.role === 'master' || userProfile?.role === 'staff');

              const uniqueSchedulesWorking = schedulesWorking.filter((s, idx, arr) =>
                arr.findIndex(item => item.user_id === s.user_id) === idx
              );
              const uniqueStaffOff = staffOff.filter((s, idx, arr) =>
                arr.findIndex(item => item.user_id === s.user_id) === idx
              );

              let displayItems: Array<{ name: string; type: 'working' | 'off'; partialDayInfo?: string | null }> = [];

              if (viewFilter === 'all') {
                displayItems = [
                  ...uniqueSchedulesWorking.map(s => ({
                    name: `${s.user_profiles?.first_name} ${s.user_profiles?.last_name}`,
                    type: 'working' as const,
                    partialDayInfo: day ? getPartialDayInfoForUser(s.user_id, day) : null
                  })),
                  ...uniqueStaffOff.map(s => ({
                    name: `${s.user_profiles?.first_name} ${s.user_profiles?.last_name}`,
                    type: 'off' as const
                  }))
                ];
              } else if (viewFilter === 'working') {
                displayItems = uniqueSchedulesWorking.map(s => ({
                  name: `${s.user_profiles?.first_name} ${s.user_profiles?.last_name}`,
                  type: 'working' as const,
                  partialDayInfo: day ? getPartialDayInfoForUser(s.user_id, day) : null
                }));
              } else if (viewFilter === 'off') {
                displayItems = uniqueStaffOff.map(s => ({
                  name: `${s.user_profiles?.first_name} ${s.user_profiles?.last_name}`,
                  type: 'off' as const
                }));
              }

              const isTodayCell = day ? isToday(day) : false;

              return (
                <div
                  key={index}
                  className={`min-h-24 p-2 rounded-lg border ${
                    isTodayCell ? 'border-4 border-cyan-400 ring-2 ring-cyan-400' : 'border-slate-700'
                  } ${
                    day ? getDateColor(day) : 'bg-slate-900'
                  } ${day && canEditDate ? 'cursor-pointer hover:border-amber-500' : day ? 'cursor-pointer' : ''} relative`}
                  onClick={() => {
                    if (day) {
                      if (canEditDate) {
                        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        setSelectedDate(clickedDate);
                        setShowDateEditModal(true);
                      } else {
                        const requests = getRequestsForDate(day);
                        if (requests.length > 0) {
                          setSelectedRequest(requests[0]);
                        }
                      }
                    }
                  }}
                >
                  {day && (
                    <>
                      <div className="flex justify-between items-start mb-1">
                        <div className={`font-bold ${isTodayCell ? 'text-cyan-300 text-lg' : 'text-white'}`}>
                          {day}
                          {isTodayCell && <span className="ml-1 text-xs align-super">●</span>}
                        </div>
                        {canEditDate && (
                          <Edit3 className="w-3 h-3 text-white hover:text-amber-300" />
                        )}
                      </div>
                      {holiday && (
                        <div className="text-xs font-semibold text-white mb-1 truncate">
                          {holiday.name}
                        </div>
                      )}
                      {displayItems.map((item, idx) => (
                        <div key={`staff-${idx}`}>
                          <div
                            className={`text-xs font-semibold truncate ${
                              item.type === 'working' ? 'text-white' : 'text-slate-300 line-through'
                            }`}
                          >
                            {item.name}
                          </div>
                          {item.partialDayInfo && (
                            <div className="text-xs text-amber-400 truncate">
                              {item.partialDayInfo}
                            </div>
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

        {isMaster && allStaff.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6 mt-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-8 h-8 text-amber-500" />
              <div>
                <h2 className="text-2xl font-bold">Staff Time Off Summary</h2>
                <p className="text-sm text-slate-400">Year: {currentDate.getFullYear()}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold">Staff Member</th>
                    <th className="text-left py-3 px-4 font-semibold">Role</th>
                    <th className="text-right py-3 px-4 font-semibold">Approved Days Off</th>
                    <th className="text-right py-3 px-4 font-semibold">Sick Days</th>
                    <th className="text-right py-3 px-4 font-semibold">Requested Days Off</th>
                    <th className="text-right py-3 px-4 font-semibold">Total Days Off</th>
                    <th className="text-left py-3 px-4 font-semibold">Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(calculateStaffStats()).map(([userId, stats]) => {
                    const totalDaysOff = stats.approvedDays + stats.sickDays + stats.requestedDays;
                    return (
                      <tr key={userId} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{stats.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-400 capitalize">{stats.role}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-block bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            {stats.approvedDays.toFixed(1)} days
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-block bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            {stats.sickDays.toFixed(1)} days
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-block bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            {stats.requestedDays.toFixed(1)} days
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-block bg-amber-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            {totalDaysOff.toFixed(1)} days
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1 text-sm">
                            {Object.entries(stats.approvedByType).length > 0 && (
                              <div className="text-green-400">
                                <span className="font-medium">Approved: </span>
                                {Object.entries(stats.approvedByType)
                                  .map(([type, days]) => `${formatTimeOffType(type)}: ${days.toFixed(1)}`)
                                  .join(', ')}
                              </div>
                            )}
                            {stats.sickDays > 0 && (
                              <div className="text-red-400">
                                <span className="font-medium">Sick Leave: </span>
                                {stats.sickDays.toFixed(1)} days
                              </div>
                            )}
                            {Object.entries(stats.requestedByType).length > 0 && (
                              <div className="text-yellow-400">
                                <span className="font-medium">Requested: </span>
                                {Object.entries(stats.requestedByType)
                                  .map(([type, days]) => `${formatTimeOffType(type)}: ${days.toFixed(1)}`)
                                  .join(', ')}
                              </div>
                            )}
                            {Object.entries(stats.approvedByType).length === 0 &&
                             Object.entries(stats.requestedByType).length === 0 &&
                             stats.sickDays === 0 && (
                              <span className="text-slate-500 italic">No time off recorded</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex flex-wrap gap-6 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <span>Approved time off that has been granted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                  <span>Sick days (called in sick)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                  <span>Requested time off pending approval</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
            requests={allTimeOffRequests.filter(r => r.status === 'pending')}
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

        {showWeekendApprovalPanel && isStaff && (
          <WeekendApprovalPanel
            schedules={staffSchedules.filter(s =>
              s.approval_status === 'pending' &&
              s.is_working_day &&
              isWeekend(s.day_of_week)
            )}
            onClose={() => setShowWeekendApprovalPanel(false)}
            onSuccess={loadData}
          />
        )}

        {showDateEditModal && selectedDate && canManageSchedules && (
          <DateScheduleEditModal
            date={selectedDate}
            staff={allStaff}
            scheduleOverrides={scheduleOverrides}
            onClose={() => {
              setShowDateEditModal(false);
              setSelectedDate(null);
            }}
            onSuccess={() => {
              loadData();
              setShowDateEditModal(false);
              setSelectedDate(null);
            }}
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
    start_time: '',
    end_time: '',
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

    const hasStartTime = formData.start_time && formData.start_time.trim() !== '';
    const hasEndTime = formData.end_time && formData.end_time.trim() !== '';

    if ((hasStartTime && !hasEndTime) || (!hasStartTime && hasEndTime)) {
      setError('Please provide both start and end times, or leave both empty for full day');
      return;
    }

    if (hasStartTime && hasEndTime && formData.start_time >= formData.end_time) {
      setError('End time must be after start time');
      return;
    }

    try {
      setSubmitting(true);

      const isSameDay = formData.start_date === formData.end_date;
      const isPartialDay = Boolean(isSameDay && hasStartTime && hasEndTime);
      let hoursTaken: number | null = null;

      if (isPartialDay) {
        const [startHour, startMin] = formData.start_time.split(':').map(Number);
        const [endHour, endMin] = formData.end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        hoursTaken = (endMinutes - startMinutes) / 60;
      }

      const payload = {
        user_id: user?.id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: hasStartTime ? formData.start_time : null,
        end_time: hasEndTime ? formData.end_time : null,
        is_partial_day: isPartialDay === true,
        hours_taken: hoursTaken,
        time_off_type: formData.time_off_type,
        reason: formData.reason && formData.reason.trim() ? formData.reason : null
      };

      console.log('Submitting time off request:', payload);
      console.log('isPartialDay type:', typeof isPartialDay, 'value:', isPartialDay);

      const { error: insertError } = await supabase
        .from('staff_time_off_requests')
        .insert(payload);

      if (insertError) {
        console.error('Database error:', insertError);
        throw insertError;
      }
      onSuccess();
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError(err?.message || 'Failed to submit request. Please try again.');
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
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time (Optional - for partial days)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Start Time</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">End Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Leave empty for full day. Add times for partial day requests (e.g., morning or afternoon off).
            </p>
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

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDateOnly = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString();
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
                    <p className="font-medium">{formatDateOnly(request.start_date)}</p>
                    {request.start_time && (
                      <p className="text-sm text-amber-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(request.start_time)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">End Date</p>
                    <p className="font-medium">{formatDateOnly(request.end_date)}</p>
                    {request.end_time && (
                      <p className="text-sm text-amber-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(request.end_time)}
                      </p>
                    )}
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

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
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
              {request.start_time && (
                <p className="text-sm text-amber-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(request.start_time)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400">End Date</p>
              <p className="font-medium">{new Date(request.end_date).toLocaleDateString()}</p>
              {request.end_time && (
                <p className="text-sm text-amber-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(request.end_time)}
                </p>
              )}
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
  const [existingSchedules, setExistingSchedules] = useState<StaffSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const seasonStatus = getCurrentSeasonStatus();

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
        .select(`
          *,
          approver:approved_by (
            first_name,
            last_name
          )
        `)
        .eq('user_id', selectedStaffId);

      if (error) throw error;

      setExistingSchedules(data || []);

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
      const seasonStatus = getCurrentSeasonStatus();

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const schedule = schedules[dayOfWeek];
        const isWeekendDay = isWeekend(dayOfWeek);
        const needsApproval = isWeekendDay && !seasonStatus.inSeason && schedule.isWorking;

        const { error } = await supabase
          .from('staff_schedules')
          .upsert({
            user_id: selectedStaffId,
            day_of_week: dayOfWeek,
            is_working_day: schedule.isWorking,
            start_time: schedule.isWorking ? schedule.startTime : null,
            end_time: schedule.isWorking ? schedule.endTime : null,
            notes: schedule.notes || null,
            requires_approval: needsApproval,
            approval_status: needsApproval ? 'pending' : 'not_required',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,day_of_week'
          });

        if (error) throw error;
      }

      alert('Work schedule saved successfully!' + (
        Object.entries(schedules).some(([idx, s]) => isWeekend(Number(idx)) && s.isWorking && !seasonStatus.inSeason)
          ? '\n\nNote: Weekend work during off-season requires staff approval.'
          : ''
      ));
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

            {dayNames.map((dayName, dayOfWeek) => {
              const existingSchedule = existingSchedules.find(s => s.day_of_week === dayOfWeek);
              const isWeekendDay = isWeekend(dayOfWeek);
              const willNeedApproval = isWeekendDay && !seasonStatus.inSeason && schedules[dayOfWeek]?.isWorking;
              const approvalStatus = existingSchedule?.approval_status;

              return (
                <div key={dayOfWeek} className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={schedules[dayOfWeek]?.isWorking || false}
                        onChange={() => toggleWorkingDay(dayOfWeek)}
                        className="w-5 h-5 rounded border-slate-500 text-green-600 focus:ring-green-500"
                      />
                      <h4 className="font-semibold text-lg flex items-center gap-2">
                        {dayName}
                        {isWeekendDay && <Sun className="w-4 h-4 text-amber-400" />}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {schedules[dayOfWeek]?.isWorking && !willNeedApproval && (
                        <span className="text-xs bg-green-600 px-2 py-1 rounded">Working Day</span>
                      )}
                      {willNeedApproval && (
                        <span className="text-xs bg-orange-600 px-2 py-1 rounded flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Needs Approval
                        </span>
                      )}
                      {approvalStatus === 'pending' && (
                        <span className="text-xs bg-yellow-600 px-2 py-1 rounded">Pending</span>
                      )}
                      {approvalStatus === 'approved' && (
                        <span className="text-xs bg-emerald-600 px-2 py-1 rounded flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Approved {existingSchedule?.approver && `by ${existingSchedule.approver.first_name}`}
                        </span>
                      )}
                      {approvalStatus === 'denied' && (
                        <span className="text-xs bg-red-600 px-2 py-1 rounded flex items-center gap-1">
                          <X className="w-3 h-3" />
                          Denied
                        </span>
                      )}
                    </div>
                  </div>
                  {approvalStatus === 'denied' && existingSchedule?.denial_reason && (
                    <div className="mb-3 text-sm text-red-300 bg-red-900/30 p-2 rounded">
                      <strong>Denial Reason:</strong> {existingSchedule.denial_reason}
                    </div>
                  )}

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
              );
            })}

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

function WeekendApprovalPanel({ schedules, onClose, onSuccess }: {
  schedules: StaffSchedule[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState<string | null>(null);
  const [denialReasons, setDenialReasons] = useState<{ [key: string]: string }>({});

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleApprove = async (scheduleId: string, schedule: StaffSchedule) => {
    try {
      setProcessing(scheduleId);

      const { error: updateError } = await supabase
        .from('staff_schedules')
        .update({
          approval_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', scheduleId);

      if (updateError) throw updateError;

      const { error: notifError } = await supabase
        .from('admin_notifications')
        .insert({
          user_id: schedule.user_id,
          message: `Your weekend work schedule for ${dayNames[schedule.day_of_week]} has been approved`,
          notification_type: 'weekend_approval',
          reference_id: scheduleId
        });

      if (notifError) console.error('Error creating notification:', notifError);

      onSuccess();
    } catch (err) {
      console.error('Error approving schedule:', err);
      alert('Failed to approve schedule');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (scheduleId: string, schedule: StaffSchedule) => {
    const reason = denialReasons[scheduleId];
    if (!reason || reason.trim() === '') {
      alert('Please provide a reason for denial');
      return;
    }

    try {
      setProcessing(scheduleId);

      const { error: updateError } = await supabase
        .from('staff_schedules')
        .update({
          approval_status: 'denied',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          denial_reason: reason
        })
        .eq('id', scheduleId);

      if (updateError) throw updateError;

      const { error: notifError } = await supabase
        .from('admin_notifications')
        .insert({
          user_id: schedule.user_id,
          message: `Your weekend work schedule for ${dayNames[schedule.day_of_week]} has been denied. Reason: ${reason}`,
          notification_type: 'weekend_denial',
          reference_id: scheduleId
        });

      if (notifError) console.error('Error creating notification:', notifError);

      onSuccess();
    } catch (err) {
      console.error('Error denying schedule:', err);
      alert('Failed to deny schedule');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sun className="w-6 h-6 text-purple-500" />
            Weekend Work Approvals
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-orange-600/20 border border-orange-600 text-orange-200 px-4 py-3 rounded-lg mb-4">
          <p className="text-sm">
            Weekend work during off-season requires approval. Review and approve or deny the requests below.
          </p>
        </div>

        {schedules.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No pending weekend work approvals</p>
        ) : (
          <div className="space-y-4">
            {schedules.map(schedule => (
              <div key={schedule.id} className="bg-slate-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {schedule.user_profiles?.first_name} {schedule.user_profiles?.last_name}
                      <span className="text-xs text-slate-400 ml-2">
                        ({schedule.user_profiles?.role})
                      </span>
                    </h4>
                    <p className="text-sm text-slate-300 mt-1 flex items-center gap-2">
                      <Sun className="w-3 h-3" />
                      {dayNames[schedule.day_of_week]}
                    </p>
                  </div>
                  <span className="text-xs bg-yellow-600 px-2 py-1 rounded">Pending Approval</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-slate-400">Work Hours</p>
                    <p className="font-medium">
                      {schedule.start_time} - {schedule.end_time}
                    </p>
                  </div>
                  {schedule.notes && (
                    <div>
                      <p className="text-xs text-slate-400">Notes</p>
                      <p className="text-sm">{schedule.notes}</p>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">Denial Reason (required if denying)</label>
                  <textarea
                    value={denialReasons[schedule.id] || ''}
                    onChange={e => setDenialReasons({ ...denialReasons, [schedule.id]: e.target.value })}
                    placeholder="Enter reason for denial..."
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(schedule.id, schedule)}
                    disabled={processing === schedule.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(schedule.id, schedule)}
                    disabled={processing === schedule.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Deny
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

function DateScheduleEditModal({ date, staff, scheduleOverrides, onClose, onSuccess }: {
  date: Date;
  staff: UserProfile[];
  scheduleOverrides: StaffScheduleOverride[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const dateStr = date.toISOString().split('T')[0];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];

  const [overrideStates, setOverrideStates] = useState<{
    [userId: string]: {
      status: 'working' | 'approved_day_off' | 'sick_leave' | 'default';
      notes: string;
      start_time: string;
      end_time: string;
      overrideId?: string;
    };
  }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initialStates: typeof overrideStates = {};
    staff.forEach(staffMember => {
      const existingOverride = scheduleOverrides.find(o => o.user_id === staffMember.user_id && o.override_date === dateStr);
      if (existingOverride) {
        initialStates[staffMember.user_id] = {
          status: existingOverride.status,
          notes: existingOverride.notes || '',
          start_time: existingOverride.start_time || '',
          end_time: existingOverride.end_time || '',
          overrideId: existingOverride.id
        };
      } else {
        initialStates[staffMember.user_id] = {
          status: 'default',
          notes: '',
          start_time: '',
          end_time: ''
        };
      }
    });
    setOverrideStates(initialStates);
  }, [staff, scheduleOverrides, dateStr]);

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const staffMember of staff) {
        const state = overrideStates[staffMember.user_id];
        if (!state) continue;

        if ((state.start_time && !state.end_time) || (!state.start_time && state.end_time)) {
          alert(`Please provide both start and end times for ${staffMember.first_name} ${staffMember.last_name}, or leave both empty.`);
          setSaving(false);
          return;
        }

        if (state.start_time && state.end_time && state.start_time >= state.end_time) {
          alert(`End time must be after start time for ${staffMember.first_name} ${staffMember.last_name}.`);
          setSaving(false);
          return;
        }

        if (state.status === 'default') {
          if (state.overrideId) {
            const { error } = await supabase
              .from('staff_schedule_overrides')
              .delete()
              .eq('id', state.overrideId);

            if (error) throw error;
          }
        } else {
          const overrideData: any = {
            user_id: staffMember.user_id,
            override_date: dateStr,
            status: state.status,
            notes: state.notes || null,
            start_time: state.start_time || null,
            end_time: state.end_time || null,
            created_by: user?.id,
            updated_at: new Date().toISOString()
          };

          if (state.overrideId) {
            overrideData.id = state.overrideId;
          }

          const { error } = await supabase
            .from('staff_schedule_overrides')
            .upsert(overrideData, {
              onConflict: 'user_id,override_date'
            });

          if (error) throw error;
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Error saving schedule overrides:', err);
      alert('Failed to save schedule changes');
    } finally {
      setSaving(false);
    }
  };

  const updateStaffStatus = (userId: string, status: typeof overrideStates[string]['status']) => {
    setOverrideStates({
      ...overrideStates,
      [userId]: {
        ...overrideStates[userId],
        status
      }
    });
  };

  const updateStaffNotes = (userId: string, notes: string) => {
    setOverrideStates({
      ...overrideStates,
      [userId]: {
        ...overrideStates[userId],
        notes
      }
    });
  };

  const updateStaffTime = (userId: string, field: 'start_time' | 'end_time', value: string) => {
    setOverrideStates({
      ...overrideStates,
      [userId]: {
        ...overrideStates[userId],
        [field]: value
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'bg-teal-600';
      case 'approved_day_off': return 'bg-green-600';
      case 'sick_leave': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'working': return 'Working';
      case 'approved_day_off': return 'Approved Day Off';
      case 'sick_leave': return 'Sick Leave';
      default: return 'Default Schedule';
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Edit3 className="w-8 h-8 text-amber-500" />
              Edit Staff Schedule
            </h3>
            <p className="text-slate-400 mt-1">
              {dayName}, {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6 bg-amber-600/20 border border-amber-600 text-amber-200 px-4 py-3 rounded-lg">
          <p className="text-sm">
            Set individual staff member schedules for this specific date. Changes override their regular weekly schedules.
          </p>
        </div>

        <div className="space-y-3">
          {staff.map(staffMember => {
            const state = overrideStates[staffMember.user_id] || { status: 'default', notes: '', start_time: '', end_time: '' };
            return (
              <div key={staffMember.user_id} className="bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <h4 className="font-semibold">
                        {staffMember.first_name} {staffMember.last_name}
                      </h4>
                      <p className="text-xs text-slate-400 capitalize">{staffMember.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(state.status)}`}>
                      {getStatusLabel(state.status)}
                    </div>
                    {state.start_time && state.end_time && (
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(state.start_time)} - {formatTime(state.end_time)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <button
                    onClick={() => updateStaffStatus(staffMember.user_id, 'default')}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      state.status === 'default'
                        ? 'bg-slate-500 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    Default
                  </button>
                  <button
                    onClick={() => updateStaffStatus(staffMember.user_id, 'working')}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      state.status === 'working'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-teal-700'
                    }`}
                  >
                    Working
                  </button>
                  <button
                    onClick={() => updateStaffStatus(staffMember.user_id, 'approved_day_off')}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      state.status === 'approved_day_off'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-green-700'
                    }`}
                  >
                    Day Off
                  </button>
                  <button
                    onClick={() => updateStaffStatus(staffMember.user_id, 'sick_leave')}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      state.status === 'sick_leave'
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-red-700'
                    }`}
                  >
                    Sick
                  </button>
                </div>

                {state.status !== 'default' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Notes (Optional)</label>
                      <input
                        type="text"
                        value={state.notes}
                        onChange={e => updateStaffNotes(staffMember.user_id, e.target.value)}
                        placeholder="Add notes..."
                        className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Work Hours (Optional - for partial days)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={state.start_time}
                            onChange={e => updateStaffTime(staffMember.user_id, 'start_time', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">End Time</label>
                          <input
                            type="time"
                            value={state.end_time}
                            onChange={e => updateStaffTime(staffMember.user_id, 'end_time', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Leave empty for full day status. Add times to track partial day work (e.g., half-day).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-600">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
