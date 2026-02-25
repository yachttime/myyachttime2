import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabase';
import { Plus, Wrench, AlertCircle, Edit2, Trash2, Check, X, ChevronDown, ChevronUp, Printer, CheckCircle, Clock, FileText, DollarSign, Mail, ExternalLink, RefreshCw, Eye, MousePointer, Download, Archive, RotateCcw, Package } from 'lucide-react';
import { generateWorkOrderPDF } from '../utils/pdfGenerator';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../hooks/useConfirm';

interface WorkOrder {
  id: string;
  work_order_number: string;
  estimate_id: string | null;
  yacht_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  is_retail_customer: boolean;
  status: string;
  marina_name: string | null;
  manager_name: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  sales_tax_rate: number | null;
  sales_tax_amount: number | null;
  shop_supplies_rate: number | null;
  shop_supplies_amount: number | null;
  park_fees_rate: number | null;
  park_fees_amount: number | null;
  surcharge_rate: number | null;
  surcharge_amount: number | null;
  subtotal: number | null;
  total_amount: number | null;
  notes: string | null;
  customer_notes: string | null;
  created_at: string;
  yachts?: { name: string };
  deposit_required: boolean;
  deposit_amount: number | null;
  deposit_payment_status: string | null;
  deposit_payment_link_url: string | null;
  deposit_link_expires_at: string | null;
  deposit_paid_at: string | null;
  deposit_payment_method_type: string | null;
}

interface WorkOrderTask {
  id?: string;
  task_name: string;
  task_overview: string;
  task_order: number;
  apply_surcharge: boolean;
  assignedEmployees: string[];
  lineItems: WorkOrderLineItem[];
}

interface WorkOrderLineItem {
  id?: string;
  task_id?: string;
  line_type: 'labor' | 'part' | 'shop_supplies' | 'park_fees' | 'surcharge';
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_taxable: boolean;
  labor_code_id?: string | null;
  part_id?: string | null;
  part_source?: string | null;
  mercury_part_id?: string | null;
  marine_wholesale_part_id?: string | null;
  line_order: number;
  work_details?: string | null;
  package_header?: string | null;
}

interface WorkOrdersProps {
  userId: string;
}

export function WorkOrders({ userId }: WorkOrdersProps) {
  const { showSuccess } = useNotification();
  const { userProfile } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [editingWorkTitle, setEditingWorkTitle] = useState<string | null>(null);
  const [workTitleDraft, setWorkTitleDraft] = useState('');
  const [yachts, setYachts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [workOrderEmployees, setWorkOrderEmployees] = useState<Record<string, string[]>>({});
  const [workOrderHasUnassigned, setWorkOrderHasUnassigned] = useState<Record<string, boolean>>({});
  const [laborCodes, setLaborCodes] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [mercuryParts, setMercuryParts] = useState<any[]>([]);
  const [marineWholesaleParts, setMarineWholesaleParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositEmailRecipient, setDepositEmailRecipient] = useState('');
  const [depositEmailRecipientName, setDepositEmailRecipientName] = useState('');
  const [sendingDepositEmail, setSendingDepositEmail] = useState(false);
  const [syncingPayment, setSyncingPayment] = useState<Record<string, boolean>>({});
  const [checkingEmailStatus, setCheckingEmailStatus] = useState<Record<string, boolean>>({});
  const [depositCheckModal, setDepositCheckModal] = useState<string | null>(null);
  const [depositCheckLoading, setDepositCheckLoading] = useState(false);
  const [depositCheckForm, setDepositCheckForm] = useState({ checkNumber: '', amount: '', notes: '' });
  const [workOrderDeposits, setWorkOrderDeposits] = useState<any[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<{ id: string; display_name: string; email: string; phone: string }[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    is_retail_customer: false,
    yacht_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    marina_name: '',
    manager_name: '',
    manager_email: '',
    manager_phone: '',
    sales_tax_rate: '0.08',
    shop_supplies_rate: '0.05',
    park_fees_rate: '0.02',
    surcharge_rate: '0.03',
    apply_shop_supplies: true,
    apply_park_fees: true,
    notes: '',
    customer_notes: '',
    deposit_required: false,
    deposit_amount: '',
    deposit_payment_method_type: 'card'
  });

  const [tasks, setTasks] = useState<WorkOrderTask[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [taskFormData, setTaskFormData] = useState({
    task_name: '',
    task_overview: ''
  });

  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [activeTaskIndex, setActiveTaskIndex] = useState<number | null>(null);
  const [lineItemFormData, setLineItemFormData] = useState({
    line_type: 'labor' as WorkOrderLineItem['line_type'],
    description: '',
    quantity: '1',
    unit_price: '0',
    is_taxable: true,
    labor_code_id: '',
    part_id: '',
    part_source: 'all',
    mercury_part_id: '',
    marine_wholesale_part_id: '',
    part_number_search: '',
    work_details: ''
  });
  const [filteredParts, setFilteredParts] = useState<any[]>([]);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [editingPackageHeader, setEditingPackageHeader] = useState<{ taskIndex: number; lineIndex: number } | null>(null);
  const [packageHeaderEditValue, setPackageHeaderEditValue] = useState('');
  const [showTimeEntryPreview, setShowTimeEntryPreview] = useState(false);
  const [timeEntryPreview, setTimeEntryPreview] = useState<any[]>([]);
  const [selectedWorkOrderForTime, setSelectedWorkOrderForTime] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [workOrderToArchive, setWorkOrderToArchive] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showPartDropdown && !target.closest('.part-search-container')) {
        setShowPartDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPartDropdown]);

  useEffect(() => {
    if (!editingId) {
      setWorkOrderDeposits([]);
      return;
    }
    const loadDeposits = async () => {
      const { data } = await supabase
        .from('estimating_payments')
        .select('*')
        .eq('work_order_id', editingId)
        .eq('payment_type', 'deposit')
        .order('payment_date', { ascending: true });
      setWorkOrderDeposits(data || []);
    };
    loadDeposits();
  }, [editingId]);

  // Removed auto-creation of deposit payment links to prevent unnecessary API calls
  // Payment links will be created when user explicitly clicks "Request Deposit" button

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First fetch all work orders (only non-archived)
      const workOrdersQuery = supabase
        .from('work_orders')
        .select('*, yachts(name, manufacturer, model), customer_vessels(vessel_name, manufacturer, model)')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      // Fetch invoices to identify converted work orders
      const invoicesQuery = supabase
        .from('estimating_invoices')
        .select('work_order_id')
        .not('work_order_id', 'is', null);

      const [workOrdersResult, invoicesResult, yachtsResult, employeesResult, laborResult, partsResult, settingsResult, mercuryResult, marineWholesaleResult, packagesResult] = await Promise.all([
        workOrdersQuery,
        invoicesQuery,
        supabase
          .from('yachts')
          .select('id, name, marina_name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, role')
          .in('role', ['staff', 'master', 'mechanic'])
          .eq('is_active', true)
          .order('first_name'),
        supabase
          .from('labor_codes')
          .select('id, code, name, hourly_rate, is_taxable')
          .eq('is_active', true)
          .order('code'),
        supabase
          .from('parts_inventory')
          .select('id, part_number, alternative_part_numbers, name, unit_price, is_taxable')
          .eq('is_active', true)
          .order('part_number'),
        supabase
          .from('estimate_settings')
          .select('*')
          .maybeSingle(),
        supabase
          .from('mercury_marine_parts')
          .select('id, part_number, description, msrp, dealer_price, is_active')
          .eq('is_active', true)
          .order('part_number'),
        supabase
          .from('marine_wholesale_parts')
          .select('id, sku, mfg_part_number, description, list_price, cost, is_active')
          .order('sku'),
        supabase
          .from('estimate_packages')
          .select('id, name, description')
          .eq('is_active', true)
          .order('name')
      ]);

      if (workOrdersResult.error) throw workOrdersResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (yachtsResult.error) throw yachtsResult.error;
      if (employeesResult.error) throw employeesResult.error;
      if (laborResult.error) throw laborResult.error;
      if (partsResult.error) throw partsResult.error;

      // Filter out work orders that have been converted to invoices
      const convertedWorkOrderIds = new Set(
        (invoicesResult.data || []).map(inv => inv.work_order_id)
      );
      const unconvertedWorkOrders = (workOrdersResult.data || []).filter(
        wo => !convertedWorkOrderIds.has(wo.id)
      );

      setWorkOrders(unconvertedWorkOrders);
      setYachts(yachtsResult.data || []);
      setEmployees(employeesResult.data || []);

      if (unconvertedWorkOrders.length > 0) {
        const workOrderIds = unconvertedWorkOrders.map(wo => wo.id);
        const { data: tasksForWOs } = await supabase
          .from('work_order_tasks')
          .select('id, work_order_id')
          .in('work_order_id', workOrderIds);

        if (tasksForWOs && tasksForWOs.length > 0) {
          const taskIds = tasksForWOs.map(t => t.id);
          const [assignmentsResult, lineItemsResult] = await Promise.all([
            supabase
              .from('work_order_task_assignments')
              .select('task_id, employee_id, user_profiles!work_order_task_assignments_employee_id_fkey(first_name, last_name)')
              .in('task_id', taskIds),
            supabase
              .from('work_order_line_items')
              .select('task_id, line_type')
              .in('task_id', taskIds)
          ]);

          const assignmentsData = assignmentsResult.data || [];
          const allLineItems = lineItemsResult.data || [];

          const taskToWO: Record<string, string> = {};
          tasksForWOs.forEach(t => { taskToWO[t.id] = t.work_order_id; });

          const woEmpMap: Record<string, string[]> = {};
          (assignmentsData).forEach((a: any) => {
            const woId = taskToWO[a.task_id];
            if (!woId) return;
            const name = a.user_profiles
              ? `${a.user_profiles.first_name} ${a.user_profiles.last_name}`.trim()
              : '';
            if (!name) return;
            if (!woEmpMap[woId]) woEmpMap[woId] = [];
            if (!woEmpMap[woId].includes(name)) woEmpMap[woId].push(name);
          });
          setWorkOrderEmployees(woEmpMap);

          const assignedTaskIds = new Set(assignmentsData.map((a: any) => a.task_id));
          const tasksWithItemsIds = new Set(allLineItems.map((li: any) => li.task_id));
          const unassignedMap: Record<string, boolean> = {};
          tasksWithItemsIds.forEach(taskId => {
            if (!assignedTaskIds.has(taskId)) {
              const woId = taskToWO[taskId];
              if (woId) unassignedMap[woId] = true;
            }
          });
          setWorkOrderHasUnassigned(unassignedMap);
        }
      }
      setLaborCodes(laborResult.data || []);
      setParts(partsResult.data || []);
      setMercuryParts(mercuryResult.data || []);
      setMarineWholesaleParts(marineWholesaleResult.data || []);
      setPackages(packagesResult.data || []);

      if (settingsResult.data) {
        setFormData(prev => ({
          ...prev,
          sales_tax_rate: settingsResult.data.sales_tax_rate.toString(),
          shop_supplies_rate: settingsResult.data.shop_supplies_rate.toString(),
          park_fees_rate: settingsResult.data.park_fees_rate.toString(),
          surcharge_rate: settingsResult.data.surcharge_rate.toString()
        }));
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  const lookupCustomer = async (name: string) => {
    if (name.length < 2) {
      setCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
      return;
    }
    const { data } = await supabase
      .from('customers')
      .select('id, customer_type, first_name, last_name, business_name, email, phone')
      .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%,business_name.ilike.%${name}%`)
      .eq('is_active', true)
      .limit(8);
    if (data && data.length > 0) {
      setCustomerSuggestions(data.map(c => ({
        id: c.id,
        display_name: c.customer_type === 'business' ? c.business_name : `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email || '',
        phone: c.phone || ''
      })));
      setShowCustomerSuggestions(true);
    } else {
      setCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
    }
  };

  const loadArchivedWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: workOrdersError } = await supabase
        .from('work_orders')
        .select('*, yachts(name, manufacturer, model), customer_vessels(vessel_name, manufacturer, model)')
        .eq('archived', true)
        .order('created_at', { ascending: false });

      if (workOrdersError) throw workOrdersError;
      setWorkOrders(data || []);
    } catch (err) {
      console.error('Error loading archived work orders:', err);
      setError('Failed to load archived work orders');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveClick = (workOrderId: string) => {
    setWorkOrderToArchive(workOrderId);
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = async () => {
    if (!workOrderToArchive) return;

    setShowArchiveModal(false);

    try {
      setError(null);

      const { error: archiveError } = await supabase
        .from('work_orders')
        .update({ archived: true })
        .eq('id', workOrderToArchive);

      if (archiveError) throw archiveError;

      showSuccess('Work order archived successfully');
      await loadData();
      setWorkOrderToArchive(null);
    } catch (err) {
      console.error('Error archiving work order:', err);
      setError('Failed to archive work order');
    }
  };

  const handleRestoreWorkOrder = async (workOrderId: string) => {
    try {
      setError(null);

      const { error: restoreError } = await supabase
        .from('work_orders')
        .update({ archived: false })
        .eq('id', workOrderId);

      if (restoreError) throw restoreError;

      showSuccess('Work order restored successfully');
      await loadArchivedWorkOrders();
    } catch (err) {
      console.error('Error restoring work order:', err);
      setError('Failed to restore work order');
    }
  };

  const handleAddTask = () => {
    if (!taskFormData.task_name.trim()) {
      setError('Task name is required');
      return;
    }

    if (editingTaskIndex !== null) {
      const updatedTasks = [...tasks];
      updatedTasks[editingTaskIndex] = {
        ...updatedTasks[editingTaskIndex],
        task_name: taskFormData.task_name,
        task_overview: taskFormData.task_overview
      };
      setTasks(updatedTasks);
      setEditingTaskIndex(null);
    } else {
      const newTask: WorkOrderTask = {
        task_name: taskFormData.task_name,
        task_overview: taskFormData.task_overview,
        task_order: tasks.length,
        apply_surcharge: true,
        assignedEmployees: [],
        lineItems: []
      };
      setTasks([...tasks, newTask]);
      setExpandedTasks(new Set([...expandedTasks, tasks.length]));
    }

    setTaskFormData({ task_name: '', task_overview: '' });
    setShowTaskForm(false);
  };

  const handleEditTask = (index: number) => {
    const task = tasks[index];
    setTaskFormData({
      task_name: task.task_name,
      task_overview: task.task_overview
    });
    setEditingTaskIndex(index);
    setShowTaskForm(true);
  };

  const handleDeleteTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
    const newExpanded = new Set(expandedTasks);
    newExpanded.delete(index);
    setExpandedTasks(newExpanded);
  };

  const toggleTaskExpanded = (index: number) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTasks(newExpanded);
  };

  const handleAddLineItem = () => {
    if (activeTaskIndex === null) return;

    const quantity = parseFloat(lineItemFormData.quantity);
    const unit_price = parseFloat(lineItemFormData.unit_price);

    const updatedTasks = [...tasks];
    if (!updatedTasks[activeTaskIndex].lineItems) {
      updatedTasks[activeTaskIndex].lineItems = [];
    }

    const newLineItem: WorkOrderLineItem = {
      line_type: lineItemFormData.line_type,
      description: lineItemFormData.description,
      quantity,
      unit_price,
      total_price: quantity * unit_price,
      is_taxable: lineItemFormData.is_taxable,
      labor_code_id: lineItemFormData.labor_code_id || null,
      part_id: lineItemFormData.part_id || null,
      part_source: lineItemFormData.line_type === 'part'
        ? (lineItemFormData.mercury_part_id ? 'mercury' : lineItemFormData.marine_wholesale_part_id ? 'marine_wholesale' : lineItemFormData.part_id ? 'inventory' : 'custom')
        : null,
      mercury_part_id: lineItemFormData.mercury_part_id || null,
      marine_wholesale_part_id: lineItemFormData.marine_wholesale_part_id || null,
      line_order: updatedTasks[activeTaskIndex].lineItems.length,
      work_details: lineItemFormData.work_details || null
    };

    updatedTasks[activeTaskIndex].lineItems.push(newLineItem);
    setTasks(updatedTasks);

    setLineItemFormData({
      line_type: 'labor',
      description: '',
      quantity: '1',
      unit_price: '0',
      is_taxable: true,
      labor_code_id: '',
      part_id: '',
      part_source: 'all',
      mercury_part_id: '',
      marine_wholesale_part_id: '',
      part_number_search: '',
      work_details: ''
    });
    setShowLineItemForm(false);
    setActiveTaskIndex(null);
    setFilteredParts([]);
    setShowPartDropdown(false);
  };

  const handleRemoveLineItem = (taskIndex: number, lineIndex: number) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].lineItems = updatedTasks[taskIndex].lineItems.filter((_, i) => i !== lineIndex);
    setTasks(updatedTasks);
  };

  const handleAddPackage = async () => {
    if (activeTaskIndex === null || !selectedPackageId) return;

    try {
      const [packageLaborRes, packagePartsRes] = await Promise.all([
        supabase
          .from('estimate_package_labor')
          .select('*, labor_code:labor_codes(id, code, name, hourly_rate, is_taxable)')
          .eq('package_id', selectedPackageId),
        supabase
          .from('estimate_package_parts')
          .select('*, part:parts_inventory(id, part_number, name, unit_price, is_taxable)')
          .eq('package_id', selectedPackageId)
      ]);

      if (packageLaborRes.error) throw packageLaborRes.error;
      if (packagePartsRes.error) throw packagePartsRes.error;

      const updatedTasks = [...tasks];
      if (!updatedTasks[activeTaskIndex].lineItems) {
        updatedTasks[activeTaskIndex].lineItems = [];
      }

      const currentLineOrder = updatedTasks[activeTaskIndex].lineItems.length;
      const packageName = packages.find(p => p.id === selectedPackageId)?.name || 'Package';

      updatedTasks[activeTaskIndex].lineItems.push({
        line_type: 'labor',
        description: '',
        quantity: 0,
        unit_price: 0,
        total_price: 0,
        is_taxable: false,
        labor_code_id: null,
        part_id: null,
        line_order: currentLineOrder,
        work_details: null,
        package_header: packageName
      });

      packageLaborRes.data?.forEach((labor: any, index: number) => {
        updatedTasks[activeTaskIndex].lineItems.push({
          line_type: 'labor',
          description: labor.description || labor.labor_code?.name || '',
          quantity: labor.hours,
          unit_price: labor.rate,
          total_price: labor.hours * labor.rate,
          is_taxable: labor.labor_code?.is_taxable || false,
          labor_code_id: labor.labor_code_id,
          part_id: null,
          line_order: currentLineOrder + 1 + index,
          work_details: null
        });
      });

      const laborItemCount = packageLaborRes.data?.length || 0;
      packagePartsRes.data?.forEach((part: any, index: number) => {
        const partDescription =
          (part.part_number_display && part.description_display)
            ? `${part.part_number_display} - ${part.description_display}`
            : (part.part?.part_number && part.part?.name)
              ? `${part.part.part_number} - ${part.part.name}`
              : part.part_number_display || part.description_display || '';
        updatedTasks[activeTaskIndex].lineItems.push({
          line_type: 'part',
          description: partDescription,
          quantity: part.quantity,
          unit_price: part.unit_price,
          total_price: part.quantity * part.unit_price,
          is_taxable: (part.part_source === 'mercury' || part.part_source === 'marine_wholesale') ? true : (part.part_source === 'inventory' ? (part.part?.is_taxable ?? part.is_taxable ?? false) : (part.is_taxable ?? false)),
          labor_code_id: null,
          part_id: part.part_id,
          line_order: currentLineOrder + 1 + laborItemCount + index,
          work_details: null
        });
      });

      setTasks(updatedTasks);
      setShowPackageModal(false);
      setSelectedPackageId('');
      setActiveTaskIndex(null);
      showSuccess('Package added successfully');
    } catch (error) {
      console.error('Error adding package:', error);
      setError('Failed to add package');
    }
  };

  const handleSavePackageHeaderEdit = () => {
    if (!editingPackageHeader) return;
    const { taskIndex, lineIndex } = editingPackageHeader;
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].lineItems[lineIndex] = {
      ...updatedTasks[taskIndex].lineItems[lineIndex],
      package_header: packageHeaderEditValue.trim() || 'Package'
    };
    setTasks(updatedTasks);
    setEditingPackageHeader(null);
    setPackageHeaderEditValue('');
  };

  const handleLaborCodeChange = (laborCodeId: string) => {
    const laborCode = laborCodes.find(lc => lc.id === laborCodeId);
    if (laborCode) {
      setLineItemFormData({
        ...lineItemFormData,
        labor_code_id: laborCodeId,
        description: laborCode.name,
        unit_price: laborCode.hourly_rate.toString(),
        is_taxable: laborCode.is_taxable
      });
    }
  };

  const handlePartChange = (partId: string) => {
    const src = lineItemFormData.part_source;
    if (src === 'inventory') {
      const part = parts.find(p => p.id === partId);
      if (part) {
        setLineItemFormData({
          ...lineItemFormData,
          part_id: partId,
          mercury_part_id: '',
          marine_wholesale_part_id: '',
          part_number_search: part.part_number,
          description: `${part.part_number} - ${part.name}`,
          unit_price: part.unit_price.toString(),
          is_taxable: part.is_taxable
        });
      }
    } else if (src === 'mercury') {
      const part = mercuryParts.find(p => p.id === partId);
      if (part) {
        setLineItemFormData({
          ...lineItemFormData,
          part_id: '',
          mercury_part_id: partId,
          marine_wholesale_part_id: '',
          part_number_search: part.part_number,
          description: `${part.part_number} - ${part.description}`,
          unit_price: part.msrp.toString(),
          is_taxable: true
        });
      }
    } else if (src === 'marine_wholesale') {
      const part = marineWholesaleParts.find(p => p.id === partId);
      if (part) {
        setLineItemFormData({
          ...lineItemFormData,
          part_id: '',
          mercury_part_id: '',
          marine_wholesale_part_id: partId,
          part_number_search: part.sku,
          description: `${part.sku} - ${part.description}`,
          unit_price: part.list_price.toString(),
          is_taxable: true
        });
      }
    }
  };

  const handlePartNumberSearch = async (searchValue: string) => {
    setLineItemFormData({
      ...lineItemFormData,
      part_number_search: searchValue,
      part_id: '',
      mercury_part_id: '',
      marine_wholesale_part_id: ''
    });

    if (searchValue.trim()) {
      const src = lineItemFormData.part_source;
      const q = searchValue.toLowerCase();
      let filtered: any[] = [];

      if (src === 'inventory' || src === 'all') {
        for (const p of parts) {
          const altNum = (p.alternative_part_numbers || '').toLowerCase();
          const matches = p.part_number.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            altNum.includes(q);
          if (matches) {
            filtered.push({ ...p, _source: 'inventory', _source_label: 'Inventory', _display_number: p.part_number, _display_name: p.name, _price: p.unit_price, _is_alt: false });
            if (p.alternative_part_numbers) {
              filtered.push({
                ...p,
                id: p.id + '_alt',
                _real_id: p.id,
                part_number: p.alternative_part_numbers,
                alternative_part_numbers: p.part_number,
                _source: 'inventory',
                _source_label: 'Inventory',
                _display_number: p.alternative_part_numbers,
                _display_name: p.name,
                _price: p.unit_price,
                _is_alt: true
              });
            }
          }
        }
      }
      if (src === 'mercury' || src === 'all') {
        const merc = mercuryParts
          .filter(p =>
            p.part_number.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
          )
          .map(p => ({ ...p, _source: 'mercury', _source_label: 'Mercury Marine', _display_number: p.part_number, _display_name: p.description, _price: p.msrp }));
        filtered = filtered.concat(merc);
      }
      if (src === 'marine_wholesale' || src === 'all') {
        const { data: mwData } = await supabase
          .from('marine_wholesale_parts')
          .select('id, sku, mfg_part_number, description, list_price, cost')
          .or(`sku.ilike.%${searchValue}%,mfg_part_number.ilike.%${searchValue}%,description.ilike.%${searchValue}%`)
          .limit(50);
        const mw = (mwData || []).map(p => ({ ...p, _source: 'marine_wholesale', _source_label: 'Marine Wholesale', _display_number: p.sku, _display_name: p.description, _price: p.list_price }));
        filtered = filtered.concat(mw);
      }

      setFilteredParts(filtered.slice(0, 80));
      setShowPartDropdown(filtered.length > 0);
    } else {
      setFilteredParts([]);
      setShowPartDropdown(false);
    }
  };

  const handleSelectPartFromDropdown = (part: any) => {
    const src = part._source || lineItemFormData.part_source;
    const realId = part._real_id || part.id;
    setLineItemFormData({
      ...lineItemFormData,
      part_id: src === 'inventory' ? realId : '',
      mercury_part_id: src === 'mercury' ? part.id : '',
      marine_wholesale_part_id: src === 'marine_wholesale' ? part.id : '',
      part_source: src,
      part_number_search: part._display_number,
      description: `${part._display_number} - ${part._display_name}`,
      unit_price: (part._price || 0).toString(),
      is_taxable: (src === 'mercury' || src === 'marine_wholesale') ? true : (part.is_taxable ?? true)
    });
    setShowPartDropdown(false);
    setFilteredParts([]);
  };

  const handleAssignEmployee = (taskIndex: number, employeeId: string) => {
    const updatedTasks = [...tasks];
    const currentEmployees = updatedTasks[taskIndex].assignedEmployees || [];

    if (currentEmployees.includes(employeeId)) {
      updatedTasks[taskIndex].assignedEmployees = currentEmployees.filter(id => id !== employeeId);
    } else {
      updatedTasks[taskIndex].assignedEmployees = [...currentEmployees, employeeId];
    }

    setTasks(updatedTasks);
  };

  const calculateSubtotal = () => {
    return tasks.reduce((sum, task) =>
      sum + task.lineItems.reduce((taskSum, item) => taskSum + item.total_price, 0), 0
    );
  };

  const calculateTaxableSubtotal = () => {
    return tasks.reduce((sum, task) =>
      sum + task.lineItems.reduce((taskSum, item) =>
        item.is_taxable ? taskSum + item.total_price : taskSum, 0), 0
    );
  };

  const calculateSurchargeableSubtotal = () => {
    return tasks.reduce((sum, task) => {
      if (!task.apply_surcharge) return sum;
      return sum + task.lineItems.reduce((taskSum, item) => taskSum + item.total_price, 0);
    }, 0);
  };

  const calculateSalesTax = () => {
    return calculateTaxableSubtotal() * parseFloat(formData.sales_tax_rate || '0');
  };

  const calculateShopSupplies = () => {
    if (!formData.apply_shop_supplies) return 0;
    return calculateSubtotal() * parseFloat(formData.shop_supplies_rate || '0');
  };

  const calculateParkFees = () => {
    if (!formData.apply_park_fees) return 0;
    return calculateSubtotal() * parseFloat(formData.park_fees_rate || '0');
  };

  const calculateSurcharge = () => {
    return calculateSurchargeableSubtotal() * parseFloat(formData.surcharge_rate || '0');
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const salesTax = calculateSalesTax();
    const shopSupplies = calculateShopSupplies();
    const parkFees = calculateParkFees();
    const surcharge = calculateSurcharge();
    return subtotal + salesTax + shopSupplies + parkFees + surcharge;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (tasks.length === 0) {
      setError('Please add at least one task');
      return;
    }

    const hasLineItems = tasks.some(task => task.lineItems.length > 0);
    if (!hasLineItems) {
      setError('Please add at least one line item to a task');
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);

      const subtotal = calculateSubtotal();
      const salesTaxRate = parseFloat(formData.sales_tax_rate);
      const salesTaxAmount = calculateSalesTax();
      const shopSuppliesRate = parseFloat(formData.shop_supplies_rate);
      const shopSuppliesAmount = calculateShopSupplies();
      const parkFeesRate = parseFloat(formData.park_fees_rate);
      const parkFeesAmount = calculateParkFees();
      const surchargeRate = parseFloat(formData.surcharge_rate);
      const surchargeAmount = calculateSurcharge();
      const totalAmount = calculateTotal();

      if (!editingId) {
        setError('Cannot create new work orders from this interface');
        return;
      }

      const depositAmount = formData.deposit_amount ? parseFloat(formData.deposit_amount) : null;

      const workOrderData = {
        yacht_id: formData.is_retail_customer ? null : formData.yacht_id,
        customer_name: formData.is_retail_customer ? formData.customer_name : null,
        customer_email: formData.is_retail_customer ? formData.customer_email : null,
        customer_phone: formData.is_retail_customer ? formData.customer_phone : null,
        is_retail_customer: formData.is_retail_customer,
        marina_name: formData.is_retail_customer ? null : formData.marina_name || null,
        manager_name: formData.is_retail_customer ? null : formData.manager_name || null,
        manager_email: formData.is_retail_customer ? null : formData.manager_email || null,
        manager_phone: formData.is_retail_customer ? null : formData.manager_phone || null,
        subtotal,
        sales_tax_rate: salesTaxRate,
        sales_tax_amount: salesTaxAmount,
        shop_supplies_rate: shopSuppliesRate,
        shop_supplies_amount: shopSuppliesAmount,
        park_fees_rate: parkFeesRate,
        park_fees_amount: parkFeesAmount,
        surcharge_rate: surchargeRate,
        surcharge_amount: surchargeAmount,
        total_amount: totalAmount,
        notes: formData.notes || null,
        customer_notes: formData.customer_notes || null,
        deposit_required: formData.deposit_required,
        deposit_amount: depositAmount,
        deposit_payment_method_type: formData.deposit_payment_method_type,
        deposit_payment_status: formData.deposit_required && depositAmount ? 'not_required' : 'not_required'
      };

      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .update(workOrderData)
        .eq('id', editingId)
        .select()
        .single();

      if (workOrderError) throw workOrderError;

      const { error: deleteTasksError } = await supabase
        .from('work_order_tasks')
        .delete()
        .eq('work_order_id', editingId);

      if (deleteTasksError) throw deleteTasksError;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        const { data: workOrderTask, error: taskError } = await supabase
          .from('work_order_tasks')
          .insert({
            work_order_id: workOrder.id,
            task_name: task.task_name,
            task_overview: task.task_overview,
            task_order: i,
            apply_surcharge: task.apply_surcharge
          })
          .select()
          .single();

        if (taskError) throw taskError;

        if (task.lineItems.length > 0) {
          const lineItemsToInsert = task.lineItems.map((item, index) => ({
            work_order_id: workOrder.id,
            task_id: workOrderTask.id,
            line_type: item.line_type,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            is_taxable: item.is_taxable ?? true,
            labor_code_id: item.labor_code_id || null,
            part_id: item.part_id || null,
            part_source: item.part_source || null,
            mercury_part_id: item.mercury_part_id || null,
            marine_wholesale_part_id: item.marine_wholesale_part_id || null,
            work_details: item.work_details || null,
            package_header: item.package_header || null,
            line_order: index
          }));

          const { error: lineItemsError } = await supabase
            .from('work_order_line_items')
            .insert(lineItemsToInsert);

          if (lineItemsError) throw lineItemsError;
        }

        if (task.assignedEmployees && task.assignedEmployees.length > 0) {
          const assignmentsToInsert = task.assignedEmployees.map(employeeId => ({
            task_id: workOrderTask.id,
            employee_id: employeeId,
            assigned_by: userId
          }));

          const { error: assignmentsError } = await supabase
            .from('work_order_task_assignments')
            .insert(assignmentsToInsert);

          if (assignmentsError) throw assignmentsError;
        }
      }

      showSuccess('Work order updated successfully!');

      await resetForm();
      await loadData();
    } catch (err: any) {
      console.error('Error saving work order:', err);
      setError(err.message || 'Failed to save work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    const ok = await confirm({ title: 'Cancel Editing', message: 'Are you sure you want to cancel editing?', variant: 'warning' });
    if (ok) {
      resetForm();
    }
  };

  const resetForm = async () => {
    const settingsResult = await supabase
      .from('estimate_settings')
      .select('*')
      .maybeSingle();

    const defaultRates = settingsResult.data ? {
      sales_tax_rate: settingsResult.data.sales_tax_rate.toString(),
      shop_supplies_rate: settingsResult.data.shop_supplies_rate.toString(),
      park_fees_rate: settingsResult.data.park_fees_rate.toString(),
      surcharge_rate: settingsResult.data.surcharge_rate.toString()
    } : {
      sales_tax_rate: '0.08',
      shop_supplies_rate: '0.05',
      park_fees_rate: '0.02',
      surcharge_rate: '0.03'
    };

    setFormData({
      is_retail_customer: false,
      yacht_id: '',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      marina_name: '',
      manager_name: '',
      manager_email: '',
      manager_phone: '',
      ...defaultRates,
      apply_shop_supplies: true,
      apply_park_fees: true,
      notes: '',
      customer_notes: ''
    });
    setTasks([]);
    setShowForm(false);
    setEditingId(null);
    setShowTaskForm(false);
    setEditingTaskIndex(null);
    setExpandedTasks(new Set());
  };

  const handleEditWorkOrder = async (workOrderId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', workOrderId)
        .single();

      if (workOrderError) throw workOrderError;

      const { data: tasksData, error: tasksError } = await supabase
        .from('work_order_tasks')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('task_order');

      if (tasksError) throw tasksError;

      const { data: allLineItems, error: lineItemsError } = await supabase
        .from('work_order_line_items')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('line_order');

      if (lineItemsError) throw lineItemsError;

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('work_order_task_assignments')
        .select('task_id, employee_id')
        .in('task_id', (tasksData || []).map(t => t.id));

      if (assignmentsError) throw assignmentsError;

      const assignmentsByTask: Record<string, string[]> = {};
      (assignmentsData || []).forEach((assignment: any) => {
        if (!assignmentsByTask[assignment.task_id]) {
          assignmentsByTask[assignment.task_id] = [];
        }
        assignmentsByTask[assignment.task_id].push(assignment.employee_id);
      });

      let resolvedEmail = workOrder.customer_email || '';
      if (!resolvedEmail && workOrder.is_retail_customer && workOrder.customer_name) {
        const nameParts = workOrder.customer_name.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        let custEmail = '';
        if (firstName && lastName) {
          const { data: byName } = await supabase
            .from('customers')
            .select('email')
            .ilike('first_name', firstName)
            .ilike('last_name', lastName)
            .not('email', 'is', null)
            .maybeSingle();
          custEmail = byName?.email || '';
        }
        if (!custEmail) {
          const { data: byBiz } = await supabase
            .from('customers')
            .select('email')
            .ilike('business_name', workOrder.customer_name)
            .not('email', 'is', null)
            .maybeSingle();
          custEmail = byBiz?.email || '';
        }
        if (custEmail) {
          resolvedEmail = custEmail;
          await supabase.from('work_orders').update({ customer_email: resolvedEmail }).eq('id', workOrderId);
        }
      }

      setFormData({
        is_retail_customer: workOrder.is_retail_customer,
        yacht_id: workOrder.yacht_id || '',
        customer_name: workOrder.customer_name || '',
        customer_email: resolvedEmail,
        customer_phone: workOrder.customer_phone || '',
        marina_name: workOrder.marina_name || '',
        manager_name: workOrder.manager_name || '',
        manager_email: workOrder.manager_email || '',
        manager_phone: workOrder.manager_phone || '',
        sales_tax_rate: (workOrder.sales_tax_rate || 0).toString(),
        shop_supplies_rate: (workOrder.shop_supplies_rate || 0).toString(),
        park_fees_rate: (workOrder.park_fees_rate || 0).toString(),
        surcharge_rate: (workOrder.surcharge_rate || 0).toString(),
        apply_shop_supplies: (workOrder.shop_supplies_amount || 0) > 0,
        apply_park_fees: (workOrder.park_fees_amount || 0) > 0,
        notes: workOrder.notes || '',
        customer_notes: workOrder.customer_notes || '',
        deposit_required: workOrder.deposit_required || false,
        deposit_amount: workOrder.deposit_amount ? workOrder.deposit_amount.toString() : '',
        deposit_payment_method_type: workOrder.deposit_payment_method_type || 'card'
      });

      const lineItemsByTask: Record<string, any[]> = {};
      (allLineItems || []).forEach((item: any) => {
        if (item.task_id) {
          if (!lineItemsByTask[item.task_id]) {
            lineItemsByTask[item.task_id] = [];
          }
          lineItemsByTask[item.task_id].push(item);
        }
      });

      const loadedTasks: WorkOrderTask[] = (tasksData || []).map(task => {
        const taskLineItems = (lineItemsByTask[task.id] || [])
          .sort((a: any, b: any) => a.line_order - b.line_order)
          .map((item: any) => ({
            id: item.id,
            task_id: item.task_id,
            line_type: item.line_type,
            description: item.description || '',
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            total_price: item.total_price || 0,
            is_taxable: item.is_taxable ?? true,
            labor_code_id: item.labor_code_id,
            part_id: item.part_id,
            part_source: item.part_source || null,
            mercury_part_id: item.mercury_part_id || null,
            marine_wholesale_part_id: item.marine_wholesale_part_id || null,
            line_order: item.line_order || 0,
            work_details: item.work_details,
            package_header: item.package_header || null
          }));

        return {
          id: task.id,
          task_name: task.task_name || '',
          task_overview: task.task_overview || '',
          task_order: task.task_order || 0,
          apply_surcharge: task.apply_surcharge ?? true,
          assignedEmployees: assignmentsByTask[task.id] || [],
          lineItems: taskLineItems
        };
      });

      setTasks(loadedTasks);

      const allTaskIndexes = loadedTasks.map((_, index) => index);
      setExpandedTasks(new Set(allTaskIndexes));

      setEditingId(workOrderId);
      setShowForm(true);
      setLoading(false);
    } catch (err) {
      console.error('Error loading work order:', err);
      setError('Failed to load work order');
      setLoading(false);
    }
  };

  const handleDeleteWorkOrder = async (workOrderId: string) => {
    const ok = await confirm({ title: 'Delete Work Order', message: 'Are you sure you want to delete this work order? This action cannot be undone.', variant: 'danger', confirmText: 'Delete' });
    if (!ok) return;

    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', workOrderId);

      if (deleteError) throw deleteError;

      await loadData();
    } catch (err) {
      console.error('Error deleting work order:', err);
      setError('Failed to delete work order');
    }
  };

  const handleCompleteWorkOrder = async (workOrderId: string) => {
    const ok = await confirm({ title: 'Complete Work Order', message: 'Mark this work order as completed?', confirmText: 'Complete' });
    if (!ok) return;

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

      showSuccess('Work order marked as completed!');
      await loadData();
    } catch (err: any) {
      console.error('Error completing work order:', err);
      setError(err.message || 'Failed to complete work order');
    }
  };

  const handleConvertToInvoice = async (workOrderId: string) => {
    const ok = await confirm({ title: 'Convert to Invoice', message: 'Convert this completed work order to an invoice? This will create a new invoice record.' });
    if (!ok) return;

    try {
      setError(null);

      const { data, error: convertError } = await supabase
        .rpc('convert_work_order_to_invoice', {
          p_work_order_id: workOrderId,
          p_user_id: userId
        });

      if (convertError) throw convertError;

      showSuccess('Work order converted to invoice successfully!');
      await loadData();
    } catch (err: any) {
      console.error('Error converting to invoice:', err);
      setError(err.message || 'Failed to convert work order to invoice');
    }
  };

  const handleRequestDeposit = async (workOrderId: string) => {
    const workOrder = workOrders.find(wo => wo.id === workOrderId);
    if (!workOrder || !workOrder.deposit_amount || workOrder.deposit_amount <= 0) {
      setError('Please set a deposit amount first');
      return;
    }

    setDepositLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-work-order-deposit-payment`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workOrderId
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate deposit payment link');
      }

      // Fetch the updated work order
      const { data: updatedWorkOrder, error: fetchError } = await supabase
        .from('work_orders')
        .select('*, yachts(name, manufacturer, model), customer_vessels(vessel_name, manufacturer, model)')
        .eq('id', workOrderId)
        .single();

      if (fetchError) throw fetchError;

      // Update editingWorkOrder if this is the one being edited
      if (editingWorkOrder?.id === workOrderId) {
        setEditingWorkOrder(updatedWorkOrder);
      }

      await loadData();
      showSuccess('Deposit payment link generated!');
    } catch (error: any) {
      console.error('Error generating deposit link:', error);
      setError(`Error: ${error.message || 'Failed to generate deposit link'}`);
    } finally {
      setDepositLoading(false);
    }
  };

  const handleRecordDepositCheck = async (workOrderId: string) => {
    const workOrder = workOrders.find(wo => wo.id === workOrderId);
    if (!workOrder) return;

    const amount = parseFloat(depositCheckForm.amount);
    if (!depositCheckForm.checkNumber.trim()) {
      setError('Check number is required');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    setDepositCheckLoading(true);
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile?.company_id) throw new Error('Company not found');

      const { error: paymentError } = await supabase
        .from('estimating_payments')
        .insert({
          company_id: profile.company_id,
          payment_type: 'deposit',
          work_order_id: workOrderId,
          yacht_id: workOrder.yacht_id,
          customer_name: workOrder.customer_name || workOrder.yachts?.name || null,
          customer_email: workOrder.customer_email,
          is_retail_customer: workOrder.is_retail_customer,
          amount,
          payment_method: 'check',
          reference_number: depositCheckForm.checkNumber.trim(),
          notes: depositCheckForm.notes.trim() || null,
          recorded_by: userId,
          payment_date: new Date().toISOString()
        });

      if (paymentError) throw paymentError;

      if (!workOrder.deposit_paid_at) {
        const { error: woError } = await supabase
          .from('work_orders')
          .update({
            deposit_payment_status: 'paid',
            deposit_paid_at: new Date().toISOString(),
            deposit_payment_method_type: 'check',
            deposit_check_number: depositCheckForm.checkNumber.trim(),
            deposit_check_recorded_at: new Date().toISOString()
          })
          .eq('id', workOrderId);

        if (woError) throw woError;
      }

      const checkNum = depositCheckForm.checkNumber;
      setDepositCheckModal(null);
      setDepositCheckForm({ checkNumber: '', amount: '', notes: '' });
      await loadData();
      const { data: freshDeposits } = await supabase
        .from('estimating_payments')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('payment_type', 'deposit')
        .order('payment_date', { ascending: true });
      setWorkOrderDeposits(freshDeposits || []);
      showSuccess(`Check #${checkNum} recorded as deposit`);
    } catch (err: any) {
      console.error('Error recording deposit check:', err);
      setError(err.message || 'Failed to record check deposit');
    } finally {
      setDepositCheckLoading(false);
    }
  };

  const handleSendDepositEmail = async (workOrder: WorkOrder) => {
    const recipientEmail = depositEmailRecipient || workOrder.deposit_email_recipient || workOrder.customer_email;

    if (!workOrder.deposit_payment_link_url || !recipientEmail) {
      setError('Payment link and recipient email are required');
      return;
    }

    setSendingDepositEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const sendApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-deposit-request-email`;
      const sendResponse = await fetch(sendApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workOrderId: workOrder.id,
          recipientEmail: recipientEmail,
          recipientName: depositEmailRecipientName || workOrder.customer_name || recipientEmail
        })
      });

      const sendResult = await sendResponse.json();

      if (!sendResult.success) {
        throw new Error(sendResult.error || 'Failed to send deposit request email');
      }

      await loadData();
      showSuccess('Deposit request email sent successfully!');
      setDepositEmailRecipient('');
      setDepositEmailRecipientName('');
    } catch (error: any) {
      console.error('Error sending deposit email:', error);
      setError(`Error: ${error.message || 'Failed to send email'}`);
    } finally {
      setSendingDepositEmail(false);
    }
  };

  const handleSyncPaymentStatus = async (workOrder: WorkOrder) => {
    setSyncingPayment({ ...syncingPayment, [workOrder.id]: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const syncApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-payment`;
      const response = await fetch(syncApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workOrderId: workOrder.id,
          type: 'work_order_deposit'
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to sync payment status');
      }

      await loadData();

      if (result.status === 'paid') {
        showSuccess('Payment confirmed! Deposit has been paid.');
      } else {
        showSuccess('Payment status synced. Still awaiting payment.');
      }
    } catch (error: any) {
      console.error('Error syncing payment:', error);
      setError(`Error: ${error.message || 'Failed to sync payment'}`);
    } finally {
      setSyncingPayment({ ...syncingPayment, [workOrder.id]: false });
    }
  };

  const handleCheckEmailStatus = async (workOrder: WorkOrder) => {
    setCheckingEmailStatus({ ...checkingEmailStatus, [workOrder.id]: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const checkApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-email-status`;
      const response = await fetch(checkApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workOrderId: workOrder.id,
          emailType: 'work_order_deposit'
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to check email status');
      }

      await loadData();
      showSuccess('Email status updated!');
    } catch (error: any) {
      console.error('Error checking email status:', error);
      setError(`Error: ${error.message || 'Failed to check email status'}`);
    } finally {
      setCheckingEmailStatus({ ...checkingEmailStatus, [workOrder.id]: false });
    }
  };

  const handleCopyDepositLink = async (workOrder: WorkOrder) => {
    if (!workOrder.deposit_payment_link_url) return;

    try {
      await navigator.clipboard.writeText(workOrder.deposit_payment_link_url);
      showSuccess('Payment link copied to clipboard!');
    } catch (err) {
      console.error('Error copying link:', err);
      setError('Failed to copy payment link');
    }
  };

  const handlePrintWorkOrder = async (workOrderId: string) => {
    try {
      setError(null);

      const { data: workOrderData, error: workOrderError } = await supabase
        .from('work_orders')
        .select('*, yachts(name, manufacturer, model), customer_vessels(vessel_name, manufacturer, model)')
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

      const { data: depositsData } = await supabase
        .from('estimating_payments')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('payment_type', 'deposit')
        .order('payment_date', { ascending: true });

      const workOrderWithEstimates = {
        ...workOrderData,
        estimates: {
          subtotal: workOrderData.subtotal || 0,
          sales_tax_rate: workOrderData.sales_tax_rate || 0,
          sales_tax_amount: workOrderData.sales_tax_amount || 0,
          shop_supplies_rate: workOrderData.shop_supplies_rate || 0,
          shop_supplies_amount: workOrderData.shop_supplies_amount || 0,
          park_fees_rate: workOrderData.park_fees_rate || 0,
          park_fees_amount: workOrderData.park_fees_amount || 0,
          surcharge_rate: workOrderData.surcharge_rate || 0,
          surcharge_amount: workOrderData.surcharge_amount || 0,
          total_amount: workOrderData.total_amount || 0,
          notes: workOrderData.notes,
          customer_notes: workOrderData.customer_notes
        },
        deposits: depositsData || []
      };

      const pdf = await generateWorkOrderPDF(workOrderWithEstimates, tasksWithLineItems, yachtName, companyInfo);

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
      waiting_for_parts: 'bg-orange-100 text-orange-800',
      in_process: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.pending;
  };

  const handleStatusChange = async (workOrderId: string, newStatus: string) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('work_orders')
        .update({ status: newStatus })
        .eq('id', workOrderId);

      if (updateError) throw updateError;

      showSuccess(`Work order status updated to ${newStatus.replace('_', ' ')}!`);
      await loadData();
    } catch (err: any) {
      console.error('Error updating status:', err);
      setError(err.message || 'Failed to update status');
    }
  };

  const handleSaveWorkTitle = async (workOrderId: string) => {
    const trimmed = workTitleDraft.trim();
    setEditingWorkTitle(null);
    try {
      await supabase
        .from('work_orders')
        .update({ work_title: trimmed || null })
        .eq('id', workOrderId);
      setWorkOrders(prev => prev.map(wo => wo.id === workOrderId ? { ...wo, work_title: trimmed || null } : wo));
    } catch (err) {
      console.error('Failed to save work title', err);
    }
  };

  const canDeleteAssignedEmployees = userProfile?.role === 'master' || userProfile?.role === 'staff';

  const handlePreviewTimeEntries = async (workOrderId: string) => {
    try {
      setError(null);
      const { data, error: previewError } = await supabase.rpc('preview_work_order_time_entries', {
        p_work_order_id: workOrderId
      });

      if (previewError) throw previewError;

      setTimeEntryPreview(data || []);
      setSelectedWorkOrderForTime(workOrderId);
      setShowTimeEntryPreview(true);
    } catch (err: any) {
      console.error('Error previewing time entries:', err);
      setError(err.message || 'Failed to preview time entries');
    }
  };

  const handleCreateTimeEntries = async () => {
    if (!selectedWorkOrderForTime) return;

    try {
      setError(null);
      setIsSubmitting(true);

      const { data, error: createError } = await supabase.rpc('create_time_entries_from_work_order', {
        p_work_order_id: selectedWorkOrderForTime,
        p_created_by: userId
      });

      if (createError) throw createError;

      showSuccess(`Created ${data.entries_created} time entries successfully!`);
      setShowTimeEntryPreview(false);
      setTimeEntryPreview([]);
      setSelectedWorkOrderForTime(null);
    } catch (err: any) {
      console.error('Error creating time entries:', err);
      setError(err.message || 'Failed to create time entries');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !showForm) {
    return <div className="p-8 text-center">Loading work orders...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ConfirmDialog />
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Work Orders</h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {!showForm && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setActiveTab('active');
                  loadData();
                }}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'active'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active Work Orders
              </button>
              <button
                onClick={() => {
                  setActiveTab('archived');
                  loadArchivedWorkOrders();
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
      )}

      {showTimeEntryPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Preview Time Entries</h3>
              <p className="text-sm text-gray-600 mt-1">
                Labor hours will be divided equally among assigned employees
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {timeEntryPreview.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No time entries to create. Tasks need labor hours and assigned employees.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(
                    timeEntryPreview.reduce((acc: any, entry: any) => {
                      if (!acc[entry.task_id]) {
                        acc[entry.task_id] = {
                          task_name: entry.task_name,
                          total_hours: entry.total_task_hours,
                          employee_count: entry.employee_count,
                          employees: []
                        };
                      }
                      acc[entry.task_id].employees.push({
                        name: entry.employee_name,
                        hours: entry.employee_hours
                      });
                      return acc;
                    }, {})
                  ).map(([taskId, task]: [string, any]) => (
                    <div key={taskId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{task.task_name}</h4>
                          <p className="text-sm text-gray-600">
                            Total: {task.total_hours} hours ÷ {task.employee_count} employee{task.employee_count !== 1 ? 's' : ''} = {(task.total_hours / task.employee_count).toFixed(2)} hours each
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {task.employees.map((emp: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                            <span className="text-sm font-medium text-gray-900">{emp.name}</span>
                            <span className="text-sm text-blue-600 font-semibold">{emp.hours} hours</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTimeEntryPreview(false);
                  setTimeEntryPreview([]);
                  setSelectedWorkOrderForTime(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              {timeEntryPreview.length > 0 && (
                <button
                  onClick={handleCreateTimeEntries}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  {isSubmitting ? 'Creating...' : 'Create Time Entries'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Edit Work Order</h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons */}
          {editingId && (() => {
            const currentWorkOrder = workOrders.find(wo => wo.id === editingId);
            if (!currentWorkOrder) return null;

            return (
              <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => handlePrintWorkOrder(currentWorkOrder.id)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm font-medium"
                >
                  <Printer className="w-4 h-4" />
                  Print Work Order
                </button>
                {currentWorkOrder.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => handleCompleteWorkOrder(currentWorkOrder.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Completed
                  </button>
                )}
                {currentWorkOrder.status === 'completed' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConvertToInvoice(currentWorkOrder.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Convert to Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreviewTimeEntries(currentWorkOrder.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
                    >
                      <Clock className="w-4 h-4" />
                      Create Time Entries
                    </button>
                  </>
                )}
                {currentWorkOrder.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkOrder(currentWorkOrder.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-medium ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Work Order
                  </button>
                )}
              </div>
            );
          })()}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_retail_customer}
                  disabled
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Retail Customer</span>
              </label>
            </div>

            {formData.is_retail_customer ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => {
                      setFormData({ ...formData, customer_name: e.target.value });
                      lookupCustomer(e.target.value);
                    }}
                    onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 150)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                  />
                  {showCustomerSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {customerSuggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => {
                            setFormData({ ...formData, customer_name: c.display_name, customer_email: c.email, customer_phone: c.phone });
                            setShowCustomerSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm"
                        >
                          <span className="font-medium text-gray-900">{c.display_name}</span>
                          {c.email && <span className="text-gray-500 ml-2">{c.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yacht</label>
                  <select
                    value={formData.yacht_id}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900"
                  >
                    <option value="">Select a yacht</option>
                    {yachts.map((yacht) => (
                      <option key={yacht.id} value={yacht.id}>{yacht.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="col-span-2">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Repair Approval Manager</h4>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marina Name</label>
                    <input
                      type="text"
                      value={formData.marina_name}
                      onChange={(e) => setFormData({ ...formData, marina_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="Marina name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name</label>
                    <input
                      type="text"
                      value={formData.manager_name}
                      onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="Manager name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manager Email</label>
                    <input
                      type="email"
                      value={formData.manager_email}
                      onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="manager@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manager Phone</label>
                    <input
                      type="tel"
                      value={formData.manager_phone}
                      onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Tasks Section - Same as Estimates */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-md font-semibold text-gray-900">Tasks</h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskForm(true);
                    setEditingTaskIndex(null);
                    setTaskFormData({ task_name: '', task_overview: '' });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>

              {showTaskForm && editingTaskIndex === null && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
                    <input
                      type="text"
                      required
                      value={taskFormData.task_name}
                      onChange={(e) => setTaskFormData({ ...taskFormData, task_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task Overview</label>
                    <textarea
                      value={taskFormData.task_overview}
                      onChange={(e) => setTaskFormData({ ...taskFormData, task_overview: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTaskForm(false);
                        setEditingTaskIndex(null);
                        setTaskFormData({ task_name: '', task_overview: '' });
                      }}
                      className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTask}
                      className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              )}

              {tasks.length > 0 && (
                <div className="space-y-3">
                  {tasks.map((task, taskIndex) => (
                    <div key={taskIndex} className="border border-gray-300 rounded-lg overflow-hidden">
                      {editingTaskIndex === taskIndex ? (
                        <div className="p-4 bg-blue-50 border-b border-blue-200 space-y-3">
                          <h5 className="font-medium text-gray-900">Edit Task</h5>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
                            <input
                              type="text"
                              required
                              value={taskFormData.task_name}
                              onChange={(e) => setTaskFormData({ ...taskFormData, task_name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Task Overview</label>
                            <textarea
                              value={taskFormData.task_overview}
                              onChange={(e) => setTaskFormData({ ...taskFormData, task_overview: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                              rows={3}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowTaskForm(false);
                                setEditingTaskIndex(null);
                                setTaskFormData({ task_name: '', task_overview: '' });
                              }}
                              className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleAddTask}
                              className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                            >
                              Update Task
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleTaskExpanded(taskIndex)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            {expandedTasks.has(taskIndex) ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900">{task.task_name}</h5>
                            {task.task_overview && (
                              <p className="text-sm text-gray-600 mt-1">{task.task_overview}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {task.lineItems.length} line item{task.lineItems.length !== 1 ? 's' : ''} -
                              ${task.lineItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditTask(taskIndex)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(taskIndex)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {expandedTasks.has(taskIndex) && (
                        <div className="p-4 bg-white">
                          <div className="mb-4 pb-4 border-b border-gray-200 bg-gray-50 p-3 rounded-lg">
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                              Assigned Employees
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {(task.assignedEmployees || []).map(employeeId => {
                                const employee = employees.find(e => e.user_id === employeeId);
                                return employee ? (
                                  <span
                                    key={employeeId}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium"
                                  >
                                    {employee.first_name} {employee.last_name}
                                    {canDeleteAssignedEmployees && (
                                      <button
                                        type="button"
                                        onClick={() => handleAssignEmployee(taskIndex, employeeId)}
                                        className="hover:text-gray-200 ml-1"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </span>
                                ) : null;
                              })}
                              {(!task.assignedEmployees || task.assignedEmployees.length === 0) && (
                                <span className="text-sm text-gray-600 italic">No employees assigned</span>
                              )}
                            </div>
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignEmployee(taskIndex, e.target.value);
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white text-gray-900"
                            >
                              <option value="" className="text-gray-500">Select employee to assign...</option>
                              {employees.map(employee => (
                                <option
                                  key={employee.user_id}
                                  value={employee.user_id}
                                  disabled={(task.assignedEmployees || []).includes(employee.user_id)}
                                  className="text-gray-900"
                                >
                                  {employee.first_name} {employee.last_name} ({employee.role})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-medium text-gray-700">Line Items</span>
                            <div className="flex items-center gap-3">
                              {packages.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTaskIndex(taskIndex);
                                    setShowPackageModal(true);
                                  }}
                                  className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                                >
                                  <Package className="w-4 h-4" />
                                  Add Package
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTaskIndex(taskIndex);
                                  setShowLineItemForm(true);
                                }}
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                Add Line
                              </button>
                            </div>
                          </div>

                          {task.lineItems.length > 0 && (
                            <>
                              <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
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
                                    {task.lineItems.map((item, lineIndex) => (
                                      item.package_header ? (
                                        <tr key={lineIndex} className="border-t bg-green-50">
                                          <td colSpan={4} className="px-3 py-2">
                                            {editingPackageHeader?.taskIndex === taskIndex && editingPackageHeader?.lineIndex === lineIndex ? (
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="text"
                                                  value={packageHeaderEditValue}
                                                  onChange={(e) => setPackageHeaderEditValue(e.target.value)}
                                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePackageHeaderEdit(); if (e.key === 'Escape') { setEditingPackageHeader(null); setPackageHeaderEditValue(''); } }}
                                                  autoFocus
                                                  className="px-2 py-1 border border-green-400 rounded text-xs font-semibold text-green-700 uppercase tracking-wide bg-white focus:ring-2 focus:ring-green-400 w-48"
                                                />
                                                <button type="button" onClick={handleSavePackageHeaderEdit} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                                                <button type="button" onClick={() => { setEditingPackageHeader(null); setPackageHeaderEditValue(''); }} className="text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>
                                              </div>
                                            ) : (
                                              <span
                                                className="text-xs font-semibold text-green-700 uppercase tracking-wide cursor-pointer hover:text-green-900"
                                                onClick={() => { setEditingPackageHeader({ taskIndex, lineIndex }); setPackageHeaderEditValue(item.package_header || ''); }}
                                                title="Click to rename"
                                              >
                                                {item.package_header}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right align-top">
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveLineItem(taskIndex, lineIndex)}
                                              className="text-red-600 hover:text-red-800"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      ) : (
                                      <tr key={lineIndex} className="border-t">
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
                                        <td className="px-3 py-2 text-right align-top">
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveLineItem(taskIndex, lineIndex)}
                                            className="text-red-600 hover:text-red-800"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                      )
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={task.apply_surcharge}
                                    onChange={(e) => {
                                      const updatedTasks = [...tasks];
                                      updatedTasks[taskIndex].apply_surcharge = e.target.checked;
                                      setTasks(updatedTasks);
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm font-medium text-gray-700">Apply surcharge to this task</span>
                                </label>
                              </div>
                            </>
                          )}

                          {showLineItemForm && activeTaskIndex === taskIndex && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                  <select
                                    value={lineItemFormData.line_type}
                                    onChange={(e) => setLineItemFormData({ ...lineItemFormData, line_type: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                                  <>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Part Source</label>
                                      <select
                                        value={lineItemFormData.part_source}
                                        onChange={(e) => setLineItemFormData({
                                          ...lineItemFormData,
                                          part_source: e.target.value,
                                          part_id: '',
                                          mercury_part_id: '',
                                          marine_wholesale_part_id: '',
                                          part_number_search: '',
                                          description: '',
                                          unit_price: '0'
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                      >
                                        <option value="all">Search All Sources</option>
                                        <option value="inventory">Parts Inventory</option>
                                        <option value="mercury">Mercury Marine</option>
                                        <option value="marine_wholesale">Marine Wholesale</option>
                                        <option value="custom">Custom / Other</option>
                                      </select>
                                    </div>

                                    {lineItemFormData.part_source !== 'custom' && (
                                      <div className="relative part-search-container col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          {lineItemFormData.part_source === 'all' && 'Search All Sources (Inventory, Mercury, Marine Wholesale)'}
                                          {lineItemFormData.part_source === 'inventory' && 'Search Part Number / Name'}
                                          {lineItemFormData.part_source === 'mercury' && 'Search Mercury Part Number / Description'}
                                          {lineItemFormData.part_source === 'marine_wholesale' && 'Search SKU / Mfg Part # / Description'}
                                        </label>
                                        <input
                                          type="text"
                                          value={lineItemFormData.part_number_search}
                                          onChange={(e) => handlePartNumberSearch(e.target.value)}
                                          onFocus={() => {
                                            if (lineItemFormData.part_number_search.trim() && filteredParts.length > 0) {
                                              setShowPartDropdown(true);
                                            }
                                          }}
                                          placeholder={lineItemFormData.part_source === 'all' ? 'Search across all sources...' : 'Start typing to search...'}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                        />

                                        {showPartDropdown && filteredParts.length > 0 && (
                                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                                            {filteredParts.map((part, idx) => (
                                              <button
                                                key={`${part._source}-${part.id}-${idx}`}
                                                type="button"
                                                onClick={() => handleSelectPartFromDropdown(part)}
                                                className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="font-medium text-gray-900 truncate">{part._display_number}</span>
                                                    {part._source === 'inventory' && part._is_alt && (
                                                      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700 flex-shrink-0">Alt #</span>
                                                    )}
                                                    {part._source === 'inventory' && !part._is_alt && part.alternative_part_numbers && (
                                                      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700 flex-shrink-0">Primary</span>
                                                    )}
                                                  </div>
                                                  {lineItemFormData.part_source === 'all' && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                                      part._source === 'inventory' ? 'bg-blue-100 text-blue-700' :
                                                      part._source === 'mercury' ? 'bg-red-100 text-red-700' :
                                                      'bg-green-100 text-green-700'
                                                    }`}>
                                                      {part._source_label}
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="text-sm text-gray-600 truncate">{part._display_name}</div>
                                                {part._source === 'inventory' && part.alternative_part_numbers && (
                                                  <div className="text-xs text-gray-400">
                                                    {part._is_alt ? `Primary: ${part.alternative_part_numbers}` : `Alt: ${part.alternative_part_numbers}`}
                                                  </div>
                                                )}
                                                <div className="text-sm text-green-600 font-medium">${(part._price || 0).toFixed(2)}</div>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {lineItemFormData.part_source === 'inventory' && (
                                      <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Or Browse Inventory</label>
                                        <select
                                          value={lineItemFormData.part_id}
                                          onChange={(e) => handlePartChange(e.target.value)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                        >
                                          <option value="">Select part</option>
                                          {parts.map((part) => (
                                            <option key={part.id} value={part.id}>
                                              {part.part_number} - {part.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}

                                    {lineItemFormData.part_source === 'mercury' && mercuryParts.length === 0 && (
                                      <div className="col-span-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                                        No Mercury Marine parts loaded. Upload a price list in Estimating &gt; Settings &gt; Mercury Parts.
                                      </div>
                                    )}

                                    {lineItemFormData.part_source === 'marine_wholesale' && marineWholesaleParts.length === 0 && (
                                      <div className="col-span-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                                        No Marine Wholesale parts loaded. Upload a price list in Estimating &gt; Settings &gt; Marine Wholesale.
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input
                                  type="text"
                                  required
                                  value={lineItemFormData.description}
                                  onChange={(e) => setLineItemFormData({ ...lineItemFormData, description: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Work Details / Notes</label>
                                <textarea
                                  value={lineItemFormData.work_details}
                                  onChange={(e) => setLineItemFormData({ ...lineItemFormData, work_details: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                  rows={2}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {lineItemFormData.line_type === 'labor' ? 'Hours' : 'Quantity'}
                                  </label>
                                  <input
                                    type="number"
                                    required
                                    step="0.01"
                                    min="0"
                                    value={lineItemFormData.quantity}
                                    onChange={(e) => setLineItemFormData({ ...lineItemFormData, quantity: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                                  <input
                                    type="text"
                                    disabled
                                    value={`$${(parseFloat(lineItemFormData.quantity) * parseFloat(lineItemFormData.unit_price)).toFixed(2)}`}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowLineItemForm(false);
                                    setActiveTaskIndex(null);
                                  }}
                                  className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddLineItem}
                                  className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                                >
                                  Add Line
                                </button>
                              </div>
                            </div>
                          )}

                          {task.lineItems.length === 0 && !showLineItemForm && (
                            <p className="text-sm text-gray-500 text-center py-4">No line items yet</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tasks.length === 0 && !showTaskForm && (
                <p className="text-sm text-gray-500 text-center py-4">No tasks yet</p>
              )}

              {tasks.length > 0 && !showTaskForm && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTaskForm(true);
                      setEditingTaskIndex(null);
                      setTaskFormData({ task_name: '', task_overview: '' });
                    }}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1 border border-dashed border-blue-300"
                  >
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                </div>
              )}
            </div>

            {/* Taxes & Surcharges Section */}
            {tasks.length > 0 && (
              <div className="border-t pt-1">
                <h4 className="text-xs font-semibold text-gray-900 mb-1">Taxes & Surcharges</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Sales Tax Rate (%)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={(parseFloat(formData.sales_tax_rate) * 100).toFixed(2)}
                          onChange={(e) => setFormData({ ...formData, sales_tax_rate: (parseFloat(e.target.value) / 100).toString() })}
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs bg-white text-gray-900"
                        />
                        <span className="text-xs text-gray-500">= ${calculateSalesTax().toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={formData.apply_shop_supplies}
                          onChange={(e) => setFormData({ ...formData, apply_shop_supplies: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                        />
                        <label className="text-xs font-medium text-gray-700">Shop Supplies (%)</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={(parseFloat(formData.shop_supplies_rate) * 100).toFixed(2)}
                          onChange={(e) => setFormData({ ...formData, shop_supplies_rate: (parseFloat(e.target.value) / 100).toString() })}
                          disabled={!formData.apply_shop_supplies}
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs bg-white text-gray-900 disabled:bg-gray-100"
                        />
                        <span className="text-xs text-gray-500">= ${calculateShopSupplies().toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={formData.apply_park_fees}
                          onChange={(e) => setFormData({ ...formData, apply_park_fees: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                        />
                        <label className="text-xs font-medium text-gray-700">Park Fees (%)</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={(parseFloat(formData.park_fees_rate) * 100).toFixed(2)}
                          onChange={(e) => setFormData({ ...formData, park_fees_rate: (parseFloat(e.target.value) / 100).toString() })}
                          disabled={!formData.apply_park_fees}
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs bg-white text-gray-900 disabled:bg-gray-100"
                        />
                        <span className="text-xs text-gray-500">= ${calculateParkFees().toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Surcharge (%)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={(parseFloat(formData.surcharge_rate) * 100).toFixed(2)}
                          onChange={(e) => setFormData({ ...formData, surcharge_rate: (parseFloat(e.target.value) / 100).toString() })}
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs bg-white text-gray-900"
                        />
                        <span className="text-xs text-gray-500">= ${calculateSurcharge().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-2">
                    <h5 className="text-xs font-semibold text-gray-900 mb-1">Work Order Summary</h5>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-xs text-gray-900">
                        <span>Subtotal:</span>
                        <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Sales Tax:</span>
                        <span>${calculateSalesTax().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Shop Supplies:</span>
                        <span>${calculateShopSupplies().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Park Fees:</span>
                        <span>${calculateParkFees().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Surcharge:</span>
                        <span>${calculateSurcharge().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1 text-gray-900">
                        <span>Total:</span>
                        <span>${calculateTotal().toFixed(2)}</span>
                      </div>
                      {(() => {
                        const totalDeposits = workOrderDeposits.reduce((sum, d) => sum + parseFloat(String(d.amount || 0)), 0);
                        if (totalDeposits <= 0) return null;
                        const balanceDue = calculateTotal() - totalDeposits;
                        return (
                          <>
                            <div className="flex justify-between text-xs text-green-700 mt-1">
                              <span>Total Deposits{workOrderDeposits.length > 1 ? ` (${workOrderDeposits.length})` : ''}:</span>
                              <span>-${totalDeposits.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1 text-gray-900">
                              <span>Balance Due:</span>
                              <span>${balanceDue.toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Deposit Section */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Deposit Settings</h4>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.deposit_required}
                      onChange={(e) => setFormData({ ...formData, deposit_required: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Require Deposit</span>
                  </label>
                </div>

                {formData.deposit_required && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.deposit_amount}
                        onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                      <select
                        value={formData.deposit_payment_method_type}
                        onChange={(e) => setFormData({ ...formData, deposit_payment_method_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="card">Credit/Debit Card</option>
                        <option value="ach">ACH Bank Transfer</option>
                        <option value="both">Both Credit Card and ACH</option>
                        <option value="check">Check</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Display Deposit Tracking Panel in Edit Mode */}
            {editingId && (() => {
              const editingWorkOrder = workOrders.find(wo => wo.id === editingId);
              return editingWorkOrder && formData.deposit_required && (
              <div className="border-t pt-4">
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-5 h-5 text-cyan-600" />
                    <h5 className="font-semibold text-cyan-700">Deposit Payment Status</h5>
                    {editingWorkOrder.deposit_payment_status && (
                      <>
                        {editingWorkOrder.deposit_payment_status === 'pending' && !editingWorkOrder.deposit_email_sent_at && (
                          <span className="ml-auto bg-yellow-500/20 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">
                            Need to Request Deposit
                          </span>
                        )}
                        {editingWorkOrder.deposit_payment_status === 'pending' && editingWorkOrder.deposit_email_sent_at && (
                          <span className="ml-auto bg-blue-500/20 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                            Awaiting Payment
                          </span>
                        )}
                        {editingWorkOrder.deposit_payment_status === 'paid' && (
                          <span className="ml-auto bg-green-500/20 text-green-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Paid
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Required Amount:</span> ${parseFloat(formData.deposit_amount || String(editingWorkOrder.deposit_amount) || '0').toFixed(2)}
                    </p>

                    {workOrderDeposits.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-xs font-semibold text-gray-700">Deposits Recorded:</p>
                        {workOrderDeposits.map((dep, idx) => (
                          <div key={dep.id} className="p-2 bg-white border border-cyan-200 rounded text-xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              <span className="font-semibold text-gray-700">#{idx + 1}</span>
                              <span className="text-green-700 font-bold">${parseFloat(String(dep.amount)).toFixed(2)}</span>
                              <span className="text-gray-500">{dep.payment_method === 'check' ? `Check #${dep.reference_number}` : dep.payment_method}</span>
                              <span className="text-gray-400 ml-auto">{new Date(dep.payment_date).toLocaleDateString()}</span>
                            </div>
                            {dep.notes && (
                              <div className="mt-1 pl-5 text-gray-500 italic">{dep.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!editingWorkOrder.deposit_payment_link_url && !editingWorkOrder.deposit_paid_at && (
                      <div className="mt-3 pt-3 border-t border-cyan-500/20 flex flex-col items-center justify-center gap-3 py-4">
                        <p className="text-sm text-gray-600 font-medium">No payment recorded yet</p>
                        {!editingWorkOrder.deposit_required ? (
                          <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Save the work order first to enable deposit actions
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-3 justify-center">
                            <button
                              onClick={() => handleRequestDeposit(editingWorkOrder.id)}
                              disabled={depositLoading || editingWorkOrder.deposit_payment_method_type === 'check'}
                              type="button"
                              className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-40 shadow hover:shadow-md"
                            >
                              <DollarSign className="w-4 h-4" />
                              {depositLoading ? 'Generating...' : 'Generate Payment Link'}
                            </button>
                            <button
                              onClick={() => {
                                setDepositCheckForm({ checkNumber: '', amount: editingWorkOrder.deposit_amount ? parseFloat(String(editingWorkOrder.deposit_amount)).toFixed(2) : '', notes: '' });
                                setDepositCheckModal(editingWorkOrder.id);
                              }}
                              type="button"
                              className="bg-gray-700 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow hover:shadow-md"
                            >
                              <FileText className="w-4 h-4" />
                              Record Check
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {editingWorkOrder.deposit_paid_at && (
                      <div className="mt-2 pt-2 border-t border-cyan-500/20 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setDepositCheckForm({ checkNumber: '', amount: '', notes: '' });
                            setDepositCheckModal(editingWorkOrder.id);
                          }}
                          type="button"
                          className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow"
                        >
                          <FileText className="w-3 h-3" />
                          Add Another Deposit
                        </button>
                      </div>
                    )}

                    {editingWorkOrder.deposit_email_sent_at && (
                      <div className="mt-3 pt-3 border-t border-cyan-500/20">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Email Tracking</p>
                        <div className="space-y-1">
                          {editingWorkOrder.deposit_email_recipient && (
                            <div className="flex items-center gap-2 text-xs text-blue-700 mb-2">
                              <Mail className="w-3 h-3" />
                              <span className="font-medium">To: {editingWorkOrder.deposit_email_recipient}</span>
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Mail className="w-3 h-3 text-blue-600" />
                              <span>Sent: {new Date(editingWorkOrder.deposit_email_sent_at).toLocaleDateString()} at {new Date(editingWorkOrder.deposit_email_sent_at).toLocaleTimeString()}</span>
                            </div>
                            {editingWorkOrder.deposit_email_delivered_at ? (
                              <div className="flex items-center gap-2 text-xs text-emerald-700">
                                <CheckCircle className="w-3 h-3" />
                                <span>Delivered: {new Date(editingWorkOrder.deposit_email_delivered_at).toLocaleDateString()} at {new Date(editingWorkOrder.deposit_email_delivered_at).toLocaleTimeString()}</span>
                              </div>
                            ) : editingWorkOrder.deposit_email_bounced_at ? (
                              <div className="flex items-center gap-2 text-xs text-red-700">
                                <AlertCircle className="w-3 h-3" />
                                <span>Bounced: {new Date(editingWorkOrder.deposit_email_bounced_at).toLocaleDateString()} at {new Date(editingWorkOrder.deposit_email_bounced_at).toLocaleTimeString()}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-yellow-700">
                                <Clock className="w-3 h-3" />
                                <span>Awaiting Delivery Confirmation</span>
                              </div>
                            )}
                            {editingWorkOrder.deposit_email_opened_at && (
                              <div className="flex items-center gap-2 text-xs text-green-700">
                                <Eye className="w-3 h-3" />
                                <span>Opened: {new Date(editingWorkOrder.deposit_email_opened_at).toLocaleDateString()} at {new Date(editingWorkOrder.deposit_email_opened_at).toLocaleTimeString()}</span>
                              </div>
                            )}
                            {editingWorkOrder.deposit_email_clicked_at && (
                              <div className="flex items-center gap-2 text-xs text-cyan-700">
                                <MousePointer className="w-3 h-3" />
                                <span>Clicked: {new Date(editingWorkOrder.deposit_email_clicked_at).toLocaleDateString()} at {new Date(editingWorkOrder.deposit_email_clicked_at).toLocaleTimeString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {editingWorkOrder.deposit_payment_link_url && (
                      <div className="mt-3 pt-3 border-t border-cyan-500/20">
                        <p className="text-xs text-gray-600 mb-2">Payment Link:</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={editingWorkOrder.deposit_payment_link_url}
                            className="flex-1 bg-gray-100 border border-gray-300 rounded px-3 py-2 text-xs text-gray-700"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(editingWorkOrder.deposit_payment_link_url!);
                              showSuccess('Payment link copied!');
                            }}
                            type="button"
                            className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {editingWorkOrder.deposit_payment_status === 'pending' && editingWorkOrder.deposit_payment_link_url && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-cyan-500/20">
                      <button
                        onClick={() => {
                          setDepositCheckForm({ checkNumber: '', amount: editingWorkOrder.deposit_amount ? parseFloat(String(editingWorkOrder.deposit_amount)).toFixed(2) : '', notes: '' });
                          setDepositCheckModal(editingWorkOrder.id);
                        }}
                        type="button"
                        className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Record Check Instead
                      </button>
                      {!editingWorkOrder.deposit_email_sent_at ? (
                        <div className="flex gap-2 w-full">
                          <input
                            type="email"
                            placeholder="Recipient email"
                            value={depositEmailRecipient}
                            onChange={(e) => setDepositEmailRecipient(e.target.value)}
                            className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Recipient name (optional)"
                            value={depositEmailRecipientName}
                            onChange={(e) => setDepositEmailRecipientName(e.target.value)}
                            className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => handleSendDepositEmail(editingWorkOrder)}
                            disabled={sendingDepositEmail || !depositEmailRecipient}
                            type="button"
                            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <Mail className="w-3 h-3" />
                            {sendingDepositEmail ? 'Sending...' : 'Send Email'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSendDepositEmail(editingWorkOrder)}
                            disabled={sendingDepositEmail}
                            type="button"
                            className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <Mail className="w-3 h-3" />
                            {sendingDepositEmail ? 'Sending...' : 'Resend Email'}
                          </button>
                          <button
                            onClick={() => handleSyncPaymentStatus(editingWorkOrder)}
                            disabled={syncingPayment[editingWorkOrder.id]}
                            type="button"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <RefreshCw className="w-3 h-3" />
                            {syncingPayment[editingWorkOrder.id] ? 'Syncing...' : 'Sync Payment'}
                          </button>
                          <button
                            onClick={() => handleCheckEmailStatus(editingWorkOrder)}
                            disabled={checkingEmailStatus[editingWorkOrder.id]}
                            type="button"
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <Mail className="w-3 h-3" />
                            {checkingEmailStatus[editingWorkOrder.id] ? 'Checking...' : 'Check Email Status'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Terms & Conditions</label>
                <textarea
                  value={formData.customer_notes}
                  onChange={(e) => setFormData({ ...formData, customer_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  rows={6}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : 'Save Work Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Order #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vessel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {workOrders.map((workOrder) => (
              <React.Fragment key={workOrder.id}>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{workOrder.work_order_number}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {editingWorkTitle === workOrder.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={workTitleDraft}
                      onChange={(e) => setWorkTitleDraft(e.target.value)}
                      onBlur={() => handleSaveWorkTitle(workOrder.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveWorkTitle(workOrder.id);
                        if (e.key === 'Escape') setEditingWorkTitle(null);
                      }}
                      className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      placeholder="Add work title..."
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingWorkTitle(workOrder.id); setWorkTitleDraft(workOrder.work_title || ''); }}
                      className="text-sm text-left w-full group"
                      title="Click to edit work title"
                    >
                      {workOrder.work_title ? (
                        <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{workOrder.work_title}</span>
                      ) : (
                        <span className="text-gray-400 group-hover:text-blue-500 transition-colors italic">Add title...</span>
                      )}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {workOrder.is_retail_customer ? workOrder.customer_name : workOrder.yachts?.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {workOrder.is_retail_customer ? (
                    workOrder.customer_vessels ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">{workOrder.customer_vessels.vessel_name}</div>
                        {(workOrder.customer_vessels.manufacturer || workOrder.customer_vessels.model) && (
                          <div className="text-xs text-gray-500">
                            {[workOrder.customer_vessels.manufacturer, workOrder.customer_vessels.model].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )
                  ) : (
                    workOrder.yachts ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">{workOrder.yachts.name}</div>
                        {(workOrder.yachts.manufacturer || workOrder.yachts.model) && (
                          <div className="text-xs text-gray-500">
                            {[workOrder.yachts.manufacturer, workOrder.yachts.model].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )
                  )}
                </td>
                <td className="px-6 py-4">
                  {workOrder.status !== 'completed' ? (
                    <select
                      value={workOrder.status}
                      onChange={(e) => handleStatusChange(workOrder.id, e.target.value)}
                      className={`px-2 py-1 text-xs font-medium rounded-full border-0 ${getStatusColor(workOrder.status)}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="waiting_for_parts">Waiting for Parts</option>
                      <option value="in_process">In Process</option>
                      <option value="completed">Completed</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                      {workOrder.status.replace('_', ' ')}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(workOrderEmployees[workOrder.id] || []).map((name, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {name}
                      </span>
                    ))}
                    {workOrderHasUnassigned[workOrder.id] && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                        Not Assigned
                      </span>
                    )}
                    {(workOrderEmployees[workOrder.id] || []).length === 0 && !workOrderHasUnassigned[workOrder.id] && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  ${(workOrder.total_amount || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-500">
                  {new Date(workOrder.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleEditWorkOrder(workOrder.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Open
                    </button>
                    {activeTab === 'active' ? (
                      <button
                        onClick={() => handleArchiveClick(workOrder.id)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Archive work order"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestoreWorkOrder(workOrder.id)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Restore work order"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {workOrders.length === 0 && (
          <div className="p-12 text-center">
            <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Work Orders Yet</h3>
            <p className="text-gray-500">Work orders will appear here when estimates are approved.</p>
          </div>
        )}
        </div>
      )}

      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Archive Work Order
            </h3>
            <p className="text-gray-700 mb-6">
              Archive this work order? You can restore it later from the Archived tab if needed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setWorkOrderToArchive(null);
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

      {depositCheckModal && (() => {
        const wo = workOrders.find(w => w.id === depositCheckModal);
        if (!wo) return null;
        return (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Record Check Deposit</h3>
                </div>
                <button onClick={() => setDepositCheckModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                  <p className="font-medium">{wo.work_order_number} — {wo.customer_name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Deposit required: ${parseFloat(String(wo.deposit_amount || 0)).toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Check Number *</label>
                    <input
                      type="text"
                      value={depositCheckForm.checkNumber}
                      onChange={(e) => setDepositCheckForm({ ...depositCheckForm, checkNumber: e.target.value })}
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
                      value={depositCheckForm.amount}
                      onChange={(e) => setDepositCheckForm({ ...depositCheckForm, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={depositCheckForm.notes}
                    onChange={(e) => setDepositCheckForm({ ...depositCheckForm, notes: e.target.value })}
                    placeholder="e.g. received at front desk"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>

                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded p-2">
                  Recording this check will mark the deposit as paid and log it to accounting.
                </p>
              </div>

              <div className="flex justify-end gap-3 px-5 pb-5">
                <button
                  onClick={() => setDepositCheckModal(null)}
                  type="button"
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRecordDepositCheck(depositCheckModal)}
                  disabled={depositCheckLoading || !depositCheckForm.checkNumber.trim() || !depositCheckForm.amount}
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-semibold disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  {depositCheckLoading ? 'Recording...' : 'Record Check'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showPackageModal && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-green-600" />
                <h3 className="text-xl font-bold text-gray-900">Add Package</h3>
              </div>
              <button
                onClick={() => { setShowPackageModal(false); setSelectedPackageId(''); setActiveTaskIndex(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Package</label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">Choose a package...</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                  ))}
                </select>
                {selectedPackageId && packages.find(p => p.id === selectedPackageId)?.description && (
                  <p className="mt-2 text-sm text-gray-600">
                    {packages.find(p => p.id === selectedPackageId)?.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => { setShowPackageModal(false); setSelectedPackageId(''); setActiveTaskIndex(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPackage}
                disabled={!selectedPackageId}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Package
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
