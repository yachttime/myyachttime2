import { useCallback, useEffect, useState } from 'react';
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
  current_value: string | null;
  unit_of_measure: string | null;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  last_reading_at: string | null;
}

const REFRESH_MS = 60_000;

const statusClass: Record<SensorRow['status'], string> = {
  normal: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  offline: 'text-slate-500',
};

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
        .select('id, sensor_name, current_value, unit_of_measure, status, last_reading_at')
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
        {sensors.length === 0 ? (
          <p className="text-slate-400">No sensors are set up for this yacht yet.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {sensors.map((sensor) => (
              <div key={sensor.id} className="rounded-xl bg-slate-800 px-4 py-4 space-y-1">
                <p className="text-sm text-slate-400">{sensor.sensor_name}</p>
                <p className={`text-2xl font-semibold ${statusClass[sensor.status]}`}>
                  {sensor.current_value ?? '--'}
                  {sensor.current_value && sensor.unit_of_measure ? ` ${sensor.unit_of_measure}` : ''}
                </p>
                <p className="text-xs text-slate-500 capitalize">{sensor.status}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
