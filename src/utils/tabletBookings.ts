import type { YachtBooking } from '../lib/supabase';

export const todayInPhoenix = (now: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const ownerNameForBooking = (booking: YachtBooking) =>
  booking.owner_name || booking.yacht_booking_owners?.[0]?.owner_name || 'Scheduled owner';

const byStartThenArrival = (a: YachtBooking, b: YachtBooking) =>
  a.start_date.localeCompare(b.start_date) || (a.arrival_time ?? '').localeCompare(b.arrival_time ?? '');

export interface TabletBookingState {
  onBoard: YachtBooking | null;
  awaiting: YachtBooking | null;
  upcoming: YachtBooking | null;
}

export const selectTabletBookingState = (bookings: YachtBooking[], today: string): TabletBookingState => {
  const open = bookings.filter((b) => !b.checked_out).sort(byStartThenArrival);
  const onBoard = open.find((b) => b.checked_in) ?? null;
  const awaiting = onBoard ? null : open.find((b) => b.start_date <= today && b.end_date >= today) ?? null;
  const current = onBoard ?? awaiting;
  const upcoming = open.find((b) => b.id !== current?.id && b.start_date >= today) ?? null;
  return { onBoard, awaiting, upcoming };
};

export const formatArrival = (booking: YachtBooking) => {
  const date = new Date(`${booking.start_date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (!booking.arrival_time) return `${date}, arrival time to be confirmed`;
  const [hourStr, minuteStr] = booking.arrival_time.split(':');
  const hour = Number(hourStr);
  if (Number.isNaN(hour) || minuteStr === undefined) return `${date}, arrival time to be confirmed`;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${date}, ${hour12}:${minuteStr.slice(0, 2)} ${suffix}`;
};
