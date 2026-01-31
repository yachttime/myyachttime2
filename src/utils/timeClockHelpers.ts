export interface PayrollPeriod {
  periodStart: Date;
  periodEnd: Date;
  cutoffDate: Date;
  paymentDate: Date;
  actualPaymentDate: Date;
  periodName: string;
}

export function getCurrentPayrollPeriod(): PayrollPeriod {
  const today = new Date();
  return getPayrollPeriodForDate(today);
}

export function getPayrollPeriodForDate(date: Date): PayrollPeriod {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (day <= 11) {
    const periodStart = new Date(year, month - 1, 27);
    const periodEnd = new Date(year, month, 11);
    const paymentDate = new Date(year, month, 16);
    const actualPaymentDate = adjustPaymentDateForWeekend(paymentDate);
    const cutoffDate = new Date(actualPaymentDate);
    cutoffDate.setDate(cutoffDate.getDate() - 5);

    return {
      periodStart,
      periodEnd,
      cutoffDate,
      paymentDate,
      actualPaymentDate,
      periodName: `${formatDateShort(periodStart)} - ${formatDateShort(periodEnd)}`
    };
  } else {
    const periodStart = new Date(year, month, 12);
    const periodEnd = new Date(year, month, 26);
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const paymentDate = new Date(nextYear, nextMonth, 1);
    const actualPaymentDate = adjustPaymentDateForWeekend(paymentDate);
    const cutoffDate = new Date(actualPaymentDate);
    cutoffDate.setDate(cutoffDate.getDate() - 5);

    return {
      periodStart,
      periodEnd,
      cutoffDate,
      paymentDate,
      actualPaymentDate,
      periodName: `${formatDateShort(periodStart)} - ${formatDateShort(periodEnd)}`
    };
  }
}

function adjustPaymentDateForWeekend(date: Date): Date {
  const adjustedDate = new Date(date);
  const dayOfWeek = adjustedDate.getDay();

  if (dayOfWeek === 6) {
    adjustedDate.setDate(adjustedDate.getDate() - 1);
  } else if (dayOfWeek === 0) {
    adjustedDate.setDate(adjustedDate.getDate() + 1);
  }

  return adjustedDate;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

export function calculateElapsedTime(startTime: Date | string): string {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  return formatDuration(hours);
}

export function isWithinCutoffDate(entryDate: Date, cutoffDate: Date): boolean {
  return entryDate <= cutoffDate;
}

export function getPayrollPeriodsForDateRange(startDate: Date, endDate: Date): PayrollPeriod[] {
  const periods: PayrollPeriod[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const period = getPayrollPeriodForDate(current);

    const isDuplicate = periods.some(
      p => p.periodStart.getTime() === period.periodStart.getTime() &&
           p.periodEnd.getTime() === period.periodEnd.getTime()
    );

    if (!isDuplicate) {
      periods.push(period);
    }

    current.setDate(current.getDate() + 15);
  }

  return periods;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  punch_in_time: string;
  punch_out_time: string | null;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  total_hours: number;
  standard_hours: number;
  overtime_hours: number;
  notes: string | null;
  is_edited: boolean;
  yacht_id: string | null;
}

export interface DailyTimeEntry {
  date: string;
  entries: TimeEntry[];
  totalHours: number;
  standardHours: number;
  overtimeHours: number;
}

export function groupEntriesByDate(entries: TimeEntry[]): DailyTimeEntry[] {
  const grouped = new Map<string, TimeEntry[]>();

  entries.forEach(entry => {
    const date = new Date(entry.punch_in_time).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(entry);
  });

  const result: DailyTimeEntry[] = [];
  grouped.forEach((entries, date) => {
    const totalHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
    const standardHours = entries.reduce((sum, e) => sum + (e.standard_hours || 0), 0);
    const overtimeHours = entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);

    result.push({
      date,
      entries,
      totalHours,
      standardHours,
      overtimeHours
    });
  });

  return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export interface PayrollSummary {
  totalStandardHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  dayCount: number;
  averageHoursPerDay: number;
}

export function calculatePayrollSummary(entries: TimeEntry[]): PayrollSummary {
  const totalStandardHours = entries.reduce((sum, e) => sum + (e.standard_hours || 0), 0);
  const totalOvertimeHours = entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
  const totalHours = totalStandardHours + totalOvertimeHours;

  const uniqueDates = new Set(
    entries.map(e => new Date(e.punch_in_time).toDateString())
  );
  const dayCount = uniqueDates.size;
  const averageHoursPerDay = dayCount > 0 ? totalHours / dayCount : 0;

  return {
    totalStandardHours: Math.round(totalStandardHours * 100) / 100,
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    dayCount,
    averageHoursPerDay: Math.round(averageHoursPerDay * 100) / 100
  };
}

export function shouldSendPunchReminder(
  scheduledStartTime: string | null,
  lastPunchInTime: string | null
): boolean {
  if (!scheduledStartTime) return false;

  const now = new Date();
  const scheduled = new Date();
  const [hours, minutes] = scheduledStartTime.split(':').map(Number);
  scheduled.setHours(hours, minutes, 0, 0);

  const bufferMs = 10 * 60 * 1000;
  const reminderTime = new Date(scheduled.getTime() + bufferMs);

  if (now < reminderTime) return false;

  if (!lastPunchInTime) return true;

  const lastPunch = new Date(lastPunchInTime);
  const isSameDay =
    lastPunch.getDate() === now.getDate() &&
    lastPunch.getMonth() === now.getMonth() &&
    lastPunch.getFullYear() === now.getFullYear();

  return !isSameDay;
}

export function getClientIP(): string {
  return 'client';
}
