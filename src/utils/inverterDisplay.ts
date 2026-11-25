// Formats inverter / inverter-charger readings sent by the Cerbo GX reporter
// script (MultiPlus, Quattro, Phoenix, Multi RS). The reporter marks them with
// "kind": "inverter" in the value object; the telemetry edge function files
// them by name, so the site recognises them by that marker instead.

import { alarmLabel as batteryAlarmLabel, isBatteryStale, type BatteryStatus } from './batteryDisplay';

export interface InverterDisplay {
  state: string;
  primary: string;
  details: Array<{ label: string; value: string }>;
  alarms: Array<{ name: string; level: string }>;
  status: BatteryStatus;
  stale: boolean;
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n;
}

function fmt(value: unknown, digits = 1): string {
  const n = num(value);
  return n === null ? '--' : n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function parseObject(raw: string | null): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw || '');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function isInverterReading(currentValue: string | null): boolean {
  if (!currentValue || !currentValue.includes('"inverter"')) return false;
  return parseObject(currentValue)?.kind === 'inverter';
}

// The edge function stores inverter rows with an inferred type (usually
// "environment"). Give them their own type on the way in so every panel
// treats them as inverters.
export function withInverterType<T extends { sensor_type: string; current_value: string | null }>(sensor: T): T {
  return sensor.sensor_type !== 'inverter' && isInverterReading(sensor.current_value)
    ? { ...sensor, sensor_type: 'inverter' }
    : sensor;
}

const INVERTER_ALARM_LABELS: Record<string, string> = {
  low_battery: 'Low battery',
  overload: 'Overload',
  ripple: 'High DC ripple',
  temperature_sensor: 'Temperature sensor fault',
  voltage_sensor: 'Voltage sensor fault',
  phase_rotation: 'Phase rotation',
  grid_lost: 'Shore power lost',
  low_ac_out_voltage: 'Low AC output voltage',
  high_ac_out_voltage: 'High AC output voltage',
};

export function inverterAlarmLabel(name: string): string {
  return INVERTER_ALARM_LABELS[name] || batteryAlarmLabel(name);
}

export function getInverterDisplay(sensor: {
  current_value: string | null;
  last_reading_at: string | null;
}): InverterDisplay {
  const stale = isBatteryStale(sensor.last_reading_at);
  const value = parseObject(sensor.current_value);
  if (!value) {
    return { state: '--', primary: sensor.current_value || '--', details: [], alarms: [], status: stale ? 'offline' : 'normal', stale };
  }

  const state = typeof value.state_text === 'string' ? value.state_text : '--';
  const primaryParts: string[] = [];
  if (num(value.ac_out_power) !== null) primaryParts.push(`${fmt(value.ac_out_power, 0)} W out`);
  if (num(value.ac_out_voltage) !== null) primaryParts.push(`${fmt(value.ac_out_voltage)} V AC`);
  if (num(value.dc_voltage) !== null) primaryParts.push(`${fmt(value.dc_voltage, 2)} V DC`);

  const details: InverterDisplay['details'] = [];
  const add = (label: string, raw: unknown, text: string) => {
    if (raw !== null && raw !== undefined && raw !== '') details.push({ label, value: text });
  };
  if (typeof value.mode_text === 'string') details.push({ label: 'Switch', value: value.mode_text });
  if (typeof value.shore_connected === 'boolean') details.push({ label: 'Shore power', value: value.shore_connected ? 'Connected' : 'Not connected' });
  add('AC in', value.ac_in_voltage, `${fmt(value.ac_in_voltage)} V · ${fmt(value.ac_in_current)} A`);
  add('AC in power', value.ac_in_power, `${fmt(value.ac_in_power, 0)} W`);
  add('Input limit', value.input_current_limit, `${fmt(value.input_current_limit)} A`);
  add('AC out current', value.ac_out_current, `${fmt(value.ac_out_current)} A`);
  add('Frequency', value.ac_out_frequency ?? value.ac_in_frequency, `${fmt(value.ac_out_frequency ?? value.ac_in_frequency)} Hz`);
  add('DC current', value.dc_current, `${fmt(value.dc_current)} A`);
  add('DC power', value.dc_power, `${fmt(value.dc_power, 0)} W`);
  add('Battery', value.soc, `${fmt(value.soc, 0)}%`);
  add('Temperature', value.temp_f, `${fmt(value.temp_f)} °F`);
  const errorCode = num(value.error_code);
  if (errorCode !== null && errorCode !== 0) details.push({ label: 'Error code', value: String(errorCode) });
  add('Model', value.product, String(value.product));

  const alarms = Array.isArray(value.alarms)
    ? (value.alarms as Array<Record<string, unknown>>)
        .filter(a => a && typeof a.name === 'string')
        .map(a => ({ name: String(a.name), level: String(a.level || 'warning') }))
    : [];

  let status: BatteryStatus = 'normal';
  if (alarms.some(a => a.level === 'alarm') || num(value.state) === 2 || (errorCode !== null && errorCode !== 0)) status = 'critical';
  else if (alarms.length > 0) status = 'warning';
  if (stale) status = 'offline';

  return { state, primary: primaryParts.join(' · ') || '--', details, alarms, status, stale };
}
