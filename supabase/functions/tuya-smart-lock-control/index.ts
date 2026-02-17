import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as crypto from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

function stringToBase64(str: string): string {
  return btoa(str);
}

function stringToHex(str: string): string {
  return Array.from(str, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

interface LockControlRequest {
  action: 'unlock' | 'lock' | 'status' | 'device_info' | 'diagnostics' | 'setup_key';
  deviceId: string;
  yachtId: string;
  userAgent?: string;
}

interface TuyaTokenResponse {
  success: boolean;
  result: {
    access_token: string;
    expire_time: number;
    refresh_token: string;
    uid: string;
  };
  t: number;
}

interface TuyaDeviceStatusResponse {
  success: boolean;
  result: Array<{
    code: string;
    value: any;
  }>;
  t: number;
}

interface TuyaCommandResponse {
  success: boolean;
  result: boolean;
  t: number;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

class TuyaAPIClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private supabase: any;
  private deviceId: string;
  private yachtId: string;

  constructor(clientId: string, clientSecret: string, region: string = 'us', supabase: any, deviceId: string, yachtId: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.supabase = supabase;
    this.deviceId = deviceId;
    this.yachtId = yachtId;

    const regionUrls: { [key: string]: string } = {
      'us': 'https://openapi.tuyaus.com',
      'eu': 'https://openapi.tuyaeu.com',
      'cn': 'https://openapi.tuyacn.com',
      'in': 'https://openapi.tuyain.com',
    };

    this.baseUrl = regionUrls[region] || regionUrls['us'];
  }

  private async logCommand(commandType: string, commandPayload: any, responseData: any, success: boolean, errorMessage: string | null, attemptNumber: number, methodName: string | null) {
    try {
      await this.supabase
        .from('smart_lock_command_logs')
        .insert({
          device_id: this.deviceId,
          yacht_id: this.yachtId,
          command_type: commandType,
          command_payload: commandPayload,
          response_data: responseData,
          success: success,
          error_message: errorMessage,
          attempt_number: attemptNumber,
          method_name: methodName
        });
    } catch (error) {
      console.error('Failed to log command to database:', error);
    }
  }

  private generateSignature(method: string, path: string, params: any = {}, body: string = ''): { sign: string; t: string; nonce: string } {
    const t = Date.now().toString();
    const nonce = '';

    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const url = path + (queryString ? '?' + queryString : '');

    const contentHash = crypto.createHash('sha256')
      .update(body)
      .digest('hex')
      .toLowerCase();

    const stringToSign = [
      method.toUpperCase(),
      contentHash,
      '',
      url
    ].join('\n');

    const signStr = this.clientId + (this.accessToken || '') + t + stringToSign;
    const sign = crypto.createHmac('sha256', this.clientSecret)
      .update(signStr)
      .digest('hex')
      .toUpperCase();

    console.log('=== Signature Generation Debug ===');
    console.log('Method:', method);
    console.log('Path:', path);
    console.log('Params:', params);
    console.log('URL for signature:', url);
    console.log('Body:', body);
    console.log('Content Hash:', contentHash);
    console.log('String to Sign:', stringToSign);
    console.log('Client ID:', this.clientId.substring(0, 10) + '...');
    console.log('Access Token:', this.accessToken ? this.accessToken.substring(0, 10) + '...' : '(empty)');
    console.log('Timestamp:', t);
    console.log('Sign String Length:', signStr.length);
    console.log('Signature:', sign.substring(0, 20) + '...');
    console.log('================================');

    return { sign, t, nonce };
  }

  async authenticate(): Promise<void> {
    const cacheKey = this.clientId;
    const cached = tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.accessToken = cached.token;
      this.tokenExpiresAt = cached.expiresAt;
      return;
    }

    const path = '/v1.0/token';
    const params = { grant_type: '1' };
    const { sign, t, nonce } = this.generateSignature('GET', path, params);

    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const headers: Record<string, string> = {
      'client_id': this.clientId,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256',
    };

    if (nonce) {
      headers['nonce'] = nonce;
    }

    console.log('Auth request details:', {
      url: `${this.baseUrl}${path}?${queryString}`,
      headers: { ...headers, sign: sign.substring(0, 20) + '...' }
    });

    const response = await fetch(`${this.baseUrl}${path}?${queryString}`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tuya authentication failed: ${response.statusText} - ${errorText}`);
    }

    const data: TuyaTokenResponse = await response.json();

    console.log('Tuya authentication response:', JSON.stringify(data, null, 2));

    if (!data.success) {
      const errorMsg = (data as any).msg || 'Invalid response';
      const errorCode = (data as any).code || 'unknown';

      if (errorCode === 28841002) {
        throw new Error('SUBSCRIPTION_EXPIRED: Your Tuya Cloud Development subscription has expired. Please renew it at https://iot.tuya.com/');
      }

      throw new Error(`Tuya authentication failed: ${errorMsg} (code: ${errorCode})`);
    }

    this.accessToken = data.result.access_token;
    this.tokenExpiresAt = Date.now() + (data.result.expire_time * 1000) - 60000;

    tokenCache.set(cacheKey, {
      token: this.accessToken,
      expiresAt: this.tokenExpiresAt,
    });
  }

  async getDeviceStatus(deviceId: string): Promise<any> {
    await this.authenticate();

    const path = `/v1.0/devices/${deviceId}/status`;
    const { sign, t, nonce } = this.generateSignature('GET', path);

    const headers: Record<string, string> = {
      'client_id': this.clientId,
      'access_token': this.accessToken!,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256',
    };

    if (nonce) {
      headers['nonce'] = nonce;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get device status: ${response.statusText}`);
    }

    const data: TuyaDeviceStatusResponse = await response.json();

    if (!data.success && (data as any).code === 28841002) {
      throw new Error('SUBSCRIPTION_EXPIRED: Your Tuya Cloud Development subscription has expired. Please renew it at https://iot.tuya.com/');
    }

    return data;
  }

  async getDeviceInfo(deviceId: string): Promise<any> {
    await this.authenticate();

    const path = `/v1.0/devices/${deviceId}`;
    const { sign, t, nonce } = this.generateSignature('GET', path);

    const headers: Record<string, string> = {
      'client_id': this.clientId,
      'access_token': this.accessToken!,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256',
    };

    if (nonce) {
      headers['nonce'] = nonce;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get device info: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  async getDeviceSpecifications(deviceId: string): Promise<any> {
    await this.authenticate();

    const path = `/v1.0/devices/${deviceId}/specifications`;
    const { sign, t, nonce } = this.generateSignature('GET', path);

    const headers: Record<string, string> = {
      'client_id': this.clientId,
      'access_token': this.accessToken!,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256',
    };

    if (nonce) {
      headers['nonce'] = nonce;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get device specifications: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  async sendCommand(deviceId: string, commands: Array<{ code: string; value: any }>): Promise<any> {
    await this.authenticate();

    const path = `/v1.0/devices/${deviceId}/commands`;
    const body = JSON.stringify({ commands });
    const { sign, t, nonce } = this.generateSignature('POST', path, {}, body);

    const headers: Record<string, string> = {
      'client_id': this.clientId,
      'access_token': this.accessToken!,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256',
      'Content-Type': 'application/json',
    };

    if (nonce) {
      headers['nonce'] = nonce;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      throw new Error(`Failed to send command: ${response.statusText}`);
    }

    const data: TuyaCommandResponse = await response.json();

    if (!data.success && (data as any).code === 28841002) {
      throw new Error('SUBSCRIPTION_EXPIRED: Your Tuya Cloud Development subscription has expired. Please renew it at https://iot.tuya.com/');
    }

    return data;
  }

  async unlockDoor(deviceId: string): Promise<any> {
    const unlockAttempts = [
      { code: 'remote_no_dp_key', value: 'unlock' },
      { code: 'unlock_app', value: true },
      { code: 'unlock', value: true },
      { code: 'unlock_door', value: true },
      { code: 'remote_unlock', value: true },
      { code: 'manual_lock', value: false },
    ];

    const errors: string[] = [];

    for (const attempt of unlockAttempts) {
      try {
        console.log(`Attempting unlock with code: ${attempt.code}, value:`, attempt.value);
        const result = await this.sendCommand(deviceId, [attempt]);
        console.log(`Unlock attempt result for ${attempt.code}:`, result);

        if (result.success) {
          console.log(`✓ Unlock successful with code: ${attempt.code}`);
          return result;
        }
        errors.push(`${attempt.code}: ${JSON.stringify(result)}`);
      } catch (error: any) {
        console.log(`✗ Unlock failed with code ${attempt.code}:`, error.message);
        errors.push(`${attempt.code}: ${error.message}`);
      }
    }

    console.error('All unlock attempts failed:', errors);
    throw new Error(`All unlock methods failed. Tried: ${unlockAttempts.map(a => a.code).join(', ')}. This lock may require special setup or may not support remote unlock.`);
  }

  async lockDoor(deviceId: string): Promise<any> {
    const lockAttempts = [
      { code: 'remote_no_dp_key', value: 'lock' },
      { code: 'lock_app', value: true },
      { code: 'lock', value: true },
      { code: 'lock_door', value: true },
      { code: 'remote_lock', value: true },
      { code: 'lock_motor_state', value: true },
      { code: 'manual_lock', value: true },
    ];

    const errors: string[] = [];

    for (const attempt of lockAttempts) {
      try {
        console.log(`Attempting lock with code: ${attempt.code}, value:`, attempt.value);
        const result = await this.sendCommand(deviceId, [attempt]);
        console.log(`Lock attempt result for ${attempt.code}:`, result);

        if (result.success) {
          console.log(`✓ Lock successful with code: ${attempt.code}`);
          return result;
        }
        errors.push(`${attempt.code}: ${JSON.stringify(result)}`);
      } catch (error: any) {
        console.log(`✗ Lock failed with code ${attempt.code}:`, error.message);
        errors.push(`${attempt.code}: ${error.message}`);
      }
    }

    console.error('All lock attempts failed:', errors);
    throw new Error(`All lock methods failed. Tried: ${lockAttempts.map(a => a.code).join(', ')}. This lock may require special setup or may not support remote lock.`);
  }

  async setupEncryptionKey(deviceId: string): Promise<string> {
    console.log('=== ENCRYPTION KEY SETUP DEBUG ===');
    console.log('Device ID:', deviceId);

    const randomKey = crypto.randomBytes(16).toString('hex');
    console.log('Generated 16-byte key (hex):', randomKey);
    console.log('Key length:', randomKey.length, 'chars (32 hex chars = 16 bytes)');

    const attempts = [
      { name: 'JSON + base64', value: stringToBase64(JSON.stringify({ key: randomKey, timestamp: Date.now() })) },
      { name: 'Raw hex key', value: randomKey },
      { name: 'Raw base64 key', value: bytesToBase64(hexToBytes(randomKey)) },
      { name: 'Simple key string', value: randomKey.toUpperCase() }
    ];

    let attemptNum = 1;
    for (const attempt of attempts) {
      try {
        console.log(`\nAttempting key setup method: ${attempt.name}`);
        console.log('Payload value:', attempt.value.substring(0, 50) + (attempt.value.length > 50 ? '...' : ''));
        console.log('Payload length:', attempt.value.length);

        const commandPayload = { code: 'remote_no_pd_setkey', value: attempt.value };
        const result = await this.sendCommand(deviceId, [commandPayload]);

        console.log('Result:', JSON.stringify(result, null, 2));

        await this.logCommand(
          'setup_key',
          commandPayload,
          result,
          result.success,
          result.success ? null : JSON.stringify(result),
          attemptNum,
          attempt.name
        );

        if (result.success) {
          console.log(`✓ SUCCESS with method: ${attempt.name}`);
          return randomKey;
        } else {
          console.log(`✗ Failed with method: ${attempt.name}, result:`, result);
        }
      } catch (error: any) {
        console.error(`✗ Exception with method ${attempt.name}:`, error.message);
        await this.logCommand(
          'setup_key',
          { code: 'remote_no_pd_setkey', method: attempt.name },
          { error: error.message },
          false,
          error.message,
          attemptNum,
          attempt.name
        );
      }
      attemptNum++;
    }

    throw new Error('All encryption key setup methods failed');
  }

  async unlockDoorWithEncryption(deviceId: string, encryptionKey: string): Promise<any> {
    console.log('=== ENCRYPTED UNLOCK DEBUG ===');
    console.log('Device ID:', deviceId);
    console.log('Encryption key (first 16 chars):', encryptionKey.substring(0, 16) + '...');

    const timestamp = Date.now();

    const encryptionAttempts = [
      {
        name: 'AES-128-CBC with JSON payload',
        encrypt: () => {
          const unlockData = { action: 'unlock', timestamp };
          const cipher = crypto.createCipheriv('aes-128-cbc', hexToBytes(encryptionKey.substring(0, 32)), new Uint8Array(16));
          let encrypted = cipher.update(JSON.stringify(unlockData), 'utf8', 'base64');
          encrypted += cipher.final('base64');
          return encrypted;
        }
      },
      {
        name: 'Plain string "unlock"',
        encrypt: () => 'unlock'
      },
      {
        name: 'Numeric value true for unlock',
        encrypt: () => true
      },
      {
        name: 'String value "true"',
        encrypt: () => 'true'
      },
      {
        name: 'Base64 "unlock"',
        encrypt: () => stringToBase64('unlock')
      },
      {
        name: 'AES-128-CBC with simple "unlock" string',
        encrypt: () => {
          const cipher = crypto.createCipheriv('aes-128-cbc', hexToBytes(encryptionKey.substring(0, 32)), new Uint8Array(16));
          let encrypted = cipher.update('unlock', 'utf8', 'base64');
          encrypted += cipher.final('base64');
          return encrypted;
        }
      },
      {
        name: 'Hex encoded command',
        encrypt: () => stringToHex('unlock')
      }
    ];

    let attemptNum = 1;
    for (const attempt of encryptionAttempts) {
      try {
        const encrypted = attempt.encrypt();
        console.log(`\nAttempting unlock method: ${attempt.name}`);
        console.log('Encrypted value:', encrypted.substring(0, 50) + (encrypted.length > 50 ? '...' : ''));
        console.log('Encrypted length:', encrypted.length);

        const commandPayload = { code: 'remote_no_dp_key', value: encrypted };
        const result = await this.sendCommand(deviceId, [commandPayload]);

        console.log('Result:', JSON.stringify(result, null, 2));

        await this.logCommand(
          'unlock_encrypted',
          commandPayload,
          result,
          result.success,
          result.success ? null : JSON.stringify(result),
          attemptNum,
          attempt.name
        );

        if (result.success) {
          console.log(`✓ SUCCESS with method: ${attempt.name}`);
          return result;
        } else {
          console.log(`✗ Failed with method: ${attempt.name}`);
        }
      } catch (error: any) {
        console.error(`✗ Exception with method ${attempt.name}:`, error.message);
        await this.logCommand(
          'unlock_encrypted',
          { code: 'remote_no_dp_key', method: attempt.name },
          { error: error.message },
          false,
          error.message,
          attemptNum,
          attempt.name
        );
      }
      attemptNum++;
    }

    throw new Error('All encrypted unlock methods failed');
  }

  async lockDoorWithEncryption(deviceId: string, encryptionKey: string): Promise<any> {
    console.log('=== ENCRYPTED LOCK DEBUG ===');
    console.log('Device ID:', deviceId);
    console.log('Encryption key (first 16 chars):', encryptionKey.substring(0, 16) + '...');

    const timestamp = Date.now();

    const encryptionAttempts = [
      {
        name: 'AES-128-CBC with JSON payload',
        encrypt: () => {
          const lockData = { action: 'lock', timestamp };
          const cipher = crypto.createCipheriv('aes-128-cbc', hexToBytes(encryptionKey.substring(0, 32)), new Uint8Array(16));
          let encrypted = cipher.update(JSON.stringify(lockData), 'utf8', 'base64');
          encrypted += cipher.final('base64');
          return encrypted;
        }
      },
      {
        name: 'Plain string "lock"',
        encrypt: () => 'lock'
      },
      {
        name: 'Numeric value true for lock',
        encrypt: () => true
      },
      {
        name: 'String value "true"',
        encrypt: () => 'true'
      },
      {
        name: 'Base64 "lock"',
        encrypt: () => stringToBase64('lock')
      },
      {
        name: 'AES-128-CBC with simple "lock" string',
        encrypt: () => {
          const cipher = crypto.createCipheriv('aes-128-cbc', hexToBytes(encryptionKey.substring(0, 32)), new Uint8Array(16));
          let encrypted = cipher.update('lock', 'utf8', 'base64');
          encrypted += cipher.final('base64');
          return encrypted;
        }
      },
      {
        name: 'Hex encoded command',
        encrypt: () => stringToHex('lock')
      }
    ];

    let attemptNum = 1;
    for (const attempt of encryptionAttempts) {
      try {
        const encrypted = attempt.encrypt();
        console.log(`\nAttempting lock method: ${attempt.name}`);
        console.log('Encrypted value:', encrypted.substring(0, 50) + (encrypted.length > 50 ? '...' : ''));
        console.log('Encrypted length:', encrypted.length);

        const commandPayload = { code: 'remote_no_dp_key', value: encrypted };
        const result = await this.sendCommand(deviceId, [commandPayload]);

        console.log('Result:', JSON.stringify(result, null, 2));

        await this.logCommand(
          'lock_encrypted',
          commandPayload,
          result,
          result.success,
          result.success ? null : JSON.stringify(result),
          attemptNum,
          attempt.name
        );

        if (result.success) {
          console.log(`✓ SUCCESS with method: ${attempt.name}`);
          return result;
        } else {
          console.log(`✗ Failed with method: ${attempt.name}`);
        }
      } catch (error: any) {
        console.error(`✗ Exception with method ${attempt.name}:`, error.message);
        await this.logCommand(
          'lock_encrypted',
          { code: 'remote_no_dp_key', method: attempt.name },
          { error: error.message },
          false,
          error.message,
          attemptNum,
          attempt.name
        );
      }
      attemptNum++;
    }

    throw new Error('All encrypted lock methods failed');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, role, yacht_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !userProfile) {
      throw new Error('User profile not found');
    }

    const requestBody: LockControlRequest = await req.json();
    const { action, deviceId, yachtId, userAgent } = requestBody;

    const { data: device, error: deviceError } = await supabase
      .from('yacht_smart_devices')
      .select('*')
      .eq('id', deviceId)
      .eq('yacht_id', yachtId)
      .maybeSingle();

    if (deviceError || !device) {
      throw new Error('Device not found');
    }

    if (action !== 'diagnostics' && action !== 'status' && !device.is_active) {
      throw new Error('Device is not active');
    }

    const isMaster = userProfile.role === 'master';
    const isStaff = ['manager', 'staff', 'mechanic', 'master'].includes(userProfile.role);
    const isOwner = userProfile.role === 'owner' && userProfile.yacht_id === yachtId;

    if (!isStaff && !isOwner) {
      const { data: booking, error: bookingError } = await supabase
        .from('yacht_bookings')
        .select('*')
        .eq('user_id', userProfile.id)
        .eq('yacht_id', yachtId)
        .lte('start_date', new Date().toISOString())
        .gte('end_date', new Date().toISOString())
        .maybeSingle();

      if (bookingError || !booking) {
        throw new Error('Access denied: No active booking found');
      }
    }

    const { data: credentials, error: credError } = await supabase
      .from('tuya_device_credentials')
      .select('*')
      .eq('yacht_id', yachtId)
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credentials) {
      throw new Error('Tuya credentials not configured for this yacht');
    }

    const encryptionKey = Deno.env.get('SMART_DEVICE_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const { data: decryptedSecret } = await supabase.rpc('decrypt_credential', {
      ciphertext: credentials.tuya_client_secret,
      key: encryptionKey
    });

    if (!decryptedSecret) {
      throw new Error('Failed to decrypt Tuya credentials');
    }

    const tuyaClient = new TuyaAPIClient(
      credentials.tuya_client_id,
      decryptedSecret,
      credentials.tuya_region,
      supabase,
      deviceId,
      yachtId
    );

    let result: any;
    let success = true;
    let errorMessage: string | null = null;
    let actionType = action;

    try {
      switch (action) {
        case 'unlock':
          if (device.device_category === 'jtmspro') {
            if (!device.encryption_key) {
              throw new Error('Device requires encryption key setup. Please run setup_key action first.');
            }
            result = await tuyaClient.unlockDoorWithEncryption(device.tuya_device_id, device.encryption_key);
          } else {
            result = await tuyaClient.unlockDoor(device.tuya_device_id);
          }
          actionType = 'unlock';
          break;
        case 'lock':
          if (device.device_category === 'jtmspro') {
            if (!device.encryption_key) {
              throw new Error('Device requires encryption key setup. Please run setup_key action first.');
            }
            result = await tuyaClient.lockDoorWithEncryption(device.tuya_device_id, device.encryption_key);
          } else {
            result = await tuyaClient.lockDoor(device.tuya_device_id);
          }
          actionType = 'lock';
          break;
        case 'setup_key':
          if (!isStaff) {
            throw new Error('Only staff can setup encryption keys');
          }
          const encryptionKey = await tuyaClient.setupEncryptionKey(device.tuya_device_id);

          await supabase
            .from('yacht_smart_devices')
            .update({
              encryption_key: encryptionKey,
              encryption_key_set_at: new Date().toISOString(),
              requires_key_setup: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', deviceId);

          result = {
            success: true,
            message: 'Encryption key setup completed successfully',
            keySetAt: new Date().toISOString()
          };
          actionType = 'setup_key';
          break;
        case 'status':
          result = await tuyaClient.getDeviceStatus(device.tuya_device_id);
          actionType = 'status_check';

          if (result.success && result.result) {
            console.log('Device status codes available:', result.result.map((item: any) => ({ code: item.code, value: item.value })));

            const lockStateCode = result.result.find((item: any) =>
              item.code === 'lock_motor_state' ||
              item.code === 'locked' ||
              item.code === 'doorlock_state' ||
              item.code === 'lock' ||
              item.code === 'manual_lock'
            );

            console.log('Lock state code found:', lockStateCode);

            if (!lockStateCode) {
              console.warn('No traditional lock state code found - using database state for professional locks');
              console.log('Available status codes:', result.result.map((item: any) => item.code).join(', '));

              result.lockState = {
                isLocked: device.current_lock_state ?? true,
                rawStatus: result.result,
                detectedCode: null,
                source: 'database',
                note: 'Professional lock - state tracked in database'
              };
            } else {
              result.lockState = {
                isLocked: lockStateCode.value,
                rawStatus: result.result,
                detectedCode: lockStateCode.code,
                source: 'device'
              };
            }
          } else {
            throw new Error('Failed to get device status from Tuya API');
          }
          break;
        case 'device_info':
          result = await tuyaClient.getDeviceStatus(device.tuya_device_id);
          actionType = 'status_check';
          break;
        case 'diagnostics':
          console.log('Running diagnostics for device:', device.tuya_device_id);
          console.log('Using Tuya region:', credentials.tuya_region);

          let deviceInfo;
          let deviceStatus;
          let deviceSpecs;

          try {
            deviceInfo = await tuyaClient.getDeviceInfo(device.tuya_device_id);
            console.log('Device info retrieved successfully');
          } catch (infoError: any) {
            console.error('Failed to get device info:', infoError);
            throw new Error(`Failed to get device info: ${infoError.message}`);
          }

          try {
            deviceStatus = await tuyaClient.getDeviceStatus(device.tuya_device_id);
            console.log('Device status retrieved successfully');
          } catch (statusError: any) {
            console.error('Failed to get device status:', statusError);
            throw new Error(`Failed to get device status: ${statusError.message}`);
          }

          try {
            deviceSpecs = await tuyaClient.getDeviceSpecifications(device.tuya_device_id);
            console.log('Device specifications retrieved successfully');
            console.log('Available functions:', JSON.stringify(deviceSpecs?.result?.functions || [], null, 2));
          } catch (specsError: any) {
            console.warn('Failed to get device specifications (non-fatal):', specsError.message);
            deviceSpecs = { error: specsError.message };
          }

          result = {
            deviceInfo: deviceInfo,
            deviceStatus: deviceStatus,
            deviceSpecifications: deviceSpecs,
            diagnostics: {
              deviceId: device.tuya_device_id,
              apiRegion: credentials.tuya_region,
              authenticationSuccess: true,
              timestamp: new Date().toISOString(),
              availableUnlockMethods: deviceSpecs?.result?.functions
                ?.filter((f: any) =>
                  f.code.includes('unlock') ||
                  f.code.includes('remote') ||
                  f.code.includes('lock')
                )
                .map((f: any) => ({ code: f.code, name: f.name, type: f.type })) || []
            }
          };
          actionType = 'diagnostics';
          break;
        default:
          throw new Error('Invalid action');
      }

      if (action === 'status' || action === 'device_info' || action === 'diagnostics') {
        let isOnline = false;

        if (action === 'diagnostics' && result.deviceInfo?.result) {
          isOnline = result.deviceInfo.result.online || false;
        } else if (result.success !== undefined) {
          isOnline = result.success;
        }

        await supabase
          .from('yacht_smart_devices')
          .update({
            last_status_check: new Date().toISOString(),
            online_status: isOnline
          })
          .eq('id', deviceId);
      }
    } catch (error: any) {
      console.error('Error executing action:', action);
      console.error('Error details:', error);
      success = false;
      errorMessage = error.message;
      result = { error: error.message };
    }

    const userName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Unknown User';
    
    await supabase
      .from('smart_lock_access_logs')
      .insert({
        device_id: deviceId,
        yacht_id: yachtId,
        user_id: userProfile.id,
        user_name: userName,
        action_type: success ? actionType : 'failed_attempt',
        door_location: device.location,
        success: success,
        error_message: errorMessage,
        user_agent: userAgent || req.headers.get('User-Agent') || 'Unknown',
        ip_address: req.headers.get('X-Forwarded-For') || 'Unknown',
        timestamp: new Date().toISOString(),
        metadata: {
          device_name: device.device_name,
          action: action,
          result: result
        }
      });

    if ((action === 'unlock' || action === 'lock') && success) {
      await supabase
        .from('yacht_smart_devices')
        .update({
          current_lock_state: action === 'lock'
        })
        .eq('id', deviceId);

      console.log(`Updated device ${deviceId} lock state to: ${action === 'lock' ? 'locked' : 'unlocked'}`);

      const { data: yacht } = await supabase
        .from('yachts')
        .select('name')
        .eq('id', yachtId)
        .maybeSingle();

      const actionText = action === 'unlock' ? 'unlocked' : 'locked';
      const logMessage = `${userName} ${actionText} ${device.location.replace('_', ' ')}`;

      await supabase
        .from('yacht_history_logs')
        .insert({
          yacht_id: yachtId,
          user_id: userProfile.id,
          log_type: 'smart_lock',
          description: logMessage,
          metadata: {
            device_id: deviceId,
            device_name: device.device_name,
            location: device.location,
            action: action
          }
        });

      await supabase
        .from('admin_notifications')
        .insert({
          type: 'smart_lock_activity',
          title: `Smart Lock ${action === 'unlock' ? 'Unlocked' : 'Locked'}`,
          message: `${userName} ${actionText} the ${device.location.replace('_', ' ')} on ${yacht?.name || 'Unknown Yacht'}`,
          yacht_id: yachtId,
          reference_id: deviceId,
          read: false,
          created_at: new Date().toISOString()
        });
    }

    const response: any = {
      success: success,
      action: action,
      device: {
        id: device.id,
        name: device.device_name,
        location: device.location
      },
      result: result,
      timestamp: new Date().toISOString()
    };

    if (!success && errorMessage) {
      response.error = errorMessage;
    }

    if (action === 'status' && result.lockState) {
      response.lockState = result.lockState;
    }

    return new Response(
      JSON.stringify(response),
      {
        status: success ? 200 : 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in tuya-smart-lock-control:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});