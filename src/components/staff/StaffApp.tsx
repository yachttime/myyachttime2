import { useState } from 'react';
import { CalendarDays, CalendarOff, Clock, History, Receipt, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TimeClockPanel } from '../TimeClockPanel';
import { StaffScheduleView } from './StaffScheduleView';
import { StaffTimeOffView } from './StaffTimeOffView';
import { StaffHistoryView } from './StaffHistoryView';
import { StaffReceiptView } from './StaffReceiptView';

type StaffTab = 'schedule' | 'timeoff' | 'clock' | 'history' | 'receipts';

const STAFF_ROLES = ['staff', 'mechanic', 'master'];

const TABS: { id: StaffTab; label: string; icon: typeof Clock }[] = [
  { id: 'clock', label: 'Clock', icon: Clock },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'timeoff', label: 'Time Off', icon: CalendarOff },
  { id: 'history', label: 'History', icon: History },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
];

export function StaffApp() {
  const { userProfile, signOut } = useAuth();
  const [tab, setTab] = useState<StaffTab>('clock');

  if (!userProfile || !STAFF_ROLES.includes(userProfile.role)) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-2">Staff access only</h1>
          <p className="text-slate-400 text-sm mb-6">
            This page is for crew and staff time clock access. Please use the main site to manage your account.
          </p>
          <button onClick={signOut} className="px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold transition-colors">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">My Yacht Time</p>
          <p className="font-semibold">
            {userProfile.first_name} {userProfile.last_name}
          </p>
        </div>
        <button
          onClick={signOut}
          aria-label="Sign out"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 max-w-xl w-full mx-auto">
        {tab === 'clock' && <TimeClockPanel />}
        {tab === 'schedule' && <StaffScheduleView />}
        {tab === 'timeoff' && <StaffTimeOffView />}
        {tab === 'history' && <StaffHistoryView />}
        {tab === 'receipts' && <StaffReceiptView />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 grid grid-cols-5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                active ? 'text-amber-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
