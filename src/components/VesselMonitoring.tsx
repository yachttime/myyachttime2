import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { isStaffRole, UserRole } from '../lib/supabase';
import {
  Activity, AlertTriangle, Battery, Gauge, Navigation, Wind,
  Droplets, Zap, Thermometer, Lock, Shield, ChevronRight,
  Plus, Wifi, WifiOff, CheckCircle, XCircle, Clock, Radio,
} from 'lucide-react';

interface MonitorDevice {
  id: string;
  yacht_id: string;
  company_id: string;
  device_serial: string;
  device_name: string;
  firmware_version: string | null;
  is_online: boolean;
  last_check_in: string | null;
  installation_date: string;
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
  A: { name: 'Pumps', type: 'digital' },
  B: { name: 'Batteries & Engine', type: 'analog' },
  C: { name: 'GPS', type: 'rs485' },
  D: { name: 'Anemometer / Wind', type: 'gpio' },
};

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
    firmware_version: '',
  });
  const [submitLoading, setSubmitLoading] = useState(false);

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
    let query = supabase.from('yachts').select('id, name, company_id').order('name');
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

  // Realtime subscriptions
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
    setShowEnrollModal(false);
    setEnrollForm({ yacht_id: '', provider_company_id: '', plan_tier: 'standard' });
    setSubmitLoading(false);
    loadEnrollments();
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
      device_name: deviceForm.device_name || 'M5 Tough',
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
      // Create default ports
      for (const [label, info] of Object.entries(PORT_LABELS)) {
        await supabase.from('vessel_monitor_ports').insert({
          device_id: newDevice.id,
          port_label: label,
          port_name: info.name,
          port_type: info.type,
        });
      }
    }
    setShowDeviceModal(false);
    setEditingDevice(null);
    setDeviceForm({ yacht_id: '', device_serial: '', device_name: 'M5 Tough', firmware_version: '' });
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

  const enrolledYachtIds = new Set(enrollments.map(e => e.yacht_id));
  const fleetYachts = yachts.filter(y => enrolledYachtIds.has(y.id));
  const onlineCount = devices.filter(d => d.is_online).length;
  const offlineCount = devices.filter(d => !d.is_online).length;
  const activeAlertCount = alerts.length;
  const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;

  // Group sensors by port label
  const sensorsByPort: Record<string, MonitorSensor[]> = { A: [], B: [], C: [], D: [] };
  const yachtSensors = sensors.filter(s => s.yacht_id === selectedYachtId);
  yachtSensors.forEach(s => {
    const port = Object.entries(PORT_LABELS).find(([_, info]) => {
      if (info.name === 'Pumps' && ['bilge_pump', 'water_pump', 'ac_pump'].includes(s.sensor_type)) return true;
      if (info.name === 'Batteries & Engine' && ['battery_bank', 'engine_alternator', 'wind_vane', 'environment'].includes(s.sensor_type)) return true;
      if (info.name === 'GPS' && s.sensor_type === 'gps') return true;
      if (info.name === 'Anemometer / Wind' && s.sensor_type === 'anemometer') return true;
      return false;
    });
    if (port) sensorsByPort[port[0]].push(s);
  });

  const selectedYacht = yachts.find(y => y.id === selectedYachtId);
  const selectedYachtEnrollment = enrollments.find(e => e.yacht_id === selectedYachtId);
  const selectedYachtDevices = devices.filter(d => d.yacht_id === selectedYachtId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
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

        {/* Summary Cards */}
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

        {/* Fleet Grid */}
        {fleetYachts.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 mb-1">No yachts are enrolled in monitoring yet</p>
            {isMaster && <p className="text-slate-500 text-sm">Click "Enroll Yacht" to get started</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleetYachts.map(yacht => {
              const yachtDevices = devices.filter(d => d.yacht_id === yacht.id);
              const yachtAlerts = alerts.filter(a => a.yacht_id === yacht.id);
              const enrollment = enrollments.find(e => e.yacht_id === yacht.id);
              const isOnline = yachtDevices.some(d => d.is_online);
              const criticalAlerts = yachtAlerts.filter(a => a.severity === 'critical');
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
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${isOnline ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-slate-400 bg-slate-500/10 border-slate-500/30'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                    {yachtDevices.length > 0 && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> {yachtDevices.length} device{yachtDevices.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {yachtAlerts.length > 0 && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${criticalAlerts.length > 0 ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'}`}>
                        {yachtAlerts.length} alert{yachtAlerts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Recent Alerts Feed */}
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

        {/* Company Monitoring Toggles (master only) */}
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

        {/* Enroll Modal */}
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
                  {submitLoading ? 'Enrolling...' : 'Enroll Yacht'}
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
              onClick={() => { setShowDeviceModal(true); setEditingDevice(null); setDeviceForm({ yacht_id: selectedYachtId, device_serial: '', device_name: 'M5 Tough', firmware_version: '' }); }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Register Device
            </button>
          )}
        </div>

        {/* Device Status */}
        {selectedYachtDevices.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700 mb-6">
            <Radio className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400">No M5 Tough devices registered for this yacht</p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {selectedYachtDevices.map(device => (
              <div key={device.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${device.is_online ? 'bg-green-500/20' : 'bg-slate-500/20'}`}>
                      <Radio className={`w-6 h-6 ${device.is_online ? 'text-green-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <p className="font-bold">{device.device_name}</p>
                      <p className="text-xs text-slate-400">Serial: {device.device_serial}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${device.is_online ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-slate-400 bg-slate-500/10 border-slate-500/30'}`}>
                      {device.is_online ? 'Online' : 'Offline'}
                    </span>
                    {device.last_check_in && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {new Date(device.last_check_in).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sensor Ports */}
        {yachtSensors.length > 0 && (
          <div className="space-y-6 mb-6">
            {Object.entries(PORT_LABELS).map(([portLabel, portInfo]) => {
              const portSensors = sensorsByPort[portLabel];
              if (portSensors.length === 0) return null;
              return (
                <div key={portLabel} className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700">
                    <h3 className="font-bold flex items-center gap-2">
                      <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-sm font-mono">Port {portLabel}</span>
                      {portInfo.name}
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {portSensors.map(sensor => {
                      const Icon = SENSOR_ICONS[sensor.sensor_type] || Gauge;
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
                            <p className="font-mono font-bold">{sensor.current_value || '--'}{sensor.unit_of_measure ? ` ${sensor.unit_of_measure}` : ''}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[sensor.status]} capitalize`}>{sensor.status}</span>
                            {sensor.last_reading_at && (
                              <p className="text-xs text-slate-500 mt-0.5">{new Date(sensor.last_reading_at).toLocaleTimeString()}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
                <h3 className="text-xl font-bold">{editingDevice ? 'Edit Device' : 'Register M5 Tough Device'}</h3>
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
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Device Serial Number *</label>
                    <input required value={deviceForm.device_serial} onChange={e => setDeviceForm(f => ({ ...f, device_serial: e.target.value }))} placeholder="e.g. M5T-00123" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Device Name</label>
                  <input value={deviceForm.device_name} onChange={e => setDeviceForm(f => ({ ...f, device_name: e.target.value }))} placeholder="M5 Tough" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
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
