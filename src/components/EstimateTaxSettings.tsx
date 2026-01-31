import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Percent, AlertCircle, Check, Save } from 'lucide-react';

interface TaxSettings {
  id: string;
  sales_tax_rate: number;
  shop_supplies_rate: number;
  park_fees_rate: number;
  surcharge_rate: number;
}

interface EstimateTaxSettingsProps {
  userId: string;
}

export function EstimateTaxSettings({ userId }: EstimateTaxSettingsProps) {
  const [settings, setSettings] = useState<TaxSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    sales_tax_rate: '8.00',
    shop_supplies_rate: '5.00',
    park_fees_rate: '2.00',
    surcharge_rate: '3.00'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('estimate_settings')
        .select('*')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setSettings(data);
        setFormData({
          sales_tax_rate: (data.sales_tax_rate * 100).toFixed(2),
          shop_supplies_rate: (data.shop_supplies_rate * 100).toFixed(2),
          park_fees_rate: (data.park_fees_rate * 100).toFixed(2),
          surcharge_rate: (data.surcharge_rate * 100).toFixed(2)
        });
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      setError('Failed to load tax settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const updateData = {
        sales_tax_rate: parseFloat(formData.sales_tax_rate) / 100,
        shop_supplies_rate: parseFloat(formData.shop_supplies_rate) / 100,
        park_fees_rate: parseFloat(formData.park_fees_rate) / 100,
        surcharge_rate: parseFloat(formData.surcharge_rate) / 100
      };

      const { error: updateError } = await supabase
        .from('estimate_settings')
        .update(updateData)
        .eq('id', settings?.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadSettings();
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save tax settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        sales_tax_rate: (settings.sales_tax_rate * 100).toFixed(2),
        shop_supplies_rate: (settings.shop_supplies_rate * 100).toFixed(2),
        park_fees_rate: (settings.park_fees_rate * 100).toFixed(2),
        surcharge_rate: (settings.surcharge_rate * 100).toFixed(2)
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Taxes & Surcharges</h2>
        <p className="text-sm text-gray-600">
          Configure default tax rates and surcharge percentages for estimates. These values can be adjusted per estimate.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="w-5 h-5" />
          Settings saved successfully
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Percent className="w-4 h-4 text-blue-600" />
                Sales Tax Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={formData.sales_tax_rate}
                  onChange={(e) => setFormData({ ...formData, sales_tax_rate: e.target.value })}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="8.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Applied to the subtotal for taxable items
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Percent className="w-4 h-4 text-blue-600" />
                Shop Supplies Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={formData.shop_supplies_rate}
                  onChange={(e) => setFormData({ ...formData, shop_supplies_rate: e.target.value })}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="5.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Standard rate for consumable shop supplies
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Percent className="w-4 h-4 text-blue-600" />
                National Park Fees Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={formData.park_fees_rate}
                  onChange={(e) => setFormData({ ...formData, park_fees_rate: e.target.value })}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="2.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Environmental or park usage fees
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Percent className="w-4 h-4 text-blue-600" />
                Surcharge Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={formData.surcharge_rate}
                  onChange={(e) => setFormData({ ...formData, surcharge_rate: e.target.value })}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="3.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Additional charges or service fees
              </p>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Preview Calculation</h4>
              <div className="text-xs text-blue-800 space-y-1">
                <p>Example on $1,000.00 subtotal:</p>
                <div className="ml-4 space-y-1 mt-2">
                  <p>• Sales Tax ({formData.sales_tax_rate}%): ${((parseFloat(formData.sales_tax_rate) / 100) * 1000).toFixed(2)}</p>
                  <p>• Shop Supplies ({formData.shop_supplies_rate}%): ${((parseFloat(formData.shop_supplies_rate) / 100) * 1000).toFixed(2)}</p>
                  <p>• Park Fees ({formData.park_fees_rate}%): ${((parseFloat(formData.park_fees_rate) / 100) * 1000).toFixed(2)}</p>
                  <p>• Surcharge ({formData.surcharge_rate}%): ${((parseFloat(formData.surcharge_rate) / 100) * 1000).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
