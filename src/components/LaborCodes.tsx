import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Check, AlertCircle } from 'lucide-react';

interface LaborCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  hourly_rate: number;
  overtime_rate: number | null;
  accounting_code_id: string | null;
  is_active: boolean;
  accounting_codes?: {
    code: string;
    name: string;
  };
}

interface AccountingCode {
  id: string;
  code: string;
  name: string;
}

interface LaborCodesProps {
  userId: string;
}

export function LaborCodes({ userId }: LaborCodesProps) {
  const [laborCodes, setLaborCodes] = useState<LaborCode[]>([]);
  const [accountingCodes, setAccountingCodes] = useState<AccountingCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    hourly_rate: '',
    overtime_rate: '',
    accounting_code_id: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [laborResult, accountingResult] = await Promise.all([
        supabase
          .from('labor_codes')
          .select(`
            *,
            accounting_codes (code, name)
          `)
          .order('code'),
        supabase
          .from('accounting_codes')
          .select('id, code, name')
          .eq('is_active', true)
          .order('code')
      ]);

      if (laborResult.error) throw laborResult.error;
      if (accountingResult.error) throw accountingResult.error;

      setLaborCodes(laborResult.data || []);
      setAccountingCodes(accountingResult.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load labor codes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);

      const dataToSave = {
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        hourly_rate: parseFloat(formData.hourly_rate),
        overtime_rate: formData.overtime_rate ? parseFloat(formData.overtime_rate) : null,
        accounting_code_id: formData.accounting_code_id || null,
        is_active: formData.is_active
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('labor_codes')
          .update(dataToSave)
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('labor_codes')
          .insert({
            ...dataToSave,
            created_by: userId
          });

        if (insertError) throw insertError;
      }

      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Error saving labor code:', err);
      setError(err.message || 'Failed to save labor code');
    }
  };

  const handleEdit = (code: LaborCode) => {
    setFormData({
      code: code.code,
      name: code.name,
      description: code.description || '',
      hourly_rate: code.hourly_rate.toString(),
      overtime_rate: code.overtime_rate ? code.overtime_rate.toString() : '',
      accounting_code_id: code.accounting_code_id || '',
      is_active: code.is_active
    });
    setEditingId(code.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this labor code?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('labor_codes')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      loadData();
    } catch (err: any) {
      console.error('Error deleting labor code:', err);
      setError(err.message || 'Failed to delete labor code');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      hourly_rate: '',
      overtime_rate: '',
      accounting_code_id: '',
      is_active: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading labor codes...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Labor Codes</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Labor Code
        </button>
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
            {editingId ? 'Edit Labor Code' : 'New Labor Code'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., MECH"
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Marine Mechanic"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hourly Rate * ($)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Overtime Rate ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.overtime_rate}
                  onChange={(e) => setFormData({ ...formData, overtime_rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accounting Code
              </label>
              <select
                value={formData.accounting_code_id}
                onChange={(e) => setFormData({ ...formData, accounting_code_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select accounting code</option>
                {accountingCodes.map((ac) => (
                  <option key={ac.id} value={ac.id}>
                    {ac.code} - {ac.name}
                  </option>
                ))}
              </select>
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
                Hourly Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                OT Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Accounting Code
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
            {laborCodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No labor codes found. Create one to get started.
                </td>
              </tr>
            ) : (
              laborCodes.map((code) => (
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
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${code.hourly_rate.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {code.overtime_rate ? `$${code.overtime_rate.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {code.accounting_codes ? `${code.accounting_codes.code}` : '-'}
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
    </div>
  );
}