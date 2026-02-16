import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Eye, Users, DollarSign, Search, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';

interface Company {
  id: string;
  company_name: string;
  legal_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  timezone: string;
  default_tax_rate: number;
  is_active: boolean;
  created_at: string;
}

interface CompanyStats {
  yacht_count: number;
  user_count: number;
  active_work_orders: number;
  total_revenue: number;
}

export function CompanyManagement() {
  const { isMaster } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStats>>({});
  const [formData, setFormData] = useState({
    company_name: '',
    legal_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: '',
    timezone: 'America/New_York',
    default_tax_rate: 0,
  });
  const [saving, setSaving] = useState(false);

  // Fetch all companies
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('company_name');

      if (error) throw error;
      setCompanies(data || []);

      // Fetch stats for each company
      if (data) {
        const stats: Record<string, CompanyStats> = {};
        for (const company of data) {
          const [yachtData, userData, workOrderData] = await Promise.all([
            supabase.from('yachts').select('id', { count: 'exact' }).eq('company_id', company.id),
            supabase.from('user_profiles').select('id', { count: 'exact' }).eq('company_id', company.id),
            supabase.from('work_orders').select('id', { count: 'exact' }).eq('company_id', company.id).in('status', ['open', 'in_progress']),
          ]);

          stats[company.id] = {
            yacht_count: yachtData.count || 0,
            user_count: userData.count || 0,
            active_work_orders: workOrderData.count || 0,
            total_revenue: 0,
          };
        }
        setCompanyStats(stats);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMaster) {
      fetchCompanies();
    }
  }, []); // Only run once on mount to prevent form reset during editing

  // Filter companies based on search and active status
  const filteredCompanies = companies.filter(company => {
    const matchesSearch =
      company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.city?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesActive = filterActive === null || company.is_active === filterActive;

    return matchesSearch && matchesActive;
  });

  // Toggle company active status
  const toggleCompanyStatus = async (company: Company) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !company.is_active })
        .eq('id', company.id);

      if (error) throw error;

      await fetchCompanies();
    } catch (error) {
      console.error('Error updating company status:', error);
      alert('Failed to update company status');
    }
  };

  // Open add modal
  const handleAddNew = () => {
    setSelectedCompany(null);
    setFormData({
      company_name: '',
      legal_name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      phone: '',
      email: '',
      website: '',
      timezone: 'America/New_York',
      default_tax_rate: 0,
    });
    setShowAddModal(true);
  };

  // Open edit modal
  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      company_name: company.company_name,
      legal_name: company.legal_name || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zip_code: company.zip_code || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      timezone: company.timezone,
      default_tax_rate: company.default_tax_rate,
    });
    setShowAddModal(true);
  };

  // Open view modal
  const handleView = (company: Company) => {
    setSelectedCompany(company);
    setShowViewModal(true);
  };

  // Save company (add or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_name.trim()) {
      alert('Company name is required');
      return;
    }

    try {
      setSaving(true);

      if (selectedCompany) {
        // Update existing company
        const { error } = await supabase
          .from('companies')
          .update({
            company_name: formData.company_name,
            legal_name: formData.legal_name || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            zip_code: formData.zip_code || null,
            phone: formData.phone || null,
            email: formData.email || null,
            website: formData.website || null,
            timezone: formData.timezone,
            default_tax_rate: formData.default_tax_rate,
          })
          .eq('id', selectedCompany.id);

        if (error) throw error;
        alert('Company updated successfully');
      } else {
        // Create new company
        const { error } = await supabase
          .from('companies')
          .insert({
            company_name: formData.company_name,
            legal_name: formData.legal_name || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            zip_code: formData.zip_code || null,
            phone: formData.phone || null,
            email: formData.email || null,
            website: formData.website || null,
            timezone: formData.timezone,
            default_tax_rate: formData.default_tax_rate,
            is_active: true,
          });

        if (error) throw error;
        alert('Company created successfully');
      }

      setShowAddModal(false);
      setSelectedCompany(null);
      await fetchCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  if (!isMaster) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-8">
        <div className="max-w-4xl mx-auto text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-slate-400">Only master users can access company management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Company Management</h1>
            <p className="text-slate-400">Manage all companies in the system</p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add New Company
          </button>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Active Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterActive(null)}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                  filterActive === null
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterActive(true)}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                  filterActive === true
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterActive(false)}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                  filterActive === false
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => {
            const stats = companyStats[company.id] || {
              yacht_count: 0,
              user_count: 0,
              active_work_orders: 0,
              total_revenue: 0,
            };

            return (
              <div
                key={company.id}
                className={`bg-slate-800/50 rounded-lg p-6 border-2 transition-all ${
                  company.is_active
                    ? 'border-green-500/30 hover:border-green-500/50'
                    : 'border-red-500/30 hover:border-red-500/50 opacity-75'
                }`}
              >
                {/* Company Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-5 w-5 text-amber-500" />
                      <h3 className="text-lg font-bold">{company.company_name}</h3>
                    </div>
                    {company.legal_name && (
                      <p className="text-sm text-slate-400">{company.legal_name}</p>
                    )}
                  </div>
                  {company.is_active ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>

                {/* Company Info */}
                <div className="space-y-2 mb-4 text-sm">
                  {company.email && (
                    <p className="text-slate-400">
                      <span className="font-semibold">Email:</span> {company.email}
                    </p>
                  )}
                  {company.phone && (
                    <p className="text-slate-400">
                      <span className="font-semibold">Phone:</span> {company.phone}
                    </p>
                  )}
                  {company.city && company.state && (
                    <p className="text-slate-400">
                      <span className="font-semibold">Location:</span> {company.city}, {company.state}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Yachts</span>
                    </div>
                    <p className="text-xl font-bold">{stats.yacht_count}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-purple-400" />
                      <span className="text-xs text-slate-400">Users</span>
                    </div>
                    <p className="text-xl font-bold">{stats.user_count}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-slate-400">Work Orders</span>
                    </div>
                    <p className="text-xl font-bold">{stats.active_work_orders}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-400">Created</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {new Date(company.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleView(company)}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(company)}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => toggleCompanyStatus(company)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      company.is_active
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {company.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredCompanies.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Companies Found</h3>
            <p className="text-slate-400 mb-6">
              {searchQuery || filterActive !== null
                ? 'Try adjusting your filters'
                : 'Get started by adding your first company'}
            </p>
            {!searchQuery && filterActive === null && (
              <button
                onClick={handleAddNew}
                className="bg-amber-600 hover:bg-amber-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Add New Company
              </button>
            )}
          </div>
        )}

        {/* Add/Edit Company Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-800 rounded-lg p-6 max-w-3xl w-full my-8">
              <h2 className="text-2xl font-bold mb-6">
                {selectedCompany ? 'Edit Company' : 'Add New Company'}
              </h2>

              <form onSubmit={handleSave} className="space-y-6">
                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-amber-500">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Legal Name</label>
                      <input
                        type="text"
                        value={formData.legal_name}
                        onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-amber-500">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">Website</label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-amber-500">Address</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Street Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">City</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">State</label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">ZIP Code</label>
                        <input
                          type="text"
                          value={formData.zip_code}
                          onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-amber-500">Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Timezone</label>
                      <select
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                      >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Default Tax Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.default_tax_rate}
                        onChange={(e) => setFormData({ ...formData, default_tax_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    {saving ? 'Saving...' : selectedCompany ? 'Update Company' : 'Create Company'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedCompany(null);
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Company Modal */}
        {showViewModal && selectedCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Company Details</h2>
                {selectedCompany.is_active ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
              </div>

              <div className="space-y-6">
                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-amber-500">Company Information</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 text-sm">Company Name:</span>
                      <p className="font-semibold">{selectedCompany.company_name}</p>
                    </div>
                    {selectedCompany.legal_name && (
                      <div>
                        <span className="text-slate-400 text-sm">Legal Name:</span>
                        <p className="font-semibold">{selectedCompany.legal_name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-amber-500">Contact Information</h3>
                  <div className="space-y-2">
                    {selectedCompany.email && (
                      <div>
                        <span className="text-slate-400 text-sm">Email:</span>
                        <p className="font-semibold">{selectedCompany.email}</p>
                      </div>
                    )}
                    {selectedCompany.phone && (
                      <div>
                        <span className="text-slate-400 text-sm">Phone:</span>
                        <p className="font-semibold">{selectedCompany.phone}</p>
                      </div>
                    )}
                    {selectedCompany.website && (
                      <div>
                        <span className="text-slate-400 text-sm">Website:</span>
                        <p className="font-semibold">
                          <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">
                            {selectedCompany.website}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                {(selectedCompany.address || selectedCompany.city || selectedCompany.state || selectedCompany.zip_code) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-amber-500">Address</h3>
                    <div className="space-y-1">
                      {selectedCompany.address && <p>{selectedCompany.address}</p>}
                      {(selectedCompany.city || selectedCompany.state || selectedCompany.zip_code) && (
                        <p>
                          {selectedCompany.city && selectedCompany.city}
                          {selectedCompany.city && selectedCompany.state && ', '}
                          {selectedCompany.state && selectedCompany.state}
                          {selectedCompany.zip_code && ' ' + selectedCompany.zip_code}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Settings */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-amber-500">Settings</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 text-sm">Timezone:</span>
                      <p className="font-semibold">{selectedCompany.timezone}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Default Tax Rate:</span>
                      <p className="font-semibold">{selectedCompany.default_tax_rate}%</p>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-amber-500">Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-slate-400">Yachts</span>
                      </div>
                      <p className="text-2xl font-bold">{companyStats[selectedCompany.id]?.yacht_count || 0}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-purple-400" />
                        <span className="text-sm text-slate-400">Users</span>
                      </div>
                      <p className="text-2xl font-bold">{companyStats[selectedCompany.id]?.user_count || 0}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-green-400" />
                        <span className="text-sm text-slate-400">Work Orders</span>
                      </div>
                      <p className="text-2xl font-bold">{companyStats[selectedCompany.id]?.active_work_orders || 0}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <span className="text-sm text-slate-400">Status</span>
                      <p className="text-lg font-bold mt-1">
                        {selectedCompany.is_active ? (
                          <span className="text-green-500">Active</span>
                        ) : (
                          <span className="text-red-500">Inactive</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Meta Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-amber-500">System Information</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 text-sm">Company ID:</span>
                      <p className="font-mono text-xs">{selectedCompany.id}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Created:</span>
                      <p className="font-semibold">{new Date(selectedCompany.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(selectedCompany);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Company
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedCompany(null);
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
