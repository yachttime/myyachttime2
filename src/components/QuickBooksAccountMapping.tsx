import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Link2, RefreshCw, Save, Trash2, Plus, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface QuickBooksAccount {
  id: string;
  qbo_account_id: string;
  account_name: string;
  account_type: string;
  account_subtype: string;
  fully_qualified_name: string;
  active: boolean;
  account_number: string;
  classification: string;
}

interface AccountMapping {
  id: string;
  mapping_type: string;
  internal_code_id: string | null;
  internal_code_type: string | null;
  qbo_account_id: string;
  is_default: boolean;
  notes: string;
  qbo_account?: QuickBooksAccount;
}

interface AccountingCode {
  id: string;
  code: string;
  name: string;
  category: string;
  gl_account: string;
}

interface LaborCode {
  id: string;
  code: string;
  name: string;
  rate: number;
}

interface ConnectionStatus {
  connected: boolean;
  company_name: string;
  last_sync_at: string;
}

export default function QuickBooksAccountMapping() {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [qboAccounts, setQboAccounts] = useState<QuickBooksAccount[]>([]);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [accountingCodes, setAccountingCodes] = useState<AccountingCode[]>([]);
  const [laborCodes, setLaborCodes] = useState<LaborCode[]>([]);
  const [activeTab, setActiveTab] = useState<'default' | 'labor' | 'accounting'>('default');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    console.log('[QuickBooks] useEffect triggered, userProfile:', userProfile);
    if (!userProfile) {
      console.log('[QuickBooks] User profile not loaded yet, keeping in loading state');
      return;
    }

    if (userProfile.role === 'master') {
      console.log('[QuickBooks] User is master, loading data...');
      loadData();
    } else {
      console.log('[QuickBooks] User is not master:', userProfile.role);
      setLoading(false);
    }
  }, [userProfile]);

  const loadData = async () => {
    console.log('[QuickBooks] loadData called');
    setLoading(true);
    setError(null);
    try {
      console.log('[QuickBooks] Starting queries...');
      const [connResult, accountsResult, mappingsResult, codesResult, laborResult] = await Promise.all([
        supabase.from('quickbooks_connection').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('quickbooks_accounts').select('*').eq('active', true).order('account_name'),
        supabase.from('quickbooks_account_mappings').select('*'),
        supabase.from('accounting_codes').select('*').eq('is_active', true).order('code'),
        supabase.from('labor_codes').select('*').eq('is_active', true).order('code')
      ]);

      console.log('[QuickBooks] Queries completed');
      console.log('[QuickBooks] Connection:', connResult.data);
      console.log('[QuickBooks] Accounts:', accountsResult.data?.length || 0);
      console.log('[QuickBooks] Mappings:', mappingsResult.data?.length || 0);

      if (connResult.error) {
        console.error('Connection error:', connResult.error);
        throw connResult.error;
      }
      if (accountsResult.error) {
        console.error('Accounts error:', accountsResult.error);
        throw accountsResult.error;
      }
      if (mappingsResult.error) {
        console.error('Mappings error:', mappingsResult.error);
        throw mappingsResult.error;
      }
      if (codesResult.error) {
        console.error('Codes error:', codesResult.error);
        throw codesResult.error;
      }
      if (laborResult.error) {
        console.error('Labor error:', laborResult.error);
        throw laborResult.error;
      }

      if (connResult.data) {
        setConnectionStatus({
          connected: true,
          company_name: connResult.data.company_name,
          last_sync_at: connResult.data.last_sync_at
        });
      }

      setQboAccounts(accountsResult.data || []);
      setMappings(mappingsResult.data || []);
      setAccountingCodes(codesResult.data || []);
      setLaborCodes(laborResult.data || []);
      console.log('[QuickBooks] Data loaded successfully, setting loading to false');
    } catch (err) {
      console.error('[QuickBooks] Error loading QuickBooks data:', err);
      setError('Failed to load QuickBooks data. Please check the console for details.');
    } finally {
      console.log('[QuickBooks] Finally block - setting loading to false');
      setLoading(false);
    }
  };

  const connectToQuickBooks = async () => {
    setError(null);
    setSuccess(null);

    // Open popup window IMMEDIATELY (before async calls) to avoid popup blockers
    const authWindow = window.open('about:blank', 'QuickBooksAuth', 'width=800,height=600');

    if (!authWindow) {
      setError('Failed to open authorization window. Please check your popup blocker settings.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        authWindow.close();
        throw new Error('Not authenticated');
      }

      console.log('[QuickBooks] Requesting auth URL...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-oauth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_auth_url' }),
      });

      const result = await response.json();
      console.log('[QuickBooks] Response:', result);

      if (!response.ok) {
        authWindow.close();
        throw new Error(result.error || 'Failed to get QuickBooks authorization URL');
      }

      const { authUrl } = result;
      console.log('[QuickBooks] Navigating auth window to:', authUrl);

      // Navigate the already-open popup to the auth URL
      authWindow.location.href = authUrl;

      setSuccess('Opening QuickBooks authorization window. After connecting, click "Sync Accounts" to load your Chart of Accounts.');

      // Listen for messages from the callback window
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'quickbooks_connected') {
          console.log('[QuickBooks] Connection successful!');
          setSuccess('QuickBooks connected successfully! Click "Sync Accounts" to load your Chart of Accounts.');
          loadData();
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);

    } catch (err: any) {
      console.error('[QuickBooks] Error connecting:', err);
      // Close the popup if there's an error
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
      setError(err.message || 'Failed to connect to QuickBooks');
    }
  };

  const syncAccounts = async () => {
    setError(null);
    setSuccess(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      setSuccess('Syncing accounts from QuickBooks...');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-sync-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync QuickBooks accounts');
      }

      setSuccess(`Successfully synced ${result.syncedCount} accounts from QuickBooks!`);
      await loadData();
    } catch (err: any) {
      console.error('Error syncing accounts:', err);
      setError(err.message || 'Failed to sync QuickBooks accounts');
    }
  };

  const disconnectQuickBooks = async () => {
    if (!confirm('Are you sure you want to disconnect from QuickBooks?')) return;

    setError(null);
    setSuccess(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-oauth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'disconnect' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to disconnect from QuickBooks');
      }

      setSuccess('Disconnected from QuickBooks successfully');
      await loadData();
    } catch (err: any) {
      console.error('Error disconnecting from QuickBooks:', err);
      setError(err.message || 'Failed to disconnect from QuickBooks');
    }
  };

  const saveMapping = async (
    mappingType: string,
    internalCodeId: string | null,
    internalCodeType: string | null,
    qboAccountId: string,
    isDefault: boolean,
    notes: string
  ) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const existingMapping = mappings.find(
        m => m.mapping_type === mappingType && m.internal_code_id === internalCodeId
      );

      if (existingMapping) {
        const { error: updateError } = await supabase
          .from('quickbooks_account_mappings')
          .update({
            qbo_account_id: qboAccountId,
            is_default: isDefault,
            notes: notes
          })
          .eq('id', existingMapping.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('quickbooks_account_mappings')
          .insert({
            mapping_type: mappingType,
            internal_code_id: internalCodeId,
            internal_code_type: internalCodeType,
            qbo_account_id: qboAccountId,
            is_default: isDefault,
            notes: notes,
            created_by: user?.id
          });

        if (insertError) throw insertError;
      }

      setSuccess('Mapping saved successfully');
      await loadData();
    } catch (err) {
      console.error('Error saving mapping:', err);
      setError('Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  const deleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('quickbooks_account_mappings')
        .delete()
        .eq('id', mappingId);

      if (deleteError) throw deleteError;

      setSuccess('Mapping deleted successfully');
      await loadData();
    } catch (err) {
      console.error('Error deleting mapping:', err);
      setError('Failed to delete mapping');
    }
  };

  const getAccountById = (qboAccountId: string) => {
    return qboAccounts.find(a => a.qbo_account_id === qboAccountId);
  };

  const getMappingForCode = (mappingType: string, internalCodeId: string | null) => {
    return mappings.find(m => m.mapping_type === mappingType && m.internal_code_id === internalCodeId);
  };

  if (!userProfile) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    );
  }

  if (userProfile.role !== 'master') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">Only Master users can manage QuickBooks account mappings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center text-gray-600">Loading QuickBooks data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">QuickBooks Configuration Required</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>Make sure you've added this <strong>exact</strong> Redirect URI in your QuickBooks Developer Dashboard:</p>
          <div className="bg-white border border-blue-300 rounded px-3 py-2 font-mono text-xs">
            https://myyachttime.vercel.app/quickbooks-callback.html
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer font-medium text-blue-900 hover:text-blue-700">
              Click for detailed setup instructions
            </summary>
            <div className="mt-2 space-y-2 pl-4 border-l-2 border-blue-300">
              <p><strong>1. QuickBooks Developer Dashboard:</strong></p>
              <ul className="list-disc list-inside pl-4 space-y-1">
                <li>Host domain: <code className="bg-white px-1">myyachttime.com</code></li>
                <li>Launch URL: <code className="bg-white px-1">https://myyachttime.vercel.app</code></li>
                <li>Redirect URI: <code className="bg-white px-1">https://myyachttime.vercel.app/quickbooks-callback.html</code></li>
              </ul>
              <p><strong>2. Supabase Edge Function Secrets:</strong></p>
              <ul className="list-disc list-inside pl-4 space-y-1">
                <li><code className="bg-white px-1">QUICKBOOKS_CLIENT_ID</code></li>
                <li><code className="bg-white px-1">QUICKBOOKS_CLIENT_SECRET</code></li>
                <li><code className="bg-white px-1">QUICKBOOKS_REDIRECT_URI</code> = https://myyachttime.vercel.app/quickbooks-callback.html</li>
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                See <strong>QUICKBOOKS_TROUBLESHOOTING.md</strong> in the project root for complete troubleshooting guide.
              </p>
            </div>
          </details>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-red-800">{error}</p>
            <p className="text-xs text-red-600 mt-2">
              If you see "sorry can't connect" error in QuickBooks, verify your Redirect URI matches exactly (see configuration above).
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="text-blue-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">QuickBooks Online Integration</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Connect to QuickBooks Online to sync your Chart of Accounts and push invoices
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus ? (
                <>
                  <button
                    onClick={syncAccounts}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <RefreshCw size={18} />
                    Sync Accounts
                  </button>
                  <button
                    onClick={disconnectQuickBooks}
                    className="flex items-center gap-2 px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={connectToQuickBooks}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Link2 size={18} />
                  Connect to QuickBooks
                </button>
              )}
            </div>
          </div>

          {connectionStatus ? (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <CheckCircle className="text-green-600" size={18} />
              <span className="text-gray-700">
                Connected to <strong>{connectionStatus.company_name}</strong>
              </span>
              {connectionStatus.last_sync_at && (
                <span className="text-gray-500">
                  • Last synced: {new Date(connectionStatus.last_sync_at).toLocaleDateString()}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <AlertCircle className="text-amber-600" size={18} />
              <span className="text-gray-700">Not connected to QuickBooks Online</span>
            </div>
          )}

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              <strong>Available QuickBooks Accounts:</strong> {qboAccounts.length} accounts loaded
            </p>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveTab('default')}
              className={`px-4 py-2 rounded font-medium ${
                activeTab === 'default'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Default Accounts
            </button>
            <button
              onClick={() => setActiveTab('labor')}
              className={`px-4 py-2 rounded font-medium ${
                activeTab === 'labor'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Labor Codes
            </button>
            <button
              onClick={() => setActiveTab('accounting')}
              className={`px-4 py-2 rounded font-medium ${
                activeTab === 'accounting'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Accounting Codes
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'default' && (
            <DefaultAccountsTab
              qboAccounts={qboAccounts}
              mappings={mappings}
              onSave={saveMapping}
              onDelete={deleteMapping}
              saving={saving}
            />
          )}

          {activeTab === 'labor' && (
            <LaborCodesTab
              laborCodes={laborCodes}
              qboAccounts={qboAccounts}
              mappings={mappings}
              onSave={saveMapping}
              onDelete={deleteMapping}
              saving={saving}
            />
          )}

          {activeTab === 'accounting' && (
            <AccountingCodesTab
              accountingCodes={accountingCodes}
              qboAccounts={qboAccounts}
              mappings={mappings}
              onSave={saveMapping}
              onDelete={deleteMapping}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface DefaultAccountsTabProps {
  qboAccounts: QuickBooksAccount[];
  mappings: AccountMapping[];
  onSave: (type: string, codeId: string | null, codeType: string | null, qboId: string, isDefault: boolean, notes: string) => void;
  onDelete: (mappingId: string) => void;
  saving: boolean;
}

function DefaultAccountsTab({ qboAccounts, mappings, onSave, saving }: DefaultAccountsTabProps) {
  const defaultMappingTypes = [
    { type: 'income', label: 'Service Income', description: 'Default income account for services' },
    { type: 'parts', label: 'Parts Sales', description: 'Default income account for parts' },
    { type: 'labor', label: 'Labor Income', description: 'Default income account for labor' },
    { type: 'cogs', label: 'Cost of Goods Sold', description: 'Default COGS account for parts' },
    { type: 'inventory_asset', label: 'Inventory Asset', description: 'Default asset account for inventory' },
    { type: 'tax', label: 'Sales Tax Payable', description: 'Default account for sales tax' },
    { type: 'expense', label: 'Operating Expenses', description: 'Default account for expenses' }
  ];

  const [editingType, setEditingType] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const startEdit = (type: string) => {
    const existing = mappings.find(m => m.mapping_type === type && m.is_default);
    setEditingType(type);
    setSelectedAccount(existing?.qbo_account_id || '');
    setNotes(existing?.notes || '');
  };

  const handleSave = async () => {
    if (!editingType || !selectedAccount) return;
    await onSave(editingType, null, null, selectedAccount, true, notes);
    setEditingType(null);
    setSelectedAccount('');
    setNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded p-3">
        <p className="text-sm text-blue-800">
          Set up default QuickBooks accounts for different transaction types. These will be used when creating estimates and invoices.
        </p>
      </div>

      <div className="space-y-3">
        {defaultMappingTypes.map(({ type, label, description }) => {
          const mapping = mappings.find(m => m.mapping_type === type && m.is_default);
          const account = mapping ? qboAccounts.find(a => a.qbo_account_id === mapping.qbo_account_id) : null;
          const isEditing = editingType === type;

          return (
            <div key={type} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{label}</h4>
                  <p className="text-sm text-gray-600">{description}</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(type)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    {account ? 'Change' : 'Set Account'}
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      QuickBooks Account
                    </label>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an account...</option>
                      {qboAccounts.map(acc => (
                        <option key={acc.id} value={acc.qbo_account_id}>
                          {acc.account_number ? `${acc.account_number} - ` : ''}{acc.fully_qualified_name || acc.account_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="Add any notes about this mapping..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={!selectedAccount || saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save size={18} />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingType(null);
                        setSelectedAccount('');
                        setNotes('');
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : account ? (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Link2 className="text-green-600" size={16} />
                  <span className="text-gray-700">
                    {account.account_number ? `${account.account_number} - ` : ''}
                    {account.fully_qualified_name || account.account_name}
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-500">No account mapped</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface LaborCodesTabProps {
  laborCodes: LaborCode[];
  qboAccounts: QuickBooksAccount[];
  mappings: AccountMapping[];
  onSave: (type: string, codeId: string | null, codeType: string | null, qboId: string, isDefault: boolean, notes: string) => void;
  onDelete: (mappingId: string) => void;
  saving: boolean;
}

function LaborCodesTab({ laborCodes, qboAccounts, mappings, onSave, saving }: LaborCodesTabProps) {
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const startEdit = (codeId: string) => {
    const existing = mappings.find(m => m.mapping_type === 'labor' && m.internal_code_id === codeId);
    setEditingCodeId(codeId);
    setSelectedAccount(existing?.qbo_account_id || '');
    setNotes(existing?.notes || '');
  };

  const handleSave = async () => {
    if (!editingCodeId || !selectedAccount) return;
    await onSave('labor', editingCodeId, 'labor_code', selectedAccount, false, notes);
    setEditingCodeId(null);
    setSelectedAccount('');
    setNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded p-3">
        <p className="text-sm text-blue-800">
          Map each labor code to a QuickBooks income account. This allows for detailed revenue tracking by service type.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Labor Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QuickBooks Account</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {laborCodes.map(code => {
              const mapping = mappings.find(m => m.mapping_type === 'labor' && m.internal_code_id === code.id);
              const account = mapping ? qboAccounts.find(a => a.qbo_account_id === mapping.qbo_account_id) : null;
              const isEditing = editingCodeId === code.id;

              return (
                <tr key={code.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{code.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{code.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">${code.rate ? code.rate.toFixed(2) : '0.00'}/hr</td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Select account...</option>
                        {qboAccounts.map(acc => (
                          <option key={acc.id} value={acc.qbo_account_id}>
                            {acc.account_number ? `${acc.account_number} - ` : ''}{acc.account_name}
                          </option>
                        ))}
                      </select>
                    ) : account ? (
                      <span className="text-gray-700">
                        {account.account_number ? `${account.account_number} - ` : ''}{account.account_name}
                      </span>
                    ) : (
                      <span className="text-gray-400">Not mapped</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleSave}
                          disabled={!selectedAccount || saving}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingCodeId(null);
                            setSelectedAccount('');
                            setNotes('');
                          }}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(code.id)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {account ? 'Edit' : 'Map'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AccountingCodesTabProps {
  accountingCodes: AccountingCode[];
  qboAccounts: QuickBooksAccount[];
  mappings: AccountMapping[];
  onSave: (type: string, codeId: string | null, codeType: string | null, qboId: string, isDefault: boolean, notes: string) => void;
  onDelete: (mappingId: string) => void;
  saving: boolean;
}

function AccountingCodesTab({ accountingCodes, qboAccounts, mappings, onSave, saving }: AccountingCodesTabProps) {
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const startEdit = (codeId: string) => {
    const existing = mappings.find(m => m.internal_code_id === codeId);
    setEditingCodeId(codeId);
    setSelectedAccount(existing?.qbo_account_id || '');
    setNotes(existing?.notes || '');
  };

  const handleSave = async (category: string) => {
    if (!editingCodeId || !selectedAccount) return;
    const mappingType = category === 'INCOME' ? 'income' : 'expense';
    await onSave(mappingType, editingCodeId, 'accounting_code', selectedAccount, false, notes);
    setEditingCodeId(null);
    setSelectedAccount('');
    setNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded p-3">
        <p className="text-sm text-blue-800">
          Map accounting codes to QuickBooks accounts for detailed financial tracking and reporting.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GL Account</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QuickBooks Account</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accountingCodes.map(code => {
              const mapping = mappings.find(m => m.internal_code_id === code.id);
              const account = mapping ? qboAccounts.find(a => a.qbo_account_id === mapping.qbo_account_id) : null;
              const isEditing = editingCodeId === code.id;

              return (
                <tr key={code.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{code.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{code.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      code.category === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {code.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{code.gl_account}</td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Select account...</option>
                        {qboAccounts.map(acc => (
                          <option key={acc.id} value={acc.qbo_account_id}>
                            {acc.account_number ? `${acc.account_number} - ` : ''}{acc.account_name}
                          </option>
                        ))}
                      </select>
                    ) : account ? (
                      <span className="text-gray-700">
                        {account.account_number ? `${account.account_number} - ` : ''}{account.account_name}
                      </span>
                    ) : (
                      <span className="text-gray-400">Not mapped</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSave(code.category)}
                          disabled={!selectedAccount || saving}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingCodeId(null);
                            setSelectedAccount('');
                            setNotes('');
                          }}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(code.id)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {account ? 'Edit' : 'Map'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
