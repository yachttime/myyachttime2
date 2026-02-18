import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Check, AlertCircle, Info } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm';

interface AccountingCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  account_type: 'income' | 'expense' | 'asset' | 'liability';
  quickbooks_account_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface AccountingCodesProps {
  userId: string;
}

export function AccountingCodes({ userId }: AccountingCodesProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [codes, setCodes] = useState<AccountingCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    account_type: 'expense' as 'income' | 'expense' | 'asset' | 'liability',
    is_active: true
  });

  useEffect(() => {
    loadAccountingCodes();
  }, []);

  const loadAccountingCodes = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('accounting_codes')
        .select('*')
        .order('code');

      if (fetchError) throw fetchError;
      setCodes(data || []);
    } catch (err) {
      console.error('Error loading accounting codes:', err);
      setError('Failed to load accounting codes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);

      if (editingId) {
        const { error: updateError } = await supabase
          .from('accounting_codes')
          .update({
            code: formData.code,
            name: formData.name,
            description: formData.description || null,
            account_type: formData.account_type,
            is_active: formData.is_active
          })
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('accounting_codes')
          .insert({
            code: formData.code,
            name: formData.name,
            description: formData.description || null,
            account_type: formData.account_type,
            is_active: formData.is_active,
            created_by: userId
          });

        if (insertError) throw insertError;
      }

      resetForm();
      loadAccountingCodes();
    } catch (err: any) {
      console.error('Error saving accounting code:', err);
      setError(err.message || 'Failed to save accounting code');
    }
  };

  const handleEdit = (code: AccountingCode) => {
    setFormData({
      code: code.code,
      name: code.name,
      description: code.description || '',
      account_type: code.account_type,
      is_active: code.is_active
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
      loadAccountingCodes();
    } catch (err: any) {
      console.error('Error deleting accounting code:', err);
      setError(err.message || 'Failed to delete accounting code');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      account_type: 'expense',
      is_active: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const accountTypeColors = {
    income: 'bg-green-100 text-green-800',
    expense: 'bg-red-100 text-red-800',
    asset: 'bg-blue-100 text-blue-800',
    liability: 'bg-orange-100 text-orange-800'
  };

  if (loading) {
    return <div className="p-8 text-center">Loading accounting codes...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Accounting Codes</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Code
        </button>
      </div>

      <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold mb-1">What are accounting codes?</p>
          <p>Accounting codes are internal categories (income, expense, asset, liability) used to classify labor codes and parts in estimates. They are linked to your QuickBooks accounts in the <strong>QuickBooks</strong> settings tab — no QuickBooks mapping is needed here.</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="e.g., 4000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type *
                </label>
                <select
                  required
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="income" className="bg-white text-gray-900">Income</option>
                  <option value="expense" className="bg-white text-gray-900">Expense</option>
                  <option value="asset" className="bg-white text-gray-900">Asset</option>
                  <option value="liability" className="bg-white text-gray-900">Liability</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder="e.g., Marine Repair Services"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Check className="w-4 h-4" />
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {codes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No accounting codes found. Create one to get started.
                </td>
              </tr>
            ) : (
              codes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {code.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {code.name}
                    {code.description && (
                      <div className="text-xs text-gray-500 mt-1">{code.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${accountTypeColors[code.account_type]}`}>
                      {code.account_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {code.is_active ? (
                      <span className="text-green-600 font-medium">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <button
                      onClick={() => handleEdit(code)}
                      className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(code.id)}
                      className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog />
    </div>
  );
}