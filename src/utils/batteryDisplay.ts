// Formats battery bank readings sent by the Cerbo GX reporter script
// (value object with voltage, current, soc, temp_f, history, alarms) and the
// older "12.6V / 3.2A" text the Tough's own Cerbo MQTT module produced.

export type BatteryStatus = 'normal' | 'warning' | 'critical' | 'offline';

export interface BatteryDisplay {
  primary: string;
  details: Array<{ label: string; value: string }>;
  history: Array<{ label: string; value: string }>;
  alarms: Array<{ name: string; level: string }>;
  status: BatteryStatus;
  stale: boolean;
}

// No new reading for this long means the Cerbo reporter has stopped.
export const BATTERY_STALE_MINUTES = 10;

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n;
}

function fmt(value: unknown, digits = 2): string {
  const n = num(value);
  return n === null ? '--' : n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '--';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function parseObject(raw: string | null): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw || '');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const ALARM_LABELS: Record<string, string> = {
  low_voltage: 'Low voltage',
  high_voltage: 'High voltage',
  low_soc: 'Low state of charge',
  low_starter_voltage: 'Low starter voltage',
  high_starter_voltage: 'High starter voltage',
  low_temperature: 'Low temperature',
  high_temperature: 'High temperature',
  midpoint_voltage: 'Midpoint deviation',
};

export function alarmLabel(name: string): string {
  return ALARM_LABELS[name] || name.replace(/_/g, ' ');
}

export function isBatteryStale(lastReadingAt: string | null, now = Date.now()): boolean {
  if (!lastReadingAt) return true;
  const t = Date.parse(lastReadingAt);
  return !Number.isFinite(t) || now - t > BATTERY_STALE_MINUTES * 60 * 1000;
}

export function getBatteryDisplay(sensor: {
  current_value: string | null;
  unit_of_measure: string | null;
  status: BatteryStatus;
  last_reading_at: string | null;
}): BatteryDisplay {
  const stale = isBatteryStale(sensor.last_reading_at);
  const value = parseObject(sensor.current_value);

  if (!value) {
    // Legacy text reading, shown as-is.
    const unit = sensor.unit_of_measure && sensor.unit_of_measure !== 'V/A' ? ` ${sensor.unit_of_measure}` : '';
    return {
      primary: sensor.current_value ? `${sensor.current_value}${unit}` : '--',
      details: [],
      history: [],
      alarms: [],
      status: stale ? 'offline' : sensor.status,
      stale,
    };
  }

  const soc = num(value.soc);
  const primaryParts = [`${fmt(value.voltage)} V`];
  if (num(value.current) !== null) primaryParts.push(`${fmt(value.current, 1)} A`);
  if (soc !== null) primaryParts.push(`${fmt(soc, 0)}%`);

  const details: BatteryDisplay['details'] = [];
  const add = (list: BatteryDisplay['details'], label: string, raw: unknown, text: string) => {
    if (raw !== null && raw !== undefined && raw !== '') list.push({ label, value: text });
  };
  add(details, 'Power', value.power, `${fmt(value.power, 0)} W`);
  add(details, 'Temperature', value.temp_f, `${fmt(value.temp_f, 1)} °F`);
  add(details, 'Used since full', value.consumed_ah, `${fmt(value.consumed_ah, 1)} Ah`);
  const ttg = num(value.time_to_go_s);
  if (ttg !== null && ttg > 0) details.push({ label: 'Time to go', value: formatDuration(ttg) });
  add(details, 'Starter', value.starter_voltage, `${fmt(value.starter_voltage)} V`);
  add(details, 'Midpoint', value.midpoint_voltage, `${fmt(value.midpoint_voltage)} V`);
  add(details, 'Midpoint dev.', value.midpoint_deviation_pct, `${fmt(value.midpoint_deviation_pct, 1)}%`);
  add(details, 'Capacity', value.capacity_ah, `${fmt(value.capacity_ah, 0)} Ah`);
  if (typeof value.relay_on === 'number' || typeof value.relay_on === 'boolean') {
    details.push({ label: 'Relay', value: value.relay_on ? 'On' : 'Off' });
  }

  const history: BatteryDisplay['history'] = [];
  add(history, 'Deepest discharge', value.deepest_discharge_ah, `${fmt(value.deepest_discharge_ah, 1)} Ah`);
  add(history, 'Last discharge', value.last_discharge_ah, `${fmt(value.last_discharge_ah, 1)} Ah`);
  add(history, 'Average discharge', value.average_discharge_ah, `${fmt(value.average_discharge_ah, 1)} Ah`);
  add(history, 'Charge cycles', value.charge_cycles, fmt(value.charge_cycles, 0));
  add(history, 'Full discharges', value.full_discharges, fmt(value.full_discharges, 0));
  add(history, 'Total drawn', value.total_ah_drawn, `${fmt(value.total_ah_drawn, 0)} Ah`);
  add(history, 'Lowest voltage', value.min_voltage, `${fmt(value.min_voltage)} V`);
  add(history, 'Highest voltage', value.max_voltage, `${fmt(value.max_voltage)} V`);
  add(history, 'Lowest starter', value.min_starter_voltage, `${fmt(value.min_starter_voltage)} V`);
  add(history, 'Highest starter', value.max_starter_voltage, `${fmt(value.max_starter_voltage)} V`);
  const sinceFull = num(value.seconds_since_full);
  if (sinceFull !== null && sinceFull > 0) history.push({ label: 'Since last full', value: formatDuration(sinceFull) });
  add(history, 'Auto syncs', value.auto_syncs, fmt(value.auto_syncs, 0));
  add(history, 'Low-voltage alarms', value.low_voltage_alarms, fmt(value.low_voltage_alarms, 0));
  add(history, 'High-voltage alarms', value.high_voltage_alarms, fmt(value.high_voltage_alarms, 0));
  add(history, 'Charged energy', value.charged_kwh, `${fmt(value.charged_kwh, 1)} kWh`);
  add(history, 'Discharged energy', value.discharged_kwh, `${fmt(value.discharged_kwh, 1)} kWh`);
  add(history, 'Monitor', value.product, String(value.product));

  const alarms = Array.isArray(value.alarms)
    ? (value.alarms as Array<Record<string, unknown>>)
        .filter(a => a && typeof a.name === 'string')
        .map(a => ({ name: String(a.name), level: String(a.level || 'warning') }))
    : [];

  // Status: the Cerbo's own alarms first, then state of charge.
  let status: BatteryStatus = 'normal';
  if (alarms.some(a => a.level === 'alarm')) status = 'critical';
  else if (alarms.length > 0) status = 'warning';
  if (soc !== null) {
    if (soc < 20) status = 'critical';
    else if (soc < 40 && status === 'normal') status = 'warning';
  }
  if (stale) status = 'offline';

  return { primary: primaryParts.join(' · '), details, history, alarms, status, stale };
}
