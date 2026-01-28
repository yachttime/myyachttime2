import { useState, useEffect } from 'react';
import { Lock, Plus, Edit2, Trash2, RefreshCw, AlertCircle, CheckCircle, X, Save, Key, Globe, Battery, WifiOff, Clock, Eye, EyeOff, Activity, Wifi } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SmartDevice {
  id: string;
  yacht_id: string;
  device_type: string;
  device_name: string;
  location: string;
  tuya_device_id: string | null;
  tuya_device_key: string | null;
  manufacturer: string | null;
  model: string | null;
  installation_date: string;
  battery_level: number;
  online_status: boolean;
  is_active: boolean;
  last_status_check: string | null;
  created_at: string;
  updated_at: string;
}

interface TuyaCredentials {
  id: string;
  yacht_id: string;
  tuya_client_id: string;
  tuya_client_secret: string;
  tuya_region: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Yacht {
  id: string;
  name: string;
}

interface AccessLog {
  id: string;
  user_name: string;
  action_type: string;
  door_location: string;
  success: boolean;
  timestamp: string;
  error_message: string | null;
}

export const SmartDeviceManagement = () => {
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [credentials, setCredentials] = useState<TuyaCredentials[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [selectedYachtId, setSelectedYachtId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [showAccessLogs, setShowAccessLogs] = useState(false);
  const [editingDevice, setEditingDevice] = useState<SmartDevice | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [testingDevice, setTestingDevice] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const [deviceForm, setDeviceForm] = useState({
    device_name: '',
    location: '',
    device_type: 'door_lock',
    tuya_device_id: '',
    tuya_device_key: '',
    manufacturer: '',
    model: '',
  });

  const [credentialsForm, setCredentialsForm] = useState({
    tuya_client_id: '',
    tuya_client_secret: '',
    tuya_region: 'us',
  });

  useEffect(() => {
    loadYachts();
  }, []);

  useEffect(() => {
    if (selectedYachtId) {
      loadDevices();
      loadCredentials();
    }
  }, [selectedYachtId]);

  const loadYachts = async () => {
    try {
      const { data, error } = await supabase
        .from('yachts')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setYachts(data || []);

      if (data && data.length > 0) {
        setSelectedYachtId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading yachts:', error);
      showMessage('error', 'Failed to load yachts');
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    if (!selectedYachtId) return;

    try {
      const { data, error } = await supabase
        .from('yacht_smart_devices')
        .select('*')
        .eq('yacht_id', selectedYachtId)
        .order('location');

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Error loading devices:', error);
      showMessage('error', 'Failed to load devices');
    }
  };

  const loadCredentials = async () => {
    if (!selectedYachtId) return;

    try {
      const { data, error } = await supabase
        .from('tuya_device_credentials')
        .select('*')
        .eq('yacht_id', selectedYachtId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setCredentials(data ? [data] : []);
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  };

  const loadAccessLogs = async (deviceId: string) => {
    try {
      const { data, error } = await supabase
        .from('smart_lock_access_logs')
        .select('*')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAccessLogs(data || []);
      setShowAccessLogs(true);
    } catch (error) {
      console.error('Error loading access logs:', error);
      showMessage('error', 'Failed to load access logs');
    }
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingDevice) {
        const { error } = await supabase
          .from('yacht_smart_devices')
          .update({
            device_name: deviceForm.device_name,
            location: deviceForm.location,
            device_type: deviceForm.device_type,
            tuya_device_id: deviceForm.tuya_device_id || null,
            tuya_device_key: deviceForm.tuya_device_key || null,
            manufacturer: deviceForm.manufacturer || null,
            model: deviceForm.model || null,
          })
          .eq('id', editingDevice.id);

        if (error) throw error;
        showMessage('success', 'Device updated successfully');
      } else {
        const { error } = await supabase
          .from('yacht_smart_devices')
          .insert({
            yacht_id: selectedYachtId,
            device_name: deviceForm.device_name,
            location: deviceForm.location,
            device_type: deviceForm.device_type,
            tuya_device_id: deviceForm.tuya_device_id || null,
            tuya_device_key: deviceForm.tuya_device_key || null,
            manufacturer: deviceForm.manufacturer || null,
            model: deviceForm.model || null,
          });

        if (error) throw error;
        showMessage('success', 'Device added successfully');
      }

      resetDeviceForm();
      loadDevices();
    } catch (error: any) {
      console.error('Error saving device:', error);
      showMessage('error', error.message || 'Failed to save device');
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const existingCreds = credentials[0];

      if (existingCreds) {
        const { error } = await supabase
          .from('tuya_device_credentials')
          .update({
            tuya_client_id: credentialsForm.tuya_client_id,
            tuya_client_secret: credentialsForm.tuya_client_secret,
            tuya_region: credentialsForm.tuya_region,
          })
          .eq('id', existingCreds.id);

        if (error) throw error;
        showMessage('success', 'Credentials updated successfully');
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('user_id', userData?.user?.id)
          .maybeSingle();

        const { error } = await supabase
          .from('tuya_device_credentials')
          .insert({
            yacht_id: selectedYachtId,
            tuya_client_id: credentialsForm.tuya_client_id,
            tuya_client_secret: credentialsForm.tuya_client_secret,
            tuya_region: credentialsForm.tuya_region,
            created_by: profile?.id,
          });

        if (error) throw error;
        showMessage('success', 'Credentials saved successfully');
      }

      setShowCredentialsForm(false);
      loadCredentials();
    } catch (error: any) {
      console.error('Error saving credentials:', error);
      showMessage('error', error.message || 'Failed to save credentials');
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;

    try {
      const { error } = await supabase
        .from('yacht_smart_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;
      showMessage('success', 'Device deleted successfully');
      loadDevices();
    } catch (error: any) {
      console.error('Error deleting device:', error);
      showMessage('error', error.message || 'Failed to delete device');
    }
  };

  const handleToggleDeviceStatus = async (deviceId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('yacht_smart_devices')
        .update({ is_active: !currentStatus })
        .eq('id', deviceId);

      if (error) throw error;
      showMessage('success', `Device ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      loadDevices();
    } catch (error: any) {
      console.error('Error toggling device status:', error);
      showMessage('error', error.message || 'Failed to update device status');
    }
  };

  const resetDeviceForm = () => {
    setDeviceForm({
      device_name: '',
      location: '',
      device_type: 'door_lock',
      tuya_device_id: '',
      tuya_device_key: '',
      manufacturer: '',
      model: '',
    });
    setEditingDevice(null);
    setShowDeviceForm(false);
  };

  const startEditDevice = (device: SmartDevice) => {
    setDeviceForm({
      device_name: device.device_name,
      location: device.location,
      device_type: device.device_type,
      tuya_device_id: device.tuya_device_id || '',
      tuya_device_key: device.tuya_device_key || '',
      manufacturer: device.manufacturer || '',
      model: device.model || '',
    });
    setEditingDevice(device);
    setShowDeviceForm(true);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const runDiagnostics = async (deviceId: string) => {
    setTestingDevice(deviceId);
    try {
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
          yachtId: selectedYachtId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setDiagnosticResults(result);
        setShowDiagnostics(true);
        showMessage('success', 'Diagnostics completed successfully');
        await loadDevices();
      } else {
        const errorMsg = result.error || result.result?.error || 'Failed to run diagnostics';
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error running diagnostics:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      showMessage('error', error.message || 'Failed to run diagnostics');
    } finally {
      setTestingDevice(null);
    }
  };

  const refreshAllDevices = async () => {
    if (devices.length === 0) return;

    setRefreshingAll(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      let successCount = 0;
      let failCount = 0;

      for (const device of devices) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/tuya-smart-lock-control`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'status',
              deviceId: device.id,
              yachtId: selectedYachtId,
            }),
          });

          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      await loadDevices();
      showMessage('success', `Refreshed ${successCount} device(s). ${failCount > 0 ? `${failCount} failed.` : ''}`);
    } catch (error: any) {
      console.error('Error refreshing all devices:', error);
      showMessage('error', 'Failed to refresh devices');
    } finally {
      setRefreshingAll(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatLocation = (location: string) => {
    return location
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const selectedYacht = yachts.find(y => y.id === selectedYachtId);
  const yachtCredentials = credentials[0];

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg border ${
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

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-bold">Smart Device Management</h2>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="yacht-select" className="text-sm text-slate-400">Select Yacht:</label>
            <select
              id="yacht-select"
              name="yacht"
              value={selectedYachtId}
              onChange={(e) => setSelectedYachtId(e.target.value)}
              className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
            >
              {yachts.map((yacht) => (
                <option key={yacht.id} value={yacht.id}>
                  {yacht.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tuya API Credentials Section */}
        <div className="mb-8 pb-8 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                Tuya API Credentials
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Configure Tuya IoT Platform credentials for {selectedYacht?.name}
              </p>
            </div>
            {!showCredentialsForm && (
              <button
                onClick={() => {
                  if (yachtCredentials) {
                    setCredentialsForm({
                      tuya_client_id: yachtCredentials.tuya_client_id,
                      tuya_client_secret: yachtCredentials.tuya_client_secret,
                      tuya_region: yachtCredentials.tuya_region,
                    });
                  }
                  setShowCredentialsForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-medium transition-colors"
              >
                {yachtCredentials ? (
                  <>
                    <Edit2 className="w-4 h-4" />
                    Edit Credentials
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Credentials
                  </>
                )}
              </button>
            )}
          </div>

          {yachtCredentials && !showCredentialsForm ? (
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Client ID</p>
                  <p className="font-mono text-sm mt-1">
                    {showSecrets ? yachtCredentials.tuya_client_id : '••••••••••••'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Region</p>
                  <p className="text-sm mt-1 uppercase">{yachtCredentials.tuya_region}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                className="flex items-center gap-2 text-sm text-amber-500 hover:text-amber-400 transition-colors"
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSecrets ? 'Hide' : 'Show'} Secrets
              </button>
            </div>
          ) : showCredentialsForm ? (
            <form onSubmit={handleSaveCredentials} className="bg-slate-900/50 rounded-lg p-6 space-y-4">
              <div>
                <label htmlFor="tuya-client-id" className="block text-sm font-medium mb-2">
                  Tuya Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  id="tuya-client-id"
                  name="tuya_client_id"
                  type="text"
                  value={credentialsForm.tuya_client_id}
                  onChange={(e) => setCredentialsForm({ ...credentialsForm, tuya_client_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="tuya-client-secret" className="block text-sm font-medium mb-2">
                  Tuya Client Secret <span className="text-red-500">*</span>
                </label>
                <input
                  id="tuya-client-secret"
                  name="tuya_client_secret"
                  type="password"
                  value={credentialsForm.tuya_client_secret}
                  onChange={(e) => setCredentialsForm({ ...credentialsForm, tuya_client_secret: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="tuya-region" className="block text-sm font-medium mb-2">
                  Region <span className="text-red-500">*</span>
                </label>
                <select
                  id="tuya-region"
                  name="tuya_region"
                  value={credentialsForm.tuya_region}
                  onChange={(e) => setCredentialsForm({ ...credentialsForm, tuya_region: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value="us">United States</option>
                  <option value="eu">Europe</option>
                  <option value="cn">China</option>
                  <option value="in">India</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCredentialsForm(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-medium transition-colors"
                >
                  Save Credentials
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <p>No credentials configured for this yacht</p>
            </div>
          )}
        </div>

        {/* Devices Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Smart Devices</h3>
              <p className="text-sm text-slate-400 mt-1">
                Manage door locks and other smart devices
              </p>
            </div>
            <div className="flex items-center gap-2">
              {devices.length > 0 && (
                <button
                  onClick={refreshAllDevices}
                  disabled={refreshingAll}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingAll ? 'animate-spin' : ''}`} />
                  Refresh All
                </button>
              )}
              <button
                onClick={() => setShowDeviceForm(true)}
                disabled={showDeviceForm}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  showDeviceForm
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                Add Device
              </button>
            </div>
          </div>

          {showDeviceForm && (
            <form onSubmit={handleSaveDevice} className="bg-slate-900/50 rounded-lg p-6 mb-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold">
                  {editingDevice ? 'Edit Device' : 'Add New Device'}
                </h4>
                <button
                  type="button"
                  onClick={resetDeviceForm}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="device-name" className="block text-sm font-medium mb-2">
                    Device Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="device-name"
                    name="device_name"
                    type="text"
                    value={deviceForm.device_name}
                    onChange={(e) => setDeviceForm({ ...deviceForm, device_name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                    placeholder="e.g., Main Entrance Lock"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="device-location" className="block text-sm font-medium mb-2">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="device-location"
                    name="location"
                    value={deviceForm.location}
                    onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                    required
                  >
                    <option value="">Select location...</option>
                    <option value="front_door">Front Door</option>
                    <option value="rear_door">Rear Door</option>
                    <option value="side_door">Side Door</option>
                    <option value="cabin_door">Cabin Door</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tuya-device-id" className="block text-sm font-medium mb-2">Tuya Device ID</label>
                  <input
                    id="tuya-device-id"
                    name="tuya_device_id"
                    type="text"
                    value={deviceForm.tuya_device_id}
                    onChange={(e) => setDeviceForm({ ...deviceForm, tuya_device_id: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                    placeholder="From Tuya IoT Platform"
                  />
                </div>
                <div>
                  <label htmlFor="tuya-device-key" className="block text-sm font-medium mb-2">Tuya Device Key</label>
                  <input
                    id="tuya-device-key"
                    name="tuya_device_key"
                    type="text"
                    value={deviceForm.tuya_device_key}
                    onChange={(e) => setDeviceForm({ ...deviceForm, tuya_device_key: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                    placeholder="Local device key"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="device-manufacturer" className="block text-sm font-medium mb-2">Manufacturer</label>
                  <input
                    id="device-manufacturer"
                    name="manufacturer"
                    type="text"
                    value={deviceForm.manufacturer}
                    onChange={(e) => setDeviceForm({ ...deviceForm, manufacturer: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                    placeholder="e.g., Tuya, Yale, etc."
                  />
                </div>
                <div>
                  <label htmlFor="device-model" className="block text-sm font-medium mb-2">Model</label>
                  <input
                    id="device-model"
                    name="model"
                    type="text"
                    value={deviceForm.model}
                    onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                    placeholder="Model number"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetDeviceForm}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {editingDevice ? 'Update Device' : 'Add Device'}
                </button>
              </div>
            </form>
          )}

          {devices.length > 0 ? (
            <div className="space-y-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className={`bg-slate-900/50 rounded-lg p-5 border-2 transition-all ${
                    device.is_active
                      ? 'border-green-500/30'
                      : 'border-slate-600 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-xl ${
                        device.is_active
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        <Lock className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-lg">{device.device_name}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            device.is_active
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-slate-700 text-slate-400'
                          }`}>
                            {device.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {device.online_status ? (
                            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-500">
                              <Wifi className="w-3 h-3" />
                              Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-500">
                              <WifiOff className="w-3 h-3" />
                              Offline
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <div>
                            <span className="text-slate-400">Location:</span>
                            <span className="ml-2 text-slate-200">{formatLocation(device.location)}</span>
                          </div>
                          {device.manufacturer && (
                            <div>
                              <span className="text-slate-400">Manufacturer:</span>
                              <span className="ml-2 text-slate-200">{device.manufacturer}</span>
                            </div>
                          )}
                          {device.model && (
                            <div>
                              <span className="text-slate-400">Model:</span>
                              <span className="ml-2 text-slate-200">{device.model}</span>
                            </div>
                          )}
                          {device.tuya_device_id && (
                            <div>
                              <span className="text-slate-400">Device ID:</span>
                              <span className="ml-2 font-mono text-xs text-slate-200">{device.tuya_device_id.substring(0, 12)}...</span>
                            </div>
                          )}
                        </div>
                        {device.last_status_check && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            Last checked: {formatTimestamp(device.last_status_check)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runDiagnostics(device.id)}
                        disabled={testingDevice === device.id}
                        className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-500 transition-colors disabled:opacity-50"
                        title="Run diagnostics"
                      >
                        {testingDevice === device.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Activity className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => loadAccessLogs(device.id)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                        title="View access logs"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEditDevice(device)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                        title="Edit device"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleDeviceStatus(device.id, device.is_active)}
                        className={`p-2 rounded-lg transition-colors ${
                          device.is_active
                            ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-500'
                            : 'bg-green-500/20 hover:bg-green-500/30 text-green-500'
                        }`}
                        title={device.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDevice(device.id)}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500 transition-colors"
                        title="Delete device"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No devices configured for this yacht</p>
              <p className="text-sm mt-1">Add a device to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Diagnostics Modal */}
      {showDiagnostics && diagnosticResults && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-500" />
                Device Diagnostics
              </h3>
              <button
                onClick={() => {
                  setShowDiagnostics(false);
                  setDiagnosticResults(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {diagnosticResults.result?.deviceInfo?.result && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-blue-500" />
                    Device Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400">Device ID:</span>
                      <p className="font-mono text-xs mt-1">{diagnosticResults.result.deviceInfo.result.id}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Online Status:</span>
                      <p className={`mt-1 font-medium ${diagnosticResults.result.deviceInfo.result.online ? 'text-green-500' : 'text-red-500'}`}>
                        {diagnosticResults.result.deviceInfo.result.online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Name:</span>
                      <p className="mt-1">{diagnosticResults.result.deviceInfo.result.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Local Key:</span>
                      <p className="font-mono text-xs mt-1">{diagnosticResults.result.deviceInfo.result.local_key ? '••••••••' : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">IP Address:</span>
                      <p className="font-mono text-xs mt-1">{diagnosticResults.result.deviceInfo.result.ip || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Active Time:</span>
                      <p className="text-xs mt-1">{diagnosticResults.result.deviceInfo.result.active_time ? new Date(diagnosticResults.result.deviceInfo.result.active_time * 1000).toLocaleString() : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {diagnosticResults.result?.deviceStatus?.result && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Battery className="w-4 h-4 text-green-500" />
                    Device Status
                  </h4>
                  <div className="space-y-2">
                    {diagnosticResults.result.deviceStatus.result.map((status: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-slate-800/50 rounded px-3 py-2">
                        <span className="text-slate-400">{status.code}:</span>
                        <span className="font-mono text-xs">{JSON.stringify(status.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diagnosticResults.result?.diagnostics && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Connection Test
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">API Region:</span>
                      <span className="uppercase">{diagnosticResults.result.diagnostics.apiRegion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Authentication:</span>
                      <span className="text-green-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Success
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Tested:</span>
                      <span className="text-xs">{new Date(diagnosticResults.result.diagnostics.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {!diagnosticResults.success && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-500 mb-1">Diagnostic Failed</h4>
                      <p className="text-sm text-red-400">{diagnosticResults.error || 'Unknown error occurred'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowDiagnostics(false);
                  setDiagnosticResults(null);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Logs Modal */}
      {showAccessLogs && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Access Logs</h3>
              <button
                onClick={() => {
                  setShowAccessLogs(false);
                  setAccessLogs([]);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {accessLogs.length > 0 ? (
              <div className="space-y-3">
                {accessLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-lg border-2 ${
                      log.success
                        ? log.action_type === 'lock'
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{log.user_name}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.action_type === 'lock'
                            ? 'bg-green-500/20 text-green-500'
                            : log.action_type === 'unlock'
                            ? 'bg-amber-500/20 text-amber-500'
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          {log.action_type.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {formatLocation(log.door_location)}
                    </p>
                    {log.error_message && (
                      <p className="text-sm text-red-400 mt-2">
                        Error: {log.error_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No access logs found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
