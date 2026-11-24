// Reads the values the ORION Tough firmware stores for pumps and alternators.
// The firmware sends nested objects, so current_value holds JSON such as
// {"active":false} or {"voltage":13.78}. Older firmware stored plain text
// ("active", "inactive", "13.78"), which is still accepted.

import { isBatteryStale } from './batteryDisplay';

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** true = on, false = off, null = no usable reading. */
export function parseActiveReading(currentValue: string | null | undefined): boolean | null {
  const raw = currentValue?.trim();
  if (!raw) return null;

  const obj = parseObject(raw);
  if (obj && 'active' in obj) {
    const active = obj.active;
    if (typeof active === 'boolean') return active;
    if (active === 1 || active === '1' || active === 'true') return true;
    if (active === 0 || active === '0' || active === 'false') return false;
    return null;
  }

  const text = raw.toLowerCase();
  if (['active', 'on', 'true', '1'].includes(text)) return true;
  if (['inactive', 'off', 'false', '0'].includes(text)) return false;
  return null;
}

/** Volts from {"voltage":13.78} or "13.78", or null. */
export function parseVoltageReading(currentValue: string | null | undefined): number | null {
  const raw = currentValue?.trim();
  if (!raw) return null;

  const obj = parseObject(raw);
  const value = obj ? obj.voltage : raw.replace(/\s*V$/i, '');
  const n = typeof value === 'number' ? value : Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n;
}

export const ALTERNATOR_NAMES = [
  'Port Engine Alternator',
  'Starboard Engine Alternator',
  'Port Generator Alternator',
  'Starboard Generator Alternator',
] as const;

export interface AlternatorDisplay {
  primary: string;
  status: 'normal' | 'offline';
  stale: boolean;
}

export function getAlternatorDisplay(sensor: {
  current_value: string | null;
  last_reading_at: string | null;
} | undefined): AlternatorDisplay {
  if (!sensor) return { primary: '--', status: 'offline', stale: true };
  const volts = parseVoltageReading(sensor.current_value);
  const stale = isBatteryStale(sensor.last_reading_at);
  return {
    primary: volts === null ? '--' : `${volts.toFixed(2)} V`,
    status: stale || volts === null ? 'offline' : 'normal',
    stale,
  };
}

// The Tough re-sends every pump state every 5 minutes (firmware v3.4+), so a
// pump reading older than this means the Tough stopped reading the pumps and
// the last state can't be trusted.
export const PUMP_STALE_MINUTES = 15;

export type PumpState = 'on' | 'off' | 'unknown';

export function getPumpState(sensor: {
  current_value: string | null;
  last_reading_at: string | null;
} | undefined, now = Date.now()): PumpState {
  if (!sensor) return 'unknown';
  const t = sensor.last_reading_at ? Date.parse(sensor.last_reading_at) : NaN;
  if (!Number.isFinite(t) || now - t > PUMP_STALE_MINUTES * 60 * 1000) return 'unknown';
  const active = parseActiveReading(sensor.current_value);
  return active === null ? 'unknown' : active ? 'on' : 'off';
}
