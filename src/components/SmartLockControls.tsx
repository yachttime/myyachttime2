import { useState, useEffect } from 'react';
import { Lock, Unlock, RefreshCw, AlertCircle, CheckCircle, Loader2, Battery, WifiOff, Clock, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SmartDevice {
  id: string;
  yacht_id: string;
  device_type: string;
  device_name: string;
  location: string;
  lock_provider: 'tuya' | 'ttlock';
  tuya_device_id: string;
  ttlock_lock_id: string | null;
  battery_level: number;
  online_status: boolean;
  is_active: boolean;
  last_status_check: string | null;
  current_lock_state: boolean | null;
  device_category: string | null;
  encryption_key: string | null;
  encryption_key_set_at: string | null;
  requires_key_setup: boolean;
}

interface SmartLockControlsProps {
  yachtId: string;
  userId: string;
  userName: string;
  hasActiveBooking: boolean;
}

interface LockStatus {
  isLocked: boolean;
  loading: boolean;
  lastActivity?: {
    userName: string;
    action: string;
    timestamp: string;
  };
}

const getLockControlEndpoint = (provider: 'tuya' | 'ttlock'): string => {
  return provider === 'ttlock' ? 'ttlock-smart-lock-control' : 'tuya-smart-lock-control';
};

export const SmartLockControls = ({ yachtId, userId, userName, hasActiveBooking }: SmartLockControlsProps) => {
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockStatuses, setLockStatuses] = useState<{ [key: string]: LockStatus }>({});
  const [showConfirmModal, setShowConfirmModal] = useState<{ deviceId: string; action: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusRefreshing, setStatusRefreshing] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState<{ deviceId: string; deviceName: string } | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState<string | null>(null);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);

  useEffect(() => {
    loadDevices();
    loadUserRole();
  }, [yachtId]);

  const loadUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          setUserRole(profile.role);
        }
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('yacht_smart_devices')
        .select('*')
        .eq('yacht_id', yachtId)
        .eq('device_type', 'door_lock')
        .eq('is_active', true)
        .order('location');

      if (error) throw error;

      setDevices(data || []);

      if (data && data.length > 0) {
        const initialStatuses: { [key: string]: LockStatus } = {};
        for (const device of data) {
          initialStatuses[device.id] = {
            isLocked: device.current_lock_state ?? true,
            loading: false
          };
        }
        setLockStatuses(initialStatuses);

        for (const device of data) {
          await loadLastActivity(device.id);
          refreshStatus(device.id);
        }
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLastActivity = async (deviceId: string) => {
    try {
      const { data, error } = await supabase
        .from('smart_lock_access_logs')
        .select('user_name, action_type, timestamp')
        .eq('device_id', deviceId)
        .in('action_type', ['lock', 'unlock'])
        .eq('success', true)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLockStatuses(prev => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            isLocked: data.action_type === 'lock',
            loading: false,
            lastActivity: {
              userName: data.user_name,
              action: data.action_type,
              timestamp: data.timestamp,
            }
          }
        }));
      }
    } catch (error) {
      console.error('Error loading last activity:', error);
    }
  };

  const refreshStatus = async (deviceId: string) => {
    setStatusRefreshing(deviceId);
    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const endpoint = getLockControlEndpoint(device.lock_provider);

      const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'status',
          deviceId: deviceId,
          yachtId: yachtId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        let isLocked = true;

        if (device.lock_provider === 'tuya' && result.lockState) {
          isLocked = result.lockState.isLocked;
        } else if (device.lock_provider === 'ttlock' && result.result) {
          isLocked = result.result.state === 1;
        }

        setLockStatuses(prev => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            isLocked: isLocked,
            loading: false,
          }
        }));
        showMessage('success', `Lock is currently ${isLocked ? 'locked' : 'unlocked'}`);
        await loadLastActivity(deviceId);
      } else {
        throw new Error(result.error || 'Failed to refresh status');
      }
    } catch (error: any) {
      console.error('Error refreshing status:', error);
      if (error.message?.includes('SUBSCRIPTION_EXPIRED')) {
        setSubscriptionExpired(true);
        showMessage('error', 'Tuya Cloud subscription has expired. Please renew at iot.tuya.com');
      } else {
        showMessage('error', error.message || 'Failed to refresh status');
      }
    } finally {
      setStatusRefreshing(null);
    }
  };

  const handleLockAction = async (deviceId: string, action: 'lock' | 'unlock') => {
    setShowConfirmModal(null);
    setActionLoading(deviceId);

    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const endpoint = getLockControlEndpoint(device.lock_provider);

      const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action,
          deviceId: deviceId,
          yachtId: yachtId,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorJson = await response.json();
          console.error('Server returned error:', errorJson);
          errorDetail = errorJson.error || errorJson.message || 'Unknown error';
        } catch {
          const errorText = await response.text();
          console.error('Server returned non-JSON error:', errorText);
          errorDetail = errorText || `HTTP ${response.status}`;
        }
        throw new Error(errorDetail);
      }

      const result = await response.json();
      console.log('Lock control response:', result);

      if (result.success) {
        setLockStatuses(prev => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            isLocked: action === 'lock',
            lastActivity: {
              userName: userName,
              action: action,
              timestamp: new Date().toISOString(),
            }
          }
        }));
        showMessage('success', `Door ${action === 'lock' ? 'locked' : 'unlocked'} successfully`);
        await loadLastActivity(deviceId);

        setTimeout(() => refreshStatus(deviceId), 2000);
      } else {
        const errorMsg = result.error || 'Failed to control lock';
        console.error('Lock control failed:', result);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error controlling lock:', error);
      if (error.message?.includes('SUBSCRIPTION_EXPIRED')) {
        setSubscriptionExpired(true);
        showMessage('error', 'Tuya Cloud subscription has expired. Please renew at iot.tuya.com');
      } else {
        const errorMessage = error.message || 'Failed to control lock';
        showMessage('error', errorMessage);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const manuallyCorrectState = async (deviceId: string, newState: boolean) => {
    setShowSyncModal(null);
    setActionLoading(deviceId);

    try {
      const { error } = await supabase
        .from('yacht_smart_devices')
        .update({ current_lock_state: newState })
        .eq('id', deviceId);

      if (error) throw error;

      setLockStatuses(prev => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          isLocked: newState
        }
      }));

      setDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, current_lock_state: newState } : d
      ));

      showMessage('success', `State corrected to: ${newState ? 'Locked' : 'Unlocked'}`);
    } catch (error: any) {
      console.error('Error correcting state:', error);
      showMessage('error', 'Failed to correct state');
    } finally {
      setActionLoading(null);
    }
  };

  const runDiagnostics = async (deviceId: string) => {
    setRunningDiagnostics(deviceId);
    setDiagnosticsResult(null);

    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      if (device.lock_provider !== 'tuya') {
        showMessage('error', 'Diagnostics is only available for Tuya devices');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/tuya-smart-lock-control`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'diagnostics',
          deviceId: deviceId,
          yachtId: yachtId,
        }),
      });

      const data = await response.json();
      console.log('Diagnostics result:', data);

      if (data.success) {
        setDiagnosticsResult(data.result);
        setShowDiagnostics(true);
        showMessage('success', 'Diagnostics completed');
      } else {
        throw new Error(data.error || 'Diagnostics failed');
      }
    } catch (error: any) {
      console.error('Error running diagnostics:', error);
      if (error.message?.includes('SUBSCRIPTION_EXPIRED')) {
        setSubscriptionExpired(true);
        showMessage('error', 'Tuya Cloud subscription has expired. Please renew at iot.tuya.com');
      } else {
        showMessage('error', error.message || 'Failed to run diagnostics');
      }
    } finally {
      setRunningDiagnostics(null);
    }
  };

  const setupEncryptionKey = async (deviceId: string) => {
    setActionLoading(deviceId);

    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      if (device.lock_provider !== 'tuya') {
        showMessage('error', 'Encryption key setup is only for Tuya devices');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/tuya-smart-lock-control`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'setup_key',
          deviceId: deviceId,
          yachtId: yachtId,
        }),
      });

      const data = await response.json();
      console.log('Setup key result:', data);

      if (data.success) {
        showMessage('success', 'Encryption key configured successfully! You can now use remote unlock.');
        await loadDevices();
      } else {
        throw new Error(data.error || 'Failed to setup encryption key');
      }
    } catch (error: any) {
      console.error('Error setting up encryption key:', error);
      if (error.message?.includes('SUBSCRIPTION_EXPIRED')) {
        setSubscriptionExpired(true);
        showMessage('error', 'Tuya Cloud subscription has expired. Please renew at iot.tuya.com');
      } else {
        showMessage('error', error.message || 'Failed to setup encryption key');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatLocation = (location: string) => {
    return location
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-6 h-6 text-amber-500" />
          <h3 className="text-xl font-semibold">Smart Access Control</h3>
        </div>
        <div className="text-center py-8">
          <Lock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-lg mb-2">No Smart Locks Configured</p>
          <p className="text-slate-500 text-sm">
            Smart lock controls will appear here once your yacht manager sets up the devices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-6 h-6 text-amber-500" />
          <h3 className="text-xl font-semibold">Smart Access Control</h3>
        </div>

        {subscriptionExpired && (
          <div className="mb-6 p-5 rounded-xl border-2 border-orange-500 bg-gradient-to-r from-orange-500/20 to-red-500/20 relative">
            <button
              onClick={() => setSubscriptionExpired(false)}
              className="absolute top-4 right-4 p-1 hover:bg-orange-500/30 rounded-lg transition-colors"
              title="Dismiss"
            >
              <X className="w-5 h-5 text-orange-300" />
            </button>
            <div className="flex items-start gap-4 pr-8">
              <div className="p-3 rounded-xl bg-orange-500/30 flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-orange-300" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-orange-300 mb-2">Tuya Cloud Subscription Expired</h4>
                <p className="text-sm text-orange-200/90 mb-3">
                  Your Tuya Cloud Development subscription has expired. Smart lock controls cannot function until you renew your subscription.
                </p>
                <div className="space-y-2 text-sm text-orange-200/80 mb-4">
                  <p className="font-medium text-orange-300">To fix this:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Visit the Tuya IoT Platform</li>
                    <li>Log in with your account</li>
                    <li>Navigate to Cloud &rarr; Development</li>
                    <li>Check your subscription status and renew</li>
                  </ol>
                </div>
                <a
                  href="https://iot.tuya.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  <span>Renew Subscription</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-start gap-3">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {message.text}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((device) => {
            const status = lockStatuses[device.id] || { isLocked: false, loading: false };
            const isProcessing = actionLoading === device.id || statusRefreshing === device.id;
            const isStaff = ['manager', 'staff', 'mechanic'].includes(userRole);

            return (
              <div
                key={device.id}
                className={`bg-slate-900/50 rounded-xl p-5 border-2 transition-all ${
                  status.isLocked
                    ? 'border-green-500/30 shadow-lg shadow-green-500/10'
                    : 'border-red-500/30 shadow-lg shadow-red-500/10'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${
                      status.isLocked
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {status.isLocked ? (
                        <Lock className="w-6 h-6" />
                      ) : (
                        <Unlock className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-lg">{formatLocation(device.location)}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          device.lock_provider === 'ttlock'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}>
                          {device.lock_provider === 'ttlock' ? 'TTLock' : 'Tuya'}
                        </span>
                      </div>
                      <p className={`text-sm font-medium ${
                        status.isLocked ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {status.isLocked ? 'Locked' : 'Unlocked'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => refreshStatus(device.id)}
                      disabled={isProcessing || runningDiagnostics === device.id}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
                      title="Refresh status"
                    >
                      <RefreshCw className={`w-4 h-4 ${statusRefreshing === device.id ? 'animate-spin' : ''}`} />
                    </button>
                    {isStaff && (
                      <>
                        <button
                          onClick={() => setShowSyncModal({ deviceId: device.id, deviceName: formatLocation(device.location) })}
                          disabled={isProcessing || runningDiagnostics === device.id}
                          className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                          title="Correct state if wrong"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </button>
                        {device.lock_provider === 'tuya' && (
                          <button
                            onClick={() => runDiagnostics(device.id)}
                            disabled={isProcessing || runningDiagnostics === device.id}
                            className="px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors disabled:opacity-50 text-xs font-medium text-blue-400"
                            title="Run diagnostics to discover lock commands"
                          >
                            {runningDiagnostics === device.id ? 'Running...' : 'Diagnostics'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {device.device_category === 'jtmspro' && !device.encryption_key && isStaff && (
                  <div className="mb-3 px-3 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-blue-400 font-medium">Encryption Key Required</p>
                        <p className="text-xs text-blue-300/70 mt-1">
                          This professional lock requires secure key setup before remote unlock can be used.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setupEncryptionKey(device.id)}
                      disabled={actionLoading === device.id}
                      className="w-full mt-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {actionLoading === device.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Setting up...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Setup Encryption Key</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {device.device_category === 'jtmspro' && device.encryption_key && device.encryption_key_set_at && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-500">Encryption configured</span>
                  </div>
                )}

                {!device.online_status && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <WifiOff className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-orange-500">Device offline</span>
                  </div>
                )}

                {device.battery_level < 20 && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <Battery className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-500">Low battery: {device.battery_level}%</span>
                  </div>
                )}

                {status.lastActivity && (
                  <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                      <Clock className="w-3 h-3" />
                      <span>Last Activity</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {status.lastActivity.userName} {status.lastActivity.action === 'lock' ? 'locked' : 'unlocked'} this door
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatTimestamp(status.lastActivity.timestamp)}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowConfirmModal({ deviceId: device.id, action: 'unlock' })}
                    disabled={!status.isLocked || isProcessing || (device.device_category === 'jtmspro' && !device.encryption_key)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                      !status.isLocked || (device.device_category === 'jtmspro' && !device.encryption_key)
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {actionLoading === device.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Unlock className="w-5 h-5" />
                    )}
                    <span>Unlock</span>
                  </button>
                  <button
                    onClick={() => setShowConfirmModal({ deviceId: device.id, action: 'lock' })}
                    disabled={status.isLocked || isProcessing || (device.device_category === 'jtmspro' && !device.encryption_key)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                      status.isLocked || (device.device_category === 'jtmspro' && !device.encryption_key)
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {actionLoading === device.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                    <span>Lock</span>
                  </button>
                </div>

                <p className="text-xs text-slate-400 mt-3 text-center">
                  Control your yacht's smart locks remotely from anywhere.
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold mb-4">
              Confirm {showConfirmModal.action === 'lock' ? 'Lock' : 'Unlock'}
            </h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to {showConfirmModal.action} this door?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLockAction(showConfirmModal.deviceId, showConfirmModal.action as 'lock' | 'unlock')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  showConfirmModal.action === 'lock'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                } text-white`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-amber-500/20">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold">Correct Lock State</h3>
            </div>
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-200 mb-2">
                Use this if someone locked/unlocked the door physically (keypad, key, manual deadbolt) and the app shows the wrong state.
              </p>
              <p className="text-xs text-amber-300/70">
                This lock doesn't report its state, so physical changes aren't automatically detected.
              </p>
            </div>
            <p className="text-slate-300 mb-6">
              What is the <span className="font-semibold">actual physical state</span> of {showSyncModal.deviceName} right now?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSyncModal(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => manuallyCorrectState(showSyncModal.deviceId, false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Unlocked</span>
              </button>
              <button
                onClick={() => manuallyCorrectState(showSyncModal.deviceId, true)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Locked</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiagnostics && diagnosticsResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full border border-slate-700 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Lock Diagnostics</h3>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-blue-400">Device Info</h4>
                <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(diagnosticsResult.deviceInfo, null, 2)}
                </pre>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-green-400">Device Status</h4>
                <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(diagnosticsResult.deviceStatus, null, 2)}
                </pre>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-amber-400">Device Specifications</h4>
                <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(diagnosticsResult.deviceSpecifications, null, 2)}
                </pre>
              </div>

              {diagnosticsResult.diagnostics?.availableUnlockMethods?.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-blue-400">Available Lock/Unlock Methods</h4>
                  <ul className="space-y-2">
                    {diagnosticsResult.diagnostics.availableUnlockMethods.map((method: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        <span className="font-mono text-green-400">{method.code}</span>
                        {method.name && <span className="text-slate-400"> - {method.name}</span>}
                        {method.type && <span className="text-slate-500"> ({method.type})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-orange-600/20 border border-orange-500/30 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-orange-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Lock Not Responding? Try These Steps:
                </h4>
                <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
                  <li><strong>Check WiFi Connection:</strong> Ensure lock is within range of WiFi router</li>
                  <li><strong>Replace Batteries:</strong> Even if showing 100%, fresh batteries often fix issues</li>
                  <li><strong>Power Cycle:</strong> Remove batteries for 30 seconds, then reinsert</li>
                  <li><strong>Test Manual Control:</strong> Try using the Tuya Smart app directly</li>
                  <li><strong>Re-pair Device:</strong> May need to remove and re-add lock in Tuya app</li>
                  <li><strong>Physical Enable:</strong> Some locks require pressing a button to enable remote control</li>
                  <li><strong>Check Mechanical Operation:</strong> Ensure the lock isn't jammed or obstructed</li>
                  <li><strong>Signal Strength:</strong> Move WiFi router closer or add a WiFi extender</li>
                </ol>
                <div className="mt-3 p-3 bg-slate-800/50 rounded text-xs text-slate-400">
                  <strong className="text-amber-400">Note:</strong> API returning "success" means Tuya Cloud received your command. If the physical lock doesn't respond, it's typically a communication issue between the lock and Tuya Cloud, or the lock needs maintenance.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDiagnostics(false)}
              className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
