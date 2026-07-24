import {
  Calendar, ChevronLeft, ChevronRight, Printer, CalendarPlus,
  Ship, CheckCircle, Trash2, ClipboardList, ChevronUp, ChevronDown, Wrench,
} from 'lucide-react';
import { Yacht } from '../../lib/supabase';

export type CalendarViewType = 'day' | 'week' | 'month';
export type AppointmentTypeFilter = 'all' | 'customer' | 'staff';

interface AdditionalOwner { owner_name: string; owner_contact: string }

export interface EditBookingForm {
  owner_name: string;
  owner_contact: string;
  start_date: string;
  end_date: string;
  departure_time: string;
  arrival_time: string;
  additionalOwners: AdditionalOwner[];
  oil_change_notes: string;
}

export interface EditAppointmentForm {
  name: string;
  phone: string;
  email: string;
  yacht_name: string;
  date: string;
  time: string;
  problem_description: string;
  useExistingCustomer: boolean;
  customerId: string;
}

export interface AssignTaskForm {
  assigned_to: string;
  task_date: string;
  admin_notes: string;
}

interface Customer { id: string; name: string; phone?: string; email?: string }
interface Staff { user_id: string; first_name?: string; last_name?: string }

interface MasterCalendarViewProps {
  calendarView: CalendarViewType;
  onCalendarViewChange: (v: CalendarViewType) => void;
  onPrint: () => void;
  onNavigate: (dir: 'prev' | 'next') => void;
  onToday: () => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  formatCalendarTitle: () => string;
  bookings: any[];
  getBookingsForDate: (d: Date) => any[];
  getDaysInMonth: (d: Date) => { daysInMonth: number; startingDayOfWeek: number };
  getWeekDays: (d: Date) => Date[];
  toAZDateStr: (s: string) => string;
  formatDate: (s: string) => string;
  formatTime: (s: string) => string;
  formatTimeOnly: (s: string) => string;
  convertTo12Hour: (s: string) => string;
  getBookingDisplayName: (b: any) => string;
  appointmentTypeFilter: AppointmentTypeFilter;
  onAppointmentTypeFilterChange: (v: AppointmentTypeFilter) => void;
  oilChangeFilter: boolean;
  onOilChangeFilterToggle: () => void;
  effectiveRole: string;
  isOwnerRole: (r: string) => boolean;
  canManageYacht: (r: string) => boolean;
  isManagerRole: (r: string) => boolean;
  onCalendarDateClick: (d: Date) => void;
  onEditBooking: (b: any, d: Date) => void;
  onEditAppointment: (b: any) => void;
  selectedDayAppointments: { date: Date; bookings: any[] } | null;
  setSelectedDayAppointments: (v: { date: Date; bookings: any[] } | null) => void;
  editingBooking: any | null;
  editingBookingClickedDate: Date | null;
  editBookingForm: EditBookingForm;
  onEditBookingFormChange: (f: EditBookingForm) => void;
  onUpdateBooking: (e: React.FormEvent) => void;
  editBookingLoading: boolean;
  editBookingError: string | null;
  onCancelEditBooking: () => void;
  onToggleOilChange: () => void;
  onDeleteBooking: (id: string) => Promise<void>;
  editingAppointment: any | null;
  editAppointmentForm: EditAppointmentForm;
  onEditAppointmentFormChange: (f: EditAppointmentForm) => void;
  onUpdateAppointment: (e: React.FormEvent) => void;
  editAppointmentLoading: boolean;
  editAppointmentError: string | null;
  onCancelEditAppointment: () => void;
  onDeleteAppointment: (id: string) => Promise<void>;
  allCustomers: Customer[];
  allYachts: Yacht[];
  assignTaskAppointmentId: string | null;
  setAssignTaskAppointmentId: (v: string | null) => void;
  openAssignTaskPanel: (apptId: string, date: string) => void;
  assignTaskForm: AssignTaskForm;
  onAssignTaskFormChange: (f: AssignTaskForm) => void;
  assignTaskStaffList: Staff[];
  assignTaskLoading: boolean;
  assignTaskSuccess: boolean;
  assignTaskError: string | null;
  onAssignAppointmentTask: (appt: any) => void;
}

const inputCls = "w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white";

function bookingColorClasses(booking: any, isDeparture: boolean) {
  const appointmentType = booking.appointment_type || 'customer';
  const isStaff = booking.is_appointment && appointmentType === 'staff';
  if (isStaff) return { bg: 'bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30', text: 'text-blue-300', sub: 'text-blue-400' };
  if (booking.is_appointment) return { bg: 'bg-pink-500/20 border border-pink-500/30 hover:bg-pink-500/30', text: 'text-pink-300', sub: 'text-pink-400' };
  if (isDeparture) return { bg: 'bg-green-500/20 border border-green-500/30 hover:bg-green-500/30', text: 'text-green-300', sub: 'text-green-400' };
  if (!isDeparture && booking.oil_change_needed) return { bg: 'bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30', text: 'text-yellow-300', sub: 'text-yellow-400' };
  return { bg: 'bg-red-500/20 border border-red-500/30 hover:bg-red-500/30', text: 'text-red-300', sub: 'text-red-400' };
}

export default function MasterCalendarView(props: MasterCalendarViewProps) {
  const p = props;
  const showStaffFilters = !p.isOwnerRole(p.effectiveRole) && p.effectiveRole !== 'manager';

  const renderBooking = (booking: any, date: Date, variant: 'compact' | 'full') => {
    const startDate = new Date(p.toAZDateStr(booking.start_date) + 'T00:00:00');
    const endDate = new Date(p.toAZDateStr(booking.end_date) + 'T00:00:00');
    startDate.setHours(0, 0, 0, 0); endDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(date); checkDate.setHours(0, 0, 0, 0);
    const isDeparture = checkDate.getTime() === startDate.getTime();
    const appointmentType = booking.appointment_type || 'customer';
    const isStaff = booking.is_appointment && appointmentType === 'staff';
    const c = bookingColorClasses(booking, isDeparture);
    const title = isStaff ? 'Staff Meeting' : booking.yachts?.name || (booking.is_appointment ? 'Walk-in Customer' : 'Yacht');
    const sub = p.getBookingDisplayName(booking);
    const time = booking.is_appointment
      ? `${isStaff ? 'Meeting' : 'Appt'} ${p.formatTimeOnly(booking.departure_time)}`
      : isDeparture
        ? `Departure${booking.departure_time ? ' ' + p.formatTimeOnly(booking.departure_time) : ''}`
        : `Arrival${booking.arrival_time ? ' ' + p.formatTimeOnly(booking.arrival_time) : ''}`;
    const onClick = () => booking.is_appointment ? p.onEditAppointment(booking) : p.onEditBooking(booking, date);

    if (variant === 'compact') {
      return (
        <div key={booking.id} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`text-xs rounded px-2 py-1 cursor-pointer transition-colors truncate ${c.bg}`}>
          <div className={`font-medium truncate ${c.text}`}>{title}</div>
          <div className="text-slate-400 truncate">{sub}</div>
          <div className={`text-xs ${c.sub}`}>{time}</div>
        </div>
      );
    }
    return (
      <div key={booking.id} onClick={onClick} className={`rounded-lg p-3 cursor-pointer transition-colors ${c.bg}`}>
        <div className={`font-semibold text-sm mb-1 ${c.text}`}>{isStaff ? 'Staff Meeting' : booking.yachts?.name || 'Yacht'}</div>
        <div className="text-xs text-slate-400 mb-2">{sub}</div>
        <div className={`text-xs font-medium ${c.sub}`}>
          {booking.is_appointment
            ? `${isStaff ? 'Meeting' : 'Appointment'} ${p.convertTo12Hour(booking.departure_time)}`
            : isDeparture ? `Departure ${p.convertTo12Hour(booking.departure_time)}` : `Arrival ${p.convertTo12Hour(booking.arrival_time)}`}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-teal-500" />
              <h2 className="text-2xl font-bold">Master Calendar</h2>
            </div>
            <div className="flex gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
              {(['day', 'week', 'month'] as CalendarViewType[]).map(v => (
                <button key={v} onClick={() => p.onCalendarViewChange(v)}
                  className={`px-4 py-2 rounded-md font-medium transition-all ${p.calendarView === v ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-teal-400'}`}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={p.onPrint} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg transition-colors text-slate-300 hover:text-white font-medium" title="Print calendar">
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => p.onNavigate('prev')} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => p.onNavigate('next')} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
              <button onClick={p.onToday} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors font-medium">Today</button>
              {p.bookings.length > 0 && (() => {
                const next = [...p.bookings].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()).find(b => new Date(b.start_date) >= new Date());
                return next ? (
                  <button onClick={() => p.setCurrentDate(new Date(next.start_date))} className="px-4 py-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 rounded-lg transition-colors font-medium text-teal-300">Next Trip</button>
                ) : null;
              })()}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">{p.bookings.length} total {p.bookings.length === 1 ? 'booking' : 'bookings'}</span>
              <h3 className="text-xl font-semibold">{p.formatCalendarTitle()}</h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
              <button onClick={() => p.onAppointmentTypeFilterChange('all')} className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${p.appointmentTypeFilter === 'all' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-teal-400'}`}>All Appointments</button>
              {showStaffFilters && (
                <>
                  <button onClick={() => p.onAppointmentTypeFilterChange('customer')} className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${p.appointmentTypeFilter === 'customer' ? 'bg-pink-500 text-white' : 'text-slate-400 hover:text-pink-400'}`}>Customer Appointments</button>
                  <button onClick={() => p.onAppointmentTypeFilterChange('staff')} className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${p.appointmentTypeFilter === 'staff' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-blue-400'}`}>Staff Meetings</button>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={p.onOilChangeFilterToggle} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all border ${p.oilChangeFilter ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-yellow-400 hover:border-yellow-500/30'}`}>
                <Wrench className="w-4 h-4" /> Oil Change Needed
                {p.oilChangeFilter && <span className="ml-1 text-xs bg-yellow-500/30 px-1.5 py-0.5 rounded">ON</span>}
              </button>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-600">
              <div className="flex items-center gap-6 flex-wrap">
                <span className="text-sm font-semibold text-slate-300">Legend:</span>
                {[['green', 'Departure'], ['red', 'Arrival'], ['yellow', 'Arrival (Oil Change Needed)']].map(([c, label]) => (
                  <div key={c} className="flex items-center gap-2"><div className={`w-4 h-4 rounded bg-${c}-500/30 border border-${c}-500/50`} /><span className="text-sm text-slate-300">{label}</span></div>
                ))}
                {showStaffFilters && (
                  <>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-pink-500/30 border border-pink-500/50" /><span className="text-sm text-slate-300">Customer Appointment</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-500/30 border border-blue-500/50" /><span className="text-sm text-slate-300">Staff Meeting</span></div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {p.calendarView === 'month' && (() => {
          const { daysInMonth, startingDayOfWeek } = p.getDaysInMonth(p.currentDate);
          const days: (number | null)[] = [];
          for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
          for (let d = 1; d <= daysInMonth; d++) days.push(d);
          const monthHasBookings = days.some(d => d && p.getBookingsForDate(new Date(p.currentDate.getFullYear(), p.currentDate.getMonth(), d)).length > 0);
          return (
            <div className="p-4">
              {!monthHasBookings && p.bookings.length > 0 && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-center gap-3 text-amber-400">
                    <Calendar className="w-5 h-5" />
                    <div><p className="font-medium">No bookings in {p.formatCalendarTitle()}</p><p className="text-sm text-amber-300/80">Use the "Next Trip" button or navigate to view scheduled trips</p></div>
                  </div>
                </div>
              )}
              {p.bookings.length === 0 && (
                <div className="mb-4 p-6 bg-slate-800/50 border border-slate-600 rounded-lg text-center">
                  <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-lg font-medium text-slate-300 mb-2">No Trips Scheduled</p>
                  <p className="text-sm text-slate-400">There are currently no yacht bookings or appointments in the system.</p>
                </div>
              )}
              <div className="grid grid-cols-7 gap-px bg-slate-700 border border-slate-700 rounded-lg overflow-hidden">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="bg-slate-800 p-3 text-center font-semibold text-slate-400 text-sm">{d}</div>
                ))}
                {days.map((day, idx) => {
                  const date = day ? new Date(p.currentDate.getFullYear(), p.currentDate.getMonth(), day) : null;
                  const bookings = date ? p.getBookingsForDate(date) : [];
                  const isToday = date && date.toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' });
                  return (
                    <div key={day ? `day-${day}` : `empty-${idx}`} onClick={() => day && date && (p.setCurrentDate(date), p.onCalendarViewChange('day'))} className={`bg-slate-900 min-h-[120px] p-2 ${day ? 'hover:bg-slate-800 cursor-pointer' : ''} transition-colors relative group`}>
                      {day && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`text-sm font-semibold ${isToday ? 'bg-teal-500 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-slate-300'}`}>{day}</div>
                            <button onClick={(e) => { e.stopPropagation(); p.onCalendarDateClick(date!); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-pink-500/20 rounded text-pink-400" title="Create Appointment"><CalendarPlus className="w-4 h-4" /></button>
                          </div>
                          <div className="space-y-1">
                            {bookings.slice(0, 2).map(b => renderBooking(b, date!, 'compact'))}
                            {bookings.length > 2 && (
                              <button onClick={(e) => { e.stopPropagation(); p.setSelectedDayAppointments({ date: date!, bookings }); }} className="w-full text-xs bg-teal-500/20 border border-teal-500/30 hover:bg-teal-500/30 rounded px-2 py-1 text-teal-300 font-medium transition-colors">+{bookings.length - 2} more</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {p.calendarView === 'week' && (() => {
          const weekDays = p.getWeekDays(p.currentDate);
          return (
            <div className="p-4">
              <div className="grid grid-cols-7 gap-px bg-slate-700 border border-slate-700 rounded-lg overflow-hidden">
                {weekDays.map((date) => {
                  const bookings = p.getBookingsForDate(date);
                  const isToday = date.toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' });
                  return (
                    <div key={date.toISOString()} className="bg-slate-900">
                      <div onClick={() => p.onCalendarDateClick(date)} className={`p-3 border-b border-slate-700 text-center cursor-pointer hover:bg-slate-800/50 transition-colors ${isToday ? 'bg-teal-500/20' : ''}`}>
                        <div className="text-sm font-semibold text-slate-400">{date.toLocaleDateString('en-US', { timeZone: 'America/Phoenix', weekday: 'short' })}</div>
                        <div className={`text-xl font-bold ${isToday ? 'text-teal-400' : 'text-slate-200'}`}>{date.getDate()}</div>
                      </div>
                      <div className="p-2 min-h-[400px] space-y-2">{bookings.map(b => renderBooking(b, date, 'full'))}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {p.calendarView === 'day' && (() => {
          const bookings = p.getBookingsForDate(p.currentDate);
          return (
            <div className="p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg min-h-[500px]">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                  <div className="text-lg font-semibold text-slate-200">{p.currentDate.toLocaleDateString('en-US', { timeZone: 'America/Phoenix', weekday: 'long' })}</div>
                  <button onClick={() => p.onCalendarDateClick(p.currentDate)} className="px-4 py-2 bg-pink-500/20 border border-pink-500/30 hover:bg-pink-500/30 rounded-lg transition-colors text-pink-300 font-medium flex items-center gap-2"><CalendarPlus className="w-4 h-4" /> Create Appointment</button>
                </div>
                <div className="p-4 space-y-3">
                  {bookings.length === 0 ? (
                    <div className="text-center py-12 text-slate-400"><Calendar className="w-12 h-12 mx-auto mb-3 text-slate-600" /><p>No trips scheduled for this day</p></div>
                  ) : bookings.map(booking => {
                    const startDate = new Date(p.toAZDateStr(booking.start_date) + 'T00:00:00');
                    const endDate = new Date(p.toAZDateStr(booking.end_date) + 'T00:00:00');
                    startDate.setHours(0,0,0,0); endDate.setHours(0,0,0,0);
                    const checkDate = new Date(p.currentDate); checkDate.setHours(0,0,0,0);
                    const isDeparture = checkDate.getTime() === startDate.getTime();
                    const c = bookingColorClasses(booking, isDeparture);
                    return (
                      <div key={booking.id} onClick={() => booking.is_appointment ? p.onEditAppointment(booking) : p.onEditBooking(booking, p.currentDate)} className={`border rounded-lg p-4 cursor-pointer transition-all ${booking.is_appointment ? 'bg-pink-500/10 border-pink-500/50 hover:border-pink-500' : isDeparture ? 'bg-green-500/10 border-green-500/50 hover:border-green-500' : !isDeparture && booking.oil_change_needed ? 'bg-yellow-500/10 border-yellow-500/50 hover:border-yellow-500' : 'bg-red-500/10 border-red-500/50 hover:border-red-500'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`p-2 rounded-lg ${booking.is_appointment ? 'bg-pink-500/20' : isDeparture ? 'bg-green-500/20' : !isDeparture && booking.oil_change_needed ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                                {booking.is_appointment ? <CalendarPlus className="w-5 h-5 text-pink-500" /> : <Ship className={`w-5 h-5 ${isDeparture ? 'text-green-500' : !isDeparture && booking.oil_change_needed ? 'text-yellow-500' : 'text-red-500'}`} />}
                              </div>
                              <div>
                                <h4 className="font-bold text-lg">{booking.yachts?.name || 'Yacht'}</h4>
                                <p className="text-sm text-slate-400">{p.getBookingDisplayName(booking)}</p>
                                <div className={`text-xs font-medium mt-1 ${booking.is_appointment ? 'text-pink-400' : isDeparture ? 'text-green-400' : !isDeparture && booking.oil_change_needed ? 'text-yellow-400' : 'text-red-400'}`}>{booking.is_appointment ? 'Appointment' : isDeparture ? 'Departure' : 'Arrival'}</div>
                              </div>
                            </div>
                            {booking.is_appointment ? (
                              <div className="bg-slate-900/50 rounded p-2 mb-3">
                                <p className="text-xs text-slate-400 mb-1">Scheduled Time</p>
                                <p className="text-sm font-medium">{p.formatDate(booking.start_date)}</p>
                                <p className="text-xs text-slate-300">{p.convertTo12Hour(booking.departure_time)}</p>
                                {booking.problem_description && <p className="text-xs text-slate-400 mt-2">{booking.problem_description}</p>}
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div className="bg-slate-900/50 rounded p-2"><p className="text-xs text-slate-400 mb-1">Departure</p><p className="text-sm font-medium">{p.formatDate(booking.start_date)}</p><p className="text-xs text-slate-300">{booking.departure_time ? p.convertTo12Hour(booking.departure_time) : p.formatTime(booking.start_date)}</p></div>
                                  <div className="bg-slate-900/50 rounded p-2"><p className="text-xs text-slate-400 mb-1">Return</p><p className="text-sm font-medium">{p.formatDate(booking.end_date)}</p><p className="text-xs text-slate-300">{booking.arrival_time ? p.convertTo12Hour(booking.arrival_time) : p.formatTime(booking.end_date)}</p></div>
                                </div>
                                <div className="flex gap-2">
                                  {booking.checked_in && <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-400"><CheckCircle className="w-3 h-3" /><span>Checked In</span></div>}
                                  {booking.checked_out && <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-400"><CheckCircle className="w-3 h-3" /><span>Checked Out</span></div>}
                                </div>
                                {booking.oil_change_needed && booking.oil_change_notes && (
                                  <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <Wrench className="w-3.5 h-3.5 text-yellow-400" />
                                      <span className="text-xs font-semibold text-yellow-300">Oil Change Instructions</span>
                                    </div>
                                    <p className="text-sm text-yellow-100/90 whitespace-pre-wrap">{booking.oil_change_notes}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {p.editingBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Edit Trip</h3>
            <form onSubmit={p.onUpdateBooking} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-200">Owners</label>
                  <button type="button" onClick={() => p.onEditBookingFormChange({ ...p.editBookingForm, additionalOwners: [...p.editBookingForm.additionalOwners, { owner_name: '', owner_contact: '' }] })} className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"><span className="text-base leading-none">+</span> Add Owner</button>
                </div>
                <div className="bg-slate-900/40 border border-slate-600 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-slate-400 font-medium">Owner 1 (Primary)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Name" value={p.editBookingForm.owner_name} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, owner_name: e.target.value })} className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white text-sm" required />
                    <input type="text" placeholder="Contact Info" value={p.editBookingForm.owner_contact} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, owner_contact: e.target.value })} className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white text-sm" />
                  </div>
                </div>
                {p.editBookingForm.additionalOwners.map((owner, idx) => (
                  <div key={idx} className="bg-slate-900/40 border border-slate-600 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400 font-medium">Owner {idx + 2}</p>
                      <button type="button" onClick={() => p.onEditBookingFormChange({ ...p.editBookingForm, additionalOwners: p.editBookingForm.additionalOwners.filter((_, i) => i !== idx) })} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Name" value={owner.owner_name} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, additionalOwners: p.editBookingForm.additionalOwners.map((o, i) => i === idx ? { ...o, owner_name: e.target.value } : o) })} className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white text-sm" />
                      <input type="text" placeholder="Contact Info" value={owner.owner_contact} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, additionalOwners: p.editBookingForm.additionalOwners.map((o, i) => i === idx ? { ...o, owner_contact: e.target.value } : o) })} className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white text-sm" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Departure Date</label><input type="date" value={p.editBookingForm.start_date} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, start_date: e.target.value })} className={inputCls} required /></div>
                <div><label className="block text-sm font-medium mb-2">Departure Time</label><input type="time" value={p.editBookingForm.departure_time} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, departure_time: e.target.value })} className={inputCls} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Return Date</label><input type="date" value={p.editBookingForm.end_date} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, end_date: e.target.value })} className={inputCls} required /></div>
                <div><label className="block text-sm font-medium mb-2">Return Time</label><input type="time" value={p.editBookingForm.arrival_time} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, arrival_time: e.target.value })} className={inputCls} required /></div>
              </div>
              {p.editBookingError && <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">{p.editBookingError}</div>}
              {(() => {
                if (p.editingBooking.is_appointment) return null;
                const startDate = new Date(p.editingBooking.start_date); startDate.setHours(0,0,0,0);
                const endDate = new Date(p.editingBooking.end_date); endDate.setHours(0,0,0,0);
                let isDeparture = false;
                if (p.editingBookingClickedDate) { const c = new Date(p.editingBookingClickedDate); c.setHours(0,0,0,0); isDeparture = c.getTime() === startDate.getTime(); }
                return !isDeparture && (
                  <div className="mb-4 space-y-3">
                    <button type="button" onClick={p.onToggleOilChange} className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${p.editingBooking.oil_change_needed ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-300 hover:bg-yellow-500/30' : 'bg-red-500/20 border-2 border-red-500 text-red-300 hover:bg-red-500/30'}`}>{p.editingBooking.oil_change_needed ? '⚠️ Oil Change Needed' : '✓ Oil Change Not Needed'}</button>
                    {p.editingBooking.oil_change_needed && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Oil Change Instructions <span className="text-slate-500">(Optional)</span></label>
                        <textarea value={p.editBookingForm.oil_change_notes} onChange={(e) => p.onEditBookingFormChange({ ...p.editBookingForm, oil_change_notes: e.target.value })} placeholder="Add guidance for the employee performing the oil change (e.g. which engine, oil type, special procedures)..." className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-yellow-500 text-white min-h-[80px] resize-none" rows={3} />
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex gap-3">
                <button type="submit" disabled={p.editBookingLoading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">{p.editBookingLoading ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" onClick={p.onCancelEditBooking} className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors">Cancel</button>
                {p.canManageYacht(p.effectiveRole) && (
                  <button type="button" onClick={async () => { await p.onDeleteBooking(p.editingBooking.id); p.onCancelEditBooking(); }} className="px-6 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {p.editingAppointment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{p.editingAppointment.appointment_type === 'staff' ? 'Edit Staff Meeting' : 'Edit Appointment'}</h3>
            <form onSubmit={p.onUpdateAppointment} className="space-y-4">
              {p.editingAppointment.appointment_type === 'staff' ? (
                <>
                  <div><label className="block text-sm font-medium mb-2">Name</label><input type="text" value={p.editAppointmentForm.name} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, name: e.target.value })} className={`${inputCls} focus:border-blue-500`} placeholder="Enter name" required /></div>
                  <div><label className="block text-sm font-medium mb-2">Phone</label><input type="tel" value={p.editAppointmentForm.phone} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, phone: e.target.value })} className={`${inputCls} focus:border-blue-500`} placeholder="Enter phone number" required /></div>
                  <div><label className="block text-sm font-medium mb-2">Email</label><input type="email" value={p.editAppointmentForm.email} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, email: e.target.value })} className={`${inputCls} focus:border-blue-500`} placeholder="Enter email address" required /></div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Customer</label>
                    {p.editAppointmentForm.useExistingCustomer ? (
                      <div className="space-y-2">
                        <select value={p.editAppointmentForm.customerId} onChange={(e) => { const c = p.allCustomers.find(c => c.id === e.target.value); if (c) p.onEditAppointmentFormChange({ ...p.editAppointmentForm, customerId: e.target.value, name: c.name, phone: c.phone || '', email: c.email || '' }); }} className={inputCls} required>
                          <option value="">Select a customer...</option>
                          {p.allCustomers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `- ${c.phone}` : ''}</option>)}
                        </select>
                        <button type="button" onClick={() => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, useExistingCustomer: false, customerId: '' })} className="text-sm text-amber-400 hover:text-amber-300">+ Create new customer</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input type="text" value={p.editAppointmentForm.name} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, name: e.target.value })} className={inputCls} placeholder="Enter customer name" required />
                        <button type="button" onClick={() => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, useExistingCustomer: true })} className="text-sm text-amber-400 hover:text-amber-300">← Use existing customer</button>
                      </div>
                    )}
                  </div>
                  {!p.editAppointmentForm.useExistingCustomer && (
                    <>
                      <div><label className="block text-sm font-medium mb-2">Phone</label><input type="tel" value={p.editAppointmentForm.phone} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, phone: e.target.value })} className={inputCls} placeholder="Enter phone number" /></div>
                      <div><label className="block text-sm font-medium mb-2">Email</label><input type="email" value={p.editAppointmentForm.email} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, email: e.target.value })} className={inputCls} placeholder="Enter email address" /></div>
                    </>
                  )}
                </>
              )}
              {p.editingAppointment.appointment_type !== 'staff' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Yacht <span className="text-slate-500">(Optional)</span></label>
                  <select value={p.editAppointmentForm.yacht_name} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, yacht_name: e.target.value })} className={inputCls}>
                    <option value="">Select a yacht...</option>
                    {p.allYachts.map(y => <option key={y.id} value={y.name}>{y.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Date</label><input type="date" value={p.editAppointmentForm.date} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, date: e.target.value })} className={inputCls} required /></div>
                <div><label className="block text-sm font-medium mb-2">Time</label><input type="time" value={p.editAppointmentForm.time} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, time: e.target.value })} className={inputCls} required /></div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{p.editingAppointment.appointment_type === 'staff' ? 'Notes / Purpose' : 'Problem Description'}{p.editingAppointment.appointment_type === 'staff' && <span className="text-slate-500"> (Optional)</span>}</label>
                <textarea value={p.editAppointmentForm.problem_description} onChange={(e) => p.onEditAppointmentFormChange({ ...p.editAppointmentForm, problem_description: e.target.value })} className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white min-h-[100px]" required={p.editingAppointment.appointment_type !== 'staff'} />
              </div>
              {p.isManagerRole(p.effectiveRole) && (
                <div className="border border-slate-600 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => p.assignTaskAppointmentId === p.editingAppointment.id ? p.setAssignTaskAppointmentId(null) : p.openAssignTaskPanel(p.editingAppointment.id, p.editAppointmentForm.date || new Date().toISOString().split('T')[0])} className="w-full flex items-center justify-between px-4 py-3 bg-teal-700/30 hover:bg-teal-700/50 text-teal-300 font-medium text-sm transition-colors">
                    <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Assign to Staff (Daily Task)</span>
                    {p.assignTaskAppointmentId === p.editingAppointment.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {p.assignTaskAppointmentId === p.editingAppointment.id && (
                    <div className="p-4 bg-slate-900/50 space-y-3">
                      {p.assignTaskSuccess && <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">Task assigned successfully. It will appear in Daily Tasks.</div>}
                      {p.assignTaskError && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{p.assignTaskError}</div>}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Assign To *</label>
                        <select value={p.assignTaskForm.assigned_to} onChange={(e) => p.onAssignTaskFormChange({ ...p.assignTaskForm, assigned_to: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500">
                          <option value="">Select staff member...</option>
                          {p.assignTaskStaffList.map(s => <option key={s.user_id} value={s.user_id}>{[s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unknown'}</option>)}
                        </select>
                      </div>
                      <div><label className="block text-xs font-medium text-slate-400 mb-1">Task Date *</label><input type="date" value={p.assignTaskForm.task_date} onChange={(e) => p.onAssignTaskFormChange({ ...p.assignTaskForm, task_date: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500" /></div>
                      <div><label className="block text-xs font-medium text-slate-400 mb-1">Notes for Staff <span className="text-slate-500">(Optional)</span></label><textarea value={p.assignTaskForm.admin_notes} onChange={(e) => p.onAssignTaskFormChange({ ...p.assignTaskForm, admin_notes: e.target.value })} rows={2} placeholder="Additional instructions for the staff member..." className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 resize-none" /></div>
                      <button type="button" disabled={p.assignTaskLoading || !p.assignTaskForm.assigned_to || !p.assignTaskForm.task_date} onClick={() => p.onAssignAppointmentTask(p.editingAppointment)} className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors">{p.assignTaskLoading ? 'Assigning...' : 'Assign Task'}</button>
                    </div>
                  )}
                </div>
              )}
              {p.editAppointmentError && <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">{p.editAppointmentError}</div>}
              <div className="flex gap-3">
                <button type="submit" disabled={p.editAppointmentLoading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">{p.editAppointmentLoading ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" onClick={p.onCancelEditAppointment} className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors">Cancel</button>
                {p.canManageYacht(p.effectiveRole) && <button type="button" onClick={() => p.onDeleteAppointment(p.editingAppointment.id)} className="px-6 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</button>}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
