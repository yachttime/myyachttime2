import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface DeviceRow {
  id: string;
  device_name: string;
  is_online: boolean;
  last_check_in: string | null;
}

interface SensorRow {
  id: string;
  sensor_name: string;
  sensor_type: string;
  current_value: string | null;
  unit_of_measure: string | null;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  last_reading_at: string | null;
}

interface ReadingRow {
  sensorName: string;
  primary: string;
  status: SensorRow['status'];
  updatedAt: string | null;
}

const REFRESH_MS = 60_000;
const MILES_PER_KM = 0.621371;

const statusPill: Record<SensorRow['status'], string> = {
  normal: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  warning: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  critical: 'text-red-300 bg-red-500/10 border-red-500/30',
  offline: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
};

function formatNumber(value: unknown, maximumFractionDigits = 1): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits }) : '--';
}

function parseReadingObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function describeReading(sensor: SensorRow, value: Record<string, unknown> | null): string {
  const raw = sensor.current_value?.trim();
  if (!raw) return '--';

  if (!value) {
    return sensor.unit_of_measure && sensor.sensor_type !== 'gps' ? `${raw} ${sensor.unit_of_measure}` : raw;
  }

  if (typeof value.distance_km === 'number') {
    return `${formatNumber(value.distance_km * MILES_PER_KM)} mi away`;
  }
  if (typeof value.status === 'string') return value.status;
  if ('mph' in value) return `${formatNumber(value.mph)} mph`;
  if ('deg' in value) return `${formatNumber(value.deg, 0)}°`;
  if ('mm' in value) return `${formatNumber(value.mm)} mm`;

  return Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`).join(', ');
}

function readingRows(sensor: SensorRow): ReadingRow[] {
  const value = sensor.current_value ? parseReadingObject(sensor.current_value.trim()) : null;

  if (value && 'temp_f' in value) {
    const base = { status: sensor.status, updatedAt: sensor.last_reading_at };
    return [
      { ...base, sensorName: 'Temperature', primary: `${formatNumber(value.temp_f)} °F` },
      { ...base, sensorName: 'Humidity', primary: `${formatNumber(value.humidity_pct)}%` },
      {
        ...base,
        sensorName: 'Barometric Pressure',
        primary: `${formatNumber(Number(value.pressure_pa) / 100)} hPa`,
      },
    ];
  }

  return [
    {
      sensorName: sensor.sensor_name,
      primary: describeReading(sensor, value),
      status: sensor.status,
      updatedAt: sensor.last_reading_at,
    },
  ];
}

function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString() : '--';
}

export function VesselMonitoringTab({ yachtId }: { yachtId: string }) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [devicesRes, sensorsRes] = await Promise.all([
      supabase
        .from('vessel_monitor_devices')
        .select('id, device_name, is_online, last_check_in')
        .eq('yacht_id', yachtId),
      supabase
        .from('vessel_monitor_sensors')
        .select('id, sensor_name, sensor_type, current_value, unit_of_measure, status, last_reading_at')
        .eq('yacht_id', yachtId)
        .order('sensor_name'),
    ]);

    if (devicesRes.error || sensorsRes.error) {
      setError('Vessel readings could not be loaded. They will retry shortly.');
    } else {
      setError('');
      setDevices((devicesRes.data as DeviceRow[]) ?? []);
      setSensors((sensorsRes.data as SensorRow[]) ?? []);
    }
    setLoading(false);
  }, [yachtId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const visibleRows = useMemo(() => {
    const rows = sensors.flatMap(readingRows);
    const namesWithValue = new Set(rows.filter((row) => row.primary !== '--').map((row) => row.sensorName));
    return rows
      .filter((row) => row.primary !== '--' || !namesWithValue.has(row.sensorName))
      .sort((a, b) => a.sensorName.localeCompare(b.sensorName));
  }, [sensors]);

  if (loading) {
    return <p className="text-slate-400">Loading vessel readings...</p>;
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-red-400">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Devices</h2>
        {devices.length === 0 ? (
          <p className="text-slate-400">No monitoring devices are set up for this yacht.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
                <span className="font-medium">{device.device_name}</span>
                <span className={device.is_online ? 'text-emerald-400 text-sm' : 'text-slate-500 text-sm'}>
                  {device.is_online ? 'Online' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Readings</h2>
        {visibleRows.length === 0 ? (
          <p className="text-slate-400">No sensors are set up for this yacht yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Sensor</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Reading</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-800/40">
                {visibleRows.map((row) => (
                  <tr key={row.sensorName} className="align-middle">
                    <td className="px-4 py-3 font-medium text-white">{row.sensorName}</td>
                    <td className="px-4 py-3 text-lg font-semibold text-white">{row.primary}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusPill[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-400">{formatTime(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
