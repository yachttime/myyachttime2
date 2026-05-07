import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Search, Printer, Mail, DollarSign, Eye, CheckCircle, Clock, XCircle, ExternalLink, Archive, RotateCcw, RefreshCw, X, Copy, CreditCard, AlertCircle, MousePointer, Download, FileText, BarChart2, Users, ChevronDown, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Toast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { TaxSurchargeReport } from './TaxSurchargeReport';

interface InvoicesProps {
  userId: string;
  initialInvoiceId?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  payment_status: string;
  quickbooks_status: string;
  quickbooks_export_status: string | null;
  quickbooks_invoice_id: string | null;
  quickbooks_export_date: string | null;
  quickbooks_export_error: string | null;
  work_order_id: string | null;
  work_order_number?: string;
  yacht_id: string | null;
  yacht_name?: string;
  created_at: string;
  notes: string | null;
  deposit_applied: number | null;
  balance_due: number | null;
  payment_link: string | null;
  payment_link_created_at: string | null;
  payment_email_sent_at: string | null;
  payment_email_recipient: string | null;
  payment_email_all_recipients: string[] | null;
  payment_email_delivered_at: string | null;
  payment_email_opened_at: string | null;
  payment_email_clicked_at: string | null;
  payment_email_bounced_at: string | null;
  stripe_payment_intent_id: string | null;
  payment_method_type: string | null;
  paid_at: string | null;
  payment_confirmation_email_sent_at: string | null;
  email_open_count: number | null;
  email_click_count: number | null;
  amount_paid: number | null;
  final_payment_link_url: string | null;
  final_payment_link_expires_at: string | null;
  final_payment_email_sent_at: string | null;
  final_payment_email_recipient: string | null;
  final_payment_email_all_recipients: string[] | null;
  final_payment_email_delivered_at: string | null;
  final_payment_email_opened_at: string | null;
  final_payment_email_clicked_at: string | null;
  final_payment_email_bounced_at: string | null;
  final_payment_method_type: string | null;
  final_payment_paid_at: string | null;
  final_payment_confirmation_email_sent_at: string | null;
  final_payment_stripe_checkout_session_id: string | null;
  final_payment_stripe_payment_intent_id: string | null;
  final_payment_resend_email_id: string | null;
  credit_card_fee: number | null;
  shop_supplies_amount: number | null;
  park_fees_amount: number | null;
  surcharge_amount: number | null;
  discount_percentage: number | null;
  discount_amount: number | null;
  manager_name?: string | null;
  company_id?: string | null;
  repair_request_id?: string | null;
  repair_request_status?: string | null;
  repair_request_deposit_status?: string | null;
}

interface WorkOrderTask {
  id: string;
  task_name: string;
  task_overview: string;
  task_order: number;
  apply_surcharge: boolean;
}

interface WorkOrderLineItem {
  id: string;
  task_id: string;
  line_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_taxable: boolean;
  line_order: number;
  work_details: string | null;
  assigned_employee_id: string | null;
  time_entry_sent_at: string | null;
  time_entry_id: string | null;
  employee_name?: string | null;
}

export function Invoices({ userId, initialInvoiceId }: InvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [invoiceToArchive, setInvoiceToArchive] = useState<string | null>(null);
  const [workOrderTasks, setWorkOrderTasks] = useState<WorkOrderTask[]>([]);
  const [workOrderLineItems, setWorkOrderLineItems] = useState<WorkOrderLineItem[]>([]);
  const [estimatingLineItems, setEstimatingLineItems] = useState<WorkOrderLineItem[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [syncPaymentLoading, setSyncPaymentLoading] = useState(false);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<{ synced: number; total: number } | null>(null);
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [emailPrompt, setEmailPrompt] = useState<{ invoice: Invoice; email: string; emailOnly?: boolean } | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalInvoice, setEmailModalInvoice] = useState<Invoice | null>(null);
  const [billingManagers, setBillingManagers] = useState<{ email: string; name: string }[]>([]);
  const [billingManagersLoading, setBillingManagersLoading] = useState(false);
  const [sendingEmailModal, setSendingEmailModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [checkPaymentModal, setCheckPaymentModal] = useState(false);
  const [checkPaymentLoading, setCheckPaymentLoading] = useState(false);
  const [fixDepositLoading, setFixDepositLoading] = useState(false);
  const [checkForm, setCheckForm] = useState({ checkNumber: '', amount: '', depositAccount: '', notes: '' });
  const [invoiceCheckPayments, setInvoiceCheckPayments] = useState<{ id: string; reference_number: string; amount: number; payment_date: string; notes: string | null }[]>([]);
  const [qbBankAccounts, setQbBankAccounts] = useState<{ qbo_account_id: string; account_name: string; account_number: string | null }[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();
  const [showTaxReport, setShowTaxReport] = useState(false);
  const [surchargeCcEmail, setSurchargeCcEmail] = useState('');
  const [surchargeCcNote, setSurchargeCcNote] = useState('');
  const [surchargeCcEnabled, setSurchargeCcEnabled] = useState(false);
  const [paymentMethodModal, setPaymentMethodModal] = useState<{ invoice: Invoice; email: string; mode: 'generate' | 'regenerate'; allRecipients?: string[] } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'ach' | 'both'>('card');
  const [editableRecipients, setEditableRecipients] = useState<string[]>([]);
  const [newRecipientInput, setNewRecipientInput] = useState('');
  const [invoiceEmployees, setInvoiceEmployees] = useState<Record<string, string[]>>({});
  const [invoiceSentEmployees, setInvoiceSentEmployees] = useState<Record<string, Set<string>>>({});
  const [invoiceHasUnassigned, setInvoiceHasUnassigned] = useState<Record<string, boolean>>({});
  const [assignModal, setAssignModal] = useState<{ invoiceId: string; workOrderId: string } | null>(null);
  const [assignModalTasks, setAssignModalTasks] = useState<any[]>([]);
  const [assignModalEmployees, setAssignModalEmployees] = useState<{ user_id: string; first_name: string; last_name: string }[]>([]);
  const [assignModalLoading, setAssignModalLoading] = useState(false);
  const [sendingToTimeClock, setSendingToTimeClock] = useState<Record<string, boolean>>({});
  const [showPaidInvoiceEmailModal, setShowPaidInvoiceEmailModal] = useState(false);
  const [paidInvoiceEmailTarget, setPaidInvoiceEmailTarget] = useState<Invoice | null>(null);
  const [paidInvoiceEmailRecipient, setPaidInvoiceEmailRecipient] = useState('');
  const [paidInvoiceEmailAdditional, setPaidInvoiceEmailAdditional] = useState('');
  const [sendingPaidInvoiceEmail, setSendingPaidInvoiceEmail] = useState(false);
  const [qbExporting, setQbExporting] = useState<Record<string, boolean>>({});
  const [qbConnection, setQbConnection] = useState<{ is_active: boolean } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    invoice_date: string;
    due_date: string;
    notes: string;
    shop_supplies_amount: string;
    park_fees_amount: string;
    surcharge_amount: string;
    tax_rate: string;
  }>({ customer_name: '', customer_email: '', customer_phone: '', invoice_date: '', due_date: '', notes: '', shop_supplies_amount: '', park_fees_amount: '', surcharge_amount: '', tax_rate: '' });
  const [editLineItems, setEditLineItems] = useState<Array<WorkOrderLineItem & { _deleted?: boolean; _new?: boolean; task_name?: string | null }>>([]);
  const [editSaving, setEditSaving] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchQbBankAccounts();
    fetchQbConnection();
  }, []);

  useEffect(() => {
    if (initialInvoiceId && invoices.length > 0) {
      const target = invoices.find(inv => inv.id === initialInvoiceId);
      if (target) {
        handleViewInvoice(target);
      }
    }
  }, [initialInvoiceId, invoices]);

  async function fetchQbBankAccounts() {
    const { data } = await supabase
      .from('quickbooks_accounts')
      .select('qbo_account_id, account_name, account_number')
      .eq('account_type', 'Bank')
      .eq('active', true)
      .order('account_number');
    if (data) setQbBankAccounts(data);
  }

  async function fetchQbConnection() {
    const { data } = await supabase
      .from('quickbooks_connection')
      .select('is_active')
      .eq('is_active', true)
      .maybeSingle();
    setQbConnection(data);
  }

  async function handleQbExport(invoice: Invoice) {
    const encryptedSession = localStorage.getItem('quickbooks_encrypted_session');
    if (!encryptedSession) {
      showToast('QuickBooks session not found. Please go to QuickBooks settings and reconnect.', 'error');
      return;
    }

    setQbExporting(prev => ({ ...prev, [invoice.id]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/quickbooks-push-estimating-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Apikey': anonKey,
        },
        body: JSON.stringify({ invoiceId: invoice.id, encrypted_session: encryptedSession }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to export to QuickBooks');
      }

      if (result.encrypted_session) {
        localStorage.setItem('quickbooks_encrypted_session', result.encrypted_session);
      }

      showToast(`Invoice ${invoice.invoice_number} exported to QuickBooks successfully`, 'success');
      await fetchInvoices();
    } catch (err: any) {
      showToast(err.message || 'Failed to export to QuickBooks', 'error');
    } finally {
      setQbExporting(prev => ({ ...prev, [invoice.id]: false }));
    }
  }

  async function fetchInvoices() {
    try {
      setLoading(true);
      setFetchError(null);
      const { data, error } = await supabase
        .from('estimating_invoices')
        .select(`
          *,
          work_orders!estimating_invoices_work_order_id_fkey(work_order_number, work_title, vessel_id, customer_vessels(vessel_name, manufacturer, model), estimates!work_orders_estimate_id_fkey(manager_name)),
          yachts!estimating_invoices_yacht_id_fkey(name, manufacturer, model),
          repair_requests!repair_requests_estimating_invoice_id_fkey(id, status, deposit_payment_status, deposit_amount, deposit_paid_at, deposit_payment_method_type)
        `)
        .eq('archived', false)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const formattedInvoices = data?.map(inv => {
        const rr = (inv as any).repair_requests;
        return {
          ...inv,
          work_order_number: inv.work_orders?.work_order_number,
          work_title: inv.work_orders?.work_title,
          yacht_name: inv.yachts?.name,
          yacht_manufacturer: inv.yachts?.manufacturer,
          yacht_model: inv.yachts?.model,
          vessel_name: inv.work_orders?.customer_vessels?.vessel_name,
          vessel_manufacturer: inv.work_orders?.customer_vessels?.manufacturer,
          vessel_model: inv.work_orders?.customer_vessels?.model,
          manager_name: inv.work_orders?.estimates?.manager_name || null,
          repair_request_id: rr?.id || null,
          repair_request_status: rr?.status || null,
          repair_request_deposit_status: rr?.deposit_payment_status || null,
          repair_request_deposit_amount: rr?.deposit_amount || null,
          repair_request_deposit_paid_at: rr?.deposit_paid_at || null,
          repair_request_deposit_method: rr?.deposit_payment_method_type || null,
        };
      }) || [];

      setInvoices(formattedInvoices);
      await fetchInvoiceEmployees(formattedInvoices.map(inv => ({ id: inv.id, work_order_id: inv.work_order_id })));
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      setFetchError(error?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvoiceEmployees(invoiceList: { id: string; work_order_id: string | null }[]) {
    const workOrderIds = invoiceList.map(inv => inv.work_order_id).filter(Boolean) as string[];
    if (workOrderIds.length === 0) return;

    const { data: tasks } = await supabase
      .from('work_order_tasks')
      .select('id, work_order_id')
      .in('work_order_id', workOrderIds);

    if (!tasks || tasks.length === 0) return;

    const taskIds = tasks.map(t => t.id);
    const [assignmentsResult, lineItemsResult] = await Promise.all([
      supabase
        .from('work_order_task_assignments')
        .select('task_id, employee_id, user_profiles!work_order_task_assignments_employee_id_fkey(first_name, last_name)')
        .in('task_id', taskIds),
      supabase
        .from('work_order_line_items')
        .select('task_id, line_type, time_entry_sent_at, assigned_employee_id, user_profiles!work_order_line_items_assigned_employee_id_fkey(first_name, last_name)')
        .in('task_id', taskIds)
    ]);

    const assignments = assignmentsResult.data || [];
    const lineItems = lineItemsResult.data || [];

    const taskToWO: Record<string, string> = {};
    tasks.forEach(t => { taskToWO[t.id] = t.work_order_id; });

    const woEmpMap: Record<string, string[]> = {};
    (assignments as any[]).forEach(a => {
      const woId = taskToWO[a.task_id];
      if (!woId) return;
      const name = a.user_profiles
        ? `${a.user_profiles.first_name} ${a.user_profiles.last_name}`.trim()
        : '';
      if (!name) return;
      if (!woEmpMap[woId]) woEmpMap[woId] = [];
      if (!woEmpMap[woId].includes(name)) woEmpMap[woId].push(name);
    });

    const taskAssignmentNames: Record<string, string[]> = {};
    (assignments as any[]).forEach(a => {
      if (!a.user_profiles) return;
      const name = `${a.user_profiles.first_name} ${a.user_profiles.last_name}`.trim();
      if (!name) return;
      if (!taskAssignmentNames[a.task_id]) taskAssignmentNames[a.task_id] = [];
      if (!taskAssignmentNames[a.task_id].includes(name)) taskAssignmentNames[a.task_id].push(name);
    });

    const woSentMap: Record<string, Set<string>> = {};
    (lineItems as any[]).forEach(li => {
      if (li.line_type === 'labor' && li.time_entry_sent_at) {
        const woId = taskToWO[li.task_id];
        if (!woId) return;
        if (!woSentMap[woId]) woSentMap[woId] = new Set();
        if (li.user_profiles) {
          const name = `${li.user_profiles.first_name} ${li.user_profiles.last_name}`.trim();
          if (name) woSentMap[woId].add(name);
        } else {
          (taskAssignmentNames[li.task_id] || []).forEach(name => woSentMap[woId].add(name));
        }
      }
    });

    const assignedTaskIds = new Set(assignments.map((a: any) => a.task_id));
    const tasksWithItemsIds = new Set(lineItems.map((li: any) => li.task_id));
    const woUnassignedMap: Record<string, boolean> = {};
    tasksWithItemsIds.forEach(taskId => {
      if (!assignedTaskIds.has(taskId)) {
        const woId = taskToWO[taskId as string];
        if (woId) woUnassignedMap[woId] = true;
      }
    });

    const invEmpMap: Record<string, string[]> = {};
    const invSentMap: Record<string, Set<string>> = {};
    const invUnassignedMap: Record<string, boolean> = {};
    invoiceList.forEach(inv => {
      if (inv.work_order_id) {
        if (woEmpMap[inv.work_order_id]) invEmpMap[inv.id] = woEmpMap[inv.work_order_id];
        if (woSentMap[inv.work_order_id]) invSentMap[inv.id] = woSentMap[inv.work_order_id];
        if (woUnassignedMap[inv.work_order_id]) invUnassignedMap[inv.id] = true;
      }
    });
    setInvoiceEmployees(invEmpMap);
    setInvoiceSentEmployees(invSentMap);
    setInvoiceHasUnassigned(invUnassignedMap);
  }

  async function openAssignModal(invoiceId: string, workOrderId: string) {
    setAssignModal({ invoiceId, workOrderId });
    setAssignModalLoading(true);
    try {
      const [tasksResult, employeesResult] = await Promise.all([
        supabase
          .from('work_order_tasks')
          .select('id, task_name, task_order')
          .eq('work_order_id', workOrderId)
          .order('task_order'),
        supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name')
          .in('role', ['staff', 'mechanic'])
          .eq('is_active', true)
          .order('first_name')
      ]);

      const taskList = tasksResult.data || [];
      const taskIds = taskList.map(t => t.id);

      const [lineItemsResult, assignmentsResult] = await Promise.all([
        supabase
          .from('work_order_line_items')
          .select('id, task_id, line_type, description, quantity, unit_price, assigned_employee_id, time_entry_sent_at, user_profiles!work_order_line_items_assigned_employee_id_fkey(first_name, last_name)')
          .in('task_id', taskIds)
          .order('line_order'),
        supabase
          .from('work_order_task_assignments')
          .select('task_id, employee_id, user_profiles!work_order_task_assignments_employee_id_fkey(first_name, last_name)')
          .in('task_id', taskIds)
      ]);

      const lineItems = lineItemsResult.data || [];
      const assignments = assignmentsResult.data || [];

      const assignmentsByTask: Record<string, { employee_id: string; name: string }[]> = {};
      (assignments as any[]).forEach(a => {
        if (!assignmentsByTask[a.task_id]) assignmentsByTask[a.task_id] = [];
        const name = a.user_profiles ? `${a.user_profiles.first_name} ${a.user_profiles.last_name}`.trim() : '';
        assignmentsByTask[a.task_id].push({ employee_id: a.employee_id, name });
      });

      const enrichedTasks = taskList.map(task => ({
        ...task,
        assignments: assignmentsByTask[task.id] || [],
        laborItems: (lineItems as any[]).filter(li => li.task_id === task.id && li.line_type === 'labor')
      }));

      setAssignModalTasks(enrichedTasks);
      setAssignModalEmployees(employeesResult.data || []);
    } finally {
      setAssignModalLoading(false);
    }
  }

  async function handleAssignEmployee(taskId: string, employeeId: string, invoiceId: string, workOrderId: string) {
    const { data: existing } = await supabase
      .from('work_order_task_assignments')
      .select('id')
      .eq('task_id', taskId)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (!existing) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('work_order_task_assignments').insert({
        task_id: taskId,
        employee_id: employeeId,
        assigned_by: user?.id,
        company_id: invoices.find(inv => inv.id === invoiceId)?.company_id
      });
    }

    await openAssignModal(invoiceId, workOrderId);
    await fetchInvoiceEmployees(invoices.map(inv => ({ id: inv.id, work_order_id: inv.work_order_id })));
  }

  async function handleRemoveAssignment(taskId: string, employeeId: string, invoiceId: string, workOrderId: string) {
    await supabase
      .from('work_order_task_assignments')
      .delete()
      .eq('task_id', taskId)
      .eq('employee_id', employeeId);

    await openAssignModal(invoiceId, workOrderId);
    await fetchInvoiceEmployees(invoices.map(inv => ({ id: inv.id, work_order_id: inv.work_order_id })));
  }

  async function handlePushToTimeClock(lineItemId: string, invoiceId: string, workOrderId: string, taskAssignments: { employee_id: string }[]) {
    setSendingToTimeClock(prev => ({ ...prev, [lineItemId]: true }));
    try {
      const workDate = new Date().toISOString().split('T')[0];
      if (taskAssignments.length > 1) {
        const empCount = taskAssignments.length;
        const { data: liData } = await supabase.from('work_order_line_items').select('quantity').eq('id', lineItemId).maybeSingle();
        const hours = liData?.quantity || 0;
        const hoursEach = hours / empCount;
        for (let i = 0; i < empCount; i++) {
          const { data, error: rpcError } = await supabase.rpc('send_assigned_labor_to_time_clock', {
            p_line_item_id: lineItemId,
            p_work_date: workDate,
            p_created_by: userId,
            p_hours_override: hoursEach,
            p_employee_override: taskAssignments[i].employee_id,
            p_mark_sent: i === empCount - 1
          });
          if (rpcError) throw rpcError;
          if (!data.success) throw new Error(data.error || 'Failed');
        }
      } else {
        const employeeOverride = taskAssignments[0]?.employee_id;
        const { data, error: rpcError } = await supabase.rpc('send_assigned_labor_to_time_clock', {
          p_line_item_id: lineItemId,
          p_work_date: workDate,
          p_created_by: userId,
          ...(employeeOverride ? { p_employee_override: employeeOverride } : {})
        });
        if (rpcError) throw rpcError;
        if (!data.success) throw new Error(data.error || 'Failed to send hours');
      }

      showToast('Hours pushed to time clock successfully');
      await openAssignModal(invoiceId, workOrderId);
      await fetchInvoiceEmployees(invoices.map(inv => ({ id: inv.id, work_order_id: inv.work_order_id })));
    } catch (err: any) {
      showToast(err.message || 'Failed to push hours to time clock', 'error');
    } finally {
      setSendingToTimeClock(prev => ({ ...prev, [lineItemId]: false }));
    }
  }

  async function fetchArchivedInvoices() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('estimating_invoices')
        .select(`
          *,
          work_orders!estimating_invoices_work_order_id_fkey(work_order_number, work_title, vessel_id, customer_vessels(vessel_name, manufacturer, model), estimates(manager_name)),
          yachts!estimating_invoices_yacht_id_fkey(name, manufacturer, model),
          repair_requests!repair_requests_estimating_invoice_id_fkey(id, status, deposit_payment_status, deposit_amount, deposit_paid_at, deposit_payment_method_type)
        `)
        .eq('archived', true)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const formattedInvoices = data?.map(inv => {
        const rr = (inv as any).repair_requests;
        return {
          ...inv,
          work_order_number: inv.work_orders?.work_order_number,
          work_title: inv.work_orders?.work_title,
          yacht_name: inv.yachts?.name,
          yacht_manufacturer: inv.yachts?.manufacturer,
          yacht_model: inv.yachts?.model,
          vessel_name: inv.work_orders?.customer_vessels?.vessel_name,
          vessel_manufacturer: inv.work_orders?.customer_vessels?.manufacturer,
          vessel_model: inv.work_orders?.customer_vessels?.model,
          manager_name: inv.work_orders?.estimates?.manager_name || null,
          repair_request_id: rr?.id || null,
          repair_request_status: rr?.status || null,
          repair_request_deposit_status: rr?.deposit_payment_status || null,
          repair_request_deposit_amount: rr?.deposit_amount || null,
          repair_request_deposit_paid_at: rr?.deposit_paid_at || null,
          repair_request_deposit_method: rr?.deposit_payment_method_type || null,
        };
      }) || [];

      setInvoices(formattedInvoices);
      await fetchInvoiceEmployees(formattedInvoices.map(inv => ({ id: inv.id, work_order_id: inv.work_order_id })));
    } catch (error) {
      console.error('Error fetching archived invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleArchiveClick = (invoiceId: string) => {
    setInvoiceToArchive(invoiceId);
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = async () => {
    if (!invoiceToArchive) return;

    setShowArchiveModal(false);

    try {
      const { error } = await supabase
        .from('estimating_invoices')
        .update({ archived: true })
        .eq('id', invoiceToArchive);

      if (error) throw error;

      await fetchInvoices();
      setInvoiceToArchive(null);
    } catch (error) {
      console.error('Error archiving invoice:', error);
    }
  };

  const handleRestoreInvoice = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('estimating_invoices')
        .update({ archived: false })
        .eq('id', invoiceId);

      if (error) throw error;

      await fetchArchivedInvoices();
    } catch (error) {
      console.error('Error restoring invoice:', error);
    }
  };

  async function fetchWorkOrderDetails(workOrderId: string) {
    try {
      const [tasksResult, lineItemsResult] = await Promise.all([
        supabase
          .from('work_order_tasks')
          .select('*')
          .eq('work_order_id', workOrderId)
          .order('task_order'),
        supabase
          .from('work_order_line_items')
          .select('*, user_profiles!work_order_line_items_assigned_employee_id_fkey(first_name, last_name)')
          .eq('work_order_id', workOrderId)
          .order('line_order')
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (lineItemsResult.error) throw lineItemsResult.error;

      const tasks = tasksResult.data || [];
      const taskIds = tasks.map((t: any) => t.id);

      let assignmentsByTask: Record<string, string[]> = {};
      if (taskIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('work_order_task_assignments')
          .select('task_id, user_profiles!work_order_task_assignments_employee_id_fkey(first_name, last_name)')
          .in('task_id', taskIds);
        (assignmentsData || []).forEach((a: any) => {
          if (!assignmentsByTask[a.task_id]) assignmentsByTask[a.task_id] = [];
          if (a.user_profiles) {
            assignmentsByTask[a.task_id].push(`${a.user_profiles.first_name} ${a.user_profiles.last_name}`.trim());
          }
        });
      }

      setWorkOrderTasks(tasks);
      const lineItemsWithNames = (lineItemsResult.data || []).map((item: WorkOrderLineItem & { user_profiles?: { first_name: string; last_name: string } | null }) => {
        const lineEmployee = item.user_profiles
          ? `${item.user_profiles.first_name} ${item.user_profiles.last_name}`
          : null;
        const taskEmployees = assignmentsByTask[item.task_id] || [];
        return {
          ...item,
          employee_name: lineEmployee || (taskEmployees.length > 0 ? taskEmployees.join(', ') : null)
        };
      });
      setWorkOrderLineItems(lineItemsWithNames);
    } catch (error) {
      console.error('Error fetching work order details:', error);
      setWorkOrderTasks([]);
      setWorkOrderLineItems([]);
    }
  }

  async function fetchEstimatingLineItems(invoiceId: string) {
    try {
      const { data } = await supabase
        .from('estimating_invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('line_order');
      const items: WorkOrderLineItem[] = (data || []).map((item: any) => ({
        id: item.id,
        task_id: item.task_id || '',
        line_type: item.line_type,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.total_price),
        is_taxable: item.is_taxable,
        line_order: item.line_order,
        work_details: item.work_details || null,
        assigned_employee_id: null,
        time_entry_sent_at: null,
        time_entry_id: null,
        employee_name: null,
        task_name: item.task_name || null,
      }));
      setEstimatingLineItems(items);
    } catch (error) {
      console.error('Error fetching estimating line items:', error);
      setEstimatingLineItems([]);
    }
  }

  async function fetchInvoiceCheckPayments(invoiceId: string) {
    const { data } = await supabase
      .from('estimating_payments')
      .select('id, reference_number, amount, payment_date, notes')
      .eq('invoice_id', invoiceId)
      .eq('payment_method', 'check')
      .order('payment_date', { ascending: true });
    setInvoiceCheckPayments(data ?? []);
  }

  async function handleViewInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setShowDetails(true);
    setInvoiceCheckPayments([]);
    setEstimatingLineItems([]);

    await Promise.all([
      invoice.work_order_id ? fetchWorkOrderDetails(invoice.work_order_id) : Promise.resolve(),
      fetchInvoiceCheckPayments(invoice.id),
      fetchEstimatingLineItems(invoice.id),
    ]);

    if (!invoice.work_order_id) {
      setWorkOrderTasks([]);
      setWorkOrderLineItems([]);
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.work_order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.yacht_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const isNotBilled = invoice.payment_status === 'unpaid' && !invoice.final_payment_link_url && !invoice.payment_link;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'not_billed' ? isNotBilled : invoice.payment_status === statusFilter && !(statusFilter === 'unpaid' && isNotBilled));

    return matchesSearch && matchesStatus;
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-orange-100 text-orange-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'overdue':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4" />;
      case 'partial':
        return <Clock className="w-4 h-4" />;
      case 'unpaid':
      case 'overdue':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  }

  function handleViewDetails(invoice: Invoice) {
    handleViewInvoice(invoice);
  }

  async function handleSendEmail(invoice: Invoice) {
    const resolvedEmail = await resolveInvoiceEmail(invoice);
    if (!resolvedEmail) {
      showToast('No email address on file for this customer', 'error');
      return;
    }

    const confirmed = await confirm({
      title: 'Send Invoice',
      message: `Send invoice ${invoice.invoice_number} to ${resolvedEmail}?`,
      confirmText: 'Send',
      variant: 'info'
    });

    if (confirmed) {
      showToast('Email functionality will be implemented', 'info');
    }
  }

  async function handlePrintInvoice(invoice: Invoice) {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
      });

      const pageWidth = 8.5;
      const margin = 0.75;
      let yPos = margin;

      // Fetch company info
      const { data: companyInfo } = await supabase
        .from('company_info')
        .select('*')
        .maybeSingle();

      // Add logo if available
      let logoAdded = false;
      let logoWidth = 0;
      let logoHeight = 0;

      if (companyInfo?.logo_url) {
        try {
          const logoResponse = await fetch(companyInfo.logo_url);
          const logoBlob = await logoResponse.blob();

          await new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              try {
                const base64data = reader.result as string;

                const img = new Image();
                img.onload = () => {
                  try {
                    const maxLogoWidth = 1.8;
                    const maxLogoHeight = 1.3;

                    const aspectRatio = img.width / img.height;
                    logoWidth = maxLogoWidth;
                    logoHeight = logoWidth / aspectRatio;

                    if (logoHeight > maxLogoHeight) {
                      logoHeight = maxLogoHeight;
                      logoWidth = logoHeight * aspectRatio;
                    }

                    doc.addImage(base64data, 'PNG', margin, yPos, logoWidth, logoHeight);
                    logoAdded = true;
                    resolve();
                  } catch (err) {
                    console.warn('Could not add logo to PDF:', err);
                    resolve();
                  }
                };
                img.onerror = () => {
                  console.warn('Could not load logo image');
                  resolve();
                };
                img.src = base64data;
              } catch (err) {
                console.warn('Could not process logo:', err);
                resolve();
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(logoBlob);
          });
        } catch (err) {
          console.warn('Could not load logo for PDF:', err);
        }
      }

      // Company information next to logo or centered
      if (logoAdded) {
        const companyInfoX = margin + logoWidth + 0.15;
        const originalYPos = yPos;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(companyInfo?.company_name || 'AZ Marine', companyInfoX, yPos);
        yPos += 0.13;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        if (companyInfo?.address_line1) {
          doc.text(companyInfo.address_line1, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.address_line2) {
          doc.text(companyInfo.address_line2, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
          const cityStateZip = [
            companyInfo?.city,
            companyInfo?.state,
            companyInfo?.zip_code
          ].filter(Boolean).join(', ');
          doc.text(cityStateZip, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.phone) {
          doc.text(`Phone: ${companyInfo.phone}`, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.email) {
          doc.text(`Email: ${companyInfo.email}`, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.website) {
          doc.text(`Web: ${companyInfo.website}`, companyInfoX, yPos);
          yPos += 0.11;
        }

        yPos = Math.max(yPos, originalYPos + logoHeight);
        yPos += 0.15;
      } else {
        if (companyInfo?.company_name) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(companyInfo.company_name, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.15;
        } else {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('AZ Marine', pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.15;
        }

        if (companyInfo?.address_line1) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(companyInfo.address_line1, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.12;
        }

        if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
          const cityStateZip = [
            companyInfo?.city,
            companyInfo?.state,
            companyInfo?.zip_code
          ].filter(Boolean).join(', ');
          doc.text(cityStateZip, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.12;
        }

        if (companyInfo?.phone) {
          doc.text(`Phone: ${companyInfo.phone}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.12;
        }

        if (companyInfo?.email) {
          doc.text(`Email: ${companyInfo.email}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.12;
        }

        yPos += 0.15;
      }

      // Draw separator line
      doc.setLineWidth(0.01);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 0.2;

      // Invoice header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Invoice #: ${invoice.invoice_number}`, margin, yPos);

      // Status on right side
      const status = invoice.payment_status.toUpperCase();
      const statusWidth = doc.getTextWidth(status);
      doc.text(status, pageWidth - margin - statusWidth, yPos);
      yPos += 0.3;

      // Invoice details and customer info side by side
      const leftColX = margin;
      const rightColX = pageWidth / 2 + 0.25;
      const leftStartY = yPos;

      // Left column - Invoice Details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Details', leftColX, yPos);
      yPos += 0.18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, leftColX, yPos);
      yPos += 0.14;
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, leftColX, yPos);
      yPos += 0.14;

      if (invoice.work_order_number) {
        doc.text(`Work Order: ${invoice.work_order_number}`, leftColX, yPos);
        yPos += 0.14;
      }

      // Right column - Customer Information
      yPos = leftStartY;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Customer Information', rightColX, yPos);
      yPos += 0.18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(invoice.customer_name, rightColX, yPos);
      yPos += 0.14;

      if (invoice.customer_email) {
        doc.text(invoice.customer_email, rightColX, yPos);
        yPos += 0.14;
      }

      if (invoice.customer_phone) {
        doc.text(invoice.customer_phone, rightColX, yPos);
        yPos += 0.14;
      }

      if (invoice.yacht_name) {
        doc.text(`Yacht: ${invoice.yacht_name}`, rightColX, yPos);
        yPos += 0.14;
      }

      yPos = Math.max(yPos, leftStartY + 0.6);
      yPos += 0.2;

      // Line items table - prefer work order line items, fall back to estimating invoice line items
      const hasWorkOrderItems = workOrderTasks.length > 0 && workOrderLineItems.length > 0;
      const hasEstimatingItems = estimatingLineItems.length > 0;

      if (hasWorkOrderItems || hasEstimatingItems) {
        const tableData: any[] = [];

        if (hasWorkOrderItems) {
          workOrderTasks.forEach(task => {
            const taskItems = workOrderLineItems.filter(item => item.task_id === task.id);
            if (taskItems.length > 0) {
              tableData.push([
                { content: task.task_name, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
              ]);
              taskItems.forEach(item => {
                tableData.push([
                  item.line_type.toUpperCase(),
                  item.description + (item.work_details ? '\n' + item.work_details : ''),
                  item.quantity.toString(),
                  `$${item.unit_price.toFixed(2)}`,
                  `$${item.total_price.toFixed(2)}`
                ]);
              });
            }
          });
        } else {
          let lastTaskName = '';
          estimatingLineItems.forEach((item: any) => {
            const taskName = item.task_name || '';
            if (taskName && taskName !== lastTaskName) {
              tableData.push([
                { content: taskName, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
              ]);
              lastTaskName = taskName;
            }
            tableData.push([
              item.line_type.toUpperCase(),
              item.description + (item.work_details ? '\n' + item.work_details : ''),
              item.quantity.toString(),
              `$${item.unit_price.toFixed(2)}`,
              `$${item.total_price.toFixed(2)}`
            ]);
          });
        }

        autoTable(doc, {
          startY: yPos,
          head: [['Type', 'Description', 'Qty', 'Unit Price', 'Total']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [66, 139, 202] },
          margin: { left: margin, right: margin },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 0.8 },
            1: { cellWidth: 3.5 },
            2: { cellWidth: 0.6, halign: 'center' },
            3: { cellWidth: 1, halign: 'right' },
            4: { cellWidth: 1, halign: 'right' }
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 0.3;
      }

      // Fetch individual deposit records for this invoice so we can show per-deposit notes
      let invoiceDeposits: { id: string; amount: number; payment_method: string; reference_number: string | null; notes: string | null; payment_date: string }[] = [];
      if (invoice.deposit_applied && invoice.deposit_applied > 0) {
        const depositsQuery = invoice.work_order_id
          ? supabase.from('estimating_payments').select('id, amount, payment_method, reference_number, notes, payment_date').eq('work_order_id', invoice.work_order_id).eq('payment_type', 'deposit').order('payment_date', { ascending: true })
          : supabase.from('estimating_payments').select('id, amount, payment_method, reference_number, notes, payment_date').eq('invoice_id', invoice.id).eq('payment_type', 'deposit').order('payment_date', { ascending: true });
        const { data: depData } = await depositsQuery;
        invoiceDeposits = depData || [];
      }

      // Estimate how much vertical space the totals block needs
      const pageHeight = 11;
      const bottomMargin = 0.75;
      const depositLineCount = invoiceDeposits.length > 0 ? invoiceDeposits.length : (invoice.deposit_applied && invoice.deposit_applied > 0 ? 1 : 0);
      const totalsLineCount =
        2 + // subtotal + tax
        (invoice.discount_amount && invoice.discount_amount > 0 ? 1 : 0) +
        (invoice.shop_supplies_amount && invoice.shop_supplies_amount > 0 ? 1 : 0) +
        (invoice.park_fees_amount && invoice.park_fees_amount > 0 ? 1 : 0) +
        (invoice.surcharge_amount && invoice.surcharge_amount > 0 ? 1 : 0) +
        depositLineCount +
        (invoice.credit_card_fee && invoice.credit_card_fee > 0 ? 1 : 0) +
        (invoice.payment_status === 'paid' || (invoice.amount_paid !== null && invoice.amount_paid > 0) ? 2 : 0);
      const totalsBlockHeight = totalsLineCount * 0.2 + 0.2 + (invoice.notes ? 0.6 : 0);

      if (yPos + totalsBlockHeight > pageHeight - bottomMargin) {
        doc.addPage();
        yPos = margin;
      }

      // Totals
      const totalsX = pageWidth - margin - 2;
      doc.setFontSize(10);

      doc.text('Subtotal:', totalsX, yPos);
      doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 0.2;

      if (invoice.discount_amount && invoice.discount_amount > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Discount (${Number(invoice.discount_percentage ?? 0).toFixed(1)}%):`, totalsX, yPos);
        doc.text(`-$${invoice.discount_amount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 0.2;
      }

      doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(2)}%):`, totalsX, yPos);
      doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 0.2;

      if (invoice.shop_supplies_amount && invoice.shop_supplies_amount > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Shop Supplies:', totalsX, yPos);
        doc.text(`$${invoice.shop_supplies_amount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 0.2;
      }

      if (invoice.park_fees_amount && invoice.park_fees_amount > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Park Fees:', totalsX, yPos);
        doc.text(`$${invoice.park_fees_amount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 0.2;
      }

      if (invoice.surcharge_amount && invoice.surcharge_amount > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Surcharge:', totalsX, yPos);
        doc.text(`$${invoice.surcharge_amount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 0.2;
      }

      if (invoiceDeposits.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        invoiceDeposits.forEach((dep, idx) => {
          const depAmt = parseFloat(String(dep.amount || 0));
          const methodLabel = dep.payment_method === 'check'
            ? `Check #${dep.reference_number || ''}`
            : (dep.payment_method === 'stripe' ? 'Stripe' : (dep.payment_method || ''));
          const notesSuffix = dep.notes ? ` — ${dep.notes}` : '';
          const label = `Deposit #${idx + 1} (${methodLabel}):${notesSuffix}`;
          const labelLines = doc.splitTextToSize(label, totalsX - margin - 0.05);
          doc.text(labelLines, margin, yPos);
          doc.text(`-$${depAmt.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
          yPos += labelLines.length > 1 ? labelLines.length * 0.14 : 0.2;
        });
      } else if (invoice.deposit_applied && invoice.deposit_applied > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Deposit Applied:', totalsX, yPos);
        doc.text(`-$${invoice.deposit_applied.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 0.2;
      }

      if (invoice.credit_card_fee && invoice.credit_card_fee > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Credit Card Processing Fee (3%):', totalsX, yPos);
        doc.text(`$${invoice.credit_card_fee.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 0.2;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const computedTotal = invoice.subtotal
        - (invoice.discount_amount ?? 0)
        + invoice.tax_amount
        + (invoice.shop_supplies_amount ?? 0)
        + (invoice.park_fees_amount ?? 0)
        + (invoice.surcharge_amount ?? 0)
        + (invoice.credit_card_fee ?? 0)
        - (invoice.deposit_applied ?? 0);

      doc.text('Total:', totalsX, yPos);
      doc.text(`$${computedTotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });

      if (invoice.payment_status === 'paid' || (invoice.amount_paid !== null && invoice.amount_paid > 0)) {
        yPos += 0.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const amountPaid = invoice.amount_paid ?? computedTotal;
        doc.text('Amount Paid:', totalsX, yPos);
        doc.text(`-$${amountPaid.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 0.2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const remaining = Math.max(0, computedTotal - amountPaid);
        doc.text('Balance Due:', totalsX, yPos);
        doc.text(`$${remaining.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      }

      // Notes
      if (invoice.notes) {
        yPos += 0.4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - (margin * 2));
        const notesBlockHeight = 0.2 + noteLines.length * 0.13 + 0.1;
        if (yPos + notesBlockHeight > pageHeight - bottomMargin) {
          doc.addPage();
          yPos = margin;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Notes:', margin, yPos);
        yPos += 0.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(noteLines, margin, yPos);
      }

      // Open PDF in new tab for printing
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Error printing invoice:', error);
      showToast('Error printing invoice. Please try again.', 'error');
    }
  }

  async function resolveInvoiceEmail(invoice: Invoice): Promise<string> {
    if (invoice.yacht_id) {
      const { data: billingProfiles } = await supabase
        .from('user_profiles')
        .select('email, notification_email')
        .eq('yacht_id', invoice.yacht_id)
        .eq('is_active', true)
        .eq('can_approve_billing', true);
      if (billingProfiles && billingProfiles.length > 0) {
        const found = billingProfiles.find((p: any) => p.notification_email || p.email);
        if (found) return (found.notification_email || found.email) ?? '';
      }
    }
    if (invoice.customer_email) return invoice.customer_email;
    return '';
  }

  async function handleRequestPayment(invoice: Invoice) {
    try {
      const resolvedEmail = await resolveInvoiceEmail(invoice);
      if (!resolvedEmail) {
        setEmailPrompt({ invoice, email: '' });
        return;
      }

      let allRecipients: string[] = [resolvedEmail];
      if (invoice.yacht_id) {
        const { data: billingMgrs } = await supabase
          .from('user_profiles')
          .select('email, notification_email')
          .eq('yacht_id', invoice.yacht_id)
          .eq('can_approve_billing', true)
          .eq('is_active', true);
        if (billingMgrs) {
          const extras = billingMgrs
            .map((m: any) => (m.notification_email || m.email || '').trim())
            .filter((e: string) => e && e !== resolvedEmail);
          allRecipients = [resolvedEmail, ...extras];
        }
      }

      setSelectedPaymentMethod(invoice.final_payment_method_type as 'card' | 'ach' | 'both' || 'card');
      setEditableRecipients(allRecipients);
      setNewRecipientInput('');
      setPaymentMethodModal({ invoice, email: resolvedEmail, mode: 'generate', allRecipients });
    } catch (error: any) {
      console.error('Error in handleRequestPayment:', error);
      showToast(error.message || 'Failed to open payment dialog', 'error');
    }
  }

  async function generatePaymentLink(invoice: Invoice, recipientEmail: string, paymentMethodType: 'card' | 'ach' | 'both' = 'card', overrideRecipients?: string[]) {
    setPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-estimating-invoice-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: invoice.id,
            recipientEmail,
            paymentMethodType
          })
        }
      );

      if (!response.ok) {
        let errorMessage = 'Failed to create payment link';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Failed to create payment link (HTTP ${response.status})`;
        }
        throw new Error(errorMessage);
      }

      await supabase.from('estimating_invoices').update({ customer_email: recipientEmail }).eq('id', invoice.id);

      let additionalRecipients: { email: string; name?: string }[] = [];
      if (overrideRecipients) {
        additionalRecipients = overrideRecipients
          .filter((e) => e && e !== recipientEmail)
          .map((e) => ({ email: e }));
      } else if (invoice.yacht_id) {
        const { data: billingMgrs } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, email, notification_email')
          .eq('yacht_id', invoice.yacht_id)
          .eq('can_approve_billing', true)
          .eq('is_active', true);
        if (billingMgrs) {
          const allMgrs = billingMgrs
            .map((m: any) => ({ email: (m.notification_email || m.email || '').trim(), name: `${m.first_name || ''} ${m.last_name || ''}`.trim() }))
            .filter((m: any) => m.email && m.email !== recipientEmail);
          additionalRecipients = allMgrs;
        }
      }

      const totalRecipients = 1 + additionalRecipients.length;
      showToast(`Payment link generated! Sending email to ${totalRecipients} recipient${totalRecipients !== 1 ? 's' : ''}...`, 'success');

      try {
        const emailResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimating-invoice-payment-email`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              invoiceId: invoice.id,
              recipientEmail,
              additionalRecipients: additionalRecipients.length > 0 ? additionalRecipients : undefined,
            })
          }
        );
        if (!emailResponse.ok) {
          const emailErr = await emailResponse.json().catch(() => ({}));
          console.error('Email send failed:', emailErr);
          showToast('Payment link created but email failed to send. Use "Email Payment Link" to retry.', 'info');
        } else {
          showToast(`Payment email sent to ${totalRecipients} recipient${totalRecipients !== 1 ? 's' : ''}!`, 'success');
        }
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
        showToast('Payment link created but email failed to send. Use "Email Payment Link" to retry.', 'info');
      }

      if (activeTab === 'active') {
        await fetchInvoices();
      } else {
        await fetchArchivedInvoices();
      }

      if (showDetails) {
        const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', invoice.id).maybeSingle();
        if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
      }
    } catch (error: any) {
      console.error('Error requesting payment:', error);
      showToast(error.message || 'Failed to create payment link. Please try again.', 'error');
    } finally {
      setPaymentLoading(false);
    }
  }

  async function handleCopyPaymentLink(invoice: Invoice) {
    const link = invoice.final_payment_link_url || invoice.payment_link;
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      showToast('Payment link copied to clipboard!', 'success');
    } catch (error) {
      console.error('Error copying link:', error);
      showToast('Failed to copy payment link', 'error');
    }
  }

  async function handleSyncPaymentStatus() {
    if (!selectedInvoice) return;

    setSyncPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-payment`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estimating_invoice_id: selectedInvoice.id
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message || 'Payment status synced successfully!', 'success');
        await fetchInvoices();
        const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', selectedInvoice.id).maybeSingle();
        if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
      } else {
        showToast(result.message || 'Payment not yet completed in Stripe', 'info');
      }
    } catch (error: any) {
      console.error('Error syncing payment status:', error);
      showToast(error.message || 'Failed to sync payment status', 'error');
    } finally {
      setSyncPaymentLoading(false);
    }
  }

  async function handleSyncAllPayments() {
    setSyncAllLoading(true);
    setSyncAllResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const unpaidWithStripe = invoices.filter(
        inv => inv.payment_status !== 'paid' && (inv.final_payment_stripe_payment_intent_id || inv.final_payment_stripe_checkout_session_id || inv.stripe_payment_intent_id)
      );

      let synced = 0;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-payment`;

      for (const inv of unpaidWithStripe) {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ estimating_invoice_id: inv.id })
          });
          const result = await response.json();
          if (result.success) synced++;
        } catch {
        }
      }

      setSyncAllResult({ synced, total: unpaidWithStripe.length });
      await fetchInvoices();
      if (synced > 0) {
        showToast(`${synced} payment${synced !== 1 ? 's' : ''} updated successfully`, 'success');
      } else if (unpaidWithStripe.length === 0) {
        showToast('No unpaid invoices with payment links to sync', 'info');
      } else {
        showToast('No new payments found', 'info');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to sync payments', 'error');
    } finally {
      setSyncAllLoading(false);
    }
  }

  async function handleRegeneratePaymentLink() {
    if (!selectedInvoice) return;
    setSelectedPaymentMethod(selectedInvoice.final_payment_method_type as 'card' | 'ach' | 'both' || 'card');
    const primaryEmail = selectedInvoice.final_payment_email_recipient || selectedInvoice.customer_email || '';

    let recipients: string[] = primaryEmail ? [primaryEmail] : [];

    if (selectedInvoice.yacht_id) {
      const { data: billingMgrs } = await supabase
        .from('user_profiles')
        .select('email, notification_email')
        .eq('yacht_id', selectedInvoice.yacht_id)
        .eq('can_approve_billing', true)
        .eq('is_active', true);
      if (billingMgrs && billingMgrs.length > 0) {
        const allEmails = billingMgrs
          .map((m: any) => (m.notification_email || m.email || '').trim())
          .filter((e: string) => Boolean(e));
        const seen = new Set<string>();
        recipients = [...allEmails].filter((e) => {
          if (seen.has(e)) return false;
          seen.add(e);
          return true;
        });
      }
    }

    setEditableRecipients(recipients);
    setNewRecipientInput('');
    setPaymentMethodModal({ invoice: selectedInvoice, email: primaryEmail, mode: 'regenerate', allRecipients: recipients });
  }

  async function executeRegeneratePaymentLink(paymentMethodType: 'card' | 'ach' | 'both', overrideRecipients?: string[]) {
    if (!selectedInvoice) return;

    setRegenerateLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const deleteApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-invoice-payment-link`;
      const deleteResponse = await fetch(deleteApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estimatingInvoiceId: selectedInvoice.id
        })
      });

      const deleteResult = await deleteResponse.json();
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete old payment link');
      }

      const createApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-estimating-invoice-payment`;
      const createResponse = await fetch(createApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          paymentMethodType
        })
      });

      const createResult = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createResult.error || 'Failed to create new payment link');
      }

      const primaryEmail = selectedInvoice.final_payment_email_recipient || selectedInvoice.customer_email || '';
      const recipients = overrideRecipients ?? [];
      const additionalRecipients = recipients
        .filter((e) => e && e !== primaryEmail)
        .map((e) => ({ email: e }));

      const totalRecipients = primaryEmail ? 1 + additionalRecipients.length : additionalRecipients.length;
      showToast('Payment link regenerated successfully!', 'success');

      if (primaryEmail) {
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimating-invoice-payment-email`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              invoiceId: selectedInvoice.id,
              recipientEmail: primaryEmail,
              additionalRecipients: additionalRecipients.length > 0 ? additionalRecipients : undefined,
            })
          }
        ).then(async (emailResponse) => {
          if (!emailResponse.ok) {
            showToast('Payment link regenerated but email failed to send. Use "Email Payment Link" to retry.', 'info');
          } else {
            showToast(`Payment email sent to ${totalRecipients} recipient${totalRecipients !== 1 ? 's' : ''}!`, 'success');
          }
        }).catch(() => {
          showToast('Payment link regenerated but email failed to send. Use "Email Payment Link" to retry.', 'info');
        });
      }

      await fetchInvoices();
      const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', selectedInvoice.id).maybeSingle();
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (error: any) {
      console.error('Error regenerating payment link:', error);
      showToast(error.message || 'Failed to regenerate payment link', 'error');
    } finally {
      setRegenerateLoading(false);
    }
  }

  async function handleDeletePaymentLink() {
    if (!selectedInvoice) return;

    const confirmed = await confirm({
      title: 'Delete Payment Link',
      message: 'Are you sure you want to delete this payment link? You can generate a new one after making changes to the invoice.',
      confirmText: 'Delete',
      variant: 'danger'
    });

    if (!confirmed) return;

    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-invoice-payment-link`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estimatingInvoiceId: selectedInvoice.id
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete payment link');
      }

      showToast('Payment link deleted. You can now generate a new payment link.', 'success');
      await fetchInvoices();
      const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', selectedInvoice.id).maybeSingle();
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (error: any) {
      console.error('Error deleting payment link:', error);
      showToast(error.message || 'Failed to delete payment link', 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleEmailPaymentLinkWithEmail(invoice: Invoice, recipientEmail: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      await supabase.from('estimating_invoices').update({ customer_email: recipientEmail }).eq('id', invoice.id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimating-invoice-payment-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoiceId: invoice.id, recipientEmail })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      showToast('Payment link email sent successfully!', 'success');
      await fetchInvoices();
      const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', invoice.id).maybeSingle();
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (error: any) {
      console.error('Error sending email:', error);
      showToast(error.message || 'Failed to send payment link email', 'error');
    }
  }

  async function openEmailModal(invoice: Invoice) {
    setEmailModalInvoice(invoice);
    setBillingManagers([]);
    setSurchargeCcEmail('');
    setSurchargeCcNote('');
    setSurchargeCcEnabled(false);
    setShowEmailModal(true);

    setBillingManagersLoading(true);
    try {
      let managers: { email: string; name: string }[] = [];

      if (invoice.yacht_id) {
        const { data: yachtManagers } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, email, notification_email')
          .eq('yacht_id', invoice.yacht_id)
          .eq('can_approve_billing', true)
          .eq('is_active', true);

        if (yachtManagers) {
          managers = yachtManagers
            .map((m: any) => ({
              email: m.notification_email || m.email || '',
              name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
            }))
            .filter((m: any) => m.email);
        }
      }

      if (managers.length === 0 && invoice.customer_email) {
        managers = [{ email: invoice.customer_email, name: invoice.customer_name || '' }];
      }

      setBillingManagers(managers);
    } catch (e) {
      console.error('Failed to load billing managers:', e);
    } finally {
      setBillingManagersLoading(false);
    }
  }

  async function handleSendEmailModal() {
    if (!emailModalInvoice) return;
    if (billingManagers.length === 0) return;

    setSendingEmailModal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const [primary, ...additional] = billingManagers;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimating-invoice-payment-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: emailModalInvoice.id,
            recipientEmail: primary.email,
            recipientName: primary.name || undefined,
            additionalRecipients: additional.map(r => ({ email: r.email, name: r.name || undefined })),
            surchargeCcEmail: surchargeCcEnabled && surchargeCcEmail.trim() ? surchargeCcEmail.trim() : undefined,
            surchargeCcNote: surchargeCcEnabled && surchargeCcNote.trim() ? surchargeCcNote.trim() : undefined,
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      showToast(`Payment link email sent to ${billingManagers.length} manager${billingManagers.length !== 1 ? 's' : ''}!`, 'success');
      setShowEmailModal(false);
      setEmailModalInvoice(null);
      setBillingManagers([]);
      await fetchInvoices();
      if (selectedInvoice?.id === emailModalInvoice.id) {
        const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', emailModalInvoice.id).maybeSingle();
        if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      showToast(error.message || 'Failed to send payment link email', 'error');
    } finally {
      setSendingEmailModal(false);
    }
  }

  async function handleEmailPaymentLink() {
    if (!selectedInvoice) return;
    openEmailModal(selectedInvoice);
  }

  function openPaidInvoiceEmailModal(invoice: Invoice) {
    setPaidInvoiceEmailTarget(invoice);
    setPaidInvoiceEmailRecipient(invoice.customer_email || '');
    setPaidInvoiceEmailAdditional('');
    setShowPaidInvoiceEmailModal(true);
  }

  async function handleSendPaidInvoiceEmail() {
    if (!paidInvoiceEmailTarget || !paidInvoiceEmailRecipient.trim()) return;
    setSendingPaidInvoiceEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const additionalEmails = paidInvoiceEmailAdditional
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0)
        .map(email => ({ email }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-paid-invoice-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: paidInvoiceEmailTarget.id,
            recipientEmail: paidInvoiceEmailRecipient.trim(),
            recipientName: paidInvoiceEmailTarget.customer_name || undefined,
            additionalRecipients: additionalEmails.length > 0 ? additionalEmails : undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      showToast('Paid invoice emailed successfully!', 'success');
      setShowPaidInvoiceEmailModal(false);
      setPaidInvoiceEmailTarget(null);
    } catch (error: any) {
      console.error('Error sending paid invoice email:', error);
      showToast(error.message || 'Failed to send paid invoice email', 'error');
    } finally {
      setSendingPaidInvoiceEmail(false);
    }
  }

  async function handleRecordCheckPayment() {
    if (!selectedInvoice) return;
    const amount = parseFloat(checkForm.amount);
    if (!checkForm.checkNumber.trim()) {
      showToast('Check number is required', 'error');
      return;
    }
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    setCheckPaymentLoading(true);
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile?.company_id) throw new Error('Company not found');

      const currentAmountPaid = selectedInvoice.amount_paid ?? 0;
      const totalAmount = selectedInvoice.total_amount;
      const depositApplied = selectedInvoice.deposit_applied ?? 0;
      const newAmountPaid = currentAmountPaid + amount;
      const newBalanceDue = Math.max(0, totalAmount - depositApplied - newAmountPaid);
      const isFullPayment = newBalanceDue <= 0;

      const { error: paymentError } = await supabase
        .from('estimating_payments')
        .insert({
          company_id: profile.company_id,
          payment_type: 'invoice_payment',
          invoice_id: selectedInvoice.id,
          work_order_id: selectedInvoice.work_order_id,
          yacht_id: selectedInvoice.yacht_id,
          customer_name: selectedInvoice.customer_name,
          customer_email: selectedInvoice.customer_email,
          amount,
          payment_method: 'check',
          reference_number: checkForm.checkNumber.trim(),
          notes: checkForm.notes.trim() || null,
          recorded_by: userId,
          payment_date: new Date().toISOString()
        });

      if (paymentError) throw paymentError;

      const invoiceUpdates: Record<string, unknown> = {
        check_number: checkForm.checkNumber.trim(),
        check_payment_amount: amount,
        check_payment_recorded_at: new Date().toISOString(),
        payment_method_type: 'check',
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue
      };

      if (isFullPayment) {
        invoiceUpdates.payment_status = 'paid';
        invoiceUpdates.paid_at = new Date().toISOString();
      }

      const { error: invoiceError } = await supabase
        .from('estimating_invoices')
        .update(invoiceUpdates)
        .eq('id', selectedInvoice.id);

      if (invoiceError) throw invoiceError;

      setCheckPaymentModal(false);
      setCheckForm({ checkNumber: '', amount: '', depositAccount: '', notes: '' });
      showToast(`Check #${checkForm.checkNumber} recorded successfully`, 'success');

      if (activeTab === 'active') {
        await fetchInvoices();
      } else {
        await fetchArchivedInvoices();
      }

      const [{ data: fresh }] = await Promise.all([
        supabase
          .from('estimating_invoices')
          .select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)')
          .eq('id', selectedInvoice.id)
          .maybeSingle(),
        fetchInvoiceCheckPayments(selectedInvoice.id),
      ]);
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (err: any) {
      console.error('Error recording check payment:', err);
      showToast(err.message || 'Failed to record check payment', 'error');
    } finally {
      setCheckPaymentLoading(false);
    }
  }

  async function handleFixDeposit(invoice: Invoice) {
    const depositAmount = (invoice as any).repair_request_deposit_amount;
    if (!depositAmount || depositAmount <= 0) return;
    const ok = await confirm({
      title: 'Apply Deposit from Repair Request',
      message: `Apply the $${Number(depositAmount).toFixed(2)} deposit collected via the repair request to this invoice? This will reduce the balance due.`
    });
    if (!ok) return;
    setFixDepositLoading(true);
    try {
      const newBalanceDue = Math.max(0, invoice.total_amount - depositAmount - (invoice.amount_paid ?? 0));
      const { error } = await supabase
        .from('estimating_invoices')
        .update({
          deposit_applied: depositAmount,
          balance_due: newBalanceDue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);
      if (error) throw error;
      showToast(`Deposit of $${Number(depositAmount).toFixed(2)} applied successfully`, 'success');
      if (activeTab === 'active') await fetchInvoices(); else await fetchArchivedInvoices();
      const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name), repair_requests!repair_requests_estimating_invoice_id_fkey(id, status, deposit_payment_status, deposit_amount, deposit_paid_at, deposit_payment_method_type)').eq('id', invoice.id).maybeSingle();
      if (fresh) {
        const rr = (fresh as any).repair_requests;
        setSelectedInvoice({
          ...fresh,
          work_order_number: fresh.work_orders?.work_order_number,
          yacht_name: fresh.yachts?.name,
          repair_request_id: rr?.id || null,
          repair_request_deposit_status: rr?.deposit_payment_status || null,
          repair_request_deposit_amount: rr?.deposit_amount || null,
          repair_request_deposit_paid_at: rr?.deposit_paid_at || null,
          repair_request_deposit_method: rr?.deposit_payment_method_type || null,
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to apply deposit', 'error');
    } finally {
      setFixDepositLoading(false);
    }
  }

  function handleOpenEdit() {
    if (!selectedInvoice) return;
    const inv = selectedInvoice;
    const toDateStr = (val: string | null | undefined) => {
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d.getTime())) return val.slice(0, 10);
      return d.toISOString().slice(0, 10);
    };
    setEditForm({
      customer_name: inv.customer_name ?? '',
      customer_email: inv.customer_email ?? '',
      customer_phone: inv.customer_phone ?? '',
      invoice_date: toDateStr(inv.invoice_date),
      due_date: toDateStr(inv.due_date),
      notes: inv.notes ?? '',
      shop_supplies_amount: inv.shop_supplies_amount != null ? String(inv.shop_supplies_amount) : '0',
      park_fees_amount: inv.park_fees_amount != null ? String(inv.park_fees_amount) : '0',
      surcharge_amount: inv.surcharge_amount != null ? String(inv.surcharge_amount) : '0',
      tax_rate: inv.tax_rate != null ? String((Number(inv.tax_rate) * 100).toFixed(4)) : '0',
    });
    const CHARGE_TYPES = ['shop_supplies', 'park_fees', 'surcharge'];
    const sourceItems = inv.work_order_id ? workOrderLineItems : estimatingLineItems;
    const allItems = sourceItems.filter(i => !CHARGE_TYPES.includes(i.line_type));
    setEditLineItems(allItems.map(item => ({ ...item, _deleted: false, _new: false })));
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!selectedInvoice) return;
    setEditSaving(true);
    try {
      const taxRateVal = parseFloat(editForm.tax_rate) / 100;
      const shopSupplies = editForm.shop_supplies_amount !== '' ? parseFloat(editForm.shop_supplies_amount) : 0;
      const parkFees = editForm.park_fees_amount !== '' ? parseFloat(editForm.park_fees_amount) : 0;
      const surcharge = editForm.surcharge_amount !== '' ? parseFloat(editForm.surcharge_amount) : 0;

      const CHARGE_TYPES = ['shop_supplies', 'park_fees', 'surcharge'];
      const billableItems = editLineItems.filter(i => !i._deleted && !CHARGE_TYPES.includes(i.line_type));
      const newSubtotal = parseFloat(billableItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0).toFixed(2));
      const discountAmt = parseFloat((selectedInvoice.discount_amount ?? 0).toFixed(2));
      const discountedSubtotal = parseFloat(Math.max(0, newSubtotal - discountAmt).toFixed(2));
      const taxableAmount = parseFloat(billableItems.filter(i => i.is_taxable).reduce((sum, i) => sum + i.quantity * i.unit_price, 0).toFixed(2));
      const taxableAfterDiscount = discountedSubtotal > 0 && newSubtotal > 0
        ? parseFloat((taxableAmount * (discountedSubtotal / newSubtotal)).toFixed(2))
        : taxableAmount;
      const taxAmount = parseFloat((taxableAfterDiscount * taxRateVal).toFixed(2));
      const newTotal = parseFloat((discountedSubtotal + taxAmount + shopSupplies + parkFees + surcharge).toFixed(2));
      const depositApplied = selectedInvoice.deposit_applied ?? 0;
      const amountPaid = selectedInvoice.amount_paid ?? 0;
      const newBalanceDue = Math.max(0, newTotal - depositApplied - amountPaid);

      const isWorkOrderInvoice = !!selectedInvoice.work_order_id;
      const lineItemTable = isWorkOrderInvoice ? 'work_order_line_items' : 'estimating_invoice_line_items';

      const saveableItems = editLineItems.filter(i => !CHARGE_TYPES.includes(i.line_type));

      for (const item of saveableItems) {
        const totalPrice = parseFloat((item.quantity * item.unit_price).toFixed(2));
        if (item._deleted && !item._new) {
          const { error: delErr } = await supabase.from(lineItemTable).delete().eq('id', item.id);
          if (delErr) console.error('Delete line item error:', delErr);
        } else if (item._new && !item._deleted) {
          const insertData: Record<string, unknown> = {
            line_type: item.line_type,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: totalPrice,
            is_taxable: item.is_taxable,
            line_order: item.line_order,
            work_details: item.work_details || null,
          };
          if (isWorkOrderInvoice) {
            insertData.work_order_id = selectedInvoice.work_order_id;
            insertData.task_id = item.task_id || null;
          } else {
            insertData.invoice_id = selectedInvoice.id;
            insertData.task_name = (item as any).task_name || item.description || '';
          }
          const { error: insErr } = await supabase.from(lineItemTable).insert(insertData);
          if (insErr) console.error('Insert line item error:', insErr);
        } else if (!item._deleted && !item._new) {
          const { error: updErr } = await supabase.from(lineItemTable).update({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: totalPrice,
            is_taxable: item.is_taxable,
            work_details: item.work_details || null,
          }).eq('id', item.id);
          if (updErr) console.error('Update line item error:', updErr);
        }
      }

      const { error } = await supabase
        .from('estimating_invoices')
        .update({
          customer_name: editForm.customer_name.trim(),
          customer_email: editForm.customer_email.trim() || null,
          customer_phone: editForm.customer_phone.trim() || null,
          invoice_date: editForm.invoice_date,
          due_date: editForm.due_date,
          notes: editForm.notes.trim() || null,
          shop_supplies_amount: shopSupplies,
          park_fees_amount: parkFees,
          surcharge_amount: surcharge,
          tax_rate: taxRateVal,
          tax_amount: taxAmount,
          subtotal: newSubtotal,
          total_amount: newTotal,
          balance_due: newBalanceDue,
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      setShowEditModal(false);
      showToast('Invoice updated successfully', 'success');

      if (activeTab === 'active') {
        await fetchInvoices();
      } else {
        await fetchArchivedInvoices();
      }

      const { data: fresh } = await supabase
        .from('estimating_invoices')
        .select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)')
        .eq('id', selectedInvoice.id)
        .maybeSingle();
      if (fresh) {
        const freshInvoice = { ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name };
        setSelectedInvoice(freshInvoice);
        if (selectedInvoice.work_order_id) {
          await fetchWorkOrderDetails(selectedInvoice.work_order_id);
        } else {
          await fetchEstimatingLineItems(selectedInvoice.id);
        }
      }
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      showToast(err.message || 'Failed to save invoice', 'error');
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading invoices...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-center max-w-md">
          <p className="text-red-700 font-medium mb-1">Failed to load invoices</p>
          <p className="text-red-600 text-sm">{fetchError}</p>
        </div>
        <button
          onClick={fetchInvoices}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <ConfirmDialog />

      {showPaidInvoiceEmailModal && paidInvoiceEmailTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2 rounded-lg">
                  <Mail className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Email Paid Invoice</h3>
                  <p className="text-sm text-slate-400">{paidInvoiceEmailTarget.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowPaidInvoiceEmailModal(false); setPaidInvoiceEmailTarget(null); }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Primary Recipient</label>
                <input
                  type="email"
                  value={paidInvoiceEmailRecipient}
                  onChange={e => setPaidInvoiceEmailRecipient(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Additional Recipients <span className="text-slate-500 font-normal">(comma-separated, optional)</span>
                </label>
                <input
                  type="text"
                  value={paidInvoiceEmailAdditional}
                  onChange={e => setPaidInvoiceEmailAdditional(e.target.value)}
                  placeholder="cc1@example.com, cc2@example.com"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <p className="text-xs text-slate-400">A PDF copy of the paid invoice will be attached to the email.</p>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => { setShowPaidInvoiceEmailModal(false); setPaidInvoiceEmailTarget(null); }}
                disabled={sendingPaidInvoiceEmail}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendPaidInvoiceEmail}
                disabled={sendingPaidInvoiceEmail || !paidInvoiceEmailRecipient.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingPaidInvoiceEmail ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />Sending...</>
                ) : (
                  <><Mail className="w-4 h-4" />Send Invoice</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Assign Employees & Push Hours</h2>
              <button onClick={() => setAssignModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {assignModalLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>
              ) : assignModalTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No tasks found for this work order</div>
              ) : (
                <div className="space-y-6">
                  {assignModalTasks.map(task => (
                    <div key={task.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <span className="font-medium text-gray-900 text-sm">{task.task_name || 'Unnamed Task'}</span>
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Assigned Employees</p>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {task.assignments.length === 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">Not Assigned</span>
                            ) : (
                              task.assignments.map((a: any) => (
                                <span key={a.employee_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                  {a.name}
                                  <button
                                    onClick={() => handleRemoveAssignment(task.id, a.employee_id, assignModal.invoiceId, assignModal.workOrderId)}
                                    className="ml-0.5 hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                          <select
                            onChange={e => {
                              if (e.target.value) {
                                handleAssignEmployee(task.id, e.target.value, assignModal.invoiceId, assignModal.workOrderId);
                                e.target.value = '';
                              }
                            }}
                            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">+ Add employee...</option>
                            {assignModalEmployees
                              .filter(emp => !task.assignments.some((a: any) => a.employee_id === emp.user_id))
                              .map(emp => (
                                <option key={emp.user_id} value={emp.user_id}>
                                  {emp.first_name} {emp.last_name}
                                </option>
                              ))}
                          </select>
                        </div>

                        {task.laborItems.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Labor Lines</p>
                            <div className="space-y-2">
                              {task.laborItems.map((li: any) => (
                                <div key={li.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                  <div className="text-sm text-gray-700">
                                    <span className="font-medium">{li.quantity} hrs</span>
                                    {li.description && <span className="text-gray-500 ml-2">— {li.description}</span>}
                                    {li.user_profiles && (
                                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${li.time_entry_sent_at ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                        {li.user_profiles.first_name} {li.user_profiles.last_name}
                                      </span>
                                    )}
                                  </div>
                                  {li.time_entry_sent_at ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Pushed
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handlePushToTimeClock(li.id, assignModal.invoiceId, assignModal.workOrderId, task.assignments)}
                                      disabled={sendingToTimeClock[li.id] || (task.assignments.length === 0 && !li.assigned_employee_id)}
                                      title={task.assignments.length === 0 && !li.assigned_employee_id ? 'Assign an employee first' : 'Push to time clock'}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                      {sendingToTimeClock[li.id] ? 'Pushing...' : 'Push to Time Clock'}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setAssignModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoices</h1>
          <p className="text-gray-600">Manage and track customer invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAllPayments}
            disabled={syncAllLoading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${syncAllLoading ? 'animate-spin' : ''}`} />
            {syncAllLoading ? 'Syncing...' : 'Sync All Payments'}
          </button>
          <button
            onClick={() => setShowTaxReport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <BarChart2 className="w-4 h-4" />
            Tax &amp; Surcharge Report
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => {
                setActiveTab('active');
                fetchInvoices();
              }}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'active'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active Invoices
            </button>
            <button
              onClick={() => {
                setActiveTab('archived');
                fetchArchivedInvoices();
              }}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'archived'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Archive className="w-4 h-4 inline mr-2" />
              Archived
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice number, customer, work order, or yacht..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="all">All Statuses</option>
              <option value="not_billed">Not Billed</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vessel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 text-sm">No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </div>
                      {invoice.work_order_number && (
                        <div className="text-xs text-gray-500">
                          WO: {invoice.work_order_number}
                        </div>
                      )}
                      {invoice.work_title && (
                        <div className="text-xs text-blue-600 font-medium mt-0.5">
                          {invoice.work_title}
                        </div>
                      )}
                      {invoice.customer_name && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          {invoice.customer_name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-1">
                          {(invoiceEmployees[invoice.id] || []).map((name, i) => {
                            const sent = invoiceSentEmployees[invoice.id]?.has(name);
                            return (
                              <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sent ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                                {name}
                              </span>
                            );
                          })}
                          {invoiceHasUnassigned[invoice.id] && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                              Not Assigned
                            </span>
                          )}
                          {(invoiceEmployees[invoice.id] || []).length === 0 && !invoiceHasUnassigned[invoice.id] && (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                        {invoice.work_order_id && (invoiceHasUnassigned[invoice.id] || (invoiceEmployees[invoice.id] || []).some(name => !invoiceSentEmployees[invoice.id]?.has(name))) && (
                          <button
                            onClick={() => openAssignModal(invoice.id, invoice.work_order_id!)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline text-left"
                          >
                            Assign / Push Hours
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {invoice.is_retail_customer ? (
                        invoice.vessel_name ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{invoice.vessel_name}</div>
                            {(invoice.vessel_manufacturer || invoice.vessel_model) && (
                              <div className="text-xs text-gray-500">
                                {[invoice.vessel_manufacturer, invoice.vessel_model].filter(Boolean).join(' ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )
                      ) : (
                        invoice.yacht_name ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{invoice.yacht_name}</div>
                            {(invoice.yacht_manufacturer || invoice.yacht_model) && (
                              <div className="text-xs text-gray-500">
                                {[invoice.yacht_manufacturer, invoice.yacht_model].filter(Boolean).join(' ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${invoice.total_amount.toFixed(2)}
                      </div>
                      {invoice.deposit_applied && invoice.deposit_applied > 0 && (
                        <div className="text-xs text-gray-500">
                          Deposit: -${invoice.deposit_applied.toFixed(2)}
                        </div>
                      )}
                      {invoice.balance_due !== null && invoice.balance_due !== invoice.total_amount && (
                        <div className="text-xs font-medium text-blue-600">
                          Balance: ${invoice.balance_due.toFixed(2)}
                        </div>
                      )}
                      {invoice.credit_card_fee && invoice.credit_card_fee > 0 && (
                        <div className="text-xs text-amber-600">
                          +${invoice.credit_card_fee.toFixed(2)} CC fee
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {invoice.payment_status === 'unpaid' && !invoice.final_payment_link_url && !invoice.payment_link ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <Clock className="w-4 h-4" />
                            Not Billed
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.payment_status)}`}>
                            {getStatusIcon(invoice.payment_status)}
                            {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                          </span>
                        )}
                        {invoice.repair_request_id && invoice.repair_request_deposit_status === 'paid' && invoice.payment_status !== 'paid' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle className="w-3 h-3" />
                            Deposit Paid
                          </span>
                        )}
                        {invoice.repair_request_id && invoice.repair_request_deposit_status === 'processing' && invoice.payment_status !== 'paid' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            <RefreshCw className="w-3 h-3" />
                            Deposit Processing
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(invoice)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          Open
                        </button>
                        {qbConnection?.is_active && invoice.quickbooks_export_status !== 'exported' && (
                          <button
                            onClick={() => handleQbExport(invoice)}
                            disabled={qbExporting[invoice.id]}
                            className="p-2 text-green-700 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title={invoice.quickbooks_export_status === 'error' ? `Retry QB Export (${invoice.quickbooks_export_error || 'error'})` : 'Export to QuickBooks'}
                          >
                            {qbExporting[invoice.id] ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {invoice.quickbooks_export_status === 'exported' && (
                          <span className="p-2 text-green-600" title={`Exported to QB${invoice.quickbooks_invoice_id ? ` (ID: ${invoice.quickbooks_invoice_id})` : ''}`}>
                            <CheckCircle className="w-4 h-4" />
                          </span>
                        )}
                        {invoice.quickbooks_export_status === 'error' && qbConnection?.is_active && (
                          <button
                            onClick={() => handleQbExport(invoice)}
                            disabled={qbExporting[invoice.id]}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title={`QB Export Error - Click to retry: ${invoice.quickbooks_export_error || 'Unknown error'}`}
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        )}
                        {activeTab === 'active' ? (
                          <button
                            onClick={() => handleArchiveClick(invoice.id)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Archive invoice"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestoreInvoice(invoice.id)}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Restore invoice"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDetails && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[1000]">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Invoice Details: {selectedInvoice.invoice_number}
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleOpenEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Invoice
                </button>
                <button
                  onClick={() => handlePrintInvoice(selectedInvoice)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
                <button
                  onClick={() => openPaidInvoiceEmailModal(selectedInvoice)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Email Invoice
                </button>
                {qbConnection?.is_active && selectedInvoice.quickbooks_export_status !== 'exported' && (
                  <button
                    onClick={() => handleQbExport(selectedInvoice)}
                    disabled={qbExporting[selectedInvoice.id]}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {qbExporting[selectedInvoice.id] ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    {qbExporting[selectedInvoice.id] ? 'Exporting...' : selectedInvoice.quickbooks_export_status === 'error' ? 'Retry QB Export' : 'Export to QuickBooks'}
                  </button>
                )}
                {selectedInvoice.quickbooks_export_status === 'exported' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200">
                    <CheckCircle className="w-4 h-4" />
                    Exported to QuickBooks
                    {selectedInvoice.quickbooks_export_date && (
                      <span className="text-green-600 font-normal">
                        {new Date(selectedInvoice.quickbooks_export_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
                {selectedInvoice.quickbooks_export_status === 'error' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200 max-w-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">QB Error: {selectedInvoice.quickbooks_export_error || 'Unknown error'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Customer Information</h3>
                  <p className="text-lg font-medium text-gray-900">{selectedInvoice.customer_name}</p>
                  {selectedInvoice.customer_email && (
                    <p className="text-sm text-gray-600">{selectedInvoice.customer_email}</p>
                  )}
                  {selectedInvoice.customer_phone && (
                    <p className="text-sm text-gray-600">{selectedInvoice.customer_phone}</p>
                  )}
                  {selectedInvoice.yacht_name && (
                    <p className="text-sm text-gray-600 mt-2">Yacht: {selectedInvoice.yacht_name}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Invoice Details</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Invoice Date:</span>
                      <span className="text-gray-900">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Due Date:</span>
                      <span className="text-gray-900">{new Date(selectedInvoice.due_date).toLocaleDateString()}</span>
                    </div>
                    {selectedInvoice.work_order_number && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Work Order:</span>
                        <span className="text-gray-900">{selectedInvoice.work_order_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Section */}
              {workOrderTasks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Line Items</h3>
                  <div className="space-y-6">
                    {workOrderTasks.map((task) => {
                      const taskLineItems = workOrderLineItems.filter(item => item.task_id === task.id);
                      if (taskLineItems.length === 0) return null;

                      return (
                        <div key={task.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <h4 className="font-semibold text-gray-900">{task.task_name}</h4>
                            {task.task_overview && (
                              <p className="text-sm text-gray-600 mt-1">{task.task_overview}</p>
                            )}
                          </div>
                          <div className="divide-y divide-gray-200">
                            {taskLineItems.map((item) => (
                              <div key={item.id} className="px-4 py-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-gray-500 uppercase bg-gray-100 px-2 py-1 rounded">
                                        {item.line_type}
                                      </span>
                                      <span className="text-sm font-medium text-gray-900">
                                        {item.description}
                                      </span>
                                    </div>
                                    {item.work_details && (
                                      <p className="text-sm text-gray-500 mt-1 ml-[3.75rem]">{item.work_details}</p>
                                    )}
                                    <div className="flex gap-4 mt-2 ml-[3.75rem] text-sm text-gray-500">
                                      <span>Qty: {item.quantity}</span>
                                      <span>Unit Price: ${item.unit_price.toFixed(2)}</span>
                                      {item.is_taxable && (
                                        <span className="text-blue-600">Taxable</span>
                                      )}
                                    </div>
                                    {item.line_type === 'labor' && item.employee_name && (
                                      <div className="flex items-center gap-2 mt-2 ml-[3.75rem]">
                                        <Users className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-sm text-gray-700">{item.employee_name}</span>
                                        {item.time_entry_sent_at ? (
                                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                            <CheckCircle className="w-3 h-3" />
                                            Sent to Time Clock
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                            <Clock className="w-3 h-3" />
                                            Not Paid
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {item.line_type === 'labor' && !item.employee_name && (
                                      <div className="flex items-center gap-2 mt-2 ml-[3.75rem]">
                                        <Users className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-xs text-gray-400 italic">No employee assigned</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="text-base font-semibold text-gray-900">
                                      ${item.total_price.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="text-gray-900">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.discount_amount && selectedInvoice.discount_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Discount ({Number(selectedInvoice.discount_percentage ?? 0).toFixed(1)}%):</span>
                      <span className="text-green-600">-${selectedInvoice.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax ({(selectedInvoice.tax_rate * 100).toFixed(2)}%):</span>
                    <span className="text-gray-900">${selectedInvoice.tax_amount.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.shop_supplies_amount && selectedInvoice.shop_supplies_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Shop Supplies:</span>
                      <span className="text-gray-900">${selectedInvoice.shop_supplies_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedInvoice.park_fees_amount && selectedInvoice.park_fees_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Park Fees:</span>
                      <span className="text-gray-900">${selectedInvoice.park_fees_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedInvoice.surcharge_amount && selectedInvoice.surcharge_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Surcharge:</span>
                      <span className="text-gray-900">${selectedInvoice.surcharge_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedInvoice.deposit_applied && selectedInvoice.deposit_applied > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Deposit Applied:</span>
                      <span className="text-green-600">-${selectedInvoice.deposit_applied.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedInvoice.credit_card_fee && selectedInvoice.credit_card_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-600">Credit Card Processing Fee (3%)</span>
                      <span className="text-amber-600">+${selectedInvoice.credit_card_fee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-lg font-bold text-gray-900">
                        {selectedInvoice.deposit_applied && selectedInvoice.deposit_applied > 0 ? 'Balance Due:' : 'Total:'}
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        ${(() => {
                          const base = selectedInvoice.balance_due !== null && selectedInvoice.balance_due !== selectedInvoice.total_amount
                            ? selectedInvoice.balance_due
                            : selectedInvoice.total_amount;
                          return (selectedInvoice.credit_card_fee && selectedInvoice.credit_card_fee > 0
                            ? base + selectedInvoice.credit_card_fee
                            : base
                          ).toFixed(2);
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Repair Request Deposit Mismatch Alert */}
              {(() => {
                const rrDepositAmount = (selectedInvoice as any).repair_request_deposit_amount;
                const rrDepositStatus = (selectedInvoice as any).repair_request_deposit_status;
                const rrDepositPaidAt = (selectedInvoice as any).repair_request_deposit_paid_at;
                const rrDepositMethod = (selectedInvoice as any).repair_request_deposit_method;
                const invoiceDepositApplied = selectedInvoice.deposit_applied ?? 0;
                const hasMismatch = rrDepositStatus === 'paid' && rrDepositAmount > 0 && invoiceDepositApplied === 0 && selectedInvoice.payment_status !== 'paid';
                const hasDeposit = rrDepositStatus === 'paid' && rrDepositAmount > 0 && invoiceDepositApplied > 0;
                if (!rrDepositAmount) return null;
                return (
                  <div className={`border rounded-lg p-3 mb-4 ${hasMismatch ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold ${hasMismatch ? 'text-amber-800' : 'text-green-800'}`}>
                          {hasMismatch ? 'Deposit Collected via Repair Request — Not Applied' : 'Deposit from Repair Request'}
                        </p>
                        <p className={`text-xs mt-0.5 ${hasMismatch ? 'text-amber-700' : 'text-green-700'}`}>
                          ${Number(rrDepositAmount).toFixed(2)} collected
                          {rrDepositMethod ? ` via ${rrDepositMethod}` : ''}
                          {rrDepositPaidAt ? ` on ${new Date(rrDepositPaidAt).toLocaleDateString()}` : ''}
                          {hasDeposit ? ' · Applied to invoice' : ''}
                        </p>
                      </div>
                      {hasMismatch && (
                        <button
                          onClick={() => handleFixDeposit(selectedInvoice)}
                          disabled={fixDepositLoading}
                          className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          {fixDepositLoading ? 'Applying...' : 'Apply Deposit'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Payment Collection Section */}
              <div className="border-t border-gray-200 pt-6">
                {(() => {
                  const paymentLink = selectedInvoice.final_payment_link_url || selectedInvoice.payment_link;
                  const emailSentAt = selectedInvoice.final_payment_email_sent_at || selectedInvoice.payment_email_sent_at;
                  const emailRecipient = selectedInvoice.final_payment_email_recipient || selectedInvoice.payment_email_recipient;
                  const emailDeliveredAt = selectedInvoice.final_payment_email_delivered_at || selectedInvoice.payment_email_delivered_at;
                  const emailOpenedAt = selectedInvoice.final_payment_email_opened_at || selectedInvoice.payment_email_opened_at;
                  const emailClickedAt = selectedInvoice.final_payment_email_clicked_at || selectedInvoice.payment_email_clicked_at;
                  const emailBouncedAt = selectedInvoice.final_payment_email_bounced_at || selectedInvoice.payment_email_bounced_at;
                  const confirmationEmailSentAt = selectedInvoice.final_payment_confirmation_email_sent_at || selectedInvoice.payment_confirmation_email_sent_at;
                  const paidAt = selectedInvoice.final_payment_paid_at || selectedInvoice.paid_at;

                  return (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Receipt className="w-5 h-5 text-green-600" />
                        <h5 className="font-semibold text-green-700">Payment Details</h5>
                        {selectedInvoice.payment_status !== 'paid' && !emailSentAt && !paymentLink && (
                          <span className="ml-auto bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Payment Not Requested
                          </span>
                        )}
                        {selectedInvoice.payment_status !== 'paid' && emailClickedAt && (
                          <span className="ml-auto bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Viewed Invoice
                          </span>
                        )}
                        {selectedInvoice.payment_status !== 'paid' && !emailClickedAt && emailOpenedAt && (
                          <span className="ml-auto bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Opened Email
                          </span>
                        )}
                        {selectedInvoice.payment_status !== 'paid' && !emailOpenedAt && emailDeliveredAt && (
                          <span className="ml-auto bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold">
                            Email Delivered
                          </span>
                        )}
                        {selectedInvoice.payment_status !== 'paid' && emailSentAt && !emailDeliveredAt && !emailOpenedAt && !emailClickedAt && (
                          <span className="ml-auto bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Email Sent
                          </span>
                        )}
                        {selectedInvoice.payment_status === 'processing' && (
                          <span className="ml-auto bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Processing
                          </span>
                        )}
                        {selectedInvoice.payment_status === 'paid' && (
                          <span className="ml-auto bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Paid
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">Amount:</span> {(selectedInvoice.balance_due ?? selectedInvoice.total_amount).toFixed(2)}
                        </p>
                        {paidAt && (
                          <p className="text-xs text-green-600">
                            Paid on: {new Date(paidAt).toLocaleDateString()} at {new Date(paidAt).toLocaleTimeString()}
                          </p>
                        )}
                        {invoiceCheckPayments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {invoiceCheckPayments.map((cp) => (
                              <div key={cp.id} className="p-2 bg-white border border-green-200 rounded flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">Check #{cp.reference_number}</p>
                                  <p className="text-xs text-gray-500">${Number(cp.amount).toFixed(2)} recorded on {new Date(cp.payment_date).toLocaleDateString()}{cp.notes ? ` — ${cp.notes}` : ''}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {emailSentAt && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Email Engagement</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Mail className="w-3 h-3 text-blue-500" />
                                <span>Sent: {new Date(emailSentAt).toLocaleDateString()} at {new Date(emailSentAt).toLocaleTimeString()}</span>
                              </div>
                              {(() => {
                                const allRecipients: string[] =
                                  (selectedInvoice as any).final_payment_email_all_recipients?.length
                                    ? (selectedInvoice as any).final_payment_email_all_recipients
                                    : (selectedInvoice as any).payment_email_all_recipients?.length
                                    ? (selectedInvoice as any).payment_email_all_recipients
                                    : emailRecipient ? [emailRecipient] : [];

                                const perRecipient: Record<string, any> =
                                  (selectedInvoice as any).final_payment_recipient_engagement || {};
                                const hasPerRecipient = Object.keys(perRecipient).length > 0;

                                if (hasPerRecipient || allRecipients.length > 1) {
                                  // Per-recipient engagement rows
                                  return (
                                    <div className="mt-1 space-y-2">
                                      {allRecipients.map((addr, i) => {
                                        const eng = perRecipient[addr] || {};
                                        return (
                                          <div key={i} className="bg-gray-50 border border-gray-200 rounded p-2 space-y-1">
                                            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                                              <Mail className="w-3 h-3 flex-shrink-0" />
                                              {addr}
                                            </div>
                                            {eng.delivered_at ? (
                                              <div className="flex items-center gap-1.5 text-xs text-green-600 pl-4">
                                                <CheckCircle className="w-3 h-3" />
                                                <span>Delivered: {new Date(eng.delivered_at).toLocaleDateString()} at {new Date(eng.delivered_at).toLocaleTimeString()}</span>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1.5 text-xs text-gray-400 pl-4">
                                                <CheckCircle className="w-3 h-3" />
                                                <span>Not yet delivered</span>
                                              </div>
                                            )}
                                            {eng.opened_at && (
                                              <div className="flex items-center gap-1.5 text-xs text-blue-600 pl-4">
                                                <Eye className="w-3 h-3" />
                                                <span>Opened: {new Date(eng.opened_at).toLocaleDateString()} at {new Date(eng.opened_at).toLocaleTimeString()}</span>
                                                {(eng.open_count ?? 0) > 1 && (
                                                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-semibold">{eng.open_count}x</span>
                                                )}
                                              </div>
                                            )}
                                            {eng.clicked_at && (
                                              <div className="flex items-center gap-1.5 text-xs text-blue-700 pl-4">
                                                <MousePointer className="w-3 h-3" />
                                                <span>Clicked: {new Date(eng.clicked_at).toLocaleDateString()} at {new Date(eng.clicked_at).toLocaleTimeString()}</span>
                                                {(eng.click_count ?? 0) > 1 && (
                                                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-semibold">{eng.click_count}x</span>
                                                )}
                                              </div>
                                            )}
                                            {eng.bounced_at && (
                                              <div className="flex items-center gap-1.5 text-xs text-red-600 pl-4">
                                                <AlertCircle className="w-3 h-3" />
                                                <span>Bounced: {new Date(eng.bounced_at).toLocaleDateString()} at {new Date(eng.bounced_at).toLocaleTimeString()}</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                // Single-recipient fallback (legacy records)
                                return (
                                  <>
                                    {emailRecipient && (
                                      <div className="flex items-center gap-2 text-xs text-blue-600">
                                        <Mail className="w-3 h-3 flex-shrink-0" />
                                        <span className="font-medium">To: {emailRecipient}</span>
                                      </div>
                                    )}
                                    {emailDeliveredAt && (
                                      <div className="flex items-center gap-2 text-xs text-green-600">
                                        <CheckCircle className="w-3 h-3" />
                                        <span>Delivered: {new Date(emailDeliveredAt).toLocaleDateString()} at {new Date(emailDeliveredAt).toLocaleTimeString()}</span>
                                      </div>
                                    )}
                                    {emailOpenedAt && (
                                      <div className="flex items-center gap-2 text-xs text-blue-600">
                                        <Eye className="w-3 h-3" />
                                        <span>Opened: {new Date(emailOpenedAt).toLocaleDateString()} at {new Date(emailOpenedAt).toLocaleTimeString()}</span>
                                        {(selectedInvoice.email_open_count ?? 0) > 1 && (
                                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">{selectedInvoice.email_open_count}x</span>
                                        )}
                                      </div>
                                    )}
                                    {emailClickedAt && (
                                      <div className="flex items-center gap-2 text-xs text-blue-700">
                                        <MousePointer className="w-3 h-3" />
                                        <span>Clicked: {new Date(emailClickedAt).toLocaleDateString()} at {new Date(emailClickedAt).toLocaleTimeString()}</span>
                                        {(selectedInvoice.email_click_count ?? 0) > 1 && (
                                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">{selectedInvoice.email_click_count}x</span>
                                        )}
                                      </div>
                                    )}
                                    {emailBouncedAt && (
                                      <div className="flex items-center gap-2 text-xs text-red-600">
                                        <AlertCircle className="w-3 h-3" />
                                        <span>Bounced: {new Date(emailBouncedAt).toLocaleDateString()} at {new Date(emailBouncedAt).toLocaleTimeString()}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              {selectedInvoice.payment_status === 'paid' && confirmationEmailSentAt && (
                                <div className="flex items-center gap-2 text-xs text-green-600 pt-2 border-t border-green-200 mt-2">
                                  <CheckCircle className="w-3 h-3" />
                                  <span className="font-medium">Payment Confirmation Sent: {new Date(confirmationEmailSentAt).toLocaleDateString()} at {new Date(confirmationEmailSentAt).toLocaleTimeString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {paymentLink && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs text-gray-500 mb-2">Payment Link:</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                value={paymentLink}
                                className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-xs text-gray-700"
                              />
                              <button
                                onClick={() => handleCopyPaymentLink(selectedInvoice)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" />
                                Copy
                              </button>
                              <button
                                onClick={handleEmailPaymentLink}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1"
                              >
                                <Mail className="w-3 h-3" />
                                Resend Email
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedInvoice.payment_status !== 'paid' && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-green-200">
                          {!paymentLink && (
                            <button
                              onClick={() => handleRequestPayment(selectedInvoice)}
                              disabled={paymentLoading}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              <CreditCard className="w-3 h-3" />
                              {paymentLoading ? 'Generating...' : 'Generate Payment Link'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const balanceDue = selectedInvoice.balance_due ?? selectedInvoice.total_amount;
                              setCheckForm({ checkNumber: '', amount: balanceDue.toFixed(2), depositAccount: '', notes: '' });
                              setCheckPaymentModal(true);
                            }}
                            className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            Record Check
                          </button>
                          {paymentLink && (
                            <>
                              <button
                                onClick={handleSyncPaymentStatus}
                                disabled={syncPaymentLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" />
                                {syncPaymentLoading ? 'Syncing...' : 'Sync Payment'}
                              </button>
                              <button
                                onClick={handleRegeneratePaymentLink}
                                disabled={regenerateLoading}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" />
                                {regenerateLoading ? 'Regenerating...' : 'Regenerate Payment Link'}
                              </button>
                              <button
                                onClick={handleDeletePaymentLink}
                                disabled={deleteLoading}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                {deleteLoading ? 'Deleting...' : 'Delete Payment Link'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {selectedInvoice.notes && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Edit Invoice {selectedInvoice.invoice_number}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Customer & Dates */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Customer Information</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={editForm.customer_name}
                      onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.customer_email}
                      onChange={e => setEditForm(f => ({ ...f, customer_email: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editForm.customer_phone}
                      onChange={e => setEditForm(f => ({ ...f, customer_phone: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={editForm.invoice_date}
                      onChange={e => setEditForm(f => ({ ...f, invoice_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editForm.due_date}
                      onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="border-t border-gray-200 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h4>
                  <button
                    type="button"
                    onClick={() => {
                      const maxOrder = editLineItems.reduce((m, i) => Math.max(m, i.line_order), 0);
                      const firstActive = editLineItems.find(i => !i._deleted);
                      setEditLineItems(prev => [...prev, {
                        id: `new-${Date.now()}`,
                        task_id: firstActive?.task_id ?? '',
                        task_name: (firstActive as any)?.task_name ?? null,
                        line_type: 'part',
                        description: '',
                        quantity: 1,
                        unit_price: 0,
                        total_price: 0,
                        is_taxable: true,
                        line_order: maxOrder + 1,
                        work_details: null,
                        assigned_employee_id: null,
                        time_entry_sent_at: null,
                        time_entry_id: null,
                        employee_name: null,
                        _deleted: false,
                        _new: true,
                      }]);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Add Line Item
                  </button>
                </div>

                {editLineItems.filter(i => !i._deleted).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No line items. Click "Add Line Item" to add one.</p>
                )}

                <div className="space-y-2">
                  {/* Header row */}
                  {editLineItems.filter(i => !i._deleted).length > 0 && (
                    <div className="flex gap-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <div style={{width: 80, flexShrink: 0}}>Type</div>
                      <div className="flex-1">Description</div>
                      <div style={{width: 120, flexShrink: 0}}>Work Details</div>
                      <div style={{width: 56, flexShrink: 0, textAlign: 'right'}}>Qty</div>
                      <div style={{width: 88, flexShrink: 0, textAlign: 'right'}}>Unit Price</div>
                      <div style={{width: 36, flexShrink: 0, textAlign: 'center'}}>Tax</div>
                      <div style={{width: 72, flexShrink: 0, textAlign: 'right'}}>Total</div>
                      <div style={{width: 28, flexShrink: 0}}></div>
                    </div>
                  )}
                  {editLineItems.map((item, idx) => {
                    if (item._deleted) return null;
                    const rowTotal = (item.quantity * item.unit_price).toFixed(2);
                    return (
                      <div key={item.id} className="flex gap-2 items-center bg-gray-50 rounded-lg px-2 py-1.5">
                        <div style={{width: 80, flexShrink: 0}}>
                          <select
                            value={item.line_type}
                            onChange={e => setEditLineItems(prev => prev.map((it, i) => i === idx ? { ...it, line_type: e.target.value } : it))}
                            className="w-full border border-gray-300 rounded px-1 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            <option value="part">Part</option>
                            <option value="labor">Labor</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={item.description ?? ''}
                            onChange={e => setEditLineItems(prev => prev.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                            placeholder="Description"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div style={{width: 120, flexShrink: 0}}>
                          <input
                            type="text"
                            value={item.work_details ?? ''}
                            onChange={e => setEditLineItems(prev => prev.map((it, i) => i === idx ? { ...it, work_details: e.target.value || null } : it))}
                            placeholder="Work details"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div style={{width: 56, flexShrink: 0}}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.quantity}
                            onChange={e => setEditLineItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseFloat(e.target.value) || 0 } : it))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div style={{width: 88, flexShrink: 0}}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={e => setEditLineItems(prev => prev.map((it, i) => i === idx ? { ...it, unit_price: parseFloat(e.target.value) || 0 } : it))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-right text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div style={{width: 36, flexShrink: 0}} className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={item.is_taxable}
                            onChange={e => setEditLineItems(prev => prev.map((it, i) => i === idx ? { ...it, is_taxable: e.target.checked } : it))}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                        <div style={{width: 72, flexShrink: 0}} className="text-right text-xs font-semibold text-gray-800">
                          ${rowTotal}
                        </div>
                        <div style={{width: 28, flexShrink: 0}} className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setEditLineItems(prev => prev.map((it, i) => i === idx ? { ...it, _deleted: true } : it))}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Charges & Tax */}
              <div className="border-t border-gray-200 pt-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Charges &amp; Tax</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.tax_rate}
                      onChange={e => setEditForm(f => ({ ...f, tax_rate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Shop Supplies ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.shop_supplies_amount}
                      onChange={e => setEditForm(f => ({ ...f, shop_supplies_amount: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Park Fees ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.park_fees_amount}
                      onChange={e => setEditForm(f => ({ ...f, park_fees_amount: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Surcharge ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.surcharge_amount}
                      onChange={e => setEditForm(f => ({ ...f, surcharge_amount: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {(() => {
                  const CHARGE_TYPES = ['shop_supplies', 'park_fees', 'surcharge'];
                  const taxRate = parseFloat(editForm.tax_rate) / 100 || 0;
                  const shopSup = parseFloat(editForm.shop_supplies_amount) || 0;
                  const parkFee = parseFloat(editForm.park_fees_amount) || 0;
                  const surchargeAmt = parseFloat(editForm.surcharge_amount) || 0;
                  const discountAmt = selectedInvoice?.discount_amount ?? 0;
                  const discountPct = selectedInvoice?.discount_percentage ?? 0;
                  const activeItems = editLineItems.filter(i => !i._deleted && !CHARGE_TYPES.includes(i.line_type));
                  const subtotal = activeItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
                  const discountedSubtotal = Math.max(0, subtotal - discountAmt);
                  const taxable = activeItems.filter(i => i.is_taxable).reduce((s, i) => s + i.quantity * i.unit_price, 0);
                  const taxableAfterDiscount = discountedSubtotal > 0 && subtotal > 0 ? taxable * (discountedSubtotal / subtotal) : taxable;
                  const tax = taxableAfterDiscount * taxRate;
                  const total = discountedSubtotal + tax + shopSup + parkFee + surchargeAmt;
                  return (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal:</span><span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                      </div>
                      {discountAmt > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount ({Number(discountPct).toFixed(1)}%):</span><span>-${discountAmt.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-600">
                        <span>Tax ({editForm.tax_rate}%):</span><span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
                      </div>
                      {shopSup > 0 && <div className="flex justify-between text-gray-600"><span>Shop Supplies:</span><span>${shopSup.toFixed(2)}</span></div>}
                      {parkFee > 0 && <div className="flex justify-between text-gray-600"><span>Park Fees:</span><span>${parkFee.toFixed(2)}</span></div>}
                      {surchargeAmt > 0 && <div className="flex justify-between text-gray-600"><span>Surcharge:</span><span>${surchargeAmt.toFixed(2)}</span></div>}
                      <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                        <span>New Total:</span><span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Notes */}
              <div className="border-t border-gray-200 pt-5">
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-white">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editForm.customer_name.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {editSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Archive Invoice
            </h3>
            <p className="text-gray-700 mb-6">
              Archive this invoice? You can restore it later from the Archived tab if needed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setInvoiceToArchive(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArchive}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
      {showEmailModal && emailModalInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Send Payment Link via Email</h3>
              </div>
              <button onClick={() => { setShowEmailModal(false); setEmailModalInvoice(null); setBillingManagers([]); }} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Invoice</p>
                <p className="font-semibold text-white">{emailModalInvoice.invoice_number}</p>
                <p className="text-green-400 font-bold text-lg">${(emailModalInvoice.balance_due ?? emailModalInvoice.total_amount).toFixed(2)}</p>
                {emailModalInvoice.yacht_name && (
                  <p className="text-slate-400 text-sm mt-1">{emailModalInvoice.yacht_name}</p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-medium text-slate-300">
                    Billing Approval Managers
                    {!billingManagersLoading && billingManagers.length > 0 && (
                      <span className="ml-2 text-slate-500">({billingManagers.length})</span>
                    )}
                  </p>
                </div>

                {billingManagersLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading billing managers...
                  </div>
                ) : billingManagers.length === 0 ? (
                  <div className="space-y-3">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <p className="text-amber-400 text-sm font-medium mb-1">No recipients found</p>
                      <p className="text-amber-300/70 text-xs">
                        {emailModalInvoice.yacht_id
                          ? 'No users with Billing Approval permission are assigned to this yacht. Add an email below to send manually.'
                          : 'No customer email is on file for this invoice. Add an email below to send the payment link.'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="Add recipient email..."
                        id="extra-recipient-input"
                        className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                              setBillingManagers(prev => [...prev, { email: val, name: '' }]);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('extra-recipient-input') as HTMLInputElement;
                          const val = input?.value.trim();
                          if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                            setBillingManagers(prev => [...prev, { email: val, name: '' }]);
                            input.value = '';
                          }
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {billingManagers.map((m, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{m.name || m.email}</p>
                          <p className="text-xs text-slate-400">{m.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBillingManagers(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 mt-1">Email will be sent to all listed billing managers</p>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="email"
                        placeholder="Add additional email..."
                        id="extra-recipient-input"
                        className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                              setBillingManagers(prev => [...prev, { email: val, name: '' }]);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('extra-recipient-input') as HTMLInputElement;
                          const val = input?.value.trim();
                          if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                            setBillingManagers(prev => [...prev, { email: val, name: '' }]);
                            input.value = '';
                          }
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {emailModalInvoice.surcharge_amount && emailModalInvoice.surcharge_amount > 0 && (
                <div className="border border-amber-500/40 rounded-xl bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-sm font-semibold">Surcharge CC</span>
                      <span className="text-amber-300/70 text-xs bg-amber-500/20 px-2 py-0.5 rounded-full">
                        ${emailModalInvoice.surcharge_amount.toFixed(2)} surcharge on this invoice
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSurchargeCcEnabled(v => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${surchargeCcEnabled ? 'bg-amber-500' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${surchargeCcEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {surchargeCcEnabled && (
                    <div className="space-y-2 mt-3">
                      <input
                        type="email"
                        placeholder="Surcharge department email..."
                        value={surchargeCcEmail}
                        onChange={e => setSurchargeCcEmail(e.target.value)}
                        className="w-full bg-slate-900/50 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      <textarea
                        placeholder="Note to surcharge department (optional)..."
                        value={surchargeCcNote}
                        onChange={e => setSurchargeCcNote(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-900/50 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                      />
                      <p className="text-xs text-amber-300/60">This contact will be CC'd on the invoice email and receive a copy of the surcharge details.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  A professional email with the payment link and the invoice PDF attached will be sent to all listed billing managers.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => { setShowEmailModal(false); setEmailModalInvoice(null); setBillingManagers([]); }}
                disabled={sendingEmailModal}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmailModal}
                disabled={sendingEmailModal || billingManagersLoading || billingManagers.length === 0}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingEmailModal ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    {billingManagers.length > 1 ? `Send to ${billingManagers.length} Managers` : 'Send Email'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Enter Customer Email</h3>
            <p className="text-sm text-slate-400 mb-4">
              No email on file for this invoice. Enter an email address to {emailPrompt.emailOnly ? 'send the payment link.' : 'generate and send the payment link.'}
            </p>
            <input
              type="email"
              value={emailPrompt.email}
              onChange={(e) => setEmailPrompt({ ...emailPrompt, email: e.target.value })}
              placeholder="customer@example.com"
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailPrompt.email) {
                  const { invoice, email, emailOnly } = emailPrompt;
                  setEmailPrompt(null);
                  if (emailOnly) {
                    handleEmailPaymentLinkWithEmail(invoice, email);
                  } else {
                    setSelectedPaymentMethod(invoice.final_payment_method_type as 'card' | 'ach' | 'both' || 'card');
                    setPaymentMethodModal({ invoice, email, mode: 'generate' });
                  }
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEmailPrompt(null)}
                className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!emailPrompt.email) return;
                  const { invoice, email, emailOnly } = emailPrompt;
                  setEmailPrompt(null);
                  if (emailOnly) {
                    handleEmailPaymentLinkWithEmail(invoice, email);
                  } else {
                    setSelectedPaymentMethod(invoice.final_payment_method_type as 'card' | 'ach' | 'both' || 'card');
                    setPaymentMethodModal({ invoice, email, mode: 'generate' });
                  }
                }}
                disabled={!emailPrompt.email}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50"
              >
                {emailPrompt.emailOnly ? 'Send Email' : 'Next: Payment Method'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">
                  {paymentMethodModal.mode === 'regenerate' ? 'Regenerate Payment Link' : 'Generate Payment Link'}
                </h3>
              </div>
              <button onClick={() => setPaymentMethodModal(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-900/50 rounded-lg text-sm">
                <p className="text-slate-300 font-medium">{paymentMethodModal.invoice.invoice_number} — {paymentMethodModal.invoice.customer_name}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Balance due: ${((paymentMethodModal.invoice.balance_due ?? paymentMethodModal.invoice.total_amount) || 0).toFixed(2)}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-slate-400 text-xs font-medium">Recipients ({editableRecipients.length}):</p>
                  {editableRecipients.map((r, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input
                        type="email"
                        value={r}
                        onChange={(e) => {
                          const updated = [...editableRecipients];
                          updated[i] = e.target.value;
                          setEditableRecipients(updated);
                        }}
                        className="flex-1 bg-slate-700 border border-slate-500 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
                      />
                      {editableRecipients.length > 1 && (
                        <button
                          onClick={() => setEditableRecipients(editableRecipients.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-1 pt-0.5">
                    <input
                      type="email"
                      value={newRecipientInput}
                      onChange={(e) => setNewRecipientInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newRecipientInput.trim()) {
                          setEditableRecipients([...editableRecipients, newRecipientInput.trim()]);
                          setNewRecipientInput('');
                        }
                      }}
                      placeholder="Add email..."
                      className="flex-1 bg-slate-700 border border-dashed border-slate-500 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      onClick={() => {
                        if (newRecipientInput.trim()) {
                          setEditableRecipients([...editableRecipients, newRecipientInput.trim()]);
                          setNewRecipientInput('');
                        }
                      }}
                      disabled={!newRecipientInput.trim()}
                      className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded text-xs transition-colors flex-shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">How can the customer pay?</label>
                <div className="space-y-2">
                  {[
                    { value: 'card', label: 'Credit / Debit Card Only', sub: '3% credit card processing fee will be added to the total' },
                    { value: 'ach', label: 'ACH Bank Transfer Only', sub: 'No processing fee — 3–5 business day settlement' },
                    { value: 'both', label: 'Card and ACH (customer chooses)', sub: 'No processing fee added — customer selects their preferred method' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPaymentMethod === opt.value
                          ? 'border-emerald-500 bg-emerald-900/20'
                          : 'border-slate-600 bg-slate-900/30 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={opt.value}
                        checked={selectedPaymentMethod === opt.value}
                        onChange={() => setSelectedPaymentMethod(opt.value as 'card' | 'ach' | 'both')}
                        className="mt-0.5 accent-emerald-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedPaymentMethod === 'card' && (() => {
                  const balanceDue = paymentMethodModal.invoice.balance_due ?? paymentMethodModal.invoice.total_amount ?? 0;
                  const fee = Math.round(balanceDue * 0.03 * 100) / 100;
                  const total = balanceDue + fee;
                  return (
                    <div className="mt-3 p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between text-slate-300">
                        <span>Balance due</span>
                        <span>${balanceDue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-amber-400">
                        <span>Credit card processing fee (3%)</span>
                        <span>+${fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-white font-semibold border-t border-amber-700/40 pt-1 mt-1">
                        <span>Customer will be charged</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setPaymentMethodModal(null)}
                  className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const { invoice, email, mode } = paymentMethodModal;
                    const recipients = [...editableRecipients];
                    setPaymentMethodModal(null);
                    if (mode === 'generate') {
                      generatePaymentLink(invoice, email, selectedPaymentMethod, recipients);
                    } else {
                      executeRegeneratePaymentLink(selectedPaymentMethod, recipients);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  {paymentMethodModal.mode === 'regenerate' ? 'Regenerate & Send' : 'Generate & Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-700" />
                <h3 className="text-lg font-semibold text-gray-900">Record Check Payment</h3>
              </div>
              <button onClick={() => setCheckPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                <p className="font-medium">{selectedInvoice.invoice_number} — {selectedInvoice.customer_name}</p>
                <p className="text-gray-500 text-xs mt-0.5">Balance due: ${(selectedInvoice.balance_due ?? selectedInvoice.total_amount).toFixed(2)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Check Number *</label>
                  <input
                    type="text"
                    value={checkForm.checkNumber}
                    onChange={(e) => setCheckForm({ ...checkForm, checkNumber: e.target.value })}
                    placeholder="e.g. 1042"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={checkForm.amount}
                    onChange={(e) => setCheckForm({ ...checkForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Deposit to Account (QuickBooks)</label>
                <select
                  value={checkForm.depositAccount}
                  onChange={(e) => setCheckForm({ ...checkForm, depositAccount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="">— Select bank account —</option>
                  {qbBankAccounts.map((acct) => (
                    <option key={acct.qbo_account_id} value={acct.qbo_account_id}>
                      {acct.account_number ? `${acct.account_number} - ` : ''}{acct.account_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={checkForm.notes}
                  onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value })}
                  placeholder="e.g. received at front desk"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>

              {checkForm.amount && parseFloat(checkForm.amount) > 0 && (
                <div className={`p-3 rounded-lg text-xs font-medium ${parseFloat(checkForm.amount) >= (selectedInvoice.balance_due ?? selectedInvoice.total_amount) ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                  {parseFloat(checkForm.amount) >= (selectedInvoice.balance_due ?? selectedInvoice.total_amount)
                    ? 'This will mark the invoice as fully paid.'
                    : `Partial payment — $${((selectedInvoice.balance_due ?? selectedInvoice.total_amount) - parseFloat(checkForm.amount)).toFixed(2)} will remain due.`}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 pb-5">
              <button
                onClick={() => setCheckPaymentModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordCheckPayment}
                disabled={checkPaymentLoading || !checkForm.checkNumber.trim() || !checkForm.amount}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-semibold disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {checkPaymentLoading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaxReport && (
        <TaxSurchargeReport onClose={() => setShowTaxReport(false)} />
      )}
    </div>
  );
}
