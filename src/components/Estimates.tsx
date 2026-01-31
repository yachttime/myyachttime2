import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, FileText, AlertCircle, Edit2, Trash2, Check, X } from 'lucide-react';

interface Estimate {
  id: string;
  estimate_number: string;
  yacht_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  is_retail_customer: boolean;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
  yachts?: { name: string };
}

interface EstimateLineItem {
  id?: string;
  line_type: 'labor' | 'part' | 'shop_supplies' | 'park_fees' | 'surcharge';
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  labor_code_id?: string | null;
  part_id?: string | null;
  line_order: number;
}

interface EstimatesProps {
  userId: string;
}

export function Estimates({ userId }: EstimatesProps) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [yachts, setYachts] = useState<any[]>([]);
  const [laborCodes, setLaborCodes] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    is_retail_customer: false,
    yacht_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    tax_rate: '0.08',
    notes: '',
    customer_notes: ''
  });

  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [lineItemFormData, setLineItemFormData] = useState({
    line_type: 'labor' as EstimateLineItem['line_type'],
    description: '',
    quantity: '1',
    unit_price: '0',
    labor_code_id: '',
    part_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [estimatesResult, yachtsResult, laborResult, partsResult] = await Promise.all([
        supabase
          .from('estimates')
          .select('*, yachts(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('yachts')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('labor_codes')
          .select('id, code, name, hourly_rate')
          .eq('is_active', true)
          .order('code'),
        supabase
          .from('parts_inventory')
          .select('id, part_number, name, unit_price')
          .eq('is_active', true)
          .order('part_number')
      ]);

      if (estimatesResult.error) {
        console.error('Estimates error:', estimatesResult.error);
        throw estimatesResult.error;
      }
      if (yachtsResult.error) {
        console.error('Yachts error:', yachtsResult.error);
        throw yachtsResult.error;
      }
      if (laborResult.error) {
        console.error('Labor codes error:', laborResult.error);
        throw laborResult.error;
      }
      if (partsResult.error) {
        console.error('Parts error:', partsResult.error);
        throw partsResult.error;
      }

      console.log('Loaded yachts:', yachtsResult.data);
      setEstimates(estimatesResult.data || []);
      setYachts(yachtsResult.data || []);
      setLaborCodes(laborResult.data || []);
      setParts(partsResult.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load estimates');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLineItem = () => {
    const quantity = parseFloat(lineItemFormData.quantity);
    const unit_price = parseFloat(lineItemFormData.unit_price);

    const newLineItem: EstimateLineItem = {
      line_type: lineItemFormData.line_type,
      description: lineItemFormData.description,
      quantity,
      unit_price,
      total_price: quantity * unit_price,
      labor_code_id: lineItemFormData.labor_code_id || null,
      part_id: lineItemFormData.part_id || null,
      line_order: lineItems.length
    };

    setLineItems([...lineItems, newLineItem]);

    setLineItemFormData({
      line_type: 'labor',
      description: '',
      quantity: '1',
      unit_price: '0',
      labor_code_id: '',
      part_id: ''
    });
    setShowLineItemForm(false);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLaborCodeChange = (laborCodeId: string) => {
    const laborCode = laborCodes.find(lc => lc.id === laborCodeId);
    if (laborCode) {
      setLineItemFormData({
        ...lineItemFormData,
        labor_code_id: laborCodeId,
        description: laborCode.name,
        unit_price: laborCode.hourly_rate.toString()
      });
    }
  };

  const handlePartChange = (partId: string) => {
    const part = parts.find(p => p.id === partId);
    if (part) {
      setLineItemFormData({
        ...lineItemFormData,
        part_id: partId,
        description: `${part.part_number} - ${part.name}`,
        unit_price: part.unit_price.toString()
      });
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const taxAmount = subtotal * parseFloat(formData.tax_rate);
    return subtotal + taxAmount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lineItems.length === 0) {
      setError('Please add at least one line item');
      return;
    }

    try {
      setError(null);

      const estimateNumber = await generateEstimateNumber();
      const subtotal = calculateSubtotal();
      const taxRate = parseFloat(formData.tax_rate);
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount;

      const estimateData = {
        estimate_number: estimateNumber,
        yacht_id: formData.is_retail_customer ? null : formData.yacht_id,
        customer_name: formData.is_retail_customer ? formData.customer_name : null,
        customer_email: formData.is_retail_customer ? formData.customer_email : null,
        customer_phone: formData.is_retail_customer ? formData.customer_phone : null,
        is_retail_customer: formData.is_retail_customer,
        status: 'draft',
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: formData.notes || null,
        customer_notes: formData.customer_notes || null,
        created_by: userId
      };

      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .insert(estimateData)
        .select()
        .single();

      if (estimateError) throw estimateError;

      const lineItemsToInsert = lineItems.map((item, index) => ({
        estimate_id: estimate.id,
        ...item,
        line_order: index
      }));

      const { error: lineItemsError } = await supabase
        .from('estimate_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Error saving estimate:', err);
      setError(err.message || 'Failed to save estimate');
    }
  };

  const generateEstimateNumber = async () => {
    const { data, error } = await supabase.rpc('generate_estimate_number');
    if (error) throw error;
    return data;
  };

  const resetForm = () => {
    setFormData({
      is_retail_customer: false,
      yacht_id: '',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      tax_rate: '0.08',
      notes: '',
      customer_notes: ''
    });
    setLineItems([]);
    setShowForm(false);
    setEditingId(null);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      converted: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || colors.draft;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading estimates...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Estimates</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Estimate
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
            {editingId ? 'Edit Estimate' : 'New Estimate'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_retail_customer}
                  onChange={(e) => setFormData({ ...formData, is_retail_customer: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Retail Customer</span>
              </label>
            </div>

            {formData.is_retail_customer ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yacht * {yachts.length > 0 && <span className="text-xs text-gray-500">({yachts.length} available)</span>}
                </label>
                <select
                  required
                  value={formData.yacht_id}
                  onChange={(e) => setFormData({ ...formData, yacht_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="" className="text-gray-500">Select a yacht</option>
                  {yachts.length === 0 ? (
                    <option value="" disabled>No yachts available</option>
                  ) : (
                    yachts.map((yacht) => (
                      <option key={yacht.id} value={yacht.id} className="text-gray-900">{yacht.name}</option>
                    ))
                  )}
                </select>
                {yachts.length === 0 && (
                  <p className="mt-1 text-sm text-red-600">No active yachts found. Please check your permissions.</p>
                )}
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-md font-semibold">Line Items</h4>
                <button
                  type="button"
                  onClick={() => setShowLineItemForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Line Item
                </button>
              </div>

              {showLineItemForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={lineItemFormData.line_type}
                        onChange={(e) => setLineItemFormData({ ...lineItemFormData, line_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="labor">Labor</option>
                        <option value="part">Part</option>
                        <option value="shop_supplies">Shop Supplies</option>
                        <option value="park_fees">Park Fees</option>
                        <option value="surcharge">Surcharge</option>
                      </select>
                    </div>

                    {lineItemFormData.line_type === 'labor' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Labor Code</label>
                        <select
                          value={lineItemFormData.labor_code_id}
                          onChange={(e) => handleLaborCodeChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Select labor code</option>
                          {laborCodes.map((lc) => (
                            <option key={lc.id} value={lc.id}>
                              {lc.code} - {lc.name} (${lc.hourly_rate}/hr)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {lineItemFormData.line_type === 'part' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Part</label>
                        <select
                          value={lineItemFormData.part_id}
                          onChange={(e) => handlePartChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Select part</option>
                          {parts.map((part) => (
                            <option key={part.id} value={part.id}>
                              {part.part_number} - {part.name} (${part.unit_price})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      required
                      value={lineItemFormData.description}
                      onChange={(e) => setLineItemFormData({ ...lineItemFormData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={lineItemFormData.quantity}
                        onChange={(e) => setLineItemFormData({ ...lineItemFormData, quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($)</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={lineItemFormData.unit_price}
                        onChange={(e) => setLineItemFormData({ ...lineItemFormData, unit_price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                      <input
                        type="text"
                        disabled
                        value={`$${(parseFloat(lineItemFormData.quantity) * parseFloat(lineItemFormData.unit_price)).toFixed(2)}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLineItemForm(false)}
                      className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {lineItems.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2">
                            <span className="text-xs text-gray-500 uppercase">{item.line_type}</span>
                            <div>{item.description}</div>
                          </td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">${item.unit_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">${item.total_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-end space-y-2">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span>Tax Rate:</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      max="1"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                      className="w-20 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span className="font-medium">${(calculateSubtotal() * parseFloat(formData.tax_rate)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Notes</label>
                <textarea
                  value={formData.customer_notes}
                  onChange={(e) => setFormData({ ...formData, customer_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Check className="w-4 h-4" />
                Create Estimate
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estimate #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {estimates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No estimates found. Create one to get started.
                </td>
              </tr>
            ) : (
              estimates.map((estimate) => (
                <tr key={estimate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {estimate.estimate_number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {estimate.is_retail_customer
                      ? estimate.customer_name
                      : estimate.yachts?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(estimate.status)}`}>
                      {estimate.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                    ${estimate.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(estimate.created_at).toLocaleDateString()}
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