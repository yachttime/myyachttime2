import { useCallback, useEffect, useState } from 'react';
import { supabase, logYachtActivity, type Yacht, type YachtBooking } from '../../lib/supabase';
import { namesMatch, type IdentityFlagDetails } from '../../utils/identityConfirmation';
import {
  formatArrival,
  ownerNameForBooking,
  selectTabletBookingState,
  todayInPhoenix,
} from '../../utils/tabletBookings';

type EventType = 'check_in' | 'check_out';

interface OwnerCheckInTabProps {
  yacht: Yacht;
  tabletUserId: string;
}

interface RecordOwnerEventArgs {
  eventType: EventType;
  booking: YachtBooking;
  yacht: Yacht;
  tabletUserId: string;
  confirmedName: string;
  flag: IdentityFlagDetails | null;
}

const REFRESH_MS = 60_000;
const PHOENIX_TZ = 'America/Phoenix';

const phoenixTimestamp = (date: Date) =>
  `${date.toLocaleDateString('en-US', { timeZone: PHOENIX_TZ })} at ${date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PHOENIX_TZ,
  })} MST`;

async function recordOwnerEvent({
  eventType,
  booking,
  yacht,
  tabletUserId,
  confirmedName,
  flag,
}: RecordOwnerEventArgs): Promise<string[]> {
  const now = new Date();
  const update =
    eventType === 'check_in'
      ? { checked_in: true, check_in_at: now.toISOString() }
      : { checked_out: true, check_out_at: now.toISOString() };

  const { error } = await supabase.from('yacht_bookings').update(update).eq('id', booking.id);
  if (error) throw error;

  const warnings: string[] = [];
  const companyId = yacht.company_id;
  const timestamp = phoenixTimestamp(now);

  if (flag) {
    const { error: flagError } = await supabase.from('identity_flags').insert({
      company_id: companyId,
      booking_id: booking.id,
      yacht_id: yacht.id,
      user_id: tabletUserId,
      event_type: eventType,
      scheduled_owner_name: flag.scheduledOwnerName,
      confirmed_name: flag.confirmedName,
    });
    if (flagError) {
      console.error('Error recording identity flag:', flagError);
      warnings.push('The name mismatch could not be saved. Please tell the office.');
    }
  }

  const verb = eventType === 'check_in' ? 'checked in' : 'checked out';
  const { error: notifyError } = await supabase.from('admin_notifications').insert({
    yacht_id: yacht.id,
    user_id: tabletUserId,
    message: `${eventType === 'check_in' ? 'Check-In' : 'Check-Out'} Alert: ${confirmedName} ${verb} of ${yacht.name} on ${timestamp}`,
    notification_type: eventType,
  });
  if (notifyError) {
    console.error('Error inserting owner event notification:', notifyError);
    warnings.push('Recorded, but the office notice could not be sent.');
  }

  await logYachtActivity(yacht.id, yacht.name, `${confirmedName} ${verb} at ${timestamp}`, tabletUserId, confirmedName);

  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-checkin-notification`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ownerName: confirmedName,
      yachtName: yacht.name,
      checkInTime: timestamp,
      eventType,
      companyId,
      identityFlag: flag ?? undefined,
    }),
  }).catch((err) => console.error('Owner event email error:', err));

  return warnings;
}

export function OwnerCheckInTab({ yacht, tabletUserId }: OwnerCheckInTabProps) {
  const [bookings, setBookings] = useState<YachtBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingEvent, setPendingEvent] = useState<EventType | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('yacht_bookings')
      .select('*, yacht_booking_owners(owner_name)')
      .eq('yacht_id', yacht.id)
      .gte('end_date', todayInPhoenix())
      .order('start_date');

    if (error) {
      setLoadError('The owner schedule could not be loaded. It will retry shortly.');
    } else {
      setLoadError('');
      setBookings((data as YachtBooking[]) ?? []);
    }
    setLoading(false);
  }, [yacht.id]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const { onBoard, awaiting, upcoming } = selectTabletBookingState(bookings, todayInPhoenix());
  const current = onBoard ?? awaiting;

  const closePrompt = () => {
    setPendingEvent(null);
    setNameInput('');
  };

  const confirmEvent = async () => {
    if (!pendingEvent || !current || !nameInput.trim()) return;
    const confirmedName = nameInput.trim();
    const scheduledOwnerName = ownerNameForBooking(current);
    const flag: IdentityFlagDetails | null = namesMatch(scheduledOwnerName, confirmedName)
      ? null
      : { scheduledOwnerName, confirmedName };

    setSubmitting(true);
    setActionError('');
    setActionNotice('');
    try {
      const warnings = await recordOwnerEvent({
        eventType: pendingEvent,
        booking: current,
        yacht,
        tabletUserId,
        confirmedName,
        flag,
      });
      const base = pendingEvent === 'check_in'
        ? `${confirmedName} is checked in.`
        : `${confirmedName} is checked out.`;
      const flagNote = flag ? ' The name did not match the booking, so the office has been told to review it.' : '';
      setActionNotice([base + flagNote, ...warnings].join(' '));
      closePrompt();
      await load();
    } catch (err) {
      console.error('Owner check-in/out failed:', err);
      setActionError('That did not save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-slate-400">Loading the owner schedule...</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {loadError && <p role="alert" className="text-red-400">{loadError}</p>}

      <section className="rounded-2xl bg-slate-800 p-6 space-y-5">
        {onBoard ? (
          <>
            <p className="text-sm uppercase tracking-wider text-emerald-400">On board now</p>
            <h2 className="text-3xl font-semibold">{ownerNameForBooking(onBoard)}</h2>
          </>
        ) : awaiting ? (
          <>
            <p className="text-sm uppercase tracking-wider text-amber-400">Scheduled to check in</p>
            <h2 className="text-3xl font-semibold">{ownerNameForBooking(awaiting)}</h2>
            <p className="text-slate-300">Arriving {formatArrival(awaiting)}</p>
          </>
        ) : (
          <>
            <p className="text-sm uppercase tracking-wider text-slate-400">No owner on board</p>
            <h2 className="text-2xl font-semibold text-slate-300">No owner is scheduled for today</h2>
          </>
        )}

        {current && pendingEvent === null && (
          <button
            type="button"
            onClick={() => {
              setActionNotice('');
              setActionError('');
              setPendingEvent(onBoard ? 'check_out' : 'check_in');
            }}
            className={`w-full py-4 rounded-xl text-lg font-semibold transition-colors ${
              onBoard
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
            }`}
          >
            {onBoard ? 'Check out' : 'Check in'}
          </button>
        )}

        {current && pendingEvent && (
          <div className="rounded-xl bg-slate-900/60 p-5 space-y-4">
            <label htmlFor="confirm-name" className="block text-slate-200 font-medium">
              Type your full name to confirm {pendingEvent === 'check_in' ? 'check-in' : 'check-out'}
            </label>
            <input
              id="confirm-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <p className="text-sm text-slate-400">
              If the name is different from the booking, you can still continue. The office will review it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closePrompt}
                disabled={submitting}
                className="py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmEvent()}
                disabled={submitting || !nameInput.trim()}
                className="py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {actionError && <p role="alert" className="text-red-400">{actionError}</p>}
        {actionNotice && <p role="status" className="text-emerald-300">{actionNotice}</p>}
      </section>

      <section className="rounded-2xl border border-slate-700 p-6 space-y-2">
        <p className="text-sm uppercase tracking-wider text-slate-400">Next owner</p>
        {upcoming ? (
          <>
            <h3 className="text-2xl font-semibold">{ownerNameForBooking(upcoming)}</h3>
            <p className="text-slate-300">Arriving {formatArrival(upcoming)}</p>
          </>
        ) : (
          <p className="text-slate-300">No owner scheduled next. Contact the office if you expected one.</p>
        )}
      </section>
    </div>
  );
}
