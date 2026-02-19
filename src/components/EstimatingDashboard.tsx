import React, { useState, useEffect } from 'react';
import { FileText, Package, Briefcase, Wrench, Settings, LayoutDashboard, Clock, DollarSign, AlertCircle, FileText as FileIcon, Receipt } from 'lucide-react';
import { Estimates } from './Estimates';
import { WorkOrders } from './WorkOrders';
import { Invoices } from './Invoices';
import { PartsInventory } from './PartsInventory';
import { AccountingCodes } from './AccountingCodes';
import { LaborCodes } from './LaborCodes';
import { EstimateTaxSettings } from './EstimateTaxSettings';
import { EstimatePackages } from './EstimatePackages';
import { MercuryPartsManager } from './MercuryPartsManager';
import { MarineWholesalePartsManager } from './MarineWholesalePartsManager';
import QuickBooksAccountMapping from './QuickBooksAccountMapping';
import { supabase } from '../lib/supabase';

interface EstimatingDashboardProps {
  userId: string;
}

type TabType = 'dashboard' | 'estimates' | 'workorders' | 'invoices' | 'parts' | 'settings';

interface DashboardStats {
  totalEstimates: number;
  pendingApproval: number;
  totalWorkOrders: number;
  pendingWorkOrders: number;
  unpaidInvoices: number;
  unpaidAmount: number;
  lowStockItems: number;
  totalRevenue: number;
  activeJobs: number;
}

export function EstimatingDashboard({ userId }: EstimatingDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalEstimates: 0,
    pendingApproval: 0,
    totalWorkOrders: 0,
    pendingWorkOrders: 0,
    unpaidInvoices: 0,
    unpaidAmount: 0,
    lowStockItems: 0,
    totalRevenue: 0,
    activeJobs: 0
  });
  const [loading, setLoading] = useState(true);

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'estimates' as TabType, label: 'Estimates', icon: FileText },
    { id: 'workorders' as TabType, label: 'Work Orders', icon: Wrench },
    { id: 'invoices' as TabType, label: 'Invoices', icon: Receipt },
    { id: 'parts' as TabType, label: 'Parts Inventory', icon: Package },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings }
  ];

  const [settingsSubTab, setSettingsSubTab] = useState<'labor' | 'accounting' | 'taxes' | 'packages' | 'mercury' | 'marine_wholesale' | 'quickbooks'>('labor');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
    }
    fetchUserRole();
  }, [activeTab, userId]);

  async function fetchUserRole() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  }

  async function fetchDashboardStats() {
    try {
      setLoading(true);

      const [estimatesRes, workOrdersRes, invoicesRes, partsRes] = await Promise.all([
        supabase.from('estimates').select('id, status, total_amount', { count: 'exact' }).neq('status', 'converted').eq('archived', false),
        supabase.from('work_orders').select('id, status', { count: 'exact' }).eq('archived', false),
        supabase.from('estimating_invoices').select('id, total_amount, payment_status, work_order_id', { count: 'exact' }).eq('archived', false),
        supabase.from('parts_inventory').select('id, quantity_on_hand, reorder_level', { count: 'exact' })
      ]);

      const estimates = estimatesRes.data || [];
      const allWorkOrders = workOrdersRes.data || [];
      const invoices = invoicesRes.data || [];

      // Filter out work orders that have been converted to invoices
      const convertedWorkOrderIds = new Set(
        invoices.filter(inv => inv.work_order_id).map(inv => inv.work_order_id)
      );
      const workOrders = allWorkOrders.filter(wo => !convertedWorkOrderIds.has(wo.id));
      const parts = partsRes.data || [];

      const pendingApproval = estimates.filter(e => e.status === 'sent').length;
      const totalWorkOrders = workOrders.length;
      const pendingWorkOrders = workOrders.filter(w =>
        w.status === 'in_progress' || w.status === 'pending'
      ).length;
      const unpaidInvoices = invoices.filter(i => i.payment_status !== 'paid');
      const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      const lowStockItems = parts.filter(p => p.quantity_on_hand <= p.reorder_level).length;

      const totalRevenue = invoices
        .filter(i => i.payment_status !== 'paid')
        .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

      const activeJobs = workOrders.filter(w =>
        w.status === 'in_progress' || w.status === 'pending'
      ).length;

      setStats({
        totalEstimates: estimates.length,
        pendingApproval,
        totalWorkOrders,
        pendingWorkOrders,
        unpaidInvoices: unpaidInvoices.length,
        unpaidAmount,
        lowStockItems,
        totalRevenue,
        activeJobs
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4 py-4">
            <Briefcase className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Estimating System</h1>
          </div>
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'dashboard' && (
          <div className="p-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
              <p className="text-gray-600">Welcome to your marine business management system</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FileIcon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {loading ? '...' : stats.totalEstimates}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">Total Estimates</div>
                <div className="text-xs text-gray-500">
                  {loading ? '...' : `${stats.pendingApproval} pending approval`}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Wrench className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {loading ? '...' : stats.totalWorkOrders}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">Total Work Orders</div>
                <div className="text-xs text-gray-500">
                  {loading ? '...' : `${stats.pendingWorkOrders} pending or in progress`}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Receipt className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {loading ? '...' : stats.unpaidInvoices}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">Unpaid Invoices</div>
                <div className="text-xs text-gray-500">
                  {loading ? '...' : `$${stats.unpaidAmount.toFixed(2)} outstanding`}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {loading ? '...' : stats.lowStockItems}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">Low Stock Items</div>
                <div className="text-xs text-gray-500">Need reordering</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h2>

                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab('estimates')}
                    className="w-full flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
                  >
                    <FileIcon className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900">Create New Estimate</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('workorders')}
                    className="w-full flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left"
                  >
                    <Wrench className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-gray-900">Create Work Order</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('invoices')}
                    className="w-full flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-left"
                  >
                    <Receipt className="w-5 h-5 text-orange-600" />
                    <span className="font-medium text-gray-900">View Invoices</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-6">System Overview</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Total Revenue (Outstanding)</span>
                    <span className="text-lg font-bold text-gray-900">
                      {loading ? '...' : `$${stats.totalRevenue.toFixed(2)}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Pending Approvals</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {loading ? '...' : stats.pendingApproval}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-gray-600">Active Jobs</span>
                    <span className="text-2xl font-bold text-green-600">
                      {loading ? '...' : stats.activeJobs}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'estimates' && (
          <Estimates userId={userId} />
        )}

        {activeTab === 'workorders' && (
          <WorkOrders userId={userId} />
        )}

        {activeTab === 'invoices' && (
          <Invoices userId={userId} />
        )}

        {activeTab === 'parts' && (
          <PartsInventory userId={userId} />
        )}

        {activeTab === 'settings' && (
          <div className="p-6">
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                  <button
                    onClick={() => setSettingsSubTab('labor')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'labor'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Labor Codes
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('accounting')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'accounting'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Accounting Codes
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('taxes')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'taxes'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Taxes & Surcharges
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('packages')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'packages'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Packages
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('mercury')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'mercury'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Mercury Parts
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('marine_wholesale')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'marine_wholesale'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Marine Wholesale
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('quickbooks')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      settingsSubTab === 'quickbooks'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    QuickBooks
                  </button>
                </nav>
              </div>
            </div>

            {settingsSubTab === 'labor' && <LaborCodes userId={userId} />}
            {settingsSubTab === 'accounting' && <AccountingCodes userId={userId} />}
            {settingsSubTab === 'taxes' && <EstimateTaxSettings userId={userId} />}
            {settingsSubTab === 'packages' && <EstimatePackages userId={userId} />}
            {settingsSubTab === 'mercury' && <MercuryPartsManager userId={userId} userRole={userRole} />}
            {settingsSubTab === 'marine_wholesale' && <MarineWholesalePartsManager userId={userId} userRole={userRole} />}
            {settingsSubTab === 'quickbooks' && <QuickBooksAccountMapping />}
          </div>
        )}
      </div>
    </div>
  );
}