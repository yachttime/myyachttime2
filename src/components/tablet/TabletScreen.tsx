import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { supabase, type Yacht } from '../../lib/supabase';
import { OwnerCheckInTab } from './OwnerCheckInTab';
import { VesselMonitoringTab } from './VesselMonitoringTab';
import { SecurityCamerasTab } from './SecurityCamerasTab';
import { TabletPinPad } from './TabletPinPad';

type TabletTab = 'cameras' | 'checkin' | 'monitoring';

const TABS: { id: TabletTab; label: string }[] = [
  { id: 'cameras', label: 'Security Cameras' },
  { id: 'checkin', label: 'Owner Check-In' },
  { id: 'monitoring', label: 'Vessel Monitoring' },
];

interface TabletScreenProps {
  yacht: Yacht;
  tabletUserId: string;
}

export function TabletScreen({ yacht, tabletUserId }: TabletScreenProps) {
  const [activeTab, setActiveTab] = useState<TabletTab>('checkin');
  const [unlockedBy, setUnlockedBy] = useState<string | null>(null);
  const [pinPadOpen, setPinPadOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    setCompanyName(null);
    if (!yacht.company_id) return;
    void (async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('company_name')
        .eq('id', yacht.company_id)
        .maybeSingle();
      if (!error && data) setCompanyName(data.company_name);
    })();
  }, [yacht.company_id]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-700">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-400">Helm Tablet</p>
          <h1 className="text-xl font-semibold truncate">{yacht.name}</h1>
          {companyName && (
            <p className="text-sm text-slate-400 truncate">
              Managed by <span className="text-slate-200 font-medium">{companyName}</span>
            </p>
          )}
        </div>
        {unlockedBy ? (
          <button
            type="button"
            onClick={() => setUnlockedBy(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 text-sm font-medium transition-colors"
          >
            <Unlock className="w-4 h-4" />
            Unlocked by {unlockedBy}. Lock
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPinPadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
          >
            <Lock className="w-4 h-4" />
            Staff unlock
          </button>
        )}
      </header>

      <nav className="grid grid-cols-3 border-b border-slate-700" role="tablist">
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`py-5 text-base font-semibold transition-colors border-b-4 ${
                selected
                  ? 'border-amber-400 text-white bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 p-6">
        {activeTab === 'cameras' && <SecurityCamerasTab />}
        {activeTab === 'checkin' && <OwnerCheckInTab yacht={yacht} tabletUserId={tabletUserId} />}
        {activeTab === 'monitoring' && <VesselMonitoringTab yachtId={yacht.id} />}
      </main>
      <footer className="px-6 py-3 border-t border-slate-800 text-center text-xs text-slate-500">
        Powered by Myyachttime
      </footer>

      {pinPadOpen && (
        <TabletPinPad
          onUnlocked={(name) => {
            setUnlockedBy(name);
            setPinPadOpen(false);
          }}
          onClose={() => setPinPadOpen(false)}
        />
      )}
    </div>
  );
}
