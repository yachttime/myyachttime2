import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { isStaffRole, UserRole } from '../lib/supabase';
import {
  Activity, AlertTriangle, Battery, Gauge, Navigation, Wind,
  Droplets, Zap, Thermometer, Lock, Shield, ChevronRight,
  Plus, Wifi, WifiOff, CheckCircle, XCircle, Clock, Radio,
  Key, Download, MapPin, CloudRain, CloudLightning, RefreshCw, Copy,
} from 'lucide-react';

interface MonitorDevice {
  id: string;
  yacht_id: string;
  company_id: string;
  device_serial: string;
  device_name: string;
  device_type: 'orion_tough' | 'weather_station';
  firmware_version: string | null;
  api_key: string;
  is_online: boolean;
  last_check_in: string | null;
  installation_date: string;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_updated_at: string | null;
  wifi_synced_at: string | null;
  key_replaced_at: string | null;
  metadata: any;
}

interface MonitorSensor {
  id: string;
  device_id: string;
  port_id: string | null;
  yacht_id: string;
  company_id: string;
  sensor_type: string;
  sensor_name: string;
  current_value: string | null;
  unit_of_measure: string | null;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  last_reading_at: string | null;
  min_threshold: number | null;
  max_threshold: number | null;
}

interface MonitorAlert {
  id: string;
  sensor_id: string | null;
  device_id: string | null;
  yacht_id: string;
  company_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  is_active: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface Enrollment {
  id: string;
  yacht_id: string;
  provider_company_id: string;
  yacht_company_id: string;
  status: string;
  plan_tier: string;
  start_date: string | null;
  end_date: string | null;
  yachts?: { name: string };
  provider_company?: { company_name: string };
  yacht_company?: { company_name: string };
}

interface SmartDevice {
  id: string;
  yacht_id: string;
  device_name: string;
  device_type: string;
  location: string | null;
  is_active: boolean;
  online_status: boolean;
  battery_level: number | null;
  lock_provider: string | null;
  current_lock_state: boolean | null;
}

interface YachtInfo {
  id: string;
  name: string;
  company_id: string;
  wifi_name: string | null;
  wifi_password: string | null;
}

const SENSOR_ICONS: Record<string, any> = {
  bilge_pump: Droplets,
  water_pump: Droplets,
  ac_pump: Zap,
  battery_bank: Battery,
  engine_alternator: Zap,
  wind_vane: Wind,
  environment: Thermometer,
  gps: Navigation,
  anemometer: Wind,
  smart_lock: Lock,
};

const STATUS_COLORS: Record<string, string> = {
  normal: 'text-green-400 bg-green-500/10 border-green-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  offline: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const PORT_LABELS: Record<string, { name: string; type: string }> = {
  A: { name: 'Pumps & Bilge', type: 'digital' },
  B: { name: 'Alternators & ENV III', type: 'i2c' },
  C: { name: 'Available / Future', type: 'free' },
};

const PORT_A_CHANNELS = [
  { channel: 'Ch1 (IO0)', label: 'Engine Room Starboard Bilge Pump', sensorName: 'Engine Room Starboard Bilge Pump' },
  { channel: 'Ch2 (IO1)', label: 'Aft Bilge Pump', sensorName: 'Aft Bilge Pump' },
  { channel: 'Ch3 (IO2)', label: 'Midship Bilge Pump', sensorName: 'Midship Bilge Pump' },
  { channel: 'Ch4 (IO3)', label: 'High Water Alarm', sensorName: 'High Water Alarm' },
  { channel: 'Ch5 (IO4)', label: 'A/C Water Pump (CU 301 relay)', sensorName: 'A/C Water Pump' },
  { channel: 'Ch6 (IO5)', label: 'Fresh Water Pump (CU 301 relay)', sensorName: 'Fresh Water Pump' },
  { channel: 'Ch7-8', label: 'Free', sensorName: null },
] as const;

const ONLINE_STALE_MS = 15 * 60 * 1000;
const GPS_LIVE_MS = 15 * 60 * 1000;
const TELEMETRY_URL = 'https://eqiecntollhgfxmmbize.supabase.co/functions/v1/vessel-monitor-telemetry';

function isDeviceEffectivelyOnline(device: MonitorDevice): boolean {
  if (!device.is_online) return false;
  if (!device.last_check_in) return false;
  return Date.now() - new Date(device.last_check_in).getTime() < ONLINE_STALE_MS;
}

const BATTERY_BANK_SENSORS = [
  { sensor_type: 'battery_bank', sensor_name: 'Port Engine Battery', unit_of_measure: 'V/A' },
  { sensor_type: 'battery_bank', sensor_name: 'Starboard Engine Battery', unit_of_measure: 'V/A' },
  { sensor_type: 'battery_bank', sensor_name: 'Port Generator Battery', unit_of_measure: 'V/A' },
  { sensor_type: 'battery_bank', sensor_name: 'Starboard Generator Battery', unit_of_measure: 'V/A' },
  { sensor_type: 'battery_bank', sensor_name: 'Inverter Batteries', unit_of_measure: 'V/A' },
  { sensor_type: 'battery_bank', sensor_name: '12V System Battery', unit_of_measure: 'V/A' },
];

const DEFAULT_SENSORS: Record<string, { sensor_type: string; sensor_name: string; unit_of_measure: string }[]> = {
  A: [
    { sensor_type: 'bilge_pump', sensor_name: 'Engine Room Starboard Bilge Pump', unit_of_measure: 'on/off' },
    { sensor_type: 'bilge_pump', sensor_name: 'Aft Bilge Pump', unit_of_measure: 'on/off' },
    { sensor_type: 'bilge_pump', sensor_name: 'Midship Bilge Pump', unit_of_measure: 'on/off' },
    { sensor_type: 'bilge_pump', sensor_name: 'High Water Alarm', unit_of_measure: 'on/off' },
    { sensor_type: 'ac_pump', sensor_name: 'A/C Water Pump', unit_of_measure: 'on/off' },
    { sensor_type: 'water_pump', sensor_name: 'Fresh Water Pump', unit_of_measure: 'on/off' },
  ],
  B: [
    { sensor_type: 'engine_alternator', sensor_name: 'Port Engine Alternator', unit_of_measure: 'V' },
    { sensor_type: 'engine_alternator', sensor_name: 'Starboard Engine Alternator', unit_of_measure: 'V' },
    { sensor_type: 'engine_alternator', sensor_name: 'Port Generator Alternator', unit_of_measure: 'V' },
    { sensor_type: 'engine_alternator', sensor_name: 'Starboard Generator Alternator', unit_of_measure: 'V' },
    { sensor_type: 'environment', sensor_name: 'Temperature', unit_of_measure: 'F' },
    { sensor_type: 'environment', sensor_name: 'Humidity', unit_of_measure: '%' },
    { sensor_type: 'environment', sensor_name: 'Barometric Pressure', unit_of_measure: 'hPa' },
  ],
  C: [],
};

const WEATHER_STATION_SENSORS = [
  { sensor_type: 'anemometer', sensor_name: 'Wind Speed', unit_of_measure: 'mph' },
  { sensor_type: 'wind_vane', sensor_name: 'Wind Direction', unit_of_measure: 'degrees' },
  { sensor_type: 'environment', sensor_name: 'Rainfall', unit_of_measure: 'mm' },
  { sensor_type: 'environment', sensor_name: 'Atmospheric', unit_of_measure: 'F' },
  { sensor_type: 'environment', sensor_name: 'Lightning Strike', unit_of_measure: 'km' },
];

const DEVICE_TYPE_LABELS: Record<string, string> = {
  orion_tough: 'ORION Tough',
  weather_station: 'Weather Station',
};

const DEVICE_TYPE_ICONS: Record<string, any> = {
  orion_tough: Radio,
  weather_station: CloudRain,
};

type WeatherDisplay = {
  primary: string;
  details: Array<{ label: string; value: string }>;
};

function formatWeatherNumber(value: unknown, maximumFractionDigits = 2): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return number.toLocaleString(undefined, { maximumFractionDigits });
}

function parseSensorValue(sensor: MonitorSensor): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(sensor.current_value || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function getSensorStatus(sensor: MonitorSensor): MonitorSensor['status'] {
  if (sensor.sensor_name === 'Lightning Strike') {
    const value = parseSensorValue(sensor);
    if (value?.status === 'Strike detected' || typeof value?.distance_km === 'number') return 'critical';
    if (value?.status === 'No strikes detected') return 'normal';
  }
  return sensor.status;
}

function getWeatherDisplay(sensor: MonitorSensor): WeatherDisplay {
  const value = parseSensorValue(sensor);

  if (!value) {
    return {
      primary: `${sensor.current_value || '--'}${sensor.unit_of_measure ? ` ${sensor.unit_of_measure}` : ''}`,
      details: [],
    };
  }

  if (sensor.sensor_name === 'Atmospheric') {
    return {
      primary: `${formatWeatherNumber(value.temp_f)} °F`,
      details: [
        { label: 'Humidity', value: `${formatWeatherNumber(value.humidity_pct)}%` },
        { label: 'Pressure', value: `${formatWeatherNumber(Number(value.pressure_pa) / 100, 1)} hPa` },
      ],
    };
  }

  if (sensor.sensor_name === 'Wind Speed') {
    return { primary: `${formatWeatherNumber(value.mph)} mph`, details: [] };
  }

  if (sensor.sensor_name === 'Wind Direction') {
    return { primary: `${formatWeatherNumber(value.deg, 0)}°`, details: [] };
  }

  if (sensor.sensor_name === 'Rainfall') {
    return { primary: `${formatWeatherNumber(value.mm)} mm`, details: [] };
  }

  if (sensor.sensor_name === 'Lightning Strike') {
    if (value.status === 'Strike detected') {
      return { primary: `${formatWeatherNumber(Number(value.distance_km) * 0.621371, 1)} miles away`, details: [] };
    }
    if (value.status === 'No strikes detected') {
      return { primary: 'No strikes detected', details: [] };
    }
    if (value.distance_km !== undefined) {
      return { primary: `${formatWeatherNumber(Number(value.distance_km) * 0.621371, 1)} miles away`, details: [] };
    }
    return { primary: 'No strikes', details: [] };
  }

  return { primary: JSON.stringify(value), details: [] };
}

export function VesselMonitoring({ effectiveRole }: { effectiveRole: UserRole }) {
  const { isMaster, selectedCompany } = useCompany();
  const [view, setView] = useState<'fleet' | 'yacht' | 'enroll' | 'devices'>('fleet');
  const [selectedYachtId, setSelectedYachtId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [devices, setDevices] = useState<MonitorDevice[]>([]);
  const [sensors, setSensors] = useState<MonitorSensor[]>([]);
  const [alerts, setAlerts] = useState<MonitorAlert[]>([]);
  const [smartDevices, setSmartDevices] = useState<SmartDevice[]>([]);
  const [yachts, setYachts] = useState<YachtInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<MonitorDevice | null>(null);
  const [companies, setCompanies] = useState<Array<{ id: string; company_name: string; offers_monitoring: boolean }>>([]);
  const [enrollForm, setEnrollForm] = useState({ yacht_id: '', provider_company_id: '', plan_tier: 'standard' });
  const [deviceForm, setDeviceForm] = useState({
    yacht_id: '',
    device_serial: '',
    device_name: 'M5 Tough',
    device_type: 'orion_tough' as 'orion_tough' | 'weather_station',
    firmware_version: '',
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalData, setKeyModalData] = useState<{ deviceName: string; apiKey: string; deviceSerial: string; isNew: boolean } | null>(null);
  const [showReplaceKeyConfirm, setShowReplaceKeyConfirm] = useState<string | null>(null);
  const [firmwareLoading, setFirmwareLoading] = useState<string | null>(null);

  const loadEnrollments = useCallback(async () => {
    let query = supabase
      .from('vessel_monitoring_enrollments')
      .select(`
        *,
        yachts:yacht_id (name),
        provider_company:provider_company_id (company_name),
        yacht_company:yacht_company_id (company_name)
      `)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false });

    const { data, error: err } = await query;
    if (err) { setError(err.message); return; }
    setEnrollments(data || []);
  }, []);

  const loadDevices = useCallback(async (yachtId?: string) => {
    let query = supabase.from('vessel_monitor_devices').select('*').order('created_at', { ascending: false });
    if (yachtId) query = query.eq('yacht_id', yachtId);
    const { data, error: err } = await query;
    if (err) { setError(err.message); return; }
    setDevices(data || []);
  }, []);

  const loadSensors = useCallback(async (yachtId?: string) => {
    let query = supabase.from('vessel_monitor_sensors').select('*').order('sensor_name');
    if (yachtId) query = query.eq('yacht_id', yachtId);
    const { data, error: err } = await query;
    if (err) { return; }
    setSensors(data || []);
  }, []);

  const loadAlerts = useCallback(async (yachtId?: string) => {
    let query = supabase.from('vessel_monitor_alerts')
      .select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(50);
    if (yachtId) query = query.eq('yacht_id', yachtId);
    const { data, error: err } = await query;
    if (err) { return; }
    setAlerts(data || []);
  }, []);

  const loadSmartDevices = useCallback(async (yachtId: string) => {
    const { data } = await supabase
      .from('yacht_smart_devices')
      .select('id, yacht_id, device_name, device_type, location, is_active, online_status, battery_level, lock_provider, current_lock_state')
      .eq('yacht_id', yachtId)
      .eq('is_active', true)
      .order('device_name');
    setSmartDevices(data || []);
  }, []);

  const loadYachts = useCallback(async () => {
    let query = supabase.from('yachts').select('id, name, company_id, wifi_name, wifi_password').order('name');
    if (!isMaster && selectedCompany?.id) {
      query = query.eq('company_id', selectedCompany.id);
    }
    const { data } = await query;
    setYachts(data || []);
  }, [isMaster, selectedCompany]);

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase.from('companies').select('id, company_name, offers_monitoring').order('company_name');
    setCompanies(data || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    await Promise.all([loadEnrollments(), loadDevices(), loadSensors(), loadAlerts(), loadYachts(), loadCompanies()]);
    setLoading(false);
  }, [loadEnrollments, loadDevices, loadSensors, loadAlerts, loadYachts, loadCompanies]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (selectedYachtId) {
      loadDevices(selectedYachtId);
      loadSensors(selectedYachtId);
      loadAlerts(selectedYachtId);
      loadSmartDevices(selectedYachtId);
    }
  }, [selectedYachtId, loadDevices, loadSensors, loadAlerts, loadSmartDevices]);

  useEffect(() => {
    const deviceChannel = supabase.channel('monitor_devices_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vessel_monitor_devices' }, () => loadDevices())
      .subscribe();
    const sensorChannel = supabase.channel('monitor_sensors_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vessel_monitor_sensors' }, () => loadSensors())
      .subscribe();
    const alertChannel = supabase.channel('monitor_alerts_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vessel_monitor_alerts' }, () => loadAlerts())
      .subscribe();
    return () => { deviceChannel.unsubscribe(); sensorChannel.unsubscribe(); alertChannel.unsubscribe(); };
  }, [loadDevices, loadSensors, loadAlerts]);

  // ---- Auto-provision two devices when enrolling a yacht ----
  const provisionDevice = async (
    yachtId: string,
    companyId: string,
    deviceType: 'orion_tough' | 'weather_station',
    yacht: YachtInfo
  ): Promise<{ id: string; api_key: string; device_serial: string } | null> => {
    const apiKey = crypto.randomUUID();
    const deviceName = deviceType === 'orion_tough' ? 'ORION Tough' : 'Weather Station';
    const placeholderSerial = deviceType === 'orion_tough'
      ? `TOUGH-${yacht.name.toUpperCase().replace(/\s+/g, '')}-PENDING`
      : `WX-${yacht.name.toUpperCase().replace(/\s+/g, '')}-PENDING`;

    const { data: newDevice, error: err } = await supabase.from('vessel_monitor_devices').insert({
      yacht_id: yachtId,
      company_id: companyId,
      device_serial: placeholderSerial,
      device_name: deviceName,
      device_type: deviceType,
      firmware_version: null,
      api_key: apiKey,
      is_online: false,
      installation_date: new Date().toISOString(),
    }).select().single();

    if (err || !newDevice) {
      setError(err?.message || 'Failed to create device');
      return null;
    }

    // Create default ports and sensors for Tough; sensors only for weather station
    if (deviceType === 'orion_tough') {
      for (const [label, info] of Object.entries(PORT_LABELS)) {
        const { data: port } = await supabase.from('vessel_monitor_ports').insert({
          device_id: newDevice.id,
          port_label: label,
          port_name: info.name,
          port_type: info.type,
        }).select().single();

        for (const def of DEFAULT_SENSORS[label] || []) {
          await supabase.from('vessel_monitor_sensors').insert({
            device_id: newDevice.id,
            port_id: port?.id || null,
            yacht_id: yachtId,
            company_id: companyId,
            sensor_type: def.sensor_type,
            sensor_name: def.sensor_name,
            unit_of_measure: def.unit_of_measure,
            status: 'offline',
          });
        }
      }

      // Battery bank sensors (Cerbo GX via MQTT — not tied to a physical port)
      for (const def of BATTERY_BANK_SENSORS) {
        await supabase.from('vessel_monitor_sensors').insert({
          device_id: newDevice.id,
          port_id: null,
          yacht_id: yachtId,
          company_id: companyId,
          sensor_type: def.sensor_type,
          sensor_name: def.sensor_name,
          unit_of_measure: def.unit_of_measure,
          status: 'offline',
        });
      }
    } else {
        for (const def of WEATHER_STATION_SENSORS) {
          await supabase.from('vessel_monitor_sensors').insert({
            device_id: newDevice.id,
            port_id: null,
            yacht_id: yachtId,
            company_id: companyId,
            sensor_type: def.sensor_type,
            sensor_name: def.sensor_name,
            unit_of_measure: def.unit_of_measure,
            status: 'offline',
          });
        }
      }

    return { id: newDevice.id, api_key: apiKey, device_serial: placeholderSerial };
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollForm.yacht_id || !enrollForm.provider_company_id) return;
    setSubmitLoading(true);
    setError('');
    const yacht = yachts.find(y => y.id === enrollForm.yacht_id);
    if (!yacht) { setError('Yacht not found'); setSubmitLoading(false); return; }
    const { error: err } = await supabase.from('vessel_monitoring_enrollments').insert({
      yacht_id: enrollForm.yacht_id,
      provider_company_id: enrollForm.provider_company_id,
      yacht_company_id: yacht.company_id,
      plan_tier: enrollForm.plan_tier,
      start_date: new Date().toISOString().split('T')[0],
    });
    if (err) { setError(err.message); setSubmitLoading(false); return; }

    // Auto-provision both devices
    const toughResult = await provisionDevice(enrollForm.yacht_id, yacht.company_id, 'orion_tough', yacht);
    const weatherResult = await provisionDevice(enrollForm.yacht_id, yacht.company_id, 'weather_station', yacht);

    setShowEnrollModal(false);
    setEnrollForm({ yacht_id: '', provider_company_id: '', plan_tier: 'standard' });
    setSubmitLoading(false);
    loadEnrollments();
    loadDevices();

    // Show the keys once after creation
    if (toughResult && weatherResult) {
      setKeyModalData({
        deviceName: 'Both Devices Created',
        apiKey: `Tough: ${toughResult.api_key}\nWeather: ${weatherResult.api_key}`,
        deviceSerial: `Tough: ${toughResult.device_serial}\nWeather: ${weatherResult.device_serial}`,
        isNew: true,
      });
      setShowKeyModal(true);
    }
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceForm.yacht_id || !deviceForm.device_serial) return;
    setSubmitLoading(true);
    setError('');
    const yacht = yachts.find(y => y.id === deviceForm.yacht_id);
    if (!yacht) { setError('Yacht not found'); setSubmitLoading(false); return; }
    const apiKey = crypto.randomUUID();
    const payload = {
      yacht_id: deviceForm.yacht_id,
      company_id: yacht.company_id,
      device_serial: deviceForm.device_serial,
      device_name: deviceForm.device_name || (deviceForm.device_type === 'orion_tough' ? 'ORION Tough' : 'Weather Station'),
      device_type: deviceForm.device_type,
      firmware_version: deviceForm.firmware_version || null,
      api_key: apiKey,
      is_online: false,
      installation_date: new Date().toISOString(),
    };
    if (editingDevice) {
      const { error: err } = await supabase.from('vessel_monitor_devices')
        .update({ device_name: deviceForm.device_name, firmware_version: deviceForm.firmware_version || null })
        .eq('id', editingDevice.id);
      if (err) setError(err.message);
    } else {
      const { error: err, data: newDevice } = await supabase.from('vessel_monitor_devices').insert(payload).select().single();
      if (err) { setError(err.message); setSubmitLoading(false); return; }

      // Create default sensors
      const sensorDefs = deviceForm.device_type === 'orion_tough'
        ? Object.entries(PORT_LABELS).flatMap(([label, info]) =>
            (DEFAULT_SENSORS[label] || []).map(def => ({ ...def, port_label: label, port_type: info.type, port_name: info.name }))
          )
        : WEATHER_STATION_SENSORS.map(s => ({ ...s, port_label: null }));

      if (deviceForm.device_type === 'orion_tough') {
        for (const [label, info] of Object.entries(PORT_LABELS)) {
          const { data: port } = await supabase.from('vessel_monitor_ports').insert({
            device_id: newDevice.id,
            port_label: label,
            port_name: info.name,
            port_type: info.type,
          }).select().single();

          for (const def of DEFAULT_SENSORS[label] || []) {
            await supabase.from('vessel_monitor_sensors').insert({
              device_id: newDevice.id,
              port_id: port?.id || null,
              yacht_id: deviceForm.yacht_id,
              company_id: yacht.company_id,
              sensor_type: def.sensor_type,
              sensor_name: def.sensor_name,
              unit_of_measure: def.unit_of_measure,
              status: 'offline',
            });
          }
        }

        // Battery bank sensors (Cerbo GX via MQTT)
        for (const def of BATTERY_BANK_SENSORS) {
          await supabase.from('vessel_monitor_sensors').insert({
            device_id: newDevice.id,
            port_id: null,
            yacht_id: deviceForm.yacht_id,
            company_id: yacht.company_id,
            sensor_type: def.sensor_type,
            sensor_name: def.sensor_name,
            unit_of_measure: def.unit_of_measure,
            status: 'offline',
          });
        }
      } else {
        for (const def of WEATHER_STATION_SENSORS) {
          await supabase.from('vessel_monitor_sensors').insert({
            device_id: newDevice.id,
            port_id: null,
            yacht_id: deviceForm.yacht_id,
            company_id: yacht.company_id,
            sensor_type: def.sensor_type,
            sensor_name: def.sensor_name,
            unit_of_measure: def.unit_of_measure,
            status: 'offline',
          });
        }
      }

      setKeyModalData({
        deviceName: deviceForm.device_name,
        apiKey,
        deviceSerial: deviceForm.device_serial,
        isNew: true,
      });
      setShowKeyModal(true);
    }
    setShowDeviceModal(false);
    setEditingDevice(null);
    setDeviceForm({ yacht_id: '', device_serial: '', device_name: 'M5 Tough', device_type: 'orion_tough', firmware_version: '' });
    setSubmitLoading(false);
    loadDevices();
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    const { error: err } = await supabase.from('vessel_monitor_alerts')
      .update({ is_active: false, acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);
    if (err) return;
    loadAlerts();
  };

  const handleToggleMonitoring = async (companyId: string, currentValue: boolean) => {
    await supabase.from('companies').update({ offers_monitoring: !currentValue }).eq('id', companyId);
    loadCompanies();
  };

  // ---- Replace Key ----
  const handleReplaceKey = async (deviceId: string) => {
    const newKey = crypto.randomUUID();
    const { error: err } = await supabase.from('vessel_monitor_devices')
      .update({ api_key: newKey, key_replaced_at: new Date().toISOString() })
      .eq('id', deviceId);
    if (err) { setError(err.message); setShowReplaceKeyConfirm(null); return; }

    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setKeyModalData({
        deviceName: device.device_name,
        apiKey: newKey,
        deviceSerial: device.device_serial,
        isNew: false,
      });
      setShowKeyModal(true);
    }
    setShowReplaceKeyConfirm(null);
    loadDevices();
  };

  // ---- Firmware download ----
  const handleDownloadFirmware = async (device: MonitorDevice) => {
    setFirmwareLoading(device.id);
    try {
      const yacht = yachts.find(y => y.id === device.yacht_id);
      const wifiName = yacht?.wifi_name || 'AZMarine';
      const wifiPassword = yacht?.wifi_password || '9286376500';

      let firmwareContent = '';
      let filename = '';

      if (device.device_type === 'orion_tough') {
        const response = await fetch('/firmware/ORION_tough_firmware_combined.ino');
        firmwareContent = await response.text();
        filename = `ORION_tough_${device.device_serial}.ino`;

        // Replace the device key, serial, and bootstrap WiFi
        firmwareContent = firmwareContent.replace(
          /const char\* DEVICE_API_KEY  = "[^"]*";/,
          `const char* DEVICE_API_KEY  = "${device.api_key}";`
        );
        firmwareContent = firmwareContent.replace(
          /const char\* DEVICE_SERIAL   = "[^"]*";/,
          `const char* DEVICE_SERIAL   = "${device.device_serial}";`
        );
        firmwareContent = firmwareContent.replace(
          /\{"AZMarine", "9286376500"\}/,
          `{"${wifiName}", "${wifiPassword}"}`
        );
      } else {
        const response = await fetch('/firmware/weather_station_firmware.ino');
        firmwareContent = await response.text();
        filename = `weather_station_${device.device_serial}.ino`;

        firmwareContent = firmwareContent.replace(
          /const char\* DEVICE_API_KEY = "YOUR_WEATHER_STATION_DEVICE_KEY";/,
          `const char* DEVICE_API_KEY = "${device.api_key}";`
        );
        firmwareContent = firmwareContent.replace(
          /const char\* DEVICE_SERIAL  = "YOUR_WEATHER_STATION_DEVICE_SERIAL";/,
          `const char* DEVICE_SERIAL  = "${device.device_serial}";`
        );
        firmwareContent = firmwareContent.replace(
          /\{"AZMarine", "9286376500"\}/,
          `{"${wifiName}", "${wifiPassword}"}`
        );
      }

      const blob = new Blob([firmwareContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Failed to generate firmware: ' + (e as Error).message);
    }
    setFirmwareLoading(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const enrolledYachtIds = new Set(enrollments.map(e => e.yacht_id));
  const fleetYachts = yachts.filter(y => enrolledYachtIds.has(y.id));
  const onlineCount = devices.filter(isDeviceEffectivelyOnline).length;
  const offlineCount = devices.filter(d => !isDeviceEffectivelyOnline(d)).length;
  const activeAlertCount = alerts.length;
  const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;

  const sensorsByPort: Record<string, MonitorSensor[]> = { A: [], B: [], C: [], D: [] };
  const yachtSensors = sensors.filter(s => s.yacht_id === selectedYachtId);
  yachtSensors.forEach(s => {
    if (s.sensor_type === 'battery_bank') return; // battery banks shown in their own section
    const port = Object.entries(PORT_LABELS).find(([_, info]) => {
      if (info.name === 'Pumps' && ['bilge_pump', 'water_pump', 'ac_pump'].includes(s.sensor_type)) return true;
      if (info.name === 'Alternators & ENV III' && ['engine_alternator', 'environment'].includes(s.sensor_type)) return true;
      return false;
    });
    if (port) sensorsByPort[port[0]].push(s);
  });

  const selectedYacht = yachts.find(y => y.id === selectedYachtId);
  const selectedYachtEnrollment = enrollments.find(e => e.yacht_id === selectedYachtId);
  const selectedYachtDevices = devices.filter(d => d.yacht_id === selectedYachtId);
  const toughDevice = selectedYachtDevices.find(d => d.device_type === 'orion_tough');
  const weatherDevice = selectedYachtDevices.find(d => d.device_type === 'weather_station');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // ===== KEY MODAL =====
  if (showKeyModal && keyModalData) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-lg w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              {keyModalData.isNew ? 'Device Keys Created' : 'New API Key Generated'}
            </h3>
            <button onClick={() => { setShowKeyModal(false); setKeyModalData(null); }} className="text-slate-400 hover:text-white">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg px-4 py-3 mb-4 text-sm">
            Copy these credentials now. For security, the API key will not be shown again after closing this window.
            {keyModalData.isNew ? ' You can replace it later if needed.' : ' The old key has been deactivated immediately.'}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Device Serial</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-300 break-all">{keyModalData.deviceSerial}</code>
                <button onClick={() => copyToClipboard(keyModalData.deviceSerial)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">API Key</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-300 break-all">{keyModalData.apiKey}</code>
                <button onClick={() => copyToClipboard(keyModalData.apiKey)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <button onClick={() => { setShowKeyModal(false); setKeyModalData(null); }} className="w-full mt-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors">
            I've Copied the Credentials
          </button>
        </div>
      </div>
    );
  }

  // ===== FLEET DASHBOARD =====
  if (view === 'fleet') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Activity className="w-7 h-7 text-cyan-400" />
              Vessel Monitoring
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {isMaster ? 'All monitored yachts across all companies' : 'Monitored yachts for your company'}
            </p>
          </div>
          {isMaster && (
            <button
              onClick={() => { setShowEnrollModal(true); setEnrollForm({ yacht_id: '', provider_company_id: selectedCompany?.id || '', plan_tier: 'standard' }); }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Enroll Yacht
            </button>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/20 p-3 rounded-lg"><Shield className="w-6 h-6 text-cyan-400" /></div>
              <div><p className="text-2xl font-bold">{fleetYachts.length}</p><p className="text-slate-400 text-xs">Yachts Monitored</p></div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-3 rounded-lg"><Wifi className="w-6 h-6 text-green-400" /></div>
              <div><p className="text-2xl font-bold">{onlineCount}</p><p className="text-slate-400 text-xs">Online</p></div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="bg-slate-500/20 p-3 rounded-lg"><WifiOff className="w-6 h-6 text-slate-400" /></div>
              <div><p className="text-2xl font-bold">{offlineCount}</p><p className="text-slate-400 text-xs">Offline</p></div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${criticalAlertCount > 0 ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                <AlertTriangle className={`w-6 h-6 ${criticalAlertCount > 0 ? 'text-red-400' : 'text-amber-400'}`} />
              </div>
              <div><p className="text-2xl font-bold">{activeAlertCount}</p><p className="text-slate-400 text-xs">Active Alerts</p></div>
            </div>
          </div>
        </div>

        {fleetYachts.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 mb-1">No yachts are enrolled in monitoring yet</p>
            {isMaster && <p className="text-slate-500 text-sm">Click "Enroll Yacht" to get started — both devices are created automatically</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fleetYachts.map(yacht => {
              const yachtDevices = devices.filter(d => d.yacht_id === yacht.id);
              const yachtAlerts = alerts.filter(a => a.yacht_id === yacht.id);
              const enrollment = enrollments.find(e => e.yacht_id === yacht.id);
              const isOnline = yachtDevices.some(isDeviceEffectivelyOnline);
              const criticalAlerts = yachtAlerts.filter(a => a.severity === 'critical');
              const tough = yachtDevices.find(d => d.device_type === 'orion_tough');
              const hasGps = tough?.gps_lat != null && tough?.gps_lng != null;
              return (
                <button
                  key={yacht.id}
                  onClick={() => { setSelectedYachtId(yacht.id); setView('yacht'); }}
                  className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700 hover:border-cyan-500 transition-all duration-300 hover:scale-[1.02] text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${isOnline ? 'bg-green-500/20' : 'bg-slate-500/20'}`}>
                        <Radio className={`w-6 h-6 ${isOnline ? 'text-green-400' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{yacht.name}</h3>
                        {enrollment?.provider_company?.company_name && (
                          <p className="text-slate-400 text-xs">Provider: {enrollment.provider_company.company_name}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${isOnline ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-slate-400 bg-slate-500/10 border-slate-500/30'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                    {yachtDevices.length > 0 && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> {yachtDevices.length} device{yachtDevices.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {hasGps && (
                      <span className="text-xs text-cyan-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> GPS
                      </span>
                    )}
                    {yachtAlerts.length > 0 && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${criticalAlerts.length > 0 ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'}`}>
                        {yachtAlerts.length} alert{yachtAlerts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const yachtSensorsList = sensors.filter(s => s.yacht_id === yacht.id);
                    const categories: { label: string; icon: any; types: string[] }[] = [
                      { label: 'Batteries', icon: Battery, types: ['battery_bank'] },
                      { label: 'Alternators', icon: Zap, types: ['engine_alternator'] },
                      { label: 'Environment', icon: Thermometer, types: ['environment'] },
                      { label: 'Weather', icon: Wind, types: ['anemometer', 'wind_vane'] },
                    ];
                    const activeCats = categories
                      .map(c => ({ ...c, count: yachtSensorsList.filter(s => c.types.includes(s.sensor_type) && s.status !== 'offline').length, total: yachtSensorsList.filter(s => c.types.includes(s.sensor_type)).length }))
                      .filter(c => c.total > 0);
                    const hasGpsSensor = yachtSensorsList.some(s => s.sensor_type === 'gps');
                    if (activeCats.length === 0 && !hasGps && !hasGpsSensor && !tough) return null;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        {activeCats.map(c => {
                          const Icon = c.icon;
                          return (
                            <span key={c.label} className={`text-xs px-2 py-1 rounded-lg border flex items-center gap-1.5 ${c.count > 0 ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-slate-500 bg-slate-500/5 border-slate-600/40'}`}>
                              <Icon className="w-3 h-3" />
                              {c.label} {c.count}/{c.total}
                            </span>
                          );
                        })}
                        {hasGps && (
                          <span className="text-xs px-2 py-1 rounded-lg border flex items-center gap-1.5 text-cyan-400 bg-cyan-500/10 border-cyan-500/20">
                            <Navigation className="w-3 h-3" /> GPS Active
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        )}

        {alerts.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Recent Alerts
            </h3>
            <div className="space-y-2">
              {alerts.slice(0, 10).map(alert => {
                const yachtName = yachts.find(y => y.id === alert.yacht_id)?.name || 'Unknown';
                return (
                  <div key={alert.id} className={`rounded-lg px-4 py-3 border flex items-center justify-between ${SEVERITY_COLORS[alert.severity]}`}>
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs opacity-70">{yachtName} - {new Date(alert.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {(isMaster || isStaffRole(effectiveRole)) && (
                      <button
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Acknowledge
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isMaster && companies.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Monitoring Providers
            </h3>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              {companies.map(company => (
                <div key={company.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-700 last:border-0">
                  <div>
                    <p className="font-medium">{company.company_name}</p>
                    <p className="text-xs text-slate-400">{company.offers_monitoring ? 'Monitoring provider' : 'Not a provider'}</p>
                  </div>
                  <button
                    onClick={() => handleToggleMonitoring(company.id, company.offers_monitoring)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${company.offers_monitoring ? 'bg-cyan-600' : 'bg-slate-600'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${company.offers_monitoring ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showEnrollModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Enroll Yacht in Monitoring</h3>
                <button onClick={() => setShowEnrollModal(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 mb-3 text-sm">{error}</div>}
              <div className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg px-3 py-2 mb-3 text-sm">
                Enrolling creates both an ORION Tough and a Weather Station device automatically, each with its own unique key.
              </div>
              <form onSubmit={handleEnroll} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Yacht *</label>
                  <select required value={enrollForm.yacht_id} onChange={e => setEnrollForm(f => ({ ...f, yacht_id: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                    <option value="">Select yacht...</option>
                    {yachts.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monitoring Provider *</label>
                  <select required value={enrollForm.provider_company_id} onChange={e => setEnrollForm(f => ({ ...f, provider_company_id: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                    <option value="">Select provider...</option>
                    {companies.filter(c => c.offers_monitoring).map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Plan Tier</label>
                  <select value={enrollForm.plan_tier} onChange={e => setEnrollForm(f => ({ ...f, plan_tier: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <button type="submit" disabled={submitLoading} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
                  {submitLoading ? 'Enrolling & Creating Devices...' : 'Enroll Yacht'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== YACHT DETAIL VIEW =====
  if (view === 'yacht' && selectedYachtId) {
    return (
      <div>
        <button onClick={() => setView('fleet')} className="flex items-center gap-2 text-slate-400 hover:text-cyan-500 transition-colors mb-4">
          <span>Back to Fleet</span>
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Radio className="w-7 h-7 text-cyan-400" />
              {selectedYacht?.name || 'Unknown Yacht'}
            </h2>
            {selectedYachtEnrollment && (
              <p className="text-slate-400 text-sm mt-1">
                Provider: {selectedYachtEnrollment.provider_company?.company_name} - Plan: {selectedYachtEnrollment.plan_tier}
              </p>
            )}
          </div>
          {(isMaster || isStaffRole(effectiveRole)) && (
            <button
              onClick={() => { setShowDeviceModal(true); setEditingDevice(null); setDeviceForm({ yacht_id: selectedYachtId, device_serial: '', device_name: 'M5 Tough', device_type: 'orion_tough', firmware_version: '' }); }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Register Device
            </button>
          )}
        </div>

        {/* GPS Live Location Panel */}
        {toughDevice && toughDevice.gps_lat != null && toughDevice.gps_lng != null && (
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-cyan-500/20">
                  <MapPin className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="font-bold">Live GPS Location</p>
                  <p className="text-sm text-slate-400 font-mono">
                    {toughDevice.gps_lat.toFixed(6)}, {toughDevice.gps_lng.toFixed(6)}
                  </p>
                  {toughDevice.gps_updated_at && (
                    <p className="text-xs mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className={Date.now() - new Date(toughDevice.gps_updated_at).getTime() < GPS_LIVE_MS ? 'text-green-400' : 'text-slate-500'}>
                        {Date.now() - new Date(toughDevice.gps_updated_at).getTime() < GPS_LIVE_MS ? 'Live' : 'Stale'} - {new Date(toughDevice.gps_updated_at).toLocaleString()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${toughDevice.gps_lat},${toughDevice.gps_lng}&basemap=satellite`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Open in Google Maps
              </a>
            </div>
          </div>
        )}

        {/* Device Status Cards */}
        {selectedYachtDevices.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700 mb-6">
            <Radio className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400">No devices registered for this yacht</p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {selectedYachtDevices.map(device => {
              const DevIcon = DEVICE_TYPE_ICONS[device.device_type] || Radio;
              const online = isDeviceEffectivelyOnline(device);
              return (
                <div key={device.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${online ? 'bg-green-500/20' : 'bg-slate-500/20'}`}>
                        <DevIcon className={`w-6 h-6 ${online ? 'text-green-400' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="font-bold">{device.device_name}</p>
                        <p className="text-xs text-slate-400">
                          {DEVICE_TYPE_LABELS[device.device_type] || device.device_type} - Serial: {device.device_serial}
                        </p>
                        {device.firmware_version && (
                          <p className="text-xs text-slate-500">Firmware: {device.firmware_version}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${online ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-slate-400 bg-slate-500/10 border-slate-500/30'}`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                      {device.last_check_in && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(device.last_check_in).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {(isMaster || isStaffRole(effectiveRole)) && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => handleDownloadFirmware(device)}
                        disabled={firmwareLoading === device.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {firmwareLoading === device.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Download Firmware
                      </button>
                      <button
                        onClick={() => setShowReplaceKeyConfirm(device.id)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg transition-colors"
                      >
                        <Key className="w-3.5 h-3.5" />
                        Replace Key
                      </button>
                    </div>
                  )}
                  {showReplaceKeyConfirm === device.id && (
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center justify-between">
                      <p className="text-sm text-amber-400">Replace the API key? The old key stops working immediately. You'll need to re-flash the device with the new firmware.</p>
                      <div className="flex items-center gap-2 ml-3">
                        <button onClick={() => handleReplaceKey(device.id)} className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg">Yes, Replace</button>
                        <button onClick={() => setShowReplaceKeyConfirm(null)} className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Port A Sensors */}
        {toughDevice && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden mb-6">
            <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700">
              <h3 className="font-bold flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400" />
                Port A — Pumps &amp; Bilge
              </h3>
              <p className="text-xs text-slate-500 mt-1">EXT.IO2 side — bilge and pump channels</p>
            </div>
            <div className="divide-y divide-slate-700">
              {PORT_A_CHANNELS.map(({ channel, label, sensorName }) => {
                const sensor = sensorName
                  ? yachtSensors.find(candidate => candidate.sensor_name.startsWith(sensorName))
                  : undefined;
                const status = sensor?.status || 'offline';
                return (
                  <div key={channel} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-slate-400 whitespace-nowrap">{channel}</span>
                      <span className="font-medium text-sm break-words">{label}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize whitespace-nowrap ${STATUS_COLORS[status]}`}>
                      {sensor ? status : 'not configured'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cerbo GX Battery Banks */}
        {toughDevice && (() => {
          const batterySensors = yachtSensors.filter(s => s.sensor_type === 'battery_bank');
          if (batterySensors.length === 0) return null;
          const reportingCount = batterySensors.filter(s => s.status !== 'offline').length;
          return (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden mb-6">
              <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700">
                <h3 className="font-bold flex items-center gap-2">
                  <Battery className="w-5 h-5 text-amber-400" />
                  Battery Banks
                  <span className="text-xs font-normal text-slate-400 ml-2">
                    via Cerbo GX MQTT{reportingCount > 0 ? ` — ${reportingCount}/${batterySensors.length} reporting` : ''}
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-slate-700">
                {batterySensors.map(sensor => {
                  const Icon = SENSOR_ICONS[sensor.sensor_type] || Battery;
                  const isOffline = sensor.status === 'offline';
                  return (
                    <div key={sensor.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${STATUS_COLORS[sensor.status]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{sensor.sensor_name}</p>
                          <p className="text-xs text-slate-400 capitalize">{sensor.sensor_type.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {isOffline ? (
                          <span className="text-xs px-2 py-0.5 rounded-full border text-slate-400 bg-slate-500/10 border-slate-500/30 capitalize">Offline</span>
                        ) : (
                          <>
                            <p className="font-mono font-bold text-sm">{sensor.current_value || '--'}{sensor.unit_of_measure ? ` ${sensor.unit_of_measure}` : ''}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[sensor.status]} capitalize`}>{sensor.status}</span>
                            {sensor.last_reading_at && (
                              <p className="text-xs text-slate-500 mt-0.5">{new Date(sensor.last_reading_at).toLocaleTimeString()}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Weather Station Sensors (show separately from port-based Tough sensors) */}
        {weatherDevice && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden mb-6">
            <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700">
              <h3 className="font-bold flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-cyan-400" />
                Weather Station Sensors
              </h3>
            </div>
            <div className="divide-y divide-slate-700">
              {sensors.filter(s => s.device_id === weatherDevice.id).length === 0 ? (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg text-slate-400 bg-slate-500/10 border border-slate-500/30">
                      <WifiOff className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-400">No sensors reporting</p>
                      <p className="text-xs text-slate-500">Waiting for weather station telemetry</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full border text-slate-400 bg-slate-500/10 border-slate-500/30 capitalize">Offline</span>
                </div>
              ) : (
                sensors.filter(s => s.device_id === weatherDevice.id).map(sensor => {
                  const Icon = SENSOR_ICONS[sensor.sensor_type] || Gauge;
                  const displayStatus = getSensorStatus(sensor);
                  return (
                    <div key={sensor.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${STATUS_COLORS[displayStatus]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{sensor.sensor_name}</p>
                          <p className="text-xs text-slate-400 capitalize">{sensor.sensor_type.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {(() => {
                        const display = getWeatherDisplay(sensor);
                        return (
                          <div className="text-right min-w-[180px] max-w-[52%]">
                            <p className="font-mono font-bold text-base text-white whitespace-nowrap">{display.primary}</p>
                            {display.details.length > 0 && (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-left">
                                {display.details.map(detail => (
                                  <div key={detail.label}>
                                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{detail.label}</p>
                                    <p className="font-mono text-xs font-semibold text-slate-200 whitespace-nowrap">{detail.value}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[displayStatus]} capitalize`}>{displayStatus}</span>
                              {sensor.last_reading_at && (
                                <p className="text-xs text-slate-500 mt-0.5">{new Date(sensor.last_reading_at).toLocaleTimeString()}</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Smart Locks Section */}
        {smartDevices.length > 0 && (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden mb-6">
            <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700">
              <h3 className="font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-green-400" />
                Smart Locks
              </h3>
            </div>
            <div className="divide-y divide-slate-700">
              {smartDevices.map(lock => (
                <div key={lock.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${lock.online_status ? 'bg-green-500/20' : 'bg-slate-500/20'}`}>
                      <Lock className={`w-5 h-5 ${lock.online_status ? 'text-green-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{lock.device_name}</p>
                      <p className="text-xs text-slate-400">{lock.location || 'Unknown location'} - {lock.lock_provider || 'unknown'}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    {lock.current_lock_state !== null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${lock.current_lock_state ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'}`}>
                        {lock.current_lock_state ? 'Locked' : 'Unlocked'}
                      </span>
                    )}
                    {lock.battery_level !== null && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Battery className="w-3.5 h-3.5" /> {lock.battery_level}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yacht Alerts */}
        {alerts.filter(a => a.yacht_id === selectedYachtId).length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Active Alerts
            </h3>
            <div className="space-y-2">
              {alerts.filter(a => a.yacht_id === selectedYachtId).map(alert => (
                <div key={alert.id} className={`rounded-lg px-4 py-3 border flex items-center justify-between ${SEVERITY_COLORS[alert.severity]}`}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs opacity-70">{new Date(alert.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {(isMaster || isStaffRole(effectiveRole)) && (
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Acknowledge
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Device Registration Modal */}
        {showDeviceModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{editingDevice ? 'Edit Device' : 'Register Device'}</h3>
                <button onClick={() => setShowDeviceModal(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 mb-3 text-sm">{error}</div>}
              <form onSubmit={handleSaveDevice} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Yacht *</label>
                  <select required value={deviceForm.yacht_id} onChange={e => setDeviceForm(f => ({ ...f, yacht_id: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500" disabled={!!editingDevice}>
                    <option value="">Select yacht...</option>
                    {yachts.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>
                {!editingDevice && (
                  <>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Device Type *</label>
                      <select required value={deviceForm.device_type} onChange={e => setDeviceForm(f => ({ ...f, device_type: e.target.value as any, device_name: e.target.value === 'orion_tough' ? 'ORION Tough' : 'Weather Station' }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500">
                        <option value="orion_tough">ORION Tough</option>
                        <option value="weather_station">Weather Station</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Device Serial Number *</label>
                      <input required value={deviceForm.device_serial} onChange={e => setDeviceForm(f => ({ ...f, device_serial: e.target.value }))} placeholder="e.g. k034326040100309" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Device Name</label>
                  <input value={deviceForm.device_name} onChange={e => setDeviceForm(f => ({ ...f, device_name: e.target.value }))} placeholder="ORION Tough" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Firmware Version</label>
                  <input value={deviceForm.firmware_version} onChange={e => setDeviceForm(f => ({ ...f, firmware_version: e.target.value }))} placeholder="e.g. 1.0.0" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
                </div>
                <button type="submit" disabled={submitLoading} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
                  {submitLoading ? 'Saving...' : 'Save Device'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
