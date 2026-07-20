import type { YachtBooking } from '../lib/supabase';

export const convertTo12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

// Extract YYYY-MM-DD in Arizona time from a timestamp string (avoids UTC midnight shifting day)
export const toAZDateStr = (ts: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' });
};

export const isAntelopePointMarina = (marinaName?: string | null): boolean => {
  if (!marinaName) return false;
  const normalized = marinaName.toLowerCase().trim();
  return normalized.includes('antelope') || normalized.includes('antilope');
};

export const isWithinBookingPeriod = (booking: YachtBooking | null): boolean => {
  if (!booking) return false;
  const now = new Date();
  const nowMST = new Date(now.toLocaleString('en-US', { timeZone: 'America/Phoenix' }));
  const start = new Date(new Date(booking.start_date).toLocaleString('en-US', { timeZone: 'America/Phoenix' }));
  const end = new Date(new Date(booking.end_date).toLocaleString('en-US', { timeZone: 'America/Phoenix' }));
  end.setHours(23, 59, 59, 999);
  return nowMST >= start && nowMST <= end;
};
