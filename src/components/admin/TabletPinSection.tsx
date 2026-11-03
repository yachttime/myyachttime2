import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface TabletPinSectionProps {
  userId: string;
  userName: string;
}

export function TabletPinSection({ userId, userName }: TabletPinSectionProps) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!/^[0-9]{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc('set_staff_tablet_pin', { p_user_id: userId, p_pin: pin });
    setSaving(false);
    if (rpcError || data !== true) {
      setError(rpcError?.message || 'Could not save the PIN');
      return;
    }
    setPin('');
    setConfirmPin('');
    setSuccess(`Tablet PIN saved for ${userName}`);
  };

  return (
    <div className="mt-6 border border-slate-600 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 hover:bg-slate-700 text-left transition-colors"
      >
        <span className="text-sm font-semibold text-amber-400">Tablet PIN</span>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Set a 6-digit PIN to unlock the helm tablet'}</span>
      </button>
      {open && (
        <div className="p-4 bg-slate-800/50">
          <p className="text-xs text-slate-400 mb-3">
            Set a 6-digit PIN for <span className="text-slate-200 font-medium">{userName}</span>. They enter it on the helm tablet to unlock full access.
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 digits"
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm text-white placeholder:text-slate-400 tracking-widest"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 digits"
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm text-white placeholder:text-slate-400 tracking-widest"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving || pin.length !== 6 || confirmPin.length !== 6}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {saving ? 'Saving...' : 'Save PIN'}
            </button>
          </form>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          {success && <p className="text-green-400 text-xs mt-2">{success}</p>}
        </div>
      )}
    </div>
  );
}
