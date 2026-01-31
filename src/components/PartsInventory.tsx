import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, AlertCircle, Package, TrendingUp, TrendingDown, Search } from 'lucide-react';

interface Part {
  id: string;
  part_number: string;
  name: string;
  description: string | null;
  vendor_id: string | null;
  quantity_on_hand: number;
  unit_cost: number;
  unit_price: number;
  msrp: number | null;
  reorder_level: number;
  reorder_quantity: number;
  location: string | null;
  accounting_code_id: string | null;
  alternative_part_numbers: string | null;
  is_active: boolean;
  is_taxable: boolean;
  accounting_codes?: {
    code: string;
    name: string;
  };
  vendors?: {
    vendor_name: string;
  };
}

interface AccountingCode {
  id: string;
  code: string;
  name: string;
}

interface Vendor {
  id: string;
  vendor_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  account_number: string | null;
  account_rep_name: string | null;
  account_rep_phone: string | null;
  account_rep_email: string | null;
  accounting_rep_name: string | null;
  accounting_rep_phone: string | null;
  accounting_rep_email: string | null;
  is_active: boolean;
}

interface PartsInventoryProps {
  userId: string;
}

export function PartsInventory({ userId }: PartsInventoryProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accountingCodes, setAccountingCodes] = useState<AccountingCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'parts' | 'vendors'>('parts');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    part_number: '',
    name: '',
    description: '',
    vendor_id: '',
    quantity_on_hand: '0',
    unit_cost: '',
    unit_price: '',
    alternative_part_numbers: '',
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
  const [vendorFormData, setVendorFormData] = useState({
    vendor_name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    account_number: '',
    account_rep_name: '',
    account_rep_phone: '',
    account_rep_email: '',
    accounting_rep_name: '',
    accounting_rep_phone: '',
    accounting_rep_email: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [partsResult, vendorsResult, accountingResult] = await Promise.all([
        supabase
          .from('parts_inventory')
          .select(`
            *,
            accounting_codes (code, name),
            vendors (vendor_name)
          `)
          .order('part_number'),
        supabase
          .from('vendors')
          .select('*')
          .order('vendor_name'),
        supabase
          .from('accounting_codes')
          .select('id, code, name')
          .eq('is_active', true)
          .order('code')
      ]);

      if (partsResult.error) throw partsResult.error;
      if (vendorsResult.error) throw vendorsResult.error;
      if (accountingResult.error) throw accountingResult.error;

      setParts(partsResult.data || []);
      setVendors(vendorsResult.data || []);
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

      if (!formData.part_number || !formData.name) {
        setError('Part number and name are required');
        return;
      }

      if (!formData.unit_cost || !formData.unit_price) {
        setError('Unit cost and unit price are required');
        return;
      }

      const unitCost = parseFloat(formData.unit_cost);
      const unitPrice = parseFloat(formData.unit_price);

      if (isNaN(unitCost) || isNaN(unitPrice)) {
        setError('Unit cost and unit price must be valid numbers');
        return;
      }

      const dataToSave = {
        part_number: formData.part_number,
        name: formData.name,
        description: formData.description || null,
        vendor_id: formData.vendor_id || null,
        quantity_on_hand: parseInt(formData.quantity_on_hand) || 0,
        unit_cost: unitCost,
        unit_price: unitPrice,
        msrp: null,
        alternative_part_numbers: formData.alternative_part_numbers || null,
        reorder_level: 0,
        reorder_quantity: 0,
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
      vendor_id: part.vendor_id || '',
      quantity_on_hand: part.quantity_on_hand.toString(),
      unit_cost: part.unit_cost.toString(),
      unit_price: part.unit_price.toString(),
      alternative_part_numbers: part.alternative_part_numbers || '',
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
      vendor_id: '',
      quantity_on_hand: '0',
      unit_cost: '',
      unit_price: '',
      alternative_part_numbers: '',
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

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);

      const dataToSave = {
        vendor_name: vendorFormData.vendor_name,
        contact_name: vendorFormData.contact_name || null,
        phone: vendorFormData.phone || null,
        email: vendorFormData.email || null,
        address: vendorFormData.address || null,
        city: vendorFormData.city || null,
        state: vendorFormData.state || null,
        zip: vendorFormData.zip || null,
        account_number: vendorFormData.account_number || null,
        account_rep_name: vendorFormData.account_rep_name || null,
        account_rep_phone: vendorFormData.account_rep_phone || null,
        account_rep_email: vendorFormData.account_rep_email || null,
        accounting_rep_name: vendorFormData.accounting_rep_name || null,
        accounting_rep_phone: vendorFormData.accounting_rep_phone || null,
        accounting_rep_email: vendorFormData.accounting_rep_email || null,
        is_active: vendorFormData.is_active
      };

      if (editingVendorId) {
        const { error: updateError } = await supabase
          .from('vendors')
          .update(dataToSave)
          .eq('id', editingVendorId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('vendors')
          .insert(dataToSave);

        if (insertError) throw insertError;
      }

      resetVendorForm();
      loadData();
    } catch (err: any) {
      console.error('Error saving vendor:', err);
      setError(err.message || 'Failed to save vendor');
    }
  };

  const handleEditVendor = (vendor: Vendor) => {
    setVendorFormData({
      vendor_name: vendor.vendor_name,
      contact_name: vendor.contact_name || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      zip: vendor.zip || '',
      account_number: vendor.account_number || '',
      account_rep_name: vendor.account_rep_name || '',
      account_rep_phone: vendor.account_rep_phone || '',
      account_rep_email: vendor.account_rep_email || '',
      accounting_rep_name: vendor.accounting_rep_name || '',
      accounting_rep_phone: vendor.accounting_rep_phone || '',
      accounting_rep_email: vendor.accounting_rep_email || '',
      is_active: vendor.is_active
    });
    setEditingVendorId(vendor.id);
    setShowVendorForm(true);
  };

  const resetVendorForm = () => {
    setVendorFormData({
      vendor_name: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      account_number: '',
      account_rep_name: '',
      account_rep_phone: '',
      account_rep_email: '',
      accounting_rep_name: '',
      accounting_rep_phone: '',
      accounting_rep_email: '',
      is_active: true
    });
    setEditingVendorId(null);
    setShowVendorForm(false);
  };

  const filteredParts = parts.filter(part =>
    part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (part.vendors?.vendor_name && part.vendors.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredVendors = vendors.filter(vendor =>
    vendor.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vendor.contact_name && vendor.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (vendor.phone && vendor.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalInventoryValue = parts.reduce((sum, part) => sum + (part.quantity_on_hand * part.unit_cost), 0);

  if (loading) {
    return <div className="p-8 text-center">Loading parts inventory...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Parts Inventory</h2>
        <div className="flex gap-2">
          {activeTab === 'parts' && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Part
            </button>
          )}
          {activeTab === 'vendors' && (
            <button
              onClick={() => setShowVendorForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('parts')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'parts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Parts
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'vendors'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Vendors
          </button>
        </div>
      </div>

      {activeTab === 'parts' && (
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
                <p className="text-sm text-gray-600">Avg. Gross Profit</p>
                <p className="text-2xl font-bold text-green-600">
                  {parts.length > 0
                    ? `${(parts.reduce((sum, part) => sum + ((part.unit_price - part.unit_cost) / part.unit_cost * 100), 0) / parts.length).toFixed(1)}%`
                    : '0%'
                  }
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
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
      )}

      {activeTab === 'vendors' && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Vendors</p>
                <p className="text-2xl font-bold text-gray-900">{vendors.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Vendors</p>
                <p className="text-2xl font-bold text-green-600">{vendors.filter(v => v.is_active).length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {activeTab === 'parts' && showForm && (
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

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Vendor</label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('vendors');
                    setShowVendorForm(true);
                    setShowForm(false);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add New Vendor
                </button>
              </div>
              <select
                value={formData.vendor_id}
                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="" className="bg-white text-gray-900">Select vendor</option>
                {vendors.filter(v => v.is_active).map((vendor) => (
                  <option key={vendor.id} value={vendor.id} className="bg-white text-gray-900">
                    {vendor.vendor_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alternative Part Numbers</label>
              <input
                type="text"
                value={formData.alternative_part_numbers}
                onChange={(e) => setFormData({ ...formData, alternative_part_numbers: e.target.value })}
                placeholder="e.g., 12345, ABC-789, XYZ-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gross Profit %</label>
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                  {(() => {
                    const cost = parseFloat(formData.unit_cost) || 0;
                    const price = parseFloat(formData.unit_price) || 0;
                    if (cost === 0 || price === 0) return '-';
                    const profitPercent = ((price - cost) / cost * 100);
                    return `${profitPercent.toFixed(1)}%`;
                  })()}
                </div>
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

      {activeTab === 'parts' && showAdjustment && selectedPart && (
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

      {activeTab === 'parts' && (
        <>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search parts by number, name, or vendor..."
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Profit %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    No parts found. {searchTerm ? 'Try a different search.' : 'Add parts to get started.'}
                  </td>
                </tr>
              ) : (
                filteredParts.map((part) => (
                  <tr key={part.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{part.part_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{part.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{part.vendors?.vendor_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{part.quantity_on_hand}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">${part.unit_cost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">${part.unit_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {(() => {
                        const profitPercent = ((part.unit_price - part.unit_cost) / part.unit_cost * 100);
                        const color = profitPercent >= 30 ? 'text-green-600' : profitPercent >= 15 ? 'text-blue-600' : 'text-orange-600';
                        return <span className={color}>{profitPercent.toFixed(1)}%</span>;
                      })()}
                    </td>
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
        </>
      )}

      {activeTab === 'vendors' && (
        <>
          {showVendorForm && (
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingVendorId ? 'Edit Vendor' : 'New Vendor'}
              </h3>
              <form onSubmit={handleVendorSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                    <input
                      type="text"
                      required
                      value={vendorFormData.vendor_name}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, vendor_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={vendorFormData.contact_name}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, contact_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={vendorFormData.address}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={vendorFormData.city}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={vendorFormData.state}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={vendorFormData.zip}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, zip: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={vendorFormData.phone}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={vendorFormData.email}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={vendorFormData.account_number}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, account_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Account Representative</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={vendorFormData.account_rep_name}
                        onChange={(e) => setVendorFormData({ ...vendorFormData, account_rep_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={vendorFormData.account_rep_phone}
                        onChange={(e) => setVendorFormData({ ...vendorFormData, account_rep_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={vendorFormData.account_rep_email}
                        onChange={(e) => setVendorFormData({ ...vendorFormData, account_rep_email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Accounting Representative</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={vendorFormData.accounting_rep_name}
                        onChange={(e) => setVendorFormData({ ...vendorFormData, accounting_rep_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={vendorFormData.accounting_rep_phone}
                        onChange={(e) => setVendorFormData({ ...vendorFormData, accounting_rep_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={vendorFormData.accounting_rep_email}
                        onChange={(e) => setVendorFormData({ ...vendorFormData, accounting_rep_email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="vendor_is_active"
                    checked={vendorFormData.is_active}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="vendor_is_active" className="text-sm font-medium text-gray-700">Active</label>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetVendorForm}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingVendorId ? 'Update' : 'Create'}
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
                placeholder="Search vendors by name, contact, or phone..."
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No vendors found. {searchTerm ? 'Try a different search.' : 'Add vendors to get started.'}
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{vendor.vendor_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vendor.contact_name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vendor.phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vendor.email || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vendor.account_number || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            vendor.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {vendor.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <button
                            onClick={() => handleEditVendor(vendor)}
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
        </>
      )}
    </div>
  );
}