import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, FileText, AlertCircle, Edit2, Trash2, Check, X, ChevronDown, ChevronUp, Printer, CheckCircle, XCircle, Package } from 'lucide-react';
import { generateEstimatePDF } from '../utils/pdfGenerator';
import { useNotification } from '../contexts/NotificationContext';

const DEFAULT_CUSTOMER_NOTES = `I hereby authorize the above repair work to be done along with necessary materials. It is distinctly understood that all labor and materials so used shall be charged to this job at current billing rates. You and your employees may operate above equipment for purpose of testing, inspecting or delivering at my risk. An express mechanic's lien is acknowledged to secure the amount of repairs thereto. It is understood that this company assumes no responsibility for loss or damage by fire or theft or weather hazards incidental to equipment or materials placed with them for sale, repair or testing. If legal action is necessary to enforce this contract I will pay all reasonable attorney's fees and other costs incurred. All payments are C.O.D. unless prior arrangements are made. If equipment is not removed within 10 days after completion of service, storage charges will accrue at $15 per day.

Customer Signature: _________________________________     Date: ______________`;

interface Estimate {
  id: string;
  estimate_number: string;
  yacht_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  is_retail_customer: boolean;
  status: string;
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
  marina_name: string | null;
  manager_name: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  created_at: string;
  yachts?: { name: string };
  deposit_required: boolean;
  deposit_percentage: number | null;
  deposit_amount: number | null;
}

interface EstimateTask {
  id?: string;
  task_name: string;
  task_overview: string;
  task_order: number;
  apply_surcharge: boolean;
  lineItems: EstimateLineItem[];
}

interface EstimateLineItem {
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

interface EstimatesProps {
  userId: string;
}

export function Estimates({ userId }: EstimatesProps) {
  const { showSuccess, showError } = useNotification();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [yachts, setYachts] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
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
    customer_notes: DEFAULT_CUSTOMER_NOTES,
    deposit_required: false,
    deposit_type: 'percentage',
    deposit_percentage: '',
    deposit_amount: ''
  });

  const [tasks, setTasks] = useState<EstimateTask[]>([]);
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
    line_type: 'labor' as EstimateLineItem['line_type'],
    description: '',
    quantity: '1',
    unit_price: '0',
    is_taxable: true,
    labor_code_id: '',
    part_id: '',
    part_number_search: '',
    work_details: '',
    mercury_part_id: '',
    part_source: 'custom' as 'inventory' | 'mercury' | 'custom',
    core_charge_amount: '0',
    container_charge_amount: '0'
  });
  const [showAutoSaveIndicator, setShowAutoSaveIndicator] = useState(false);
  const [filteredParts, setFilteredParts] = useState<any[]>([]);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mercuryParts, setMercuryParts] = useState<any[]>([]);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [estimateToApprove, setEstimateToApprove] = useState<string | null>(null);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [estimateToDeny, setEstimateToDeny] = useState<string | null>(null);
  const [showRestoreDraftModal, setShowRestoreDraftModal] = useState(false);
  const [draftToRestore, setDraftToRestore] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [estimateToDelete, setEstimateToDelete] = useState<string | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');

  useEffect(() => {
    loadData();
    loadDraft();
  }, []);

  useEffect(() => {
    if (showForm && !isSubmitting && (tasks.length > 0 || formData.yacht_id || formData.customer_name)) {
      const draftData = {
        formData,
        tasks,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('estimate_draft', JSON.stringify(draftData));

      setShowAutoSaveIndicator(true);
      const timer = setTimeout(() => {
        setShowAutoSaveIndicator(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [formData, tasks, showForm, isSubmitting]);

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

      const [estimatesResult, yachtsResult, managersResult, laborResult, partsResult, mercuryResult, settingsResult, packagesResult] = await Promise.all([
        supabase
          .from('estimates')
          .select('*, yachts(name)')
          .neq('status', 'converted')
          .order('created_at', { ascending: false }),
        supabase
          .from('yachts')
          .select('id, name, marina_name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('user_profiles')
          .select('id, yacht_id, first_name, last_name, can_approve_repairs, email, phone')
          .eq('role', 'manager')
          .eq('is_active', true),
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
          .from('mercury_marine_parts')
          .select('id, part_number, description, msrp, item_status, core_charge, container_charge, superseded_part_number, is_active')
          .eq('is_active', true)
          .order('part_number'),
        supabase
          .from('estimate_settings')
          .select('*')
          .maybeSingle(),
        supabase
          .from('estimate_packages')
          .select('id, name, description')
          .eq('is_active', true)
          .order('name')
      ]);

      if (estimatesResult.error) throw estimatesResult.error;
      if (yachtsResult.error) throw yachtsResult.error;
      if (managersResult.error) throw managersResult.error;
      if (laborResult.error) throw laborResult.error;
      if (partsResult.error) throw partsResult.error;
      if (mercuryResult.error) throw mercuryResult.error;
      if (packagesResult.error) throw packagesResult.error;

      setEstimates(estimatesResult.data || []);
      setYachts(yachtsResult.data || []);
      setManagers(managersResult.data || []);
      setLaborCodes(laborResult.data || []);
      setParts(partsResult.data || []);
      setMercuryParts(mercuryResult.data || []);
      setPackages(packagesResult.data || []);

      console.log('Loaded Mercury Parts:', mercuryResult.data?.length || 0, 'parts');

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
      setError('Failed to load estimates');
    } finally {
      setLoading(false);
    }
  };

  const loadDraft = () => {
    try {
      const draftStr = localStorage.getItem('estimate_draft');
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        const draftAge = Date.now() - new Date(draft.timestamp).getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        if (draftAge < oneDay) {
          setDraftToRestore(draft);
          setShowRestoreDraftModal(true);
        } else {
          localStorage.removeItem('estimate_draft');
        }
      }
    } catch (err) {
      console.error('Error loading draft:', err);
      localStorage.removeItem('estimate_draft');
    }
  };

  const handleRestoreDraft = () => {
    if (draftToRestore) {
      setFormData(draftToRestore.formData);
      const restoredTasks = draftToRestore.tasks.map((task: any) => ({
        ...task,
        lineItems: (task.lineItems || []).map((item: any) => ({
          ...item,
          is_taxable: item.is_taxable ?? true
        }))
      }));
      setTasks(restoredTasks);
      const allTaskIndexes = restoredTasks.map((_: any, index: number) => index);
      setExpandedTasks(new Set(allTaskIndexes));
      setShowForm(true);
    }
    setShowRestoreDraftModal(false);
    setDraftToRestore(null);
  };

  const handleDeclineDraft = () => {
    localStorage.removeItem('estimate_draft');
    setShowRestoreDraftModal(false);
    setDraftToRestore(null);
  };

  const handleYachtChange = (yachtId: string) => {
    const selectedYacht = yachts.find(y => y.id === yachtId);
    const marinaName = selectedYacht?.marina_name || '';

    const repairManager = managers.find(
      m => m.yacht_id === yachtId && m.can_approve_repairs === true
    );
    const managerName = repairManager
      ? `${repairManager.first_name} ${repairManager.last_name}`.trim()
      : '';
    const managerEmail = repairManager?.email || '';
    const managerPhone = repairManager?.phone || '';

    setFormData({
      ...formData,
      yacht_id: yachtId,
      marina_name: marinaName,
      manager_name: managerName,
      manager_email: managerEmail,
      manager_phone: managerPhone
    });
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
      const newTask: EstimateTask = {
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

    const newLineItem: EstimateLineItem = {
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

  const handleAddPackage = async () => {
    if (activeTaskIndex === null || !selectedPackageId) return;

    try {
      const [packageLaborRes, packagePartsRes] = await Promise.all([
        supabase
          .from('estimate_package_labor')
          .select(`
            *,
            labor_code:labor_codes(id, code, name, hourly_rate, is_taxable)
          `)
          .eq('package_id', selectedPackageId),
        supabase
          .from('estimate_package_parts')
          .select(`
            *,
            part:parts_inventory(id, part_number, name, unit_price, is_taxable)
          `)
          .eq('package_id', selectedPackageId)
      ]);

      if (packageLaborRes.error) throw packageLaborRes.error;
      if (packagePartsRes.error) throw packagePartsRes.error;

      const updatedTasks = [...tasks];
      if (!updatedTasks[activeTaskIndex].lineItems) {
        updatedTasks[activeTaskIndex].lineItems = [];
      }

      const currentLineOrder = updatedTasks[activeTaskIndex].lineItems.length;

      packageLaborRes.data?.forEach((labor: any, index: number) => {
        const newLineItem: EstimateLineItem = {
          line_type: 'labor',
          description: labor.description || labor.labor_code?.name || '',
          quantity: labor.hours,
          unit_price: labor.rate,
          total_price: labor.hours * labor.rate,
          is_taxable: labor.labor_code?.is_taxable || false,
          labor_code_id: labor.labor_code_id,
          part_id: null,
          line_order: currentLineOrder + index,
          work_details: null
        };
        updatedTasks[activeTaskIndex].lineItems.push(newLineItem);
      });

      const laborItemCount = packageLaborRes.data?.length || 0;
      packagePartsRes.data?.forEach((part: any, index: number) => {
        const newLineItem: EstimateLineItem = {
          line_type: 'part',
          description: part.description || `${part.part?.part_number} - ${part.part?.name}` || '',
          quantity: part.quantity,
          unit_price: part.unit_price,
          total_price: part.quantity * part.unit_price,
          is_taxable: part.part?.is_taxable || false,
          labor_code_id: null,
          part_id: part.part_id,
          line_order: currentLineOrder + laborItemCount + index,
          work_details: null
        };
        updatedTasks[activeTaskIndex].lineItems.push(newLineItem);
      });

      setTasks(updatedTasks);
      setShowPackageModal(false);
      setSelectedPackageId('');
      setActiveTaskIndex(null);
      showSuccess('Package added successfully');
    } catch (error) {
      console.error('Error adding package:', error);
      showError('Failed to add package');
    }
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
      part_id: '',
      mercury_part_id: ''
    });

    if (searchValue.trim()) {
      const searchLower = searchValue.toLowerCase().replace(/[-\s]/g, '');

      const inventoryParts = parts
        .filter(p => {
          const partNum = p.part_number.toLowerCase().replace(/[-\s]/g, '');
          const name = p.name.toLowerCase();
          return partNum.includes(searchLower) ||
                 name.includes(searchValue.toLowerCase()) ||
                 p.part_number.toLowerCase().includes(searchValue.toLowerCase());
        })
        .map(p => ({ ...p, source: 'inventory' }));

      const mercuryFiltered = mercuryParts
        .filter(p => {
          const partNum = p.part_number.toLowerCase().replace(/[-\s]/g, '');
          const desc = (p.description || '').toLowerCase();
          return partNum.includes(searchLower) ||
                 desc.includes(searchValue.toLowerCase()) ||
                 p.part_number.toLowerCase().includes(searchValue.toLowerCase());
        })
        .map(p => ({ ...p, source: 'mercury', name: p.description }));

      const combined = [...inventoryParts, ...mercuryFiltered];
      console.log('Search results:', {
        searchValue,
        searchLower,
        inventoryCount: inventoryParts.length,
        mercuryCount: mercuryFiltered.length,
        totalMercuryParts: mercuryParts.length,
        sampleMercury: mercuryParts.slice(0, 3).map(p => p.part_number)
      });
      setFilteredParts(combined);
      setShowPartDropdown(combined.length > 0);
    } else {
      setFilteredParts([]);
      setShowPartDropdown(false);
    }
  };

  const handleSelectPartFromDropdown = (part: any) => {
    if (part.source === 'mercury') {
      setLineItemFormData({
        ...lineItemFormData,
        mercury_part_id: part.id,
        part_id: '',
        part_number_search: part.part_number,
        description: `${part.part_number} - ${part.description}`,
        unit_price: part.msrp.toString(),
        is_taxable: true,
        part_source: 'mercury',
        core_charge_amount: part.core_charge?.toString() || '0',
        container_charge_amount: part.container_charge?.toString() || '0'
      });
    } else {
      setLineItemFormData({
        ...lineItemFormData,
        part_id: part.id,
        mercury_part_id: '',
        part_number_search: part.part_number,
        description: `${part.part_number} - ${part.name}`,
        unit_price: part.unit_price.toString(),
        is_taxable: part.is_taxable,
        part_source: 'inventory',
        core_charge_amount: '0',
        container_charge_amount: '0'
      });
    }
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

      let estimate;

      if (editingId) {
        // Update existing estimate
        const estimateData = {
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
          deposit_percentage: formData.deposit_required && formData.deposit_type === 'percentage' ? parseFloat(formData.deposit_percentage) || null : null,
          deposit_amount: formData.deposit_required && formData.deposit_type === 'fixed' ? parseFloat(formData.deposit_amount) || null : null
        };

        const { data, error: estimateError } = await supabase
          .from('estimates')
          .update(estimateData)
          .eq('id', editingId)
          .select()
          .single();

        if (estimateError) throw estimateError;
        estimate = data;

        // Delete existing tasks and line items
        await supabase.from('estimate_tasks').delete().eq('estimate_id', editingId);
      } else {
        // Create new estimate
        const estimateNumber = await generateEstimateNumber();
        const estimateData = {
          estimate_number: estimateNumber,
          yacht_id: formData.is_retail_customer ? null : formData.yacht_id,
          customer_name: formData.is_retail_customer ? formData.customer_name : null,
          customer_email: formData.is_retail_customer ? formData.customer_email : null,
          customer_phone: formData.is_retail_customer ? formData.customer_phone : null,
          is_retail_customer: formData.is_retail_customer,
          marina_name: formData.is_retail_customer ? null : formData.marina_name || null,
          manager_name: formData.is_retail_customer ? null : formData.manager_name || null,
          manager_email: formData.is_retail_customer ? null : formData.manager_email || null,
          manager_phone: formData.is_retail_customer ? null : formData.manager_phone || null,
          status: 'draft',
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
          created_by: userId,
          deposit_required: formData.deposit_required,
          deposit_percentage: formData.deposit_required && formData.deposit_type === 'percentage' ? parseFloat(formData.deposit_percentage) || null : null,
          deposit_amount: formData.deposit_required && formData.deposit_type === 'fixed' ? parseFloat(formData.deposit_amount) || null : null
        };

        const { data, error: estimateError } = await supabase
          .from('estimates')
          .insert(estimateData)
          .select()
          .single();

        if (estimateError) throw estimateError;
        estimate = data;
      }

      // Insert tasks and their line items
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        const { data: estimateTask, error: taskError } = await supabase
          .from('estimate_tasks')
          .insert({
            estimate_id: estimate.id,
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
            estimate_id: estimate.id,
            task_id: estimateTask.id,
            line_type: item.line_type,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            is_taxable: item.is_taxable ?? true,
            labor_code_id: item.labor_code_id || null,
            part_id: item.part_id || null,
            accounting_code_id: item.accounting_code_id || null,
            work_details: item.work_details || null,
            line_order: index
          }));

          console.log('Inserting line items:', lineItemsToInsert);

          const { error: lineItemsError } = await supabase
            .from('estimate_line_items')
            .insert(lineItemsToInsert);

          if (lineItemsError) {
            console.error('Error inserting line items:', lineItemsError);
            throw lineItemsError;
          }
        }
      }

      showSuccess(editingId ? 'Estimate updated successfully!' : 'Estimate created successfully! Use the Approve button to convert it to a work order and adjust inventory.');

      localStorage.removeItem('estimate_draft');
      await resetForm();
      await loadData();
    } catch (err: any) {
      console.error('Error saving estimate:', err);
      setError(err.message || 'Failed to save estimate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateEstimateNumber = async () => {
    const { data, error } = await supabase.rpc('generate_estimate_number');
    if (error) throw error;
    return data;
  };

  const handleCancel = () => {
    const hasDraft = tasks.length > 0 || formData.yacht_id || formData.customer_name;

    if (hasDraft) {
      setShowCancelModal(true);
    } else {
      resetForm();
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    resetForm();
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
      ...defaultRates,
      apply_shop_supplies: true,
      apply_park_fees: true,
      notes: '',
      customer_notes: DEFAULT_CUSTOMER_NOTES
    });
    setTasks([]);
    setShowForm(false);
    setEditingId(null);
    setShowTaskForm(false);
    setEditingTaskIndex(null);
    setExpandedTasks(new Set());
    localStorage.removeItem('estimate_draft');
  };

  const handleEditEstimate = async (estimateId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Clear any existing draft since we're editing a saved estimate
      localStorage.removeItem('estimate_draft');

      // Load estimate with tasks and line items
      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single();

      if (estimateError) throw estimateError;

      // If estimate has yacht_id but no marina/manager info, fetch them from yacht and manager
      let marinaName = estimate.marina_name || '';
      let managerName = estimate.manager_name || '';
      let managerEmail = estimate.manager_email || '';
      let managerPhone = estimate.manager_phone || '';

      if (estimate.yacht_id && (!marinaName || !managerName || !managerEmail || !managerPhone)) {
        // Load yacht data
        const { data: yachtData } = await supabase
          .from('yachts')
          .select('marina_name')
          .eq('id', estimate.yacht_id)
          .maybeSingle();

        if (yachtData && !marinaName) {
          marinaName = yachtData.marina_name || '';
        }

        // Load manager with repair approval
        const { data: managerData } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, email, phone')
          .eq('yacht_id', estimate.yacht_id)
          .eq('role', 'manager')
          .eq('can_approve_repairs', true)
          .eq('is_active', true)
          .maybeSingle();

        if (managerData) {
          if (!managerName) {
            managerName = `${managerData.first_name} ${managerData.last_name}`.trim();
          }
          if (!managerEmail) {
            managerEmail = managerData.email || '';
          }
          if (!managerPhone) {
            managerPhone = managerData.phone || '';
          }
        }
      }

      // Load tasks first
      const { data: tasksData, error: tasksError } = await supabase
        .from('estimate_tasks')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('task_order');

      if (tasksError) throw tasksError;

      console.log('Loaded tasks data:', tasksData);

      // Load line items for all tasks
      const { data: allLineItems, error: lineItemsError } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('line_order');

      if (lineItemsError) throw lineItemsError;

      console.log('Loaded line items:', allLineItems);

      // Set form data
      setFormData({
        is_retail_customer: estimate.is_retail_customer,
        yacht_id: estimate.yacht_id || '',
        customer_name: estimate.customer_name || '',
        customer_email: estimate.customer_email || '',
        customer_phone: estimate.customer_phone || '',
        marina_name: marinaName,
        manager_name: managerName,
        manager_email: managerEmail,
        manager_phone: managerPhone,
        sales_tax_rate: estimate.sales_tax_rate.toString(),
        shop_supplies_rate: estimate.shop_supplies_rate.toString(),
        park_fees_rate: estimate.park_fees_rate.toString(),
        surcharge_rate: estimate.surcharge_rate.toString(),
        apply_shop_supplies: estimate.shop_supplies_amount > 0,
        apply_park_fees: estimate.park_fees_amount > 0,
        notes: estimate.notes || '',
        customer_notes: estimate.customer_notes || ''
      });

      // Group line items by task_id
      const lineItemsByTask: Record<string, any[]> = {};
      (allLineItems || []).forEach((item: any) => {
        if (item.task_id) {
          if (!lineItemsByTask[item.task_id]) {
            lineItemsByTask[item.task_id] = [];
          }
          lineItemsByTask[item.task_id].push(item);
        }
      });

      console.log('Line items grouped by task:', lineItemsByTask);

      // Set tasks with line items
      const loadedTasks: EstimateTask[] = (tasksData || []).map(task => {
        const taskLineItems = (lineItemsByTask[task.id] || [])
          .sort((a: any, b: any) => a.line_order - b.line_order)
          .map((item: any) => ({
            id: item.id,
            task_id: item.task_id,
            line_type: item.line_type,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            is_taxable: item.is_taxable,
            labor_code_id: item.labor_code_id,
            part_id: item.part_id,
            line_order: item.line_order,
            work_details: item.work_details
          }));

        console.log(`Task "${task.task_name}" (${task.id}) has ${taskLineItems.length} line items`);

        return {
          id: task.id,
          task_name: task.task_name,
          task_overview: task.task_overview,
          task_order: task.task_order,
          apply_surcharge: task.apply_surcharge,
          lineItems: taskLineItems
        };
      });

      setTasks(loadedTasks);

      // Expand all tasks
      const allTaskIndexes = loadedTasks.map((_, index) => index);
      setExpandedTasks(new Set(allTaskIndexes));

      setEditingId(estimateId);
      setShowForm(true);
      setLoading(false);
    } catch (err) {
      console.error('Error loading estimate:', err);
      setError('Failed to load estimate');
      setLoading(false);
    }
  };

  const handleDeleteEstimate = (estimateId: string) => {
    setEstimateToDelete(estimateId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!estimateToDelete) return;

    setShowDeleteModal(false);

    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('estimates')
        .delete()
        .eq('id', estimateToDelete);

      if (deleteError) throw deleteError;

      await loadData();
      setEstimateToDelete(null);
    } catch (err) {
      console.error('Error deleting estimate:', err);
      setError('Failed to delete estimate');
    }
  };

  const openApproveModal = (estimateId: string) => {
    setEstimateToApprove(estimateId);
    setShowApproveModal(true);
  };

  const handleApproveEstimate = async () => {
    if (!estimateToApprove) return;

    setShowApproveModal(false);

    try {
      setError(null);
      setLoading(true);

      const { data, error } = await supabase
        .rpc('approve_estimate', {
          p_estimate_id: estimateToApprove,
          p_user_id: userId
        });

      if (error) throw error;

      // Display low stock alerts if any
      if (data?.low_stock_alerts && data.low_stock_alerts.length > 0) {
        const alerts = data.low_stock_alerts;
        const negativeStock = alerts.filter((a: any) => a.is_negative);
        const lowStock = alerts.filter((a: any) => !a.is_negative);

        let alertMessage = `Estimate approved and converted to Work Order ${data.work_order_number}!\n\n`;

        if (negativeStock.length > 0) {
          alertMessage += '⚠️ CRITICAL - NEGATIVE INVENTORY:\n';
          negativeStock.forEach((alert: any) => {
            alertMessage += `• ${alert.part_number} - ${alert.part_name}: ${alert.current_quantity} (ORDER IMMEDIATELY)\n`;
          });
          alertMessage += '\n';
        }

        if (lowStock.length > 0) {
          alertMessage += '📦 LOW STOCK - REORDER NEEDED:\n';
          lowStock.forEach((alert: any) => {
            alertMessage += `• ${alert.part_number} - ${alert.part_name}: ${alert.current_quantity} remaining\n`;
          });
        }

        showSuccess(alertMessage);
      } else {
        showSuccess(`Estimate approved and converted to Work Order ${data.work_order_number}!`);
      }

      await loadData();
    } catch (err: any) {
      console.error('Error approving estimate:', err);
      setError(err.message || 'Failed to approve estimate');
      showError('Error: ' + (err.message || 'Failed to approve estimate'));
    } finally {
      setLoading(false);
    }
  };

  const openDenyModal = (estimateId: string) => {
    setEstimateToDeny(estimateId);
    setShowDenyModal(true);
  };

  const handleDenyEstimate = async () => {
    if (!estimateToDeny) return;

    setShowDenyModal(false);

    try {
      setError(null);
      setLoading(true);

      const { error } = await supabase
        .rpc('deny_estimate', {
          p_estimate_id: estimateToDeny,
          p_user_id: userId
        });

      if (error) throw error;

      showSuccess('Estimate has been denied and archived.');
      await loadData();
    } catch (err: any) {
      console.error('Error denying estimate:', err);
      setError(err.message || 'Failed to deny estimate');
      showError('Error: ' + (err.message || 'Failed to deny estimate'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrintEstimate = async (estimateId: string) => {
    try {
      setError(null);

      const { data: estimateData, error: estimateError } = await supabase
        .from('estimates')
        .select('*, yachts(name)')
        .eq('id', estimateId)
        .single();

      if (estimateError) throw estimateError;

      const { data: companyInfo, error: companyError } = await supabase
        .from('company_info')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (companyError) console.warn('Could not load company info:', companyError);

      const { data: tasksData, error: tasksError } = await supabase
        .from('estimate_tasks')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('task_order');

      if (tasksError) throw tasksError;

      const tasksWithLineItems = await Promise.all(
        tasksData.map(async (task) => {
          const { data: lineItemsData, error: lineItemsError } = await supabase
            .from('estimate_line_items')
            .select('*')
            .eq('task_id', task.id)
            .order('line_order');

          if (lineItemsError) throw lineItemsError;

          return {
            ...task,
            lineItems: lineItemsData
          };
        })
      );

      const yachtName = estimateData.yachts?.name || null;
      const pdf = await generateEstimatePDF(estimateData, tasksWithLineItems, yachtName, companyInfo);

      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (err) {
      console.error('Error printing estimate:', err);
      setError('Failed to print estimate');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      converted: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || colors.draft;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading estimates...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Estimates</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Estimate
        </button>
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
            <h3 className="text-lg font-semibold">
              {editingId ? 'Edit Estimate' : 'New Estimate'}
            </h3>
            {showAutoSaveIndicator && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="w-4 h-4" />
                <span>Draft saved</span>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_retail_customer}
                  onChange={(e) => setFormData({ ...formData, is_retail_customer: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Retail Customer</span>
              </label>
            </div>

            {formData.is_retail_customer ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yacht * {yachts.length > 0 && <span className="text-xs text-gray-700">({yachts.length} available)</span>}
                </label>
                <select
                  required
                  value={formData.yacht_id}
                  onChange={(e) => handleYachtChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="" className="text-gray-700">Select a yacht</option>
                  {yachts.length === 0 ? (
                    <option value="" disabled>No yachts available</option>
                  ) : (
                    yachts.map((yacht) => (
                      <option key={yacht.id} value={yacht.id} className="text-gray-900">{yacht.name}</option>
                    ))
                  )}
                </select>
                {yachts.length === 0 && (
                  <p className="mt-1 text-sm text-red-600">No active yachts found. Please check your permissions.</p>
                )}

                {formData.yacht_id && (
                  <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3">Billing Manager Information</h4>
                    <div className="grid grid-cols-2 gap-4">
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
                  </div>
                )}
              </div>
            )}

            {/* Tasks Section */}
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
                      placeholder="e.g., Engine Service, Hull Cleaning, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task Overview</label>
                    <textarea
                      value={taskFormData.task_overview}
                      onChange={(e) => setTaskFormData({ ...taskFormData, task_overview: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      rows={3}
                      placeholder="Describe what this task involves..."
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
                            <p className="text-xs text-gray-700 mt-1">
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
                            <div className="flex items-center gap-2">
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
                            </div>
                          </div>

                          {task.lineItems.length > 0 && (
                            <>
                              <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Description</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Qty</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Price</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Total</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {task.lineItems.map((item, lineIndex) => (
                                      <tr key={lineIndex} className="border-t">
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-700 uppercase">{item.line_type}</span>
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
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Part Number / Name
                                        <span className="ml-2 text-xs text-gray-700">
                                          ({parts.length} inventory + {mercuryParts.length} Mercury parts)
                                        </span>
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
                                        placeholder="Start typing part number or name..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                      />

                                      {showPartDropdown && filteredParts.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                          {filteredParts.map((part, idx) => (
                                            <button
                                              key={`${part.source}-${part.id}-${idx}`}
                                              type="button"
                                              onClick={() => handleSelectPartFromDropdown(part)}
                                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                            >
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-gray-900">{part.part_number}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                  part.source === 'mercury'
                                                    ? 'bg-orange-100 text-orange-800'
                                                    : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                  {part.source === 'mercury' ? 'Mercury Marine' : 'Inventory'}
                                                </span>
                                                {part.source === 'mercury' && part.item_status && (
                                                  <span className="text-xs text-gray-700">({part.item_status})</span>
                                                )}
                                              </div>
                                              <div className="text-sm text-gray-600">
                                                {part.source === 'mercury' ? (part.description || part.name) : part.name}
                                              </div>
                                              <div className="text-sm text-green-600 font-medium">
                                                ${part.source === 'mercury' ? (part.msrp ? part.msrp.toFixed(2) : '0.00') : (part.unit_price ? part.unit_price.toFixed(2) : '0.00')}
                                              </div>
                                              {part.source === 'mercury' && (part.core_charge > 0 || part.container_charge > 0) && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                  {part.core_charge > 0 && `Core: $${part.core_charge.toFixed(2)} `}
                                                  {part.container_charge > 0 && `Container: $${part.container_charge.toFixed(2)}`}
                                                </div>
                                              )}
                                              {part.source === 'mercury' && part.superseded_part_number && (
                                                <div className="text-xs text-gray-700 mt-1">
                                                  Superseded by: {part.superseded_part_number}
                                                </div>
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                      )}

                                      {lineItemFormData.part_number_search && !lineItemFormData.part_id && !lineItemFormData.mercury_part_id && !showPartDropdown && filteredParts.length === 0 && (
                                        <p className="text-xs text-orange-600 mt-1">No matching parts found</p>
                                      )}
                                      {(lineItemFormData.part_id || lineItemFormData.mercury_part_id) && (
                                        <div className="text-xs text-green-600 mt-1">
                                          <span>Part selected</span>
                                          {lineItemFormData.mercury_part_id && (
                                            <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 rounded font-medium">Mercury Marine</span>
                                          )}
                                          {parseFloat(lineItemFormData.core_charge_amount) > 0 && (
                                            <div className="text-blue-600 mt-1">Core charge: ${parseFloat(lineItemFormData.core_charge_amount).toFixed(2)}</div>
                                          )}
                                          {parseFloat(lineItemFormData.container_charge_amount) > 0 && (
                                            <div className="text-blue-600">Container charge: ${parseFloat(lineItemFormData.container_charge_amount).toFixed(2)}</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Or Browse All Parts</label>
                                      <select
                                        value={lineItemFormData.part_id}
                                        onChange={(e) => handlePartChange(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                      >
                                        <option value="">Select part</option>
                                        {parts.map((part) => (
                                          <option key={part.id} value={part.id}>
                                            {part.part_number} - {part.name} (${part.unit_price})
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
                                  placeholder="Describe the work performed or additional details..."
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
                            <p className="text-sm text-gray-700 text-center py-4">No line items yet. Click "Add Line" to add one.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tasks.length === 0 && !showTaskForm && (
                <p className="text-sm text-gray-700 text-center py-4">No tasks yet. Click "Add Task" to get started.</p>
              )}
            </div>

            {/* Taxes & Surcharges Section */}
            {tasks.length > 0 && (
              <div className="border-t pt-1">
                <h4 className="text-xs font-semibold text-gray-900 mb-1">Taxes & Surcharges</h4>
                <div className="mb-1 p-1.5 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> Sales tax is only applied to line items marked as taxable.
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Sales Tax Rate (%)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={(parseFloat(formData.sales_tax_rate) * 100).toFixed(2)}
                          onChange={(e) => setFormData({ ...formData, sales_tax_rate: (parseFloat(e.target.value) / 100).toString() })}
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs text-gray-900"
                        />
                        <span className="text-xs text-gray-700">= ${calculateSalesTax().toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id="apply_shop_supplies"
                          checked={formData.apply_shop_supplies}
                          onChange={(e) => setFormData({ ...formData, apply_shop_supplies: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                        />
                        <label htmlFor="apply_shop_supplies" className="text-xs font-medium text-gray-700">Shop Supplies (%)</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={(parseFloat(formData.shop_supplies_rate) * 100).toFixed(2)}
                          onChange={(e) => setFormData({ ...formData, shop_supplies_rate: (parseFloat(e.target.value) / 100).toString() })}
                          disabled={!formData.apply_shop_supplies}
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs text-gray-900 disabled:bg-gray-100"
                        />
                        <span className="text-xs text-gray-700">= ${calculateShopSupplies().toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id="apply_park_fees"
                          checked={formData.apply_park_fees}
                          onChange={(e) => setFormData({ ...formData, apply_park_fees: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                        />
                        <label htmlFor="apply_park_fees" className="text-xs font-medium text-gray-700">Park Fees (%)</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={(parseFloat(formData.park_fees_rate) * 100).toFixed(2)}
                          onChange={(e) => setFormData({ ...formData, park_fees_rate: (parseFloat(e.target.value) / 100).toString() })}
                          disabled={!formData.apply_park_fees}
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs text-gray-900 disabled:bg-gray-100"
                        />
                        <span className="text-xs text-gray-700">= ${calculateParkFees().toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">Surcharge (%)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={(parseFloat(formData.surcharge_rate) * 100).toFixed(2)}
                          onChange={(e) => setFormData({ ...formData, surcharge_rate: (parseFloat(e.target.value) / 100).toString() })}
                          className="w-16 px-1.5 py-0.5 text-right border border-gray-300 rounded text-xs text-gray-900"
                        />
                        <span className="text-xs text-gray-700">= ${calculateSurcharge().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-2">
                    <h5 className="text-xs font-semibold text-gray-900 mb-1">Estimate Summary</h5>
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

                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                    <h5 className="text-xs font-semibold text-blue-900 mb-2">Deposit Settings</h5>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="deposit_required"
                          checked={formData.deposit_required}
                          onChange={(e) => setFormData({ ...formData, deposit_required: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="deposit_required" className="text-xs font-medium text-gray-700">
                          Require Deposit to Start Work
                        </label>
                      </div>

                      {formData.deposit_required && (
                        <>
                          <div className="flex items-center gap-2 pl-6">
                            <label className="flex items-center gap-1">
                              <input
                                type="radio"
                                name="deposit_type"
                                value="percentage"
                                checked={formData.deposit_type === 'percentage'}
                                onChange={() => setFormData({ ...formData, deposit_type: 'percentage', deposit_amount: '' })}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">Percentage</span>
                            </label>
                            <label className="flex items-center gap-1">
                              <input
                                type="radio"
                                name="deposit_type"
                                value="fixed"
                                checked={formData.deposit_type === 'fixed'}
                                onChange={() => setFormData({ ...formData, deposit_type: 'fixed', deposit_percentage: '' })}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">Fixed Amount</span>
                            </label>
                          </div>

                          {formData.deposit_type === 'percentage' ? (
                            <div className="flex items-center gap-2 pl-6">
                              <label className="text-xs text-gray-700">Percentage:</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={formData.deposit_percentage}
                                onChange={(e) => setFormData({ ...formData, deposit_percentage: e.target.value })}
                                placeholder="50"
                                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                              <span className="text-xs text-gray-700">
                                % = ${formData.deposit_percentage ? ((calculateTotal() * parseFloat(formData.deposit_percentage)) / 100).toFixed(2) : '0.00'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pl-6">
                              <label className="text-xs text-gray-700">Amount:</label>
                              <span className="text-xs text-gray-700">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.deposit_amount}
                                onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                                placeholder="0.00"
                                className="w-24 px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </div>
                          )}

                          <div className="text-xs text-gray-600 pl-6 italic">
                            Deposit will be collected when work order is created
                          </div>
                        </>
                      )}
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
                  style={{ color: '#111827' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Terms & Conditions
                  <span className="text-xs text-gray-700 ml-2">(Printed at bottom of estimate)</span>
                </label>
                <textarea
                  value={formData.customer_notes}
                  onChange={(e) => setFormData({ ...formData, customer_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  rows={6}
                  style={{ color: '#111827' }}
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : editingId ? 'Save Estimate' : 'Create Estimate'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estimate #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Total</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {estimates.map((estimate) => (
              <tr key={estimate.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-900">{estimate.estimate_number}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {estimate.is_retail_customer ? estimate.customer_name : estimate.yachts?.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(estimate.status)}`}>
                    {estimate.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  ${estimate.total_amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-700">
                  {new Date(estimate.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {(estimate.status === 'draft' || estimate.status === 'sent') && (
                      <>
                        <button
                          onClick={() => openApproveModal(estimate.id)}
                          className="text-green-600 hover:text-green-800"
                          title="Approve and convert to work order"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDenyModal(estimate.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Deny estimate"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handlePrintEstimate(estimate.id)}
                      className="text-gray-600 hover:text-gray-800"
                      title="Print estimate"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {(estimate.status === 'draft' || estimate.status === 'sent') && (
                      <button
                        onClick={() => handleEditEstimate(estimate.id)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit estimate"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {estimate.status === 'draft' && (
                      <button
                        onClick={() => handleDeleteEstimate(estimate.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete estimate"
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
      </div>

      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Approve Estimate
            </h3>
            <p className="text-gray-700 mb-6">
              Approve this estimate and convert it to a work order? This will adjust parts inventory.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setEstimateToApprove(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveEstimate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {showDenyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Deny Estimate
            </h3>
            <p className="text-gray-700 mb-6">
              Deny this estimate? It will be marked as rejected and archived.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDenyModal(false);
                  setEstimateToDeny(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDenyEstimate}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestoreDraftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Restore Draft
            </h3>
            <p className="text-gray-700 mb-6">
              You have an unsaved estimate draft. Would you like to restore it?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleDeclineDraft}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                No
              </button>
              <button
                onClick={handleRestoreDraft}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cancel Estimate
            </h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to cancel? Your draft will be saved and you can restore it later.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                No, Keep Editing
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Estimate
            </h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this estimate? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEstimateToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showPackageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-green-600" />
                <h3 className="text-xl font-bold text-gray-900">Add Package</h3>
              </div>
              <button
                onClick={() => {
                  setShowPackageModal(false);
                  setSelectedPackageId('');
                  setActiveTaskIndex(null);
                }}
                className="text-gray-600 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Package
                </label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  required
                >
                  <option value="">Choose a package...</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
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
                onClick={() => {
                  setShowPackageModal(false);
                  setSelectedPackageId('');
                  setActiveTaskIndex(null);
                }}
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
        </div>
      )}
    </div>
  );
}
