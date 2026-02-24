import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  ShoppingCart, ChevronDown, ChevronUp, CheckCircle, Clock, XCircle,
  Send, RotateCcw, Package, Building2, Phone, Mail, MapPin, FileText,
  Printer, AlertCircle, Layers,
} from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { useConfirm } from '../hooks/useConfirm';

interface PurchaseOrder {
  id: string;
  po_number: string;
  work_order_id: string;
  work_order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  yacht_name: string | null;
  vendor_id: string | null;
  vendor_name: string;
  vendor_contact_name: string | null;
  vendor_email: string | null;
  vendor_phone: string | null;
  vendor_address: string | null;
  vendor_city: string | null;
  vendor_state: string | null;
  vendor_zip: string | null;
  vendor_source: string;
  status: string;
  total_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  line_items?: PurchaseOrderLineItem[];
}

interface PurchaseOrderLineItem {
  id: string;
  part_number: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  received: boolean;
  received_quantity: number | null;
  line_order: number;
}

interface WorkOrderGroup {
  work_order_id: string;
  work_order_number: string;
  customer_name: string | null;
  yacht_name: string | null;
  orders: PurchaseOrder[];
  total: number;
  pendingCount: number;
  orderedCount: number;
  receivedCount: number;
}

interface PurchaseOrdersProps {
  userId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-700',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  ordered: {
    label: 'Ordered',
    color: 'bg-blue-100 text-blue-700',
    icon: <Send className="w-3.5 h-3.5" />,
  },
  partially_received: {
    label: 'Partial',
    color: 'bg-orange-100 text-orange-700',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  received: {
    label: 'Received',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

export function PurchaseOrders({ userId }: PurchaseOrdersProps) {
  const { showSuccess, showError } = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWO, setExpandedWO] = useState<string | null>(null);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  async function fetchPurchaseOrders() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          line_items:purchase_order_line_items(
            id,
            part_number,
            description,
            quantity,
            unit_cost,
            total_cost,
            received,
            received_quantity,
            line_order
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const orders = (data || []).map((po: any) => ({
        ...po,
        line_items: (po.line_items || []).sort((a: any, b: any) => a.line_order - b.line_order),
      }));

      setPurchaseOrders(orders);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(poId: string, newStatus: string) {
    try {
      setUpdatingStatus(poId);
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', poId);

      if (updateError) throw updateError;

      setPurchaseOrders(prev =>
        prev.map(po => (po.id === poId ? { ...po, status: newStatus } : po))
      );
      showSuccess(`Purchase order marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (err: any) {
      showError(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function saveNotes(poId: string) {
    try {
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ notes: notesValue, updated_at: new Date().toISOString() })
        .eq('id', poId);

      if (updateError) throw updateError;

      setPurchaseOrders(prev =>
        prev.map(po => (po.id === poId ? { ...po, notes: notesValue } : po))
      );
      setEditingNotes(null);
      showSuccess('Notes saved');
    } catch (err: any) {
      showError(err.message || 'Failed to save notes');
    }
  }

  async function toggleLineItemReceived(poId: string, lineItemId: string, received: boolean) {
    try {
      const { error: updateError } = await supabase
        .from('purchase_order_line_items')
        .update({
          received,
          received_at: received ? new Date().toISOString() : null,
        })
        .eq('id', lineItemId);

      if (updateError) throw updateError;

      setPurchaseOrders(prev =>
        prev.map(po => {
          if (po.id !== poId) return po;
          return {
            ...po,
            line_items: (po.line_items || []).map(item =>
              item.id === lineItemId ? { ...item, received } : item
            ),
          };
        })
      );
    } catch (err: any) {
      showError(err.message || 'Failed to update item');
    }
  }

  function handlePrint(po: PurchaseOrder) {
    const consolidatedItems = (po.line_items || []).reduce((acc, item) => {
      const key = `${item.part_number || ''}|${item.description}|${item.unit_cost}`;
      const existing = acc.find(i => i._key === key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.total_cost += item.total_cost;
      } else {
        acc.push({ ...item, _key: key });
      }
      return acc;
    }, [] as (typeof po.line_items[0] & { _key: string })[]);

    const lineItemRows = consolidatedItems
      .map(
        item => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.part_number || '-'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${item.unit_cost.toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${item.total_cost.toFixed(2)}</td>
      </tr>`
      )
      .join('');

    const vendorAddress = [po.vendor_address, po.vendor_city, po.vendor_state, po.vendor_zip]
      .filter(Boolean)
      .join(', ');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Purchase Order ${po.po_number}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 40px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .section { margin-bottom: 24px; }
    .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
    .total-row td { font-weight: bold; padding: 10px 12px; border-top: 2px solid #d1d5db; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
    <div>
      <h1>Purchase Order</h1>
      <div style="font-size:20px;font-weight:bold;color:#2563eb;">${po.po_number}</div>
    </div>
    <div style="text-align:right;">
      <div class="label">Work Order</div>
      <div style="font-weight:bold;">${po.work_order_number}</div>
      <div class="label" style="margin-top:8px;">Date</div>
      <div>${new Date(po.created_at).toLocaleDateString()}</div>
      <div class="label" style="margin-top:8px;">Status</div>
      <div style="text-transform:capitalize;">${po.status}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;">
    <div class="section">
      <div class="label">Vendor</div>
      <div style="font-weight:bold;font-size:15px;margin-top:4px;">${po.vendor_name}</div>
      ${po.vendor_contact_name ? `<div>${po.vendor_contact_name}</div>` : ''}
      ${po.vendor_email ? `<div>${po.vendor_email}</div>` : ''}
      ${po.vendor_phone ? `<div>${po.vendor_phone}</div>` : ''}
      ${vendorAddress ? `<div>${vendorAddress}</div>` : ''}
    </div>
    <div class="section">
      <div class="label">Customer / Vessel</div>
      <div style="font-weight:bold;font-size:15px;margin-top:4px;">${po.customer_name || '-'}</div>
      ${po.yacht_name ? `<div>Vessel: ${po.yacht_name}</div>` : ''}
      ${po.customer_email ? `<div>${po.customer_email}</div>` : ''}
      ${po.customer_phone ? `<div>${po.customer_phone}</div>` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Part #</th>
        <th>Description</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Cost</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemRows}
      <tr class="total-row">
        <td colspan="4" style="text-align:right;">Total Cost</td>
        <td style="text-align:right;">$${po.total_cost.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  ${po.notes ? `<div style="margin-top:24px;"><div class="label">Notes</div><div style="margin-top:4px;">${po.notes}</div></div>` : ''}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      w.onload = () => {
        w.focus();
        w.print();
        URL.revokeObjectURL(url);
      };
    }
  }

  const filteredOrders = purchaseOrders.filter(po => {
    if (filterStatus !== 'all' && po.status !== filterStatus) return false;
    return true;
  });

  const workOrderGroups: WorkOrderGroup[] = [];
  const seen = new Map<string, WorkOrderGroup>();

  for (const po of filteredOrders) {
    const key = po.work_order_id;
    if (!seen.has(key)) {
      const group: WorkOrderGroup = {
        work_order_id: po.work_order_id,
        work_order_number: po.work_order_number,
        customer_name: po.customer_name,
        yacht_name: po.yacht_name,
        orders: [],
        total: 0,
        pendingCount: 0,
        orderedCount: 0,
        receivedCount: 0,
      };
      seen.set(key, group);
      workOrderGroups.push(group);
    }
    const group = seen.get(key)!;
    group.orders.push(po);
    group.total += Number(po.total_cost) || 0;
    if (po.status === 'pending') group.pendingCount++;
    else if (po.status === 'ordered') group.orderedCount++;
    else if (po.status === 'received') group.receivedCount++;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <ConfirmDialog />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
          <p className="text-sm text-gray-500 mt-1">
            Grouped by work order — auto-generated when estimates are converted
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {workOrderGroups.length} work order{workOrderGroups.length !== 1 ? 's' : ''} &middot; {filteredOrders.length} POs
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 mb-6">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="ordered">Ordered</option>
          <option value="partially_received">Partially Received</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {workOrderGroups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Purchase Orders</h3>
          <p className="text-sm text-gray-500">
            Purchase orders are created automatically when estimates are converted to work orders.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workOrderGroups.map(group => {
            const isWOExpanded = expandedWO === group.work_order_id;
            const allDone = group.orders.every(o => o.status === 'received' || o.status === 'cancelled');

            return (
              <div key={group.work_order_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Work Order Header */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedWO(isWOExpanded ? null : group.work_order_id)}
                >
                  <div className="flex-shrink-0">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${allDone ? 'bg-green-50' : 'bg-blue-50'}`}>
                      <Layers className={`w-5 h-5 ${allDone ? 'text-green-600' : 'text-blue-600'}`} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-lg">{group.work_order_number}</span>
                      {allDone && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Complete
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                      {group.customer_name && (
                        <span>{group.customer_name}</span>
                      )}
                      {group.yacht_name && (
                        <span className="text-gray-400">· {group.yacht_name}</span>
                      )}
                      <span className="text-gray-400">·</span>
                      <span>{group.orders.length} purchase order{group.orders.length !== 1 ? 's' : ''}</span>
                      {group.pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          {group.pendingCount} pending
                        </span>
                      )}
                      {group.orderedCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {group.orderedCount} ordered
                        </span>
                      )}
                      {group.receivedCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          {group.receivedCount} received
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">${group.total.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">total</div>
                    </div>
                    {isWOExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* PO List inside Work Order */}
                {isWOExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
                    {group.orders.map(po => {
                      const isPOExpanded = expandedPO === po.id;
                      const statusCfg = STATUS_CONFIG[po.status] || STATUS_CONFIG.pending;
                      const allReceived = (po.line_items || []).length > 0 && (po.line_items || []).every(i => i.received);

                      return (
                        <div key={po.id} className="bg-white mx-4 my-3 rounded-lg border border-gray-200 overflow-hidden">
                          {/* PO Row Header */}
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setExpandedPO(isPOExpanded ? null : po.id)}
                          >
                            <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
                              <ShoppingCart className="w-4 h-4 text-blue-600" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900">{po.po_number}</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                                  {statusCfg.icon}
                                  {statusCfg.label}
                                </span>
                                {allReceived && !['received', 'cancelled'].includes(po.status) && (
                                  <span className="text-xs text-green-600 font-medium">All items received</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {po.vendor_name}
                                </span>
                                <span>{(po.line_items || []).length} items</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="font-bold text-gray-900">${Number(po.total_cost).toFixed(2)}</span>
                              {isPOExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </div>

                          {/* PO Expanded Details */}
                          {isPOExpanded && (
                            <div className="border-t border-gray-100">
                              {/* Vendor & Customer */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                                <div className="p-4">
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5" />
                                    Vendor
                                  </h4>
                                  <div className="space-y-1.5">
                                    <div className="font-semibold text-gray-900">{po.vendor_name}</div>
                                    {po.vendor_contact_name && (
                                      <div className="text-sm text-gray-600">{po.vendor_contact_name}</div>
                                    )}
                                    {po.vendor_email && (
                                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                                        <a href={`mailto:${po.vendor_email}`} className="hover:text-blue-600">{po.vendor_email}</a>
                                      </div>
                                    )}
                                    {po.vendor_phone && (
                                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                                        {po.vendor_phone}
                                      </div>
                                    )}
                                    {(po.vendor_address || po.vendor_city) && (
                                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                        {[po.vendor_address, po.vendor_city, po.vendor_state, po.vendor_zip].filter(Boolean).join(', ')}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="p-4">
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    Customer / Vessel
                                  </h4>
                                  <div className="space-y-1.5">
                                    {po.customer_name ? (
                                      <div className="font-semibold text-gray-900">{po.customer_name}</div>
                                    ) : (
                                      <div className="text-sm text-gray-400">No customer info</div>
                                    )}
                                    {po.yacht_name && (
                                      <div className="text-sm text-gray-600">Vessel: {po.yacht_name}</div>
                                    )}
                                    {po.customer_email && (
                                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                                        {po.customer_email}
                                      </div>
                                    )}
                                    {po.customer_phone && (
                                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                                        {po.customer_phone}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Line Items */}
                              <div className="p-4 border-t border-gray-100">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                                  <Package className="w-3.5 h-3.5" />
                                  Parts to Order
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium">Part #</th>
                                        <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium">Description</th>
                                        <th className="text-center py-2 pr-4 text-xs text-gray-500 font-medium">Qty</th>
                                        <th className="text-right py-2 pr-4 text-xs text-gray-500 font-medium">Unit Cost</th>
                                        <th className="text-right py-2 pr-4 text-xs text-gray-500 font-medium">Total</th>
                                        <th className="text-center py-2 text-xs text-gray-500 font-medium">Received</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(po.line_items || []).map(item => (
                                        <tr key={item.id} className={`border-b border-gray-50 ${item.received ? 'bg-green-50' : ''}`}>
                                          <td className="py-2.5 pr-4 font-mono text-xs text-gray-600">
                                            {item.part_number || <span className="text-gray-400">-</span>}
                                          </td>
                                          <td className="py-2.5 pr-4 text-gray-900">{item.description}</td>
                                          <td className="py-2.5 pr-4 text-center text-gray-700">{item.quantity}</td>
                                          <td className="py-2.5 pr-4 text-right text-gray-700">${item.unit_cost.toFixed(2)}</td>
                                          <td className="py-2.5 pr-4 text-right font-medium text-gray-900">${item.total_cost.toFixed(2)}</td>
                                          <td className="py-2.5 text-center">
                                            <button
                                              onClick={() => toggleLineItemReceived(po.id, item.id, !item.received)}
                                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
                                                item.received
                                                  ? 'bg-green-500 border-green-500 text-white'
                                                  : 'border-gray-300 hover:border-green-400'
                                              }`}
                                              title={item.received ? 'Mark as not received' : 'Mark as received'}
                                            >
                                              {item.received && <CheckCircle className="w-4 h-4" />}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                      <tr className="bg-gray-50">
                                        <td colSpan={4} className="py-2.5 pr-4 text-right font-semibold text-gray-900 text-sm">
                                          Total Cost
                                        </td>
                                        <td className="py-2.5 pr-4 text-right font-bold text-gray-900">
                                          ${Number(po.total_cost).toFixed(2)}
                                        </td>
                                        <td />
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Notes */}
                              <div className="p-4 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</h4>
                                  {editingNotes !== po.id && (
                                    <button
                                      onClick={() => { setEditingNotes(po.id); setNotesValue(po.notes || ''); }}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      {po.notes ? 'Edit' : 'Add Notes'}
                                    </button>
                                  )}
                                </div>
                                {editingNotes === po.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={notesValue}
                                      onChange={e => setNotesValue(e.target.value)}
                                      rows={3}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                      placeholder="Add notes..."
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => saveNotes(po.id)}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingNotes(null)}
                                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-600">
                                    {po.notes || <span className="text-gray-400 italic">No notes</span>}
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {po.status === 'pending' && (
                                    <button
                                      onClick={() => updateStatus(po.id, 'ordered')}
                                      disabled={updatingStatus === po.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      Mark as Ordered
                                    </button>
                                  )}
                                  {po.status === 'ordered' && (
                                    <button
                                      onClick={() => updateStatus(po.id, 'partially_received')}
                                      disabled={updatingStatus === po.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                                    >
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      Partially Received
                                    </button>
                                  )}
                                  {(po.status === 'pending' || po.status === 'ordered' || po.status === 'partially_received') && (
                                    <button
                                      onClick={() => updateStatus(po.id, 'received')}
                                      disabled={updatingStatus === po.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Mark as Received
                                    </button>
                                  )}
                                  {po.status === 'received' && (
                                    <button
                                      onClick={() => updateStatus(po.id, 'ordered')}
                                      disabled={updatingStatus === po.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Reopen
                                    </button>
                                  )}
                                  {po.status !== 'cancelled' && (
                                    <button
                                      onClick={async () => {
                                        const ok = await confirm({
                                          title: 'Cancel Purchase Order',
                                          message: `Are you sure you want to cancel ${po.po_number}?`,
                                          confirmText: 'Cancel PO',
                                          confirmVariant: 'danger',
                                        });
                                        if (ok) updateStatus(po.id, 'cancelled');
                                      }}
                                      disabled={updatingStatus === po.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      Cancel
                                    </button>
                                  )}
                                  {po.status === 'cancelled' && (
                                    <button
                                      onClick={() => updateStatus(po.id, 'pending')}
                                      disabled={updatingStatus === po.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Restore to Pending
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handlePrint(po)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  Print PO
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Work Order Totals footer */}
                    <div className="px-4 py-3 flex items-center justify-between text-sm">
                      <span className="text-gray-500">{group.orders.length} purchase orders for {group.work_order_number}</span>
                      <span className="font-bold text-gray-900">Total: ${group.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
