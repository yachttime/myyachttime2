import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as crypto from "node:crypto";

/**
 * Tuya thermostat control.
 *
 * Reads and controls Tuya Wi-Fi thermostats stored in yacht_smart_devices
 * with device_type = 'thermostat'. Uses the same per-yacht Tuya cloud
 * credentials (tuya_device_credentials) as the smart locks.
 *
 * Thermostat brands name their data points differently (temp_set vs
 * temp_set_f, mode values "hot" vs "heat", ...), so this function reads the
 * device's own specification and maps the common codes to one normalized
 * shape. If a device uses unusual codes, they can be pinned per device in
 * yacht_smart_devices.metadata.thermostat_codes, e.g.
 *   { "current": "temp_indoor", "setpoint": "temp_set_f", "mode": "mode" }
 *
 * Actions:
 *   status            -> normalized thermostat state
 *   set_temperature   -> { target: number, which?: 'single' | 'heat' | 'cool' }
 *   set_mode          -> { mode: string }
 *   set_power         -> { on: boolean }
 *   set_fan           -> { fan: string }
 *   details           -> raw device info + specification (staff only)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Action = 'status' | 'set_temperature' | 'set_mode' | 'set_power' | 'set_fan' | 'details';

interface ThermostatRequest {
  action: Action;
  deviceId: string;
  yachtId: string;
  target?: number;
  which?: 'single' | 'heat' | 'cool';
  mode?: string;
  on?: boolean;
  fan?: string;
}

interface DataPoint {
  code: string;
  value: any;
}

interface SpecEntry {
  code: string;
  type: string;
  values: any;
  writable: boolean;
}

const SUBSCRIPTION_EXPIRED =
  'SUBSCRIPTION_EXPIRED: Your Tuya Cloud Development subscription has expired. Please renew it at https://iot.tuya.com/';

// Placeholder key the browser uses when VITE_SMART_DEVICE_ENCRYPTION_KEY is missing.
const LEGACY_BROWSER_KEY = 'temporary_migration_key_replace_in_production';

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

class TuyaClient {
  private accessToken: string | null = null;
  private baseUrl: string;

  constructor(private clientId: string, private clientSecret: string, region: string = 'us') {
    const regionUrls: Record<string, string> = {
      us: 'https://openapi.tuyaus.com',
      eu: 'https://openapi.tuyaeu.com',
      cn: 'https://openapi.tuyacn.com',
      in: 'https://openapi.tuyain.com',
    };
    this.baseUrl = regionUrls[region] || regionUrls.us;
  }

  private sign(method: string, pathWithQuery: string, body: string, includeToken: boolean) {
    const t = Date.now().toString();
    const contentHash = crypto.createHash('sha256').update(body).digest('hex');
    const stringToSign = [method.toUpperCase(), contentHash, '', pathWithQuery].join('\n');
    const signStr = this.clientId + (includeToken ? this.accessToken || '' : '') + t + stringToSign;
    const sign = crypto.createHmac('sha256', this.clientSecret).update(signStr).digest('hex').toUpperCase();
    return { sign, t };
  }

  private async authenticate(): Promise<void> {
    const cached = tokenCache.get(this.clientId);
    if (cached && cached.expiresAt > Date.now()) {
      this.accessToken = cached.token;
      return;
    }

    const path = '/v1.0/token?grant_type=1';
    const { sign, t } = this.sign('GET', path, '', false);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { client_id: this.clientId, sign, t, sign_method: 'HMAC-SHA256' },
    });
    const data = await response.json();
    if (!data.success) {
      if (data.code === 28841002) throw new Error(SUBSCRIPTION_EXPIRED);
      throw new Error(`Tuya authentication failed: ${data.msg || 'unknown error'} (code: ${data.code ?? 'unknown'})`);
    }

    this.accessToken = data.result.access_token;
    tokenCache.set(this.clientId, {
      token: data.result.access_token,
      expiresAt: Date.now() + data.result.expire_time * 1000 - 60000,
    });
  }

  private async request(method: 'GET' | 'POST', path: string, bodyObj?: unknown): Promise<any> {
    await this.authenticate();
    const body = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
    const { sign, t } = this.sign(method, path, body, true);
    const headers: Record<string, string> = {
      client_id: this.clientId,
      access_token: this.accessToken!,
      sign,
      t,
      sign_method: 'HMAC-SHA256',
    };
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${this.baseUrl}${path}`, { method, headers, body: body || undefined });
    const data = await response.json();
    if (!data.success) {
      if (data.code === 28841002) throw new Error(SUBSCRIPTION_EXPIRED);
      if (data.code === 1010 || data.code === 1011) tokenCache.delete(this.clientId);
      throw new Error(`Tuya request failed: ${data.msg || 'unknown error'} (code: ${data.code ?? 'unknown'})`);
    }
    return data.result;
  }

  getDevice(deviceId: string) {
    return this.request('GET', `/v1.0/devices/${deviceId}`);
  }

  getStatus(deviceId: string) {
    return this.request('GET', `/v1.0/devices/${deviceId}/status`);
  }

  getSpecifications(deviceId: string) {
    return this.request('GET', `/v1.0/devices/${deviceId}/specifications`);
  }

  sendCommands(deviceId: string, commands: DataPoint[]) {
    return this.request('POST', `/v1.0/devices/${deviceId}/commands`, { commands });
  }
}

// ---------- Normalization ----------

function parseSpecs(spec: any): Map<string, SpecEntry> {
  const map = new Map<string, SpecEntry>();
  const add = (list: any[] | undefined, writable: boolean) => {
    for (const item of list || []) {
      let values: any = {};
      try {
        values = typeof item.values === 'string' ? JSON.parse(item.values) : item.values || {};
      } catch {
        values = {};
      }
      const existing = map.get(item.code);
      map.set(item.code, {
        code: item.code,
        type: item.type,
        values,
        writable: writable || existing?.writable || false,
      });
    }
  };
  add(spec?.status, false);
  add(spec?.functions, true);
  return map;
}

function scaleOf(entry?: SpecEntry): number {
  const s = Number(entry?.values?.scale);
  return Number.isFinite(s) ? s : 0;
}

function toReal(raw: any, entry?: SpecEntry): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n / Math.pow(10, scaleOf(entry));
}

function unitOf(code: string, entry: SpecEntry | undefined, fallback: 'F' | 'C'): 'F' | 'C' {
  const u = String(entry?.values?.unit || '').toUpperCase();
  if (u.includes('F')) return 'F';
  if (u.includes('C') || u.includes('℃')) return 'C';
  if (/_f$/i.test(code)) return 'F';
  if (/_c$/i.test(code)) return 'C';
  return fallback;
}

function pick(
  candidates: string[],
  status: Map<string, any>,
  specs: Map<string, SpecEntry>,
  override?: string,
  mustBeWritable = false,
): string | null {
  const ok = (code: string) =>
    (status.has(code) || specs.has(code)) && (!mustBeWritable || specs.get(code)?.writable);
  if (override && ok(override)) return override;
  for (const c of candidates) {
    if (ok(c)) return c;
  }
  return null;
}

function orderByUnit(codes: string[], preferF: boolean): string[] {
  const f = codes.filter((c) => /_f$/i.test(c));
  const other = codes.filter((c) => !/_f$/i.test(c));
  return preferF ? [...f, ...other] : [...other, ...f];
}

interface Resolved {
  codes: {
    current: string | null;
    setpoint: string | null;
    heat: string | null;
    cool: string | null;
    mode: string | null;
    power: string | null;
    fan: string | null;
    humidity: string | null;
    state: string | null;
    hold: string | null;
  };
  status: Map<string, any>;
  specs: Map<string, SpecEntry>;
  preferF: boolean;
}

function resolve(statusList: DataPoint[], spec: any, overrides: Record<string, string> = {}): Resolved {
  const status = new Map<string, any>(statusList.map((dp) => [dp.code, dp.value]));
  const specs = parseSpecs(spec);

  const unitFlag = String(status.get('temp_unit_convert') ?? status.get('c_f') ?? status.get('temp_unit') ?? '').toLowerCase();
  const preferF = unitFlag ? unitFlag.startsWith('f') : [...status.keys()].some((c) => /^temp_(current|set)_f$/.test(c));

  const allCodes = [...new Set([...status.keys(), ...specs.keys()])];
  const fuzzy = (re: RegExp) => allCodes.filter((c) => re.test(c) && !/upper|lower|limit|max|min|calib|correct/.test(c));

  const codes = {
    current: pick(
      orderByUnit([
        'temp_current', 'temp_current_f', 'temp_indoor', 'temp_indoor_f',
        'current_temp', 'indoor_temp', 'temp_current_c', 'temp_room', 'room_temp',
        ...fuzzy(/(temp|temperature).*(current|indoor|room|inside|inner)|^(current|indoor|room|inside|inner)_(temp|temperature)/),
      ].filter((c) => !/set|target|outdoor|outside/.test(c)), preferF),
      status, specs, overrides.current,
    ),
    setpoint: pick(
      orderByUnit(['temp_set', 'temp_set_f', 'set_temp', 'set_temp_f', 'temp_set_c'], preferF),
      status, specs, overrides.setpoint, true,
    ),
    heat: pick(
      orderByUnit(['heat_temp_set', 'heat_temp_set_f', 'temp_set_heat', 'temp_set_heat_f', 'heating_temp_set', 'heat_setpoint', 'heating_setpoint', ...fuzzy(/heat/).filter((c) => !/mode|state|switch|alarm/.test(c))], preferF),
      status, specs, overrides.heat, true,
    ),
    cool: pick(
      orderByUnit(['cool_temp_set', 'cool_temp_set_f', 'temp_set_cool', 'temp_set_cool_f', 'cooling_temp_set', 'cool_setpoint', 'cooling_setpoint', ...fuzzy(/cool/).filter((c) => !/mode|state|switch|alarm/.test(c))], preferF),
      status, specs, overrides.cool, true,
    ),
    mode: pick(['mode', 'work_mode', 'system_mode', 'thermostat_mode', 'hvac_mode', ...fuzzy(/mode/).filter((c) => !/fan|wind/.test(c))], status, specs, overrides.mode),
    power: pick(['switch', 'power', 'switch_1'], status, specs, overrides.power),
    fan: pick(['fan_mode', 'fan_speed_enum', 'windspeed', 'fan_speed', 'fan', ...fuzzy(/fan|wind/)], status, specs, overrides.fan),
    humidity: pick(['humidity_current', 'humidity_indoor', 'va_humidity', 'humidity', 'humidity_relative', ...fuzzy(/humid/)], status, specs, overrides.humidity),
    state: pick(['work_state', 'running_state', 'work_status', 'hvac_state', 'valve_state'], status, specs, overrides.state),
    hold: pick(['hold', 'temporary_hold', 'hold_state', 'temp_hold', 'hold_flag', 'hold_mode', ...fuzzy(/hold/)], status, specs, overrides.hold),
  };

  return { codes, status, specs, preferF };
}

function describeSetpoint(code: string | null, r: Resolved) {
  if (!code) return null;
  const entry = r.specs.get(code);
  const scale = scaleOf(entry);
  const div = Math.pow(10, scale);
  const v = entry?.values || {};
  return {
    code,
    value: toReal(r.status.get(code), entry),
    min: v.min !== undefined ? Number(v.min) / div : null,
    max: v.max !== undefined ? Number(v.max) / div : null,
    step: v.step !== undefined ? Math.max(Number(v.step) / div, 1 / div) : 1,
    unit: unitOf(code, entry, r.preferF ? 'F' : 'C'),
  };
}

function enumOptions(code: string | null, r: Resolved): string[] {
  if (!code) return [];
  const range = r.specs.get(code)?.values?.range;
  return Array.isArray(range) ? range.map(String) : [];
}

function normalize(r: Resolved, online: boolean) {
  const { codes } = r;
  const currentEntry = codes.current ? r.specs.get(codes.current) : undefined;
  const humidityEntry = codes.humidity ? r.specs.get(codes.humidity) : undefined;
  const fallbackUnit: 'F' | 'C' = r.preferF ? 'F' : 'C';

  return {
    online,
    unit: codes.current ? unitOf(codes.current, currentEntry, fallbackUnit) : fallbackUnit,
    currentTemp: codes.current ? toReal(r.status.get(codes.current), currentEntry) : null,
    humidity: codes.humidity ? toReal(r.status.get(codes.humidity), humidityEntry) : null,
    setpoint: describeSetpoint(codes.setpoint, r),
    heatSetpoint: describeSetpoint(codes.heat, r),
    coolSetpoint: describeSetpoint(codes.cool, r),
    mode: codes.mode
      ? { code: codes.mode, value: String(r.status.get(codes.mode) ?? ''), options: enumOptions(codes.mode, r), writable: !!r.specs.get(codes.mode)?.writable }
      : null,
    power: codes.power
      ? { code: codes.power, value: !!r.status.get(codes.power), writable: !!r.specs.get(codes.power)?.writable }
      : null,
    fan: codes.fan
      ? { code: codes.fan, value: String(r.status.get(codes.fan) ?? ''), options: enumOptions(codes.fan, r), writable: !!r.specs.get(codes.fan)?.writable }
      : null,
    workState: codes.state ? String(r.status.get(codes.state) ?? '') : null,
    hold: codes.hold ? { code: codes.hold, value: r.status.get(codes.hold) ?? null } : null,
  };
}

function buildTemperatureCommand(r: Resolved, which: 'single' | 'heat' | 'cool', target: number): DataPoint {
  const code = which === 'heat' ? r.codes.heat : which === 'cool' ? r.codes.cool : (r.codes.setpoint || r.codes.heat || r.codes.cool);
  if (!code) throw new Error('This thermostat does not report a settable temperature');
  const entry = r.specs.get(code);
  if (!entry?.writable) throw new Error(`Temperature (${code}) cannot be changed remotely on this thermostat`);

  const v = entry.values || {};
  const scale = scaleOf(entry);
  let raw = Math.round(target * Math.pow(10, scale));
  const step = Number(v.step) || 1;
  const min = v.min !== undefined ? Number(v.min) : undefined;
  const max = v.max !== undefined ? Number(v.max) : undefined;
  const base = min ?? 0;
  raw = base + Math.round((raw - base) / step) * step;
  if (min !== undefined && raw < min) raw = min;
  if (max !== undefined && raw > max) raw = max;
  return { code, value: raw };
}

function buildEnumCommand(r: Resolved, code: string | null, value: string | undefined, label: string): DataPoint {
  if (!code) throw new Error(`This thermostat does not support ${label}`);
  const entry = r.specs.get(code);
  if (!entry?.writable) throw new Error(`${label} cannot be changed remotely on this thermostat`);
  const options = enumOptions(code, r);
  if (!value || (options.length > 0 && !options.includes(value))) {
    throw new Error(`Invalid ${label}: ${value}. Allowed: ${options.join(', ')}`);
  }
  return { code, value };
}

function describeChange(cmd: DataPoint, r: Resolved): string {
  const entry = r.specs.get(cmd.code);
  if (entry?.type === 'Integer') {
    const unit = unitOf(cmd.code, entry, r.preferF ? 'F' : 'C');
    return `set ${cmd.code === r.codes.heat ? 'heat ' : cmd.code === r.codes.cool ? 'cool ' : ''}temperature to ${toReal(cmd.value, entry)}°${unit}`;
  }
  if (cmd.code === r.codes.power) return `turned ${cmd.value ? 'on' : 'off'}`;
  if (cmd.code === r.codes.mode) return `set mode to ${cmd.value}`;
  if (cmd.code === r.codes.fan) return `set fan to ${cmd.value}`;
  return `set ${cmd.code} to ${cmd.value}`;
}

// ---------- Handler ----------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let accessibleDevice: { id: string; yacht_id: string; metadata: Record<string, unknown> | null } | null = null;

  try {
    supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error('Unauthorized');

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, role, yacht_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!userProfile) throw new Error('User profile not found');

    const body: ThermostatRequest = await req.json();
    const { action, deviceId, yachtId } = body;
    if (!deviceId || !yachtId) throw new Error('deviceId and yachtId are required');

    const { data: device } = await supabase
      .from('yacht_smart_devices')
      .select('*')
      .eq('id', deviceId)
      .eq('yacht_id', yachtId)
      .maybeSingle();
    if (!device) throw new Error('Device not found');
    if (device.device_type !== 'thermostat') throw new Error('Device is not a thermostat');
    if (!device.tuya_device_id) throw new Error('Thermostat has no Tuya Device ID set');

    // Assign before the access checks so even those failures persist to the device card.
    accessibleDevice = {
      id: device.id,
      yacht_id: device.yacht_id,
      metadata: device.metadata && typeof device.metadata === 'object' ? device.metadata : null,
    };

    if (action !== 'status' && action !== 'details' && !device.is_active) throw new Error('Device is not active');

    // Same access rules as the smart locks: staff, the yacht's owner, or a guest with an active booking.
    const isStaff = ['manager', 'staff', 'mechanic', 'master'].includes(userProfile.role);
    const isOwner = userProfile.role === 'owner' && userProfile.yacht_id === yachtId;
    if (!isStaff && !isOwner) {
      const now = new Date().toISOString();
      const { data: booking } = await supabase
        .from('yacht_bookings')
        .select('id')
        .eq('user_id', userProfile.id)
        .eq('yacht_id', yachtId)
        .lte('start_date', now)
        .gte('end_date', now)
        .maybeSingle();
      if (!booking) throw new Error('Access denied: No active booking found');
    }
    if (action === 'details' && !isStaff) throw new Error('Access denied');

    const { data: credentials } = await supabase
      .from('tuya_device_credentials')
      .select('*')
      .eq('yacht_id', yachtId)
      .eq('is_active', true)
      .maybeSingle();
    if (!credentials) throw new Error('Tuya credentials not configured for this yacht');

    const encryptionKey = Deno.env.get('SMART_DEVICE_ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('Encryption key not configured');
    let { data: secret } = await supabase.rpc('decrypt_credential', {
      ciphertext: credentials.tuya_client_secret,
      key: encryptionKey,
    });

    // The Smart Device Management page encrypts the secret in the browser and falls back
    // to a placeholder key when VITE_SMART_DEVICE_ENCRYPTION_KEY isn't set, so some saved
    // secrets can't be opened with the real key. Try the placeholder, and if it works,
    // re-encrypt the secret with the real key so it is fixed for good.
    if (!secret) {
      const { data: legacySecret } = await supabase.rpc('decrypt_credential', {
        ciphertext: credentials.tuya_client_secret,
        key: LEGACY_BROWSER_KEY,
      });
      if (legacySecret) {
        secret = legacySecret;
        const { data: reEncrypted, error: encryptError } = await supabase.rpc('encrypt_credential', {
          plaintext: legacySecret,
          key: encryptionKey,
        });
        if (!encryptError && reEncrypted) {
          const { error: saveError } = await supabase
            .from('tuya_device_credentials')
            .update({ tuya_client_secret: reEncrypted, updated_at: new Date().toISOString() })
            .eq('id', credentials.id);
          if (saveError) console.error('Could not re-encrypt Tuya secret:', saveError);
          else console.log('Re-encrypted Tuya secret with the server key for yacht', yachtId);
        }
      }
    }
    if (!secret) throw new Error('Failed to decrypt Tuya credentials');

    const tuya = new TuyaClient(credentials.tuya_client_id, secret, credentials.tuya_region);
    const info = await tuya.getDevice(device.tuya_device_id);
    let rawStatus = Array.isArray(info?.status) ? info.status : [];
    if (action !== 'details') {
      try {
        const status = await tuya.getStatus(device.tuya_device_id);
        if (Array.isArray(status)) rawStatus = status;
      } catch (error) {
        console.warn('Tuya live status endpoint unavailable; using device details status:', error);
      }
    }

    let spec: any = {};
    try {
      spec = await tuya.getSpecifications(device.tuya_device_id);
    } catch (error) {
      console.warn('Tuya specifications unavailable; continuing with live device status:', error);
    }

    if (action === 'details') {
      // Leave out the device's local encryption key; staff only need the data points.
      const { local_key: _localKey, ...safeInfo } = info || {};
      return json({ success: true, deviceInfo: safeInfo, specification: spec });
    }

    const overrides = (device.metadata && device.metadata.thermostat_codes) || {};
    const resolved = resolve(rawStatus, spec, overrides);
    const online = !!info?.online;

    let command: DataPoint | null = null;
    switch (action) {
      case 'status':
        break;
      case 'set_temperature': {
        const target = Number(body.target);
        if (!Number.isFinite(target)) throw new Error('target temperature is required');
        command = buildTemperatureCommand(resolved, body.which || 'single', target);
        break;
      }
      case 'set_mode':
        command = buildEnumCommand(resolved, resolved.codes.mode, body.mode, 'mode');
        break;
      case 'set_fan':
        command = buildEnumCommand(resolved, resolved.codes.fan, body.fan, 'fan setting');
        break;
      case 'set_power': {
        const code = resolved.codes.power;
        if (!code || !resolved.specs.get(code)?.writable) throw new Error('Power cannot be switched remotely on this thermostat');
        command = { code, value: !!body.on };
        break;
      }
      default:
        throw new Error('Invalid action');
    }

    if (command) {
      if (!online) throw new Error('Thermostat is offline');
      await tuya.sendCommands(device.tuya_device_id, [command]);
      resolved.status.set(command.code, command.value);

      const userName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Unknown User';
      const { data: yacht } = await supabase.from('yachts').select('name').eq('id', yachtId).maybeSingle();
      const { error: logError } = await supabase.from('yacht_history_logs').insert({
        yacht_id: yachtId,
        yacht_name: yacht?.name || 'Unknown',
        action: `${userName} ${describeChange(command, resolved)} on ${device.device_name}`,
        created_by: user.id,
        created_by_name: userName,
        reference_id: device.id,
        reference_type: 'smart_device',
        company_id: device.company_id ?? null,
      });
      if (logError) console.error('Failed to write history log:', logError);
    }

    const thermostat = normalize(resolved, online);

    const { thermostat_error: _thermostatError, ...metadataWithoutError } =
      device.metadata && typeof device.metadata === 'object' ? device.metadata : {};
    const checkedAt = new Date().toISOString();

    await supabase
      .from('yacht_smart_devices')
      .update({
        online_status: online,
        last_status_check: checkedAt,
        metadata: {
          ...metadataWithoutError,
          thermostat_state: { ...thermostat, checked_at: checkedAt },
        },
      })
      .eq('id', device.id);

    return json({ success: true, thermostat });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Unable to check thermostat status';
    console.error('Error in tuya-thermostat-control:', error);

    if (supabase && accessibleDevice) {
      const failedAt = new Date().toISOString();
      const { thermostat_error: _previousError, ...metadataWithoutError } = accessibleDevice.metadata || {};
      const { error: saveError } = await supabase
        .from('yacht_smart_devices')
        .update({
          metadata: {
            ...metadataWithoutError,
            thermostat_error: { message, checked_at: failedAt },
          },
        })
        .eq('id', accessibleDevice.id)
        .eq('yacht_id', accessibleDevice.yacht_id);

      if (saveError) console.error('Failed to save thermostat error:', saveError);
    }

    return json({ success: false, error: message }, 400);
  }
});
