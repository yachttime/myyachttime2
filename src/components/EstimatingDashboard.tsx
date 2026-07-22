import React, { useState, useEffect } from 'react';
import { FileText, Package, Briefcase, Wrench, Settings, LayoutDashboard, Clock, DollarSign, AlertCircle, FileText as FileIcon, Receipt, ShoppingCart, TrendingUp, RefreshCw } from 'lucide-react';
import { Estimates } from './Estimates';
import { WorkOrders } from './WorkOrders';
import { Invoices } from './Invoices';
import { PartsInventory } from './PartsInventory';
import { PurchaseOrders } from './PurchaseOrders';
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
  initialInvoiceId?: string;
}

type TabType = 'dashboard' | 'estimates' | 'workorders' | 'invoices' | 'purchaseorders' | 'parts' | 'settings';

interface DashboardStats {
  totalEstimates: number;
  totalEstimatesAmount: number;
  pendingApproval: number;
  totalWorkOrders: number;
  totalWorkOrdersAmount: number;
  totalDepositsPaid: number;
  pendingWorkOrders: number;
  unpaidInvoices: number;
  unpaidAmount: number;
  processingInvoices: number;
  processingAmount: number;
  lowStockItems: number;
  activeJobs: number;
  ytdTotalSales: number;
  ytdTotalSalesCount: number;
}

export function EstimatingDashboard({ userId, initialInvoiceId }: EstimatingDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialInvoiceId ? 'invoices' : 'dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalEstimates: 0,
    totalEstimatesAmount: 0,
    pendingApproval: 0,
    totalWorkOrders: 0,
    totalWorkOrdersAmount: 0,
    totalDepositsPaid: 0,
    pendingWorkOrders: 0,
    unpaidInvoices: 0,
    unpaidAmount: 0,
    processingInvoices: 0,
    processingAmount: 0,
    lowStockItems: 0,
    activeJobs: 0,
    ytdTotalSales: 0,
    ytdTotalSalesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'estimates' as TabType, label: 'Estimates', icon: FileText },
    { id: 'workorders' as TabType, label: 'Work Orders', icon: Wrench },
    { id: 'invoices' as TabType, label: 'Invoices', icon: Receipt },
    { id: 'purchaseorders' as TabType, label: 'Purchase Orders', icon: ShoppingCart },
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

      const yearStart = `${new Date().getFullYear()}-01-01`;

      const [estimatesRes, workOrdersRes, invoicesRes, partsRes, ytdInvoicesRes, ytdYachtInvoicesRes] = await Promise.all([
        supabase.from('estimates').select('id, status, total_amount', { count: 'exact' }).neq('status', 'converted').eq('archived', false),
        supabase.from('work_orders').select('id, status, total_amount, deposit_amount, deposit_payment_status, deposit_paid_at', { count: 'exact' }).eq('archived', false),
        supabase.from('estimating_invoices').select('id, total_amount, payment_status, work_order_id', { count: 'exact' }).eq('archived', false),
        supabase.from('parts_inventory').select('id, quantity_on_hand, reorder_level', { count: 'exact' }),
        supabase.from('estimating_invoices').select('id, total_amount, payment_status').gte('created_at', yearStart),
        supabase.from('yacht_invoices').select('id, invoice_amount_numeric, payment_status').gte('created_at', yearStart),
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
      const ytdInvoices = ytdInvoicesRes.data || [];
      const ytdYachtInvoices = ytdYachtInvoicesRes.data || [];

      const totalEstimatesAmount = estimates.reduce((sum, e) => sum + (e.total_amount || 0), 0);
      const pendingApproval = estimates.filter(e => e.status === 'sent').length;
      const openWorkOrders = workOrders.filter(w =>
        w.status === 'in_progress' || w.status === 'pending'
      );
      const totalWorkOrders = openWorkOrders.length;
      const totalWorkOrdersAmount = openWorkOrders.reduce((sum, w) => sum + (w.total_amount || 0), 0);
      const totalDepositsPaid = openWorkOrders.reduce((sum, w) =>
        sum + (w.deposit_paid_at ? (w.deposit_amount || 0) : 0), 0);
      const pendingWorkOrders = openWorkOrders.filter(w => w.status === 'pending').length;
      const unpaidInvoices = invoices.filter(i => i.payment_status === 'unpaid' && (i.total_amount || 0) > 0);
      const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      const processingInvoices = invoices.filter(i => i.payment_status === 'processing' && (i.total_amount || 0) > 0);
      const processingAmount = processingInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      const lowStockItems = parts.filter(p => p.quantity_on_hand <= p.reorder_level).length;

      const activeJobs = totalWorkOrders;

      // YTD total sales: estimating invoices + yacht card invoices created this calendar year
      const ytdTotalSales =
        ytdInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) +
        ytdYachtInvoices.reduce((sum, inv) => sum + (Number(inv.invoice_amount_numeric) || 0), 0);
      const ytdTotalSalesCount = ytdInvoices.length + ytdYachtInvoices.length;

      setStats({
        totalEstimates: estimates.length,
        totalEstimatesAmount,
        pendingApproval,
        totalWorkOrders,
        totalWorkOrdersAmount,
        totalDepositsPaid,
        pendingWorkOrders,
        unpaidInvoices: unpaidInvoices.length,
        unpaidAmount,
        processingInvoices: processingInvoices.length,
        processingAmount,
        lowStockItems,
        activeJobs,
        ytdTotalSales,
        ytdTotalSalesCount,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function syncStripeStatuses() {
    try {
      setSyncing(true);
      setSyncMessage(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSyncMessage('Authentication required');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-all-invoice-statuses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        if (result.updated > 0) {
          setSyncMessage(`Synced ${result.checked} invoices, ${result.updated} updated`);
          await fetchDashboardStats();
        } else {
          setSyncMessage(`Checked ${result.checked} invoices, all up to date`);
        }
      } else {
        setSyncMessage(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing Stripe statuses:', error);
      setSyncMessage('Failed to sync with Stripe');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
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

      <div className={activeTab === 'invoices' ? '' : 'max-w-7xl mx-auto'}>
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
                <div className="text-sm font-medium text-gray-900 mb-1">Open Work Orders</div>
                <div className="text-xs text-gray-500">
                  {loading ? '...' : `${stats.pendingWorkOrders} pending`}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-orange-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Receipt className="w-6 h-6 text-orange-600" />
                  </div>
                  {!loading && (stats.unpaidInvoices + stats.processingInvoices) > 0 && (
                    <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                      Action Needed
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {loading ? '...' : stats.unpaidInvoices + stats.processingInvoices}
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">Unpaid Invoices</div>
                <div className="text-xs text-orange-600 font-semibold">
                  {loading ? '...' : `$${(stats.unpaidAmount + stats.processingAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding`}
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
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Total Sales ({new Date().getFullYear()})</span>
                      <span className="ml-2 text-xs text-gray-400">({loading ? '...' : stats.ytdTotalSalesCount} invoices)</span>
                      <p className="text-xs text-gray-400 mt-0.5">Estimating &amp; yacht card invoices</p>
                    </div>
                    <span className="text-xl font-bold text-emerald-700">
                      {loading ? '...' : `$${stats.ytdTotalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  </div>

                  {/* Unpaid invoices — prominently highlighted */}
                  <div className={`py-3 border-b rounded-lg px-3 -mx-3 ${!loading && (stats.unpaidInvoices + stats.processingInvoices) > 0 ? 'bg-orange-50 border-orange-200' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className={`w-4 h-4 ${!loading && (stats.unpaidInvoices + stats.processingInvoices) > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                        <span className={`text-sm font-semibold ${!loading && (stats.unpaidInvoices + stats.processingInvoices) > 0 ? 'text-orange-800' : 'text-gray-700'}`}>
                          Outstanding Invoices
                        </span>
                        {!loading && (stats.unpaidInvoices + stats.processingInvoices) > 0 && (
                          <span className="text-xs bg-orange-200 text-orange-800 font-bold px-2 py-0.5 rounded-full">
                            {stats.unpaidInvoices + stats.processingInvoices}
                          </span>
                        )}
                      </div>
                      <span className={`text-xl font-bold ${!loading && (stats.unpaidInvoices + stats.processingInvoices) > 0 ? 'text-orange-700' : 'text-gray-900'}`}>
                        {loading ? '...' : `$${(stats.unpaidAmount + stats.processingAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    {!loading && (stats.unpaidInvoices > 0 || stats.processingInvoices > 0) && (
                      <div className="flex gap-4 mt-1 pl-6">
                        {stats.unpaidInvoices > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                            <span className="text-xs text-orange-700">
                              {stats.unpaidInvoices} unpaid — ${stats.unpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {stats.processingInvoices > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
                            <span className="text-xs text-orange-700">
                              {stats.processingInvoices} processing — ${stats.processingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {!loading && stats.unpaidInvoices === 0 && stats.processingInvoices === 0 && (
                      <p className="text-xs text-green-600 pl-6">All invoices paid</p>
                    )}
                    <div className="mt-3 pl-6 flex items-center gap-3">
                      <button
                        onClick={syncStripeStatuses}
                        disabled={syncing || loading}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Stripe Statuses'}
                      </button>
                      {syncMessage && (
                        <span className="text-xs text-gray-600">{syncMessage}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <span className="text-sm text-gray-600">Total Estimates</span>
                      <span className="ml-2 text-xs text-gray-400">({loading ? '...' : stats.totalEstimates})</span>
                    </div>
                    <span className="text-lg font-bold text-blue-700">
                      {loading ? '...' : `$${stats.totalEstimatesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  </div>

                  <div className="py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600">Open Work Orders</span>
                        <span className="ml-2 text-xs text-gray-400">({loading ? '...' : stats.totalWorkOrders})</span>
                      </div>
                      <span className="text-lg font-bold text-green-700">
                        {loading ? '...' : `$${stats.totalWorkOrdersAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    {!loading && stats.totalDepositsPaid > 0 && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500 pl-2">Less deposits paid</span>
                        <span className="text-sm font-medium text-red-600">
                          -${stats.totalDepositsPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ${(stats.totalWorkOrdersAmount - stats.totalDepositsPaid).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
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
          <Invoices userId={userId} initialInvoiceId={initialInvoiceId} />
        )}

        {activeTab === 'purchaseorders' && (
          <PurchaseOrders userId={userId} />
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