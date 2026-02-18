import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Info, RefreshCw, Plus, Edit2, Trash2, Check, Star, X } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm';

interface QboAccount {
  id: string;
  qbo_account_id: string;
  account_name: string;
  account_number: string | null;
  account_type: string | null;
  account_subtype: string | null;
  active: boolean;
  last_synced_at: string | null;
}

interface InternalCode {
  id: string;
  code: string;
  name: string;
  account_type: string | null;
  description: string | null;
  is_active: boolean;
  is_default_inventory: boolean;
}

interface AccountingCodesProps {
  userId: string;
}

const typeColors: Record<string, string> = {
  Income: 'bg-green-100 text-green-800',
  Expense: 'bg-red-100 text-red-800',
  Asset: 'bg-blue-100 text-blue-800',
  Liability: 'bg-orange-100 text-orange-800',
  Equity: 'bg-yellow-100 text-yellow-800',
  'Cost of Goods Sold': 'bg-rose-100 text-rose-800',
};

const ACCOUNT_TYPES = ['Asset', 'Income', 'Expense', 'Liability', 'Equity', 'Cost of Goods Sold'];

export function AccountingCodes({ userId }: AccountingCodesProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [accounts, setAccounts] = useState<QboAccount[]>([]);
  const [internalCodes, setInternalCodes] = useState<InternalCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    account_type: 'Asset',
    description: '',
    is_active: true,
    is_default_inventory: false
  });

  useEffect(() => {
    loadAccounts();
    loadInternalCodes();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('quickbooks_accounts')
        .select('id, qbo_account_id, account_name, account_number, account_type, account_subtype, active, last_synced_at')
        .order('account_number', { ascending: true });
      if (fetchError) throw fetchError;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error loading QB accounts:', err);
      setError('Failed to load QuickBooks accounts');
    } finally {
      setLoading(false);
    }
  };

  const loadInternalCodes = async () => {
    try {
      setInternalLoading(true);
      const { data, error: fetchError } = await supabase
        .from('accounting_codes')
        .select('id, code, name, account_type, description, is_active, is_default_inventory')
        .order('code');
      if (fetchError) throw fetchError;
      setInternalCodes(data || []);
    } catch (err) {
      console.error('Error loading internal accounting codes:', err);
    } finally {
      setInternalLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      if (formData.is_default_inventory) {
        await supabase
          .from('accounting_codes')
          .update({ is_default_inventory: false })
          .neq('id', editingId || '00000000-0000-0000-0000-000000000000');
      }

      const dataToSave = {
        code: formData.code,
        name: formData.name,
        account_type: formData.account_type || null,
        description: formData.description || null,
        is_active: formData.is_active,
        is_default_inventory: formData.is_default_inventory
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('accounting_codes')
          .update(dataToSave)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('accounting_codes')
          .insert({ ...dataToSave, created_by: userId });
        if (insertError) throw insertError;
      }

      resetForm();
      loadInternalCodes();
    } catch (err: any) {
      console.error('Error saving accounting code:', err);
      setError(err.message || 'Failed to save accounting code');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (code: InternalCode) => {
    setFormData({
      code: code.code,
      name: code.name,
      account_type: code.account_type || 'Asset',
      description: code.description || '',
      is_active: code.is_active,
      is_default_inventory: code.is_default_inventory
    });
    setEditingId(code.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ message: 'Are you sure you want to delete this accounting code?', variant: 'danger' })) return;
    try {
      const { error: deleteError } = await supabase
        .from('accounting_codes')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
      loadInternalCodes();
    } catch (err: any) {
      setError(err.message || 'Failed to delete accounting code');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await supabase.from('accounting_codes').update({ is_default_inventory: false }).neq('id', id);
      await supabase.from('accounting_codes').update({ is_default_inventory: true }).eq('id', id);
      loadInternalCodes();
    } catch (err: any) {
      setError(err.message || 'Failed to set default');
    }
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', account_type: 'Asset', description: '', is_active: true, is_default_inventory: false });
    setEditingId(null);
    setShowForm(false);
  };

  const filtered = accounts.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.account_name.toLowerCase().includes(q) ||
      (a.account_number || '').toLowerCase().includes(q) ||
      (a.account_type || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <ConfirmDialog />

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Internal Accounting Codes</h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Code
          </button>
        </div>

        <div className="mb-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold mb-1">Default Inventory Asset Code</p>
            <p>Mark one code as the <strong>Default Inventory</strong> to have it automatically selected when adding new parts to inventory.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {showForm && (
          <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingId ? 'Edit Accounting Code' : 'New Accounting Code'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    placeholder="e.g., 1300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    placeholder="e.g., Inventory Asset"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  {ACCOUNT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="Optional description"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_default_inventory}
                    onChange={(e) => setFormData({ ...formData, is_default_inventory: e.target.checked })}
                    className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-400"
                  />
                  <span className="text-sm font-medium text-gray-700">Default Inventory Asset (auto-selected when adding parts)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}

        {internalLoading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default Inventory</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {internalCodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No accounting codes found. Add one to get started.
                    </td>
                  </tr>
                ) : (
                  internalCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{code.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {code.name}
                        {code.description && <div className="text-xs text-gray-400 mt-0.5">{code.description}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {code.account_type ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[code.account_type] || 'bg-gray-100 text-gray-700'}`}>
                            {code.account_type}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {code.is_default_inventory ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            Default
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetDefault(code.id)}
                            className="text-xs text-gray-400 hover:text-amber-600 hover:underline"
                          >
                            Set as default
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {code.is_active ? (
                          <span className="text-green-600 font-medium">Active</span>
                        ) : (
                          <span className="text-gray-400">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right space-x-2">
                        <button onClick={() => handleEdit(code)} className="text-blue-600 hover:text-blue-900">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(code.id)} className="text-red-600 hover:text-red-900">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">QuickBooks Accounts</h2>
          <button
            onClick={loadAccounts}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
          <div>
            <p className="font-semibold mb-1">QuickBooks Chart of Accounts</p>
            <p>These accounts are synced from your QuickBooks company file. Use the <strong>QuickBooks</strong> tab to map labor codes and parts to specific accounts for invoice export.</p>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, number, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
          />
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Loading QuickBooks accounts...</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      {accounts.length === 0
                        ? 'No QuickBooks accounts found. Sync your accounts from the QuickBooks tab.'
                        : 'No accounts match your search.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((acct) => (
                    <tr key={acct.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {acct.account_number || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {acct.account_name}
                        {acct.account_subtype && (
                          <div className="text-xs text-gray-400 mt-0.5">{acct.account_subtype}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {acct.account_type ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[acct.account_type] || 'bg-gray-100 text-gray-700'}`}>
                            {acct.account_type}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {acct.active ? (
                          <span className="text-green-600 font-medium">Active</span>
                        ) : (
                          <span className="text-gray-400">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {accounts.length > 0 && (
          <div className="mt-3 text-xs text-gray-400 text-right">
            {filtered.length} of {accounts.length} accounts
          </div>
        )}
      </div>
    </div>
  );
}
