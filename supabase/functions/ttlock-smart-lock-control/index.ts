import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as crypto from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LockControlRequest {
  action: 'unlock' | 'lock' | 'status' | 'create_passcode' | 'delete_passcode' | 'get_passcodes';
  deviceId: string;
  yachtId: string;
  userAgent?: string;
  passcodeData?: {
    passcode: string;
    passcodeName: string;
    startDate: string;
    endDate: string;
    bookingId?: string;
  };
  passcodeId?: string;
}

interface TTLockTokenResponse {
  access_token: string;
  uid: number;
  expires_in: number;
}

interface TTLockLockStatusResponse {
  electricQuantity: number;
  lockMac: string;
  lockName: string;
  lockSound: number;
  privacyLock: number;
  tamperAlert: number;
  resetButton: number;
  lockId: number;
  state: number;
  date: number;
}

interface TTLockPasscodeResponse {
  keyboardPwdId: number;
  keyboardPwd: string;
  keyboardPwdName: string;
  keyboardPwdType: number;
  startDate: number;
  endDate: number;
}

class TTLockAPIClient {
  private clientId: string;
  private clientSecret: string;
  private username: string;
  private passwordMd5: string;
  private baseUrl: string = 'https://euopen.ttlock.com';
  private supabase: any;
  private deviceId: string;
  private yachtId: string;

  constructor(
    clientId: string,
    clientSecret: string,
    username: string,
    passwordMd5: string,
    supabase: any,
    deviceId: string,
    yachtId: string
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.username = username;
    this.passwordMd5 = passwordMd5;
    this.supabase = supabase;
    this.deviceId = deviceId;
    this.yachtId = yachtId;
  }

  private async getAccessToken(): Promise<{ token: string; uid: number }> {
    const { data: cachedToken, error: tokenError } = await this.supabase
      .from('ttlock_access_tokens')
      .select('*')
      .eq('yacht_id', this.yachtId)
      .maybeSingle();

    if (!tokenError && cachedToken && new Date(cachedToken.expires_at) > new Date()) {
      console.log('Using cached TTLock access token');
      return {
        token: cachedToken.access_token,
        uid: cachedToken.uid
      };
    }

    console.log('Requesting new TTLock access token');
    const timestamp = Date.now();
    const url = `${this.baseUrl}/oauth2/token`;

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username: this.username,
      password: this.passwordMd5,
      grant_type: 'password',
      redirect_uri: 'https://example.com/callback'
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTLock authentication failed: ${response.statusText} - ${errorText}`);
    }

    const data: TTLockTokenResponse = await response.json();

    if (!data.access_token) {
      throw new Error('TTLock authentication failed: No access token received');
    }

    const expiresAt = new Date(Date.now() + (data.expires_in * 1000) - 60000);

    await this.supabase
      .from('ttlock_access_tokens')
      .upsert({
        yacht_id: this.yachtId,
        access_token: data.access_token,
        uid: data.uid,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'yacht_id'
      });

    console.log('TTLock access token obtained and cached');
    return {
      token: data.access_token,
      uid: data.uid
    };
  }

  async unlockDoor(lockId: string): Promise<any> {
    const { token } = await this.getAccessToken();
    const timestamp = Date.now();

    const params = new URLSearchParams({
      clientId: this.clientId,
      accessToken: token,
      lockId: lockId,
      date: timestamp.toString()
    });

    const response = await fetch(`${this.baseUrl}/v3/lock/unlock?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to unlock door: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.errcode !== 0) {
      throw new Error(`TTLock unlock failed: ${data.errmsg || 'Unknown error'} (code: ${data.errcode})`);
    }

    return data;
  }

  async lockDoor(lockId: string): Promise<any> {
    const { token } = await this.getAccessToken();
    const timestamp = Date.now();

    const params = new URLSearchParams({
      clientId: this.clientId,
      accessToken: token,
      lockId: lockId,
      date: timestamp.toString()
    });

    const response = await fetch(`${this.baseUrl}/v3/lock/lock?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to lock door: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.errcode !== 0) {
      throw new Error(`TTLock lock failed: ${data.errmsg || 'Unknown error'} (code: ${data.errcode})`);
    }

    return data;
  }

  async getLockStatus(lockId: string): Promise<TTLockLockStatusResponse> {
    const { token } = await this.getAccessToken();
    const timestamp = Date.now();

    const params = new URLSearchParams({
      clientId: this.clientId,
      accessToken: token,
      lockId: lockId,
      date: timestamp.toString()
    });

    const response = await fetch(`${this.baseUrl}/v3/lock/detail?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get lock status: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.errcode !== 0) {
      throw new Error(`TTLock status check failed: ${data.errmsg || 'Unknown error'} (code: ${data.errcode})`);
    }

    return data;
  }

  async createPasscode(
    lockId: string,
    passcode: string,
    passcodeName: string,
    startDate: number,
    endDate: number
  ): Promise<TTLockPasscodeResponse> {
    const { token } = await this.getAccessToken();
    const timestamp = Date.now();

    const params = new URLSearchParams({
      clientId: this.clientId,
      accessToken: token,
      lockId: lockId,
      keyboardPwd: passcode,
      keyboardPwdName: passcodeName,
      startDate: startDate.toString(),
      endDate: endDate.toString(),
      addType: '2',
      date: timestamp.toString()
    });

    const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/add?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create passcode: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.errcode !== 0) {
      throw new Error(`TTLock passcode creation failed: ${data.errmsg || 'Unknown error'} (code: ${data.errcode})`);
    }

    return data;
  }

  async deletePasscode(lockId: string, keyboardPwdId: string): Promise<any> {
    const { token } = await this.getAccessToken();
    const timestamp = Date.now();

    const params = new URLSearchParams({
      clientId: this.clientId,
      accessToken: token,
      lockId: lockId,
      keyboardPwdId: keyboardPwdId,
      deleteType: '2',
      date: timestamp.toString()
    });

    const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/delete?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete passcode: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.errcode !== 0) {
      throw new Error(`TTLock passcode deletion failed: ${data.errmsg || 'Unknown error'} (code: ${data.errcode})`);
    }

    return data;
  }

  async getPasscodes(lockId: string): Promise<TTLockPasscodeResponse[]> {
    const { token } = await this.getAccessToken();
    const timestamp = Date.now();

    const params = new URLSearchParams({
      clientId: this.clientId,
      accessToken: token,
      lockId: lockId,
      pageNo: '1',
      pageSize: '100',
      date: timestamp.toString()
    });

    const response = await fetch(`${this.baseUrl}/v3/lock/listKeyboardPwd?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get passcodes: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.errcode !== 0) {
      throw new Error(`TTLock get passcodes failed: ${data.errmsg || 'Unknown error'} (code: ${data.errcode})`);
    }

    return data.list || [];
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
    const { action, deviceId, yachtId, userAgent, passcodeData, passcodeId } = requestBody;

    const { data: device, error: deviceError } = await supabase
      .from('yacht_smart_devices')
      .select('*')
      .eq('id', deviceId)
      .eq('yacht_id', yachtId)
      .eq('lock_provider', 'ttlock')
      .maybeSingle();

    if (deviceError || !device) {
      throw new Error('TTLock device not found');
    }

    if (!device.is_active) {
      throw new Error('Device is not active');
    }

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
      .from('ttlock_device_credentials')
      .select('*')
      .eq('yacht_id', yachtId)
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credentials) {
      throw new Error('TTLock credentials not configured for this yacht');
    }

    const ttlockClient = new TTLockAPIClient(
      credentials.ttlock_client_id,
      credentials.ttlock_client_secret,
      credentials.ttlock_username,
      credentials.ttlock_password_md5,
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
          result = await ttlockClient.unlockDoor(device.ttlock_lock_id);
          actionType = 'unlock';
          break;
        case 'lock':
          result = await ttlockClient.lockDoor(device.ttlock_lock_id);
          actionType = 'lock';
          break;
        case 'status':
          result = await ttlockClient.getLockStatus(device.ttlock_lock_id);
          actionType = 'status_check';

          await supabase
            .from('yacht_smart_devices')
            .update({
              last_status_check: new Date().toISOString(),
              online_status: true,
              battery_level: result.electricQuantity || device.battery_level
            })
            .eq('id', deviceId);
          break;
        case 'create_passcode':
          if (!isStaff) {
            throw new Error('Only staff can create passcodes');
          }
          if (!passcodeData) {
            throw new Error('Passcode data is required');
          }

          const startTimestamp = new Date(passcodeData.startDate).getTime();
          const endTimestamp = new Date(passcodeData.endDate).getTime();

          result = await ttlockClient.createPasscode(
            device.ttlock_lock_id,
            passcodeData.passcode,
            passcodeData.passcodeName,
            startTimestamp,
            endTimestamp
          );

          await supabase
            .from('ttlock_passcodes')
            .insert({
              device_id: deviceId,
              yacht_id: yachtId,
              booking_id: passcodeData.bookingId || null,
              passcode: passcodeData.passcode,
              passcode_name: passcodeData.passcodeName,
              ttlock_passcode_id: result.keyboardPwdId,
              start_date: passcodeData.startDate,
              end_date: passcodeData.endDate,
              is_active: true,
              created_by: userProfile.id
            });

          actionType = 'create_passcode';
          break;
        case 'delete_passcode':
          if (!isStaff) {
            throw new Error('Only staff can delete passcodes');
          }
          if (!passcodeId) {
            throw new Error('Passcode ID is required');
          }

          const { data: passcodeRecord, error: passcodeError } = await supabase
            .from('ttlock_passcodes')
            .select('*')
            .eq('id', passcodeId)
            .maybeSingle();

          if (passcodeError || !passcodeRecord) {
            throw new Error('Passcode not found');
          }

          result = await ttlockClient.deletePasscode(
            device.ttlock_lock_id,
            passcodeRecord.ttlock_passcode_id.toString()
          );

          await supabase
            .from('ttlock_passcodes')
            .update({ is_active: false })
            .eq('id', passcodeId);

          actionType = 'delete_passcode';
          break;
        case 'get_passcodes':
          result = await ttlockClient.getPasscodes(device.ttlock_lock_id);

          const { data: dbPasscodes } = await supabase
            .from('ttlock_passcodes')
            .select('*')
            .eq('device_id', deviceId)
            .eq('is_active', true);

          result = {
            ttlockPasscodes: result,
            databasePasscodes: dbPasscodes || []
          };
          actionType = 'status_check';
          break;
        default:
          throw new Error('Invalid action');
      }
    } catch (error: any) {
      console.error('Error executing TTLock action:', action);
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
          result: result,
          provider: 'ttlock'
        }
      });

    if ((action === 'unlock' || action === 'lock') && success) {
      await supabase
        .from('yacht_smart_devices')
        .update({
          current_lock_state: action === 'lock'
        })
        .eq('id', deviceId);

      const { data: yacht } = await supabase
        .from('yachts')
        .select('name')
        .eq('id', yachtId)
        .maybeSingle();

      const actionText = action === 'unlock' ? 'unlocked' : 'locked';
      const logMessage = `${userName} ${actionText} ${device.location.replace('_', ' ')} (TTLock)`;

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
            action: action,
            provider: 'ttlock'
          }
        });

      await supabase
        .from('admin_notifications')
        .insert({
          type: 'smart_lock_activity',
          title: `TTLock ${action === 'unlock' ? 'Unlocked' : 'Locked'}`,
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
        location: device.location,
        provider: 'ttlock'
      },
      result: result,
      timestamp: new Date().toISOString()
    };

    if (!success && errorMessage) {
      response.error = errorMessage;
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
    console.error('Error in ttlock-smart-lock-control:', error);
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
