import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, AlertCircle, Package, TrendingUp, TrendingDown, Search } from 'lucide-react';

interface Part {
  id: string;
  part_number: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  category: string;
  quantity_on_hand: number;
  unit_cost: number;
  unit_price: number;
  reorder_level: number;
  reorder_quantity: number;
  location: string | null;
  accounting_code_id: string | null;
  is_active: boolean;
  is_taxable: boolean;
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

interface PartsInventoryProps {
  userId: string;
}

export function PartsInventory({ userId }: PartsInventoryProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [accountingCodes, setAccountingCodes] = useState<AccountingCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    part_number: '',
    name: '',
    description: '',
    manufacturer: '',
    category: '',
    quantity_on_hand: '0',
    unit_cost: '',
    unit_price: '',
    reorder_level: '0',
    reorder_quantity: '0',
    location: '',
    accounting_code_id: '',
    is_active: true,
    is_taxable: true
  });
  const [adjustmentData, setAdjustmentData] = useState({
    transaction_type: 'add' as 'add' | 'remove' | 'adjustment',
    quantity: '',
    reason: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [partsResult, accountingResult] = await Promise.all([
        supabase
          .from('parts_inventory')
          .select(`
            *,
            accounting_codes (code, name)
          `)
          .order('part_number'),
        supabase
          .from('accounting_codes')
          .select('id, code, name')
          .eq('is_active', true)
          .order('code')
      ]);

      if (partsResult.error) throw partsResult.error;
      if (accountingResult.error) throw accountingResult.error;

      setParts(partsResult.data || []);
      setAccountingCodes(accountingResult.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load parts inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);

      const dataToSave = {
        part_number: formData.part_number,
        name: formData.name,
        description: formData.description || null,
        manufacturer: formData.manufacturer || null,
        category: formData.category,
        quantity_on_hand: parseInt(formData.quantity_on_hand),
        unit_cost: parseFloat(formData.unit_cost),
        unit_price: parseFloat(formData.unit_price),
        reorder_level: parseInt(formData.reorder_level),
        reorder_quantity: parseInt(formData.reorder_quantity),
        location: formData.location || null,
        accounting_code_id: formData.accounting_code_id || null,
        is_active: formData.is_active,
        is_taxable: formData.is_taxable
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('parts_inventory')
          .update(dataToSave)
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('parts_inventory')
          .insert({
            ...dataToSave,
            created_by: userId
          });

        if (insertError) throw insertError;
      }

      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Error saving part:', err);
      setError(err.message || 'Failed to save part');
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) return;

    try {
      setError(null);

      const quantity = parseInt(adjustmentData.quantity);
      const quantityChange = adjustmentData.transaction_type === 'remove' ? -quantity : quantity;
      const newQuantity = selectedPart.quantity_on_hand + quantityChange;

      if (newQuantity < 0) {
        setError('Cannot reduce quantity below zero');
        return;
      }

      const { error: transactionError } = await supabase
        .from('part_transactions')
        .insert({
          part_id: selectedPart.id,
          transaction_type: adjustmentData.transaction_type,
          quantity_change: quantityChange,
          before_quantity: selectedPart.quantity_on_hand,
          after_quantity: newQuantity,
          performed_by: userId,
          reason: adjustmentData.reason || null
        });

      if (transactionError) throw transactionError;

      const { error: updateError } = await supabase
        .from('parts_inventory')
        .update({ quantity_on_hand: newQuantity })
        .eq('id', selectedPart.id);

      if (updateError) throw updateError;

      resetAdjustmentForm();
      loadData();
    } catch (err: any) {
      console.error('Error adjusting inventory:', err);
      setError(err.message || 'Failed to adjust inventory');
    }
  };

  const handleEdit = (part: Part) => {
    setFormData({
      part_number: part.part_number,
      name: part.name,
      description: part.description || '',
      manufacturer: part.manufacturer || '',
      category: part.category,
      quantity_on_hand: part.quantity_on_hand.toString(),
      unit_cost: part.unit_cost.toString(),
      unit_price: part.unit_price.toString(),
      reorder_level: part.reorder_level.toString(),
      reorder_quantity: part.reorder_quantity.toString(),
      location: part.location || '',
      accounting_code_id: part.accounting_code_id || '',
      is_active: part.is_active,
      is_taxable: part.is_taxable
    });
    setEditingId(part.id);
    setShowForm(true);
  };

  const openAdjustment = (part: Part) => {
    setSelectedPart(part);
    setShowAdjustment(true);
  };

  const resetForm = () => {
    setFormData({
      part_number: '',
      name: '',
      description: '',
      manufacturer: '',
      category: '',
      quantity_on_hand: '0',
      unit_cost: '',
      unit_price: '',
      reorder_level: '0',
      reorder_quantity: '0',
      location: '',
      accounting_code_id: '',
      is_active: true,
      is_taxable: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const resetAdjustmentForm = () => {
    setAdjustmentData({
      transaction_type: 'add',
      quantity: '',
      reason: ''
    });
    setSelectedPart(null);
    setShowAdjustment(false);
  };

  const filteredParts = parts.filter(part =>
    part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockParts = parts.filter(part => part.quantity_on_hand <= part.reorder_level);
  const totalInventoryValue = parts.reduce((sum, part) => sum + (part.quantity_on_hand * part.unit_cost), 0);

  if (loading) {
    return <div className="p-8 text-center">Loading parts inventory...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Parts Inventory</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Part
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Parts</p>
              <p className="text-2xl font-bold text-gray-900">{parts.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-orange-600">{lowStockParts.length}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900">${totalInventoryValue.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
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
            {editingId ? 'Edit Part' : 'New Part'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number *</label>
                <input
                  type="text"
                  required
                  value={formData.part_number}
                  onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
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
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <input
                  type="text"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData({ ...formData, quantity_on_hand: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost ($) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorder_quantity}
                  onChange={(e) => setFormData({ ...formData, reorder_quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accounting Code</label>
              <select
                value={formData.accounting_code_id}
                onChange={(e) => setFormData({ ...formData, accounting_code_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="" className="bg-white text-gray-900">Select accounting code</option>
                {accountingCodes.map((ac) => (
                  <option key={ac.id} value={ac.id} className="bg-white text-gray-900">
                    {ac.code} - {ac.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active</label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_taxable"
                  checked={formData.is_taxable}
                  onChange={(e) => setFormData({ ...formData, is_taxable: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_taxable" className="text-sm font-medium text-gray-700">
                  Taxable (applies sales tax when used in estimates)
                </label>
              </div>
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showAdjustment && selectedPart && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            Adjust Inventory: {selectedPart.part_number} - {selectedPart.name}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Current Quantity: <span className="font-semibold">{selectedPart.quantity_on_hand}</span>
          </p>
          <form onSubmit={handleAdjustment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type *</label>
              <select
                required
                value={adjustmentData.transaction_type}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, transaction_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="add" className="bg-white text-gray-900">Add Stock</option>
                <option value="remove" className="bg-white text-gray-900">Remove Stock</option>
                <option value="adjustment" className="bg-white text-gray-900">Adjustment</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                required
                min="1"
                value={adjustmentData.quantity}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                value={adjustmentData.reason}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                rows={2}
                placeholder="Optional reason for this adjustment"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetAdjustmentForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search parts by number, name, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No parts found. {searchTerm ? 'Try a different search.' : 'Add parts to get started.'}
                  </td>
                </tr>
              ) : (
                filteredParts.map((part) => (
                  <tr key={part.id} className={`hover:bg-gray-50 ${part.quantity_on_hand <= part.reorder_level ? 'bg-orange-50' : ''}`}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{part.part_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {part.name}
                      {part.quantity_on_hand <= part.reorder_level && (
                        <span className="ml-2 text-xs text-orange-600 font-medium">LOW STOCK</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{part.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{part.quantity_on_hand}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">${part.unit_cost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">${part.unit_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${(part.quantity_on_hand * part.unit_cost).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      <button
                        onClick={() => openAdjustment(part)}
                        className="text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                        title="Adjust Inventory"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(part)}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}