import { useState, useEffect, useRef, useCallback } from 'react';
import { Thermometer, RefreshCw, Loader2, Minus, Plus, Power, Fan, Wifi, WifiOff, AlertCircle, Droplets, Info, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Setpoint {
  code: string;
  value: number | null;
  min: number | null;
  max: number | null;
  step: number;
  unit: 'F' | 'C';
}

interface EnumState {
  code: string;
  value: string;
  options: string[];
  writable: boolean;
}

interface ThermostatState {
  online: boolean;
  unit: 'F' | 'C';
  currentTemp: number | null;
  humidity: number | null;
  setpoint: Setpoint | null;
  heatSetpoint: Setpoint | null;
  coolSetpoint: Setpoint | null;
  mode: EnumState | null;
  power: { code: string; value: boolean; writable: boolean } | null;
  fan: EnumState | null;
  workState: string | null;
}

interface ThermostatDevice {
  id: string;
  yacht_id: string;
  device_name: string;
  location: string;
  metadata: { thermostat_state?: ThermostatState } | null;
}

interface ThermostatControlsProps {
  yachtId: string;
}

type Which = 'single' | 'heat' | 'cool';

const MODE_LABELS: Record<string, string> = {
  hot: 'Heat',
  heat: 'Heat',
  heating: 'Heat',
  cold: 'Cool',
  cool: 'Cool',
  cooling: 'Cool',
  auto: 'Auto',
  off: 'Off',
  wind: 'Fan',
  fan: 'Fan',
  fan_only: 'Fan',
  emergencyheat: 'Emergency Heat',
  emergency_heat: 'Emergency Heat',
  eco: 'Eco',
  dry: 'Dry',
  manual: 'Manual',
  program: 'Schedule',
  smart: 'Schedule',
  holiday: 'Away',
  away: 'Away',
};

const prettify = (value: string) =>
  MODE_LABELS[value.toLowerCase()] ||
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatTemp = (value: number | null | undefined, unit: string) =>
  value === null || value === undefined ? '--' : `${Number.isInteger(value) ? value : value.toFixed(1)}°${unit}`;

const callThermostat = async (body: Record<string, unknown>) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tuya-thermostat-control`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Thermostat request failed');
  return result;
};

export const ThermostatControls = ({ yachtId }: ThermostatControlsProps) => {
  const [devices, setDevices] = useState<ThermostatDevice[]>([]);
  const [states, setStates] = useState<Record<string, ThermostatState>>({});
  const [pending, setPending] = useState<Record<string, Partial<Record<Which, number>>>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [details, setDetails] = useState<{ name: string; data: unknown } | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const runAction = useCallback(async (deviceId: string, body: Record<string, unknown>) => {
    setBusy((b) => ({ ...b, [deviceId]: true }));
    setErrors((e) => ({ ...e, [deviceId]: null }));
    try {
      const result = await callThermostat({ ...body, deviceId, yachtId });
      setStates((s) => ({ ...s, [deviceId]: result.thermostat }));
      return true;
    } catch (error) {
      setErrors((e) => ({ ...e, [deviceId]: error instanceof Error ? error.message : 'Something went wrong' }));
      return false;
    } finally {
      setBusy((b) => ({ ...b, [deviceId]: false }));
    }
  }, [yachtId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setIsStaff(['manager', 'staff', 'mechanic', 'master'].includes(profile?.role || ''));
      }

      const { data, error } = await supabase
        .from('yacht_smart_devices')
        .select('id, yacht_id, device_name, location, metadata')
        .eq('yacht_id', yachtId)
        .eq('device_type', 'thermostat')
        .eq('is_active', true)
        .order('device_name');

      if (cancelled) return;
      if (error) {
        console.error('Error loading thermostats:', error);
        setLoading(false);
        return;
      }

      const list = (data || []) as ThermostatDevice[];
      setDevices(list);
      const cached: Record<string, ThermostatState> = {};
      for (const d of list) {
        if (d.metadata?.thermostat_state) cached[d.id] = d.metadata.thermostat_state;
      }
      setStates(cached);
      setLoading(false);

      for (const d of list) {
        runAction(d.id, { action: 'status' });
      }
    };
    load();
    const pendingTimers = timers.current;
    return () => {
      cancelled = true;
      Object.values(pendingTimers).forEach(clearTimeout);
    };
  }, [yachtId, runAction]);

  const nudge = (deviceId: string, which: Which, sp: Setpoint, direction: 1 | -1) => {
    const current = pending[deviceId]?.[which] ?? sp.value ?? 0;
    let next = Math.round((current + direction * sp.step) * 100) / 100;
    if (sp.min !== null) next = Math.max(sp.min, next);
    if (sp.max !== null) next = Math.min(sp.max, next);
    setPending((p) => ({ ...p, [deviceId]: { ...p[deviceId], [which]: next } }));

    const key = `${deviceId}:${which}`;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      await runAction(deviceId, { action: 'set_temperature', which, target: next });
      setPending((p) => {
        const copy = { ...p[deviceId] };
        delete copy[which];
        return { ...p, [deviceId]: copy };
      });
    }, 1200);
  };

  const showDetails = async (device: ThermostatDevice) => {
    try {
      const result = await callThermostat({ action: 'details', deviceId: device.id, yachtId });
      setDetails({ name: device.device_name, data: { deviceInfo: result.deviceInfo, specification: result.specification } });
    } catch (error) {
      setErrors((e) => ({ ...e, [device.id]: error instanceof Error ? error.message : 'Could not load details' }));
    }
  };

  if (loading || devices.length === 0) return null;

  const renderSetpoint = (device: ThermostatDevice, which: Which, sp: Setpoint, label: string, disabled: boolean) => {
    const shown = pending[device.id]?.[which] ?? sp.value;
    return (
      <div className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-3">
        <span className="text-sm text-slate-300">{label}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => nudge(device.id, which, sp, -1)}
            disabled={disabled || (sp.min !== null && shown !== null && shown <= sp.min)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-40"
            aria-label={`Lower ${label.toLowerCase()}`}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className={`text-xl font-semibold w-20 text-center ${pending[device.id]?.[which] !== undefined ? 'text-amber-400' : ''}`}>
            {formatTemp(shown, sp.unit)}
          </span>
          <button
            onClick={() => nudge(device.id, which, sp, 1)}
            disabled={disabled || (sp.max !== null && shown !== null && shown >= sp.max)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-40"
            aria-label={`Raise ${label.toLowerCase()}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-6">
          <Thermometer className="w-6 h-6 text-amber-500" />
          <h3 className="text-xl font-semibold">Climate Control</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((device) => {
            const st = states[device.id];
            const isBusy = !!busy[device.id];
            const offline = st ? !st.online : false;
            const isOff = st?.power ? !st.power.value : st?.mode?.value?.toLowerCase() === 'off';
            const controlsDisabled = !st || offline || isBusy;
            const modeLower = st?.mode?.value?.toLowerCase() || '';
            const isAutoDual = modeLower === 'auto' && st?.heatSetpoint && st?.coolSetpoint;

            return (
              <div key={device.id} className="bg-slate-900/50 rounded-xl p-5 border-2 border-slate-700">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-lg">{device.device_name}</h4>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      {st ? (
                        st.online ? (
                          <span className="flex items-center gap-1 text-green-500"><Wifi className="w-3 h-3" /> Online</span>
                        ) : (
                          <span className="flex items-center gap-1 text-orange-500"><WifiOff className="w-3 h-3" /> Offline</span>
                        )
                      ) : (
                        <span className="text-slate-400">Checking…</span>
                      )}
                      {st?.workState && <span className="text-slate-400">· {prettify(st.workState)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isStaff && (
                      <button
                        onClick={() => showDetails(device)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                        title="Device details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => runAction(device.id, { action: 'status' })}
                      disabled={isBusy}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {!st ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-end gap-6">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">Inside now</div>
                        <div className="text-4xl font-bold">{formatTemp(st.currentTemp, st.unit)}</div>
                      </div>
                      {st.humidity !== null && (
                        <div className="flex items-center gap-1 text-slate-300 pb-1">
                          <Droplets className="w-4 h-4 text-blue-400" />
                          {Math.round(st.humidity)}%
                        </div>
                      )}
                      {st.power && st.power.writable && (
                        <button
                          onClick={() => runAction(device.id, { action: 'set_power', on: !st.power!.value })}
                          disabled={offline || isBusy}
                          className={`ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                            st.power.value ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                          {st.power.value ? 'On' : 'Off'}
                        </button>
                      )}
                    </div>

                    {!isOff && (
                      isAutoDual ? (
                        <>
                          {renderSetpoint(device, 'heat', st.heatSetpoint!, 'Heat to', controlsDisabled)}
                          {renderSetpoint(device, 'cool', st.coolSetpoint!, 'Cool to', controlsDisabled)}
                        </>
                      ) : st.setpoint ? (
                        renderSetpoint(device, 'single', st.setpoint, 'Set to', controlsDisabled)
                      ) : modeLower.includes('heat') || modeLower === 'hot' ? (
                        st.heatSetpoint && renderSetpoint(device, 'heat', st.heatSetpoint, 'Heat to', controlsDisabled)
                      ) : (
                        st.coolSetpoint && renderSetpoint(device, 'cool', st.coolSetpoint, 'Cool to', controlsDisabled)
                      )
                    )}

                    {st.mode && st.mode.writable && st.mode.options.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Mode</div>
                        <div className="flex flex-wrap gap-2">
                          {st.mode.options.map((option) => (
                            <button
                              key={option}
                              onClick={() => runAction(device.id, { action: 'set_mode', mode: option })}
                              disabled={controlsDisabled || option === st.mode!.value}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                option === st.mode!.value
                                  ? 'bg-amber-500 text-slate-900'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50'
                              }`}
                            >
                              {prettify(option)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {st.fan && st.fan.writable && st.fan.options.length > 0 && (
                      <div className="flex items-center gap-3">
                        <Fan className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">Fan</span>
                        <select
                          value={st.fan.value}
                          onChange={(e) => runAction(device.id, { action: 'set_fan', fan: e.target.value })}
                          disabled={controlsDisabled}
                          className="ml-auto px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
                        >
                          {st.fan.options.map((option) => (
                            <option key={option} value={option}>{prettify(option)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {errors[device.id] && (
                  <div className="mt-4 flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{errors[device.id]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {details && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{details.name}: Tuya data points</h3>
              <button onClick={() => setDetails(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="text-xs bg-slate-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(details.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
};
