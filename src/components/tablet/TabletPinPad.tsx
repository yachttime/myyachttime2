import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface TabletPinPadProps {
  onUnlocked: (name: string) => void;
  onClose: () => void;
}

type VerifyResult =
  | { status: 'unlocked'; name: string }
  | { status: 'wrong' | 'invalid' }
  | { status: 'locked'; locked_until?: string };

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

export function TabletPinPad({ onUnlocked, onClose }: TabletPinPadProps) {
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  const verify = async (value: string) => {
    setChecking(true);
    setMessage('');
    const { data, error } = await supabase.rpc('verify_tablet_pin', { p_pin: value });
    setChecking(false);
    setPin('');

    if (error || !data || typeof (data as VerifyResult).status !== 'string') {
      setMessage('Could not check the PIN. Try again.');
      return;
    }
    const result = data as VerifyResult;
    if (result.status === 'unlocked') {
      onUnlocked(result.name || 'Staff');
      return;
    }
    if (result.status === 'locked') {
      setMessage('Too many wrong attempts. Try again in 15 minutes.');
      return;
    }
    setMessage(result.status === 'invalid' ? 'Enter all 6 digits.' : 'That PIN is not recognised.');
  };

  const press = (key: string) => {
    if (checking) return;
    if (key === 'clear') {
      setPin('');
      return;
    }
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 6) void verify(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold text-white">Staff Unlock</h2>
          <p className="text-sm text-slate-400">Enter your 6-digit tablet PIN</p>
        </div>

        <div className="flex justify-center gap-3" aria-live="polite">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                i < pin.length ? 'bg-amber-400 border-amber-400' : 'border-slate-500'
              }`}
            />
          ))}
        </div>

        <p className="min-h-[1.25rem] text-center text-sm text-red-400">{message}</p>

        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={checking}
              onClick={() => press(key)}
              className="h-16 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-xl font-semibold transition disabled:opacity-50"
            >
              {key === 'back' ? '\u232B' : key === 'clear' ? 'Clear' : key}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 text-sm text-slate-300 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
