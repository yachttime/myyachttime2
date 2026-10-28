import type { YachtBooking } from '../lib/supabase';

export const todayInPhoenix = (now: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

const toIsoTimestamp = (value: string) => value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');

export const phoenixDateOf = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(toIsoTimestamp(value)));

export const ownerNameForBooking = (booking: YachtBooking) =>
  booking.owner_name || booking.yacht_booking_owners?.[0]?.owner_name || 'Scheduled owner';

const startDay = (b: YachtBooking) => phoenixDateOf(b.start_date);
const endDay = (b: YachtBooking) => phoenixDateOf(b.end_date);

const byStartThenArrival = (a: YachtBooking, b: YachtBooking) =>
  startDay(a).localeCompare(startDay(b)) || (a.arrival_time ?? '').localeCompare(b.arrival_time ?? '');

export interface TabletBookingState {
  onBoard: YachtBooking | null;
  awaiting: YachtBooking | null;
  upcoming: YachtBooking | null;
}

export const selectTabletBookingState = (bookings: YachtBooking[], today: string): TabletBookingState => {
  const open = bookings.filter((b) => !b.checked_out).sort(byStartThenArrival);
  const onBoard = open.find((b) => b.checked_in) ?? null;
  const awaiting = onBoard ? null : open.find((b) => startDay(b) <= today && endDay(b) >= today) ?? null;
  const current = onBoard ?? awaiting;
  const upcoming = open.find((b) => b.id !== current?.id && startDay(b) >= today) ?? null;
  return { onBoard, awaiting, upcoming };
};

export const formatArrival = (booking: YachtBooking) => {
  const date = new Date(`${startDay(booking)}T12:00:00`).toLocaleDateString('en-US', {
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
