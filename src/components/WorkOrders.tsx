import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wrench, AlertCircle, Edit2, Trash2, Check, X, ChevronDown, ChevronUp, Printer, CheckCircle, XCircle } from 'lucide-react';
import { generateWorkOrderPDF } from '../utils/pdfGenerator';

interface WorkOrder {
  id: string;
  work_order_number: string;
  estimate_id: string | null;
  yacht_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  is_retail_customer: boolean;
  status: string;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  total_hours_worked: number;
  created_at: string;
  yachts?: { name: string };
  estimates?: {
    subtotal: number;
    sales_tax_rate: number;
    sales_tax_amount: number;
    shop_supplies_rate: number;
    shop_supplies_amount: number;
    park_fees_rate: number;
    park_fees_amount: number;
    surcharge_rate: number;
    surcharge_amount: number;
    total_amount: number;
    notes: string | null;
    customer_notes: string | null;
  };
}

interface WorkOrderTask {
  id: string;
  task_name: string;
  task_overview: string | null;
  task_order: number;
  apply_surcharge: boolean;
  is_completed: boolean;
  completed_at: string | null;
  lineItems: WorkOrderLineItem[];
}

interface WorkOrderLineItem {
  id: string;
  line_type: 'labor' | 'part' | 'other';
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_taxable: boolean;
  work_details: string | null;
}

interface WorkOrdersProps {
  userId: string;
}

export function WorkOrders({ userId }: WorkOrdersProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkOrder, setExpandedWorkOrder] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Record<string, WorkOrderTask[]>>({});

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: workOrdersError } = await supabase
        .from('work_orders')
        .select(`
          *,
          yachts(name),
          estimates(
            subtotal,
            sales_tax_rate,
            sales_tax_amount,
            shop_supplies_rate,
            shop_supplies_amount,
            park_fees_rate,
            park_fees_amount,
            surcharge_rate,
            surcharge_amount,
            total_amount,
            notes,
            customer_notes
          )
        `)
        .order('created_at', { ascending: false });

      if (workOrdersError) throw workOrdersError;

      setWorkOrders(data || []);
    } catch (err) {
      console.error('Error loading work orders:', err);
      setError('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkOrderTasks = async (workOrderId: string) => {
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('work_order_tasks')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('task_order');

      if (tasksError) throw tasksError;

      const tasksWithLineItems = await Promise.all(
        (tasksData || []).map(async (task) => {
          const { data: lineItems, error: lineItemsError } = await supabase
            .from('work_order_line_items')
            .select('*')
            .eq('task_id', task.id)
            .order('line_order');

          if (lineItemsError) throw lineItemsError;

          return {
            ...task,
            lineItems: lineItems || []
          };
        })
      );

      setTasks(prev => ({
        ...prev,
        [workOrderId]: tasksWithLineItems
      }));
    } catch (err) {
      console.error('Error loading work order tasks:', err);
      setError('Failed to load work order tasks');
    }
  };

  const toggleWorkOrderExpanded = async (workOrderId: string) => {
    if (expandedWorkOrder === workOrderId) {
      setExpandedWorkOrder(null);
    } else {
      setExpandedWorkOrder(workOrderId);
      if (!tasks[workOrderId]) {
        await loadWorkOrderTasks(workOrderId);
      }
    }
  };

  const handleCompleteWorkOrder = async (workOrderId: string) => {
    if (!window.confirm('Mark this work order as completed?')) {
      return;
    }

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('work_orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', workOrderId);

      if (updateError) throw updateError;

      alert('Work order marked as completed!');
      await loadWorkOrders();
    } catch (err: any) {
      console.error('Error completing work order:', err);
      setError(err.message || 'Failed to complete work order');
    }
  };

  const handleDeleteWorkOrder = async (workOrderId: string) => {
    if (!window.confirm('Are you sure you want to delete this work order? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', workOrderId);

      if (deleteError) throw deleteError;

      await loadWorkOrders();
    } catch (err) {
      console.error('Error deleting work order:', err);
      setError('Failed to delete work order');
    }
  };

  const handlePrintWorkOrder = async (workOrderId: string) => {
    try {
      setError(null);

      const { data: workOrderData, error: workOrderError } = await supabase
        .from('work_orders')
        .select(`
          *,
          yachts(name),
          estimates(
            subtotal,
            sales_tax_rate,
            sales_tax_amount,
            shop_supplies_rate,
            shop_supplies_amount,
            park_fees_rate,
            park_fees_amount,
            surcharge_rate,
            surcharge_amount,
            total_amount,
            notes,
            customer_notes
          )
        `)
        .eq('id', workOrderId)
        .single();

      if (workOrderError) throw workOrderError;

      const { data: companyInfo, error: companyError } = await supabase
        .from('company_info')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (companyError) console.warn('Could not load company info:', companyError);

      const { data: tasksData, error: tasksError } = await supabase
        .from('work_order_tasks')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('task_order');

      if (tasksError) throw tasksError;

      const tasksWithLineItems = await Promise.all(
        (tasksData || []).map(async (task) => {
          const { data: lineItemsData, error: lineItemsError } = await supabase
            .from('work_order_line_items')
            .select('*')
            .eq('task_id', task.id)
            .order('line_order');

          if (lineItemsError) throw lineItemsError;

          return {
            ...task,
            lineItems: lineItemsData || []
          };
        })
      );

      const yachtName = workOrderData.yachts?.name || null;
      const pdf = await generateWorkOrderPDF(workOrderData, tasksWithLineItems, yachtName, companyInfo);

      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (err) {
      console.error('Error printing work order:', err);
      setError('Failed to print work order');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.pending;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading work orders...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Work Orders</h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {workOrders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Work Orders Yet</h3>
          <p className="text-gray-500">Work orders will appear here when estimates are approved.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workOrders.map((workOrder) => (
            <div key={workOrder.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Wrench className="w-5 h-5 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900">{workOrder.work_order_number}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                        {workOrder.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium">Customer:</span>{' '}
                        {workOrder.is_retail_customer ? workOrder.customer_name : workOrder.yachts?.name}
                      </p>
                      {workOrder.estimates && (
                        <p>
                          <span className="font-medium">Total Amount:</span> ${workOrder.estimates.total_amount.toFixed(2)}
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Created:</span> {new Date(workOrder.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWorkOrderExpanded(workOrder.id)}
                      className="text-gray-600 hover:text-gray-800"
                      title="View details"
                    >
                      {expandedWorkOrder === workOrder.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handlePrintWorkOrder(workOrder.id)}
                      className="text-gray-600 hover:text-gray-800"
                      title="Print work order"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {workOrder.status !== 'completed' && (
                      <button
                        onClick={() => handleCompleteWorkOrder(workOrder.id)}
                        className="text-green-600 hover:text-green-800"
                        title="Mark as completed"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {workOrder.status === 'pending' && (
                      <button
                        onClick={() => handleDeleteWorkOrder(workOrder.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete work order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {expandedWorkOrder === workOrder.id && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Tasks & Line Items</h4>

                    {tasks[workOrder.id] && tasks[workOrder.id].length > 0 ? (
                      <div className="space-y-3">
                        {tasks[workOrder.id].map((task) => (
                          <div key={task.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3">
                              <div className="flex items-center gap-2">
                                {task.is_completed ? (
                                  <Check className="w-5 h-5 text-green-600" />
                                ) : (
                                  <X className="w-5 h-5 text-gray-400" />
                                )}
                                <div className="flex-1">
                                  <h5 className="font-semibold text-gray-900">{task.task_name}</h5>
                                  {task.task_overview && (
                                    <p className="text-sm text-gray-600 mt-1">{task.task_overview}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {task.lineItems.length > 0 && (
                              <div className="p-4">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {task.lineItems.map((item) => (
                                      <tr key={item.id} className="border-t">
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 uppercase">{item.line_type}</span>
                                            {item.is_taxable && (
                                              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Taxable</span>
                                            )}
                                          </div>
                                          <div className="font-medium text-gray-900">{item.description}</div>
                                          {item.work_details && (
                                            <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                                              {item.work_details}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right align-top text-gray-900">{item.quantity}</td>
                                        <td className="px-3 py-2 text-right align-top text-gray-900">${item.unit_price.toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right align-top text-gray-900">${item.total_price.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">No tasks found for this work order.</p>
                    )}

                    {workOrder.estimates && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3">Work Order Summary</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Subtotal:</span>
                              <span className="font-medium text-gray-900">${workOrder.estimates.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Sales Tax:</span>
                              <span className="text-gray-900">${workOrder.estimates.sales_tax_amount.toFixed(2)}</span>
                            </div>
                            {workOrder.estimates.shop_supplies_amount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Shop Supplies:</span>
                                <span className="text-gray-900">${workOrder.estimates.shop_supplies_amount.toFixed(2)}</span>
                              </div>
                            )}
                            {workOrder.estimates.park_fees_amount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Park Fees:</span>
                                <span className="text-gray-900">${workOrder.estimates.park_fees_amount.toFixed(2)}</span>
                              </div>
                            )}
                            {workOrder.estimates.surcharge_amount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Surcharge:</span>
                                <span className="text-gray-900">${workOrder.estimates.surcharge_amount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                              <span className="text-gray-900">Total:</span>
                              <span className="text-gray-900">${workOrder.estimates.total_amount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
