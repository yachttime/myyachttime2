import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Percent, AlertCircle, Check, Save, Building2, Upload, X } from 'lucide-react';
import { uploadFile, deleteFile } from '../utils/fileUpload';

interface TaxSettings {
  id: string;
  sales_tax_rate: number;
  shop_supplies_rate: number;
  park_fees_rate: number;
  surcharge_rate: number;
}

interface CompanyInfo {
  id: string;
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
}

type TabType = 'taxes' | 'company';

interface EstimateTaxSettingsProps {
  userId: string;
}

export function EstimateTaxSettings({ userId }: EstimateTaxSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('taxes');
  const [settings, setSettings] = useState<TaxSettings | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [formData, setFormData] = useState({
    sales_tax_rate: '8.00',
    shop_supplies_rate: '5.00',
    park_fees_rate: '2.00',
    surcharge_rate: '3.00'
  });

  const [companyFormData, setCompanyFormData] = useState({
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: '',
    logo_url: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const [taxSettingsResult, companyInfoResult] = await Promise.all([
        supabase.from('estimate_settings').select('*').maybeSingle(),
        supabase.from('company_info').select('*').maybeSingle()
      ]);

      if (taxSettingsResult.error) throw taxSettingsResult.error;
      if (companyInfoResult.error) throw companyInfoResult.error;

      if (taxSettingsResult.data) {
        setSettings(taxSettingsResult.data);
        setFormData({
          sales_tax_rate: (taxSettingsResult.data.sales_tax_rate * 100).toFixed(2),
          shop_supplies_rate: (taxSettingsResult.data.shop_supplies_rate * 100).toFixed(2),
          park_fees_rate: (taxSettingsResult.data.park_fees_rate * 100).toFixed(2),
          surcharge_rate: (taxSettingsResult.data.surcharge_rate * 100).toFixed(2)
        });
      }

      if (companyInfoResult.data) {
        setCompanyInfo(companyInfoResult.data);
        setCompanyFormData({
          company_name: companyInfoResult.data.company_name || '',
          address_line1: companyInfoResult.data.address_line1 || '',
          address_line2: companyInfoResult.data.address_line2 || '',
          city: companyInfoResult.data.city || '',
          state: companyInfoResult.data.state || '',
          zip_code: companyInfoResult.data.zip_code || '',
          phone: companyInfoResult.data.phone || '',
          email: companyInfoResult.data.email || '',
          website: companyInfoResult.data.website || '',
          logo_url: companyInfoResult.data.logo_url || ''
        });
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings');
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

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const { error: updateError } = await supabase
        .from('company_info')
        .update(companyFormData)
        .eq('id', companyInfo?.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadSettings();
    } catch (err: any) {
      console.error('Error saving company info:', err);
      setError(err.message || 'Failed to save company information');
    } finally {
      setSaving(false);
    }
  };

  const handleCompanyReset = () => {
    if (companyInfo) {
      setCompanyFormData({
        company_name: companyInfo.company_name || '',
        address_line1: companyInfo.address_line1 || '',
        address_line2: companyInfo.address_line2 || '',
        city: companyInfo.city || '',
        state: companyInfo.state || '',
        zip_code: companyInfo.zip_code || '',
        phone: companyInfo.phone || '',
        email: companyInfo.email || '',
        website: companyInfo.website || '',
        logo_url: companyInfo.logo_url || ''
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo file size must be less than 5MB');
      return;
    }

    try {
      setUploadingLogo(true);
      setError(null);

      if (companyFormData.logo_url) {
        try {
          const oldPath = companyFormData.logo_url.split('/').pop();
          if (oldPath) {
            console.log('Deleting old logo:', oldPath);
            await deleteFile('company-logos', oldPath);
          }
        } catch (deleteErr) {
          console.warn('Could not delete old logo:', deleteErr);
        }
      }

      const fileName = `logo-${Date.now()}-${file.name}`;
      console.log('Uploading to:', fileName);
      const url = await uploadFile('company-logos', fileName, file);
      console.log('Upload successful, URL:', url);

      setCompanyFormData({ ...companyFormData, logo_url: url });

      console.log('Updating database with logo URL...');
      const { error: updateError } = await supabase
        .from('company_info')
        .update({ logo_url: url })
        .eq('id', companyInfo?.id);

      if (updateError) throw updateError;

      console.log('Database updated successfully');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadSettings();
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!companyFormData.logo_url) return;

    try {
      setUploadingLogo(true);
      setError(null);

      const oldPath = companyFormData.logo_url.split('/').pop();
      if (oldPath) {
        await deleteFile('company-logos', oldPath);
      }

      setCompanyFormData({ ...companyFormData, logo_url: '' });

      const { error: updateError } = await supabase
        .from('company_info')
        .update({ logo_url: '' })
        .eq('id', companyInfo?.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error removing logo:', err);
      setError(err.message || 'Failed to remove logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Estimate Settings</h2>
        <p className="text-sm text-gray-600">
          Configure taxes, surcharges, and company information displayed on estimates.
        </p>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('taxes')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'taxes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Taxes & Surcharges
            </div>
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'company'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Company Information
            </div>
          </button>
        </div>
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

      {activeTab === 'taxes' && (
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
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-700">
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
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-700">
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
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-700">
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
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-700">
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
      )}

      {activeTab === 'company' && (
        <form onSubmit={handleCompanySubmit} className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="space-y-6">
            {uploadingLogo && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700">
                <div className="animate-spin w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full"></div>
                Uploading logo...
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Logo
              </label>
              <div className="flex items-start gap-4">
                {companyFormData.logo_url ? (
                  <div className="relative">
                    <img
                      src={companyFormData.logo_url}
                      alt="Company Logo"
                      className="w-32 h-32 object-contain border border-gray-300 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      disabled={uploadingLogo}
                      className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                    <Upload className="w-8 h-8 text-gray-600" />
                  </div>
                )}
                <div className="flex-1">
                  <label className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-all ${uploadingLogo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Upload className="w-4 h-4" />
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-700">
                    Recommended: Square image, max 5MB. Supports JPG, PNG, GIF, WebP.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyFormData.company_name}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Your Company Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={companyFormData.address_line1}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, address_line1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Street Address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={companyFormData.address_line2}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, address_line2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Suite, Unit, Building, Floor, etc."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={companyFormData.city}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={companyFormData.state}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={companyFormData.zip_code}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, zip_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="ZIP"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={companyFormData.phone}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={companyFormData.email}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="info@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={companyFormData.website}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="https://www.company.com"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-6">
              <button
                type="button"
                onClick={handleCompanyReset}
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
                {saving ? 'Saving...' : 'Save Company Info'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
