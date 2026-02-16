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
  const { isMaster, refreshCompanies } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStats>>({});

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
  }, [isMaster]);

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
      await refreshCompanies();
    } catch (error) {
      console.error('Error updating company status:', error);
      alert('Failed to update company status');
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
            onClick={() => setShowAddModal(true)}
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
                    onClick={() => setSelectedCompany(company)}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCompany(company);
                      setShowAddModal(true);
                    }}
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
                onClick={() => setShowAddModal(true)}
                className="bg-amber-600 hover:bg-amber-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Add New Company
              </button>
            )}
          </div>
        )}

        {/* TODO: Add Company Modal will be implemented */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full">
              <h2 className="text-2xl font-bold mb-4">
                {selectedCompany ? 'Edit Company' : 'Add New Company'}
              </h2>
              <p className="text-slate-400 mb-4">Company form coming soon...</p>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedCompany(null);
                }}
                className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
