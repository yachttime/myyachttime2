import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Wrench, AlertCircle, Edit2, Trash2, Check, X, ChevronDown, ChevronUp, Printer, CheckCircle } from 'lucide-react';
import { generateWorkOrderPDF } from '../utils/pdfGenerator';

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
}

interface WorkOrderTask {
  id?: string;
  task_name: string;
  task_overview: string;
  task_order: number;
  apply_surcharge: boolean;
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
  line_order: number;
  work_details?: string | null;
}

interface WorkOrdersProps {
  userId: string;
}

export function WorkOrders({ userId }: WorkOrdersProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [yachts, setYachts] = useState<any[]>([]);
  const [laborCodes, setLaborCodes] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    customer_notes: ''
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
    part_number_search: '',
    work_details: ''
  });
  const [filteredParts, setFilteredParts] = useState<typeof parts>([]);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [workOrdersResult, yachtsResult, laborResult, partsResult, settingsResult] = await Promise.all([
        supabase
          .from('work_orders')
          .select('*, yachts(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('yachts')
          .select('id, name, marina_name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('labor_codes')
          .select('id, code, name, hourly_rate, is_taxable')
          .eq('is_active', true)
          .order('code'),
        supabase
          .from('parts_inventory')
          .select('id, part_number, name, unit_price, is_taxable')
          .eq('is_active', true)
          .order('part_number'),
        supabase
          .from('estimate_settings')
          .select('*')
          .maybeSingle()
      ]);

      if (workOrdersResult.error) throw workOrdersResult.error;
      if (yachtsResult.error) throw yachtsResult.error;
      if (laborResult.error) throw laborResult.error;
      if (partsResult.error) throw partsResult.error;

      setWorkOrders(workOrdersResult.data || []);
      setYachts(yachtsResult.data || []);
      setLaborCodes(laborResult.data || []);
      setParts(partsResult.data || []);

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
    const part = parts.find(p => p.id === partId);
    if (part) {
      setLineItemFormData({
        ...lineItemFormData,
        part_id: partId,
        part_number_search: part.part_number,
        description: `${part.part_number} - ${part.name}`,
        unit_price: part.unit_price.toString(),
        is_taxable: part.is_taxable
      });
    }
  };

  const handlePartNumberSearch = (searchValue: string) => {
    setLineItemFormData({
      ...lineItemFormData,
      part_number_search: searchValue,
      part_id: ''
    });

    if (searchValue.trim()) {
      const filtered = parts.filter(p =>
        p.part_number.toLowerCase().includes(searchValue.toLowerCase()) ||
        p.name.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredParts(filtered);
      setShowPartDropdown(true);
    } else {
      setFilteredParts([]);
      setShowPartDropdown(false);
    }
  };

  const handleSelectPartFromDropdown = (part: typeof parts[0]) => {
    setLineItemFormData({
      ...lineItemFormData,
      part_id: part.id,
      part_number_search: part.part_number,
      description: `${part.part_number} - ${part.name}`,
      unit_price: part.unit_price.toString(),
      is_taxable: part.is_taxable
    });
    setShowPartDropdown(false);
    setFilteredParts([]);
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
        customer_notes: formData.customer_notes || null
      };

      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .update(workOrderData)
        .eq('id', editingId)
        .select()
        .single();

      if (workOrderError) throw workOrderError;

      await supabase.from('work_order_tasks').delete().eq('work_order_id', editingId);

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
            work_details: item.work_details || null,
            line_order: index
          }));

          const { error: lineItemsError } = await supabase
            .from('work_order_line_items')
            .insert(lineItemsToInsert);

          if (lineItemsError) {
            console.error('Error inserting line items:', lineItemsError);
            throw lineItemsError;
          }
        }
      }

      alert('Work order updated successfully!');

      await resetForm();
      await loadData();
    } catch (err: any) {
      console.error('Error saving work order:', err);
      setError(err.message || 'Failed to save work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel editing?')) {
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

      setFormData({
        is_retail_customer: workOrder.is_retail_customer,
        yacht_id: workOrder.yacht_id || '',
        customer_name: workOrder.customer_name || '',
        customer_email: workOrder.customer_email || '',
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
        customer_notes: workOrder.customer_notes || ''
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
            line_order: item.line_order || 0,
            work_details: item.work_details
          }));

        return {
          id: task.id,
          task_name: task.task_name || '',
          task_overview: task.task_overview || '',
          task_order: task.task_order || 0,
          apply_surcharge: task.apply_surcharge ?? true,
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

      await loadData();
    } catch (err) {
      console.error('Error deleting work order:', err);
      setError('Failed to delete work order');
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
      await loadData();
    } catch (err: any) {
      console.error('Error completing work order:', err);
      setError(err.message || 'Failed to complete work order');
    }
  };

  const handlePrintWorkOrder = async (workOrderId: string) => {
    try {
      setError(null);

      const { data: workOrderData, error: workOrderError } = await supabase
        .from('work_orders')
        .select('*, yachts(name)')
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
        }
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
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.pending;
  };

  if (loading && !showForm) {
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

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Edit Work Order</h3>
          </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
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

              {showTaskForm && (
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
                      {editingTaskIndex !== null ? 'Update Task' : 'Add Task'}
                    </button>
                  </div>
                </div>
              )}

              {tasks.length > 0 && (
                <div className="space-y-3">
                  {tasks.map((task, taskIndex) => (
                    <div key={taskIndex} className="border border-gray-300 rounded-lg overflow-hidden">
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
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-medium text-gray-700">Line Items</span>
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
                                    <div className="relative part-search-container">
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Part Number / Name</label>
                                      <input
                                        type="text"
                                        value={lineItemFormData.part_number_search}
                                        onChange={(e) => handlePartNumberSearch(e.target.value)}
                                        onFocus={() => {
                                          if (lineItemFormData.part_number_search.trim() && filteredParts.length > 0) {
                                            setShowPartDropdown(true);
                                          }
                                        }}
                                        placeholder="Start typing..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                      />

                                      {showPartDropdown && filteredParts.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                          {filteredParts.map((part) => (
                                            <button
                                              key={part.id}
                                              type="button"
                                              onClick={() => handleSelectPartFromDropdown(part)}
                                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                                            >
                                              <div className="font-medium text-gray-900">{part.part_number}</div>
                                              <div className="text-sm text-gray-600">{part.name}</div>
                                              <div className="text-sm text-green-600 font-medium">${part.unit_price.toFixed(2)}</div>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Or Browse</label>
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
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs"
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
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs disabled:bg-gray-100"
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
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs disabled:bg-gray-100"
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
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs"
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
                    </div>
                  </div>
                </div>
              </div>
            )}

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

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Order #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {workOrders.map((workOrder) => (
              <tr key={workOrder.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{workOrder.work_order_number}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {workOrder.is_retail_customer ? workOrder.customer_name : workOrder.yachts?.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workOrder.status)}`}>
                    {workOrder.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  ${(workOrder.total_amount || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-500">
                  {new Date(workOrder.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {workOrder.status !== 'completed' && (
                      <>
                        <button
                          onClick={() => handleCompleteWorkOrder(workOrder.id)}
                          className="text-green-600 hover:text-green-800"
                          title="Mark as completed"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditWorkOrder(workOrder.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit work order"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handlePrintWorkOrder(workOrder.id)}
                      className="text-gray-600 hover:text-gray-800"
                      title="Print work order"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
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
                </td>
              </tr>
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
    </div>
  );
}
