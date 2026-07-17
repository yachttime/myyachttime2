import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  X,
  Trash2,
  DollarSign,
  Ship,
  User,
  ShoppingBag,
  Fuel,
  Filter,
  Plus,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  ExternalLink,
  Check,
  Archive,
  Clock,
  Info,
} from 'lucide-react';
import { supabase, isMasterRole } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRoleImpersonation } from '../contexts/RoleImpersonationContext';
import { ConfirmDialog } from './ConfirmDialog';

interface Receipt {
  id: string;
  user_id: string;
  receipt_url: string;
  amount: number;
  description: string | null;
  tag_type: string;
  yacht_id: string | null;
  customer_id: string | null;
  estimate_id: string | null;
  receipt_date: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  created_at: string;
  yachts?: { name: string } | null;
  customers?: { first_name: string | null; last_name: string | null; business_name: string | null } | null;
  estimates?: { estimate_number: string } | null;
}

interface YachtOption {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
}

interface EstimateOption {
  id: string;
  estimate_number: string;
  work_title: string | null;
  customer_name: string | null;
}

interface StaffOption {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

type TagType = 'yacht' | 'customer' | 'shop_supplies' | 'fuel_company_vehicle' | 'fuel_company_boat';

const TAG_LABELS: Record<TagType, string> = {
  yacht: 'Yacht',
  customer: 'Customer',
  shop_supplies: 'Shop Supplies',
  fuel_company_vehicle: 'Fuel - Company Vehicle',
  fuel_company_boat: 'Fuel - Company Boat',
};

const TAG_COLORS: Record<TagType, string> = {
  yacht: 'bg-blue-100 text-blue-800',
  customer: 'bg-green-100 text-green-800',
  shop_supplies: 'bg-gray-100 text-gray-800',
  fuel_company_vehicle: 'bg-orange-100 text-orange-800',
  fuel_company_boat: 'bg-amber-100 text-amber-800',
};

const TAG_ICONS: Record<TagType, React.ReactNode> = {
  yacht: <Ship className="w-3 h-3" />,
  customer: <User className="w-3 h-3" />,
  shop_supplies: <ShoppingBag className="w-3 h-3" />,
  fuel_company_vehicle: <Fuel className="w-3 h-3" />,
  fuel_company_boat: <Fuel className="w-3 h-3" />,
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  archived: 'Archived',
};

export function ReceiptsView() {
  const { user, userProfile } = useAuth();
  const { getEffectiveRole } = useRoleImpersonation();
  const effectiveRole = getEffectiveRole(userProfile?.role);
  const isStaffOrMaster = effectiveRole === 'staff' || effectiveRole === 'master';

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Filters
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterTagType, setFilterTagType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Options for filters
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  useEffect(() => {
    loadReceipts();
    if (isStaffOrMaster) loadStaffOptions();
  }, [filterEmployee, filterTagType, filterStatus, filterDateFrom, filterDateTo]);

  const loadStaffOptions = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name')
      .in('role', ['staff', 'mechanic', 'master'])
      .eq('is_active', true)
      .order('last_name');
    if (data) setStaffOptions(data);
  };

  const loadReceipts = async () => {
    setLoading(true);
    let query = supabase
      .from('receipts')
      .select(`
        *,
        yachts(name),
        customers(first_name, last_name, business_name),
        estimates(estimate_number)
      `)
      .order('receipt_date', { ascending: false });

    if (filterEmployee !== 'all') {
      query = query.eq('user_id', filterEmployee);
    }
    if (filterTagType !== 'all') {
      query = query.eq('tag_type', filterTagType);
    }
    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }
    if (filterDateFrom) {
      query = query.gte('receipt_date', filterDateFrom);
    }
    if (filterDateTo) {
      query = query.lte('receipt_date', filterDateTo);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error loading receipts:', error);
    } else {
      setReceipts(data || []);
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);
        if (profiles) {
          const names: Record<string, string> = {};
          profiles.forEach(p => {
            names[p.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          });
          setUserNames(names);
        }
      }
    }
    setLoading(false);
  };

  const handleApprove = async (receipt: Receipt) => {
    if (!user) return;
    const { error } = await supabase
      .from('receipts')
      .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', receipt.id);
    if (error) {
      setMessage({ type: 'error', text: 'Failed to approve receipt.' });
    } else {
      setMessage({ type: 'success', text: 'Receipt approved.' });
      loadReceipts();
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleArchive = async (receipt: Receipt) => {
    const { error } = await supabase
      .from('receipts')
      .update({ status: 'archived' })
      .eq('id', receipt.id);
    if (error) {
      setMessage({ type: 'error', text: 'Failed to archive receipt.' });
    } else {
      setMessage({ type: 'success', text: 'Receipt archived.' });
      loadReceipts();
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('receipts').delete().eq('id', deleteTarget.id);
    if (error) {
      setMessage({ type: 'error', text: 'Failed to delete receipt.' });
    } else {
      setMessage({ type: 'success', text: 'Receipt deleted.' });
      setReceipts(prev => prev.filter(r => r.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
    setTimeout(() => setMessage(null), 3000);
  };

  const canDelete = (receipt: Receipt) => {
    if (isStaffOrMaster) return true;
    return receipt.user_id === user?.id && receipt.status === 'pending';
  };

  const getTagLabel = (receipt: Receipt): string => {
    switch (receipt.tag_type) {
      case 'yacht':
        return receipt.yachts?.name || 'Yacht';
      case 'customer': {
        const c = receipt.customers;
        if (!c) return 'Customer';
        return c.business_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer';
      }
      default:
        return TAG_LABELS[receipt.tag_type as TagType] || receipt.tag_type;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Receipts</h2>
          <p className="text-sm text-gray-500">Upload and manage company credit card receipts</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Upload Receipt
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Receipt Approval Required</p>
          <p className="mt-0.5">Uploaded receipts must be approved by a manager before they are considered processed. Until approved, receipts remain in "Pending" status. Pending receipts are subject to payroll deduction.</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {isStaffOrMaster && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Employees</option>
                {staffOptions.map(s => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={filterTagType}
              onChange={(e) => setFilterTagType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(TAG_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Receipts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : receipts.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No receipts found</p>
          <p className="text-sm text-gray-400 mt-1">Upload a receipt to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receipts.map(receipt => (
            <div key={receipt.id} className={`bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow ${
              receipt.status === 'archived' ? 'border-gray-200 opacity-75' : 'border-gray-200'
            }`}>
              {/* Thumbnail */}
              <a
                href={receipt.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative h-40 bg-gray-100 group"
              >
                {receipt.receipt_url.toLowerCase().endsWith('.pdf') ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ImageIcon className="w-10 h-10 text-gray-400 mx-auto" />
                      <span className="text-xs text-gray-500 mt-1">PDF Receipt</span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={receipt.receipt_url}
                    alt="Receipt"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Status badge overlay */}
                <div className="absolute top-2 left-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[receipt.status] || 'bg-gray-100 text-gray-800'}`}>
                    {receipt.status === 'pending' && <Clock className="w-3 h-3" />}
                    {receipt.status === 'approved' && <Check className="w-3 h-3" />}
                    {receipt.status === 'archived' && <Archive className="w-3 h-3" />}
                    {STATUS_LABELS[receipt.status] || receipt.status}
                  </span>
                </div>
              </a>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(receipt.amount)}</span>
                  <span className="text-xs text-gray-500">{formatDate(receipt.receipt_date)}</span>
                </div>

                {receipt.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{receipt.description}</p>
                )}

                {/* Tag Badge */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TAG_COLORS[receipt.tag_type as TagType] || 'bg-gray-100 text-gray-800'}`}>
                    {TAG_ICONS[receipt.tag_type as TagType]}
                    {getTagLabel(receipt)}
                  </span>
                  {receipt.estimates?.estimate_number && (
                    <span className="text-xs text-gray-500">({receipt.estimates.estimate_number})</span>
                  )}
                </div>

                {/* Employee name */}
                <div className="text-xs text-gray-400 mb-3">
                  {userNames[receipt.user_id] || 'Unknown'}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  {/* Approve button - only for staff/master on pending receipts */}
                  {isStaffOrMaster && receipt.status === 'pending' && (
                    <button
                      onClick={() => handleApprove(receipt)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-md text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  )}

                  {/* Archive button - only for staff/master on approved receipts */}
                  {isStaffOrMaster && receipt.status === 'approved' && (
                    <button
                      onClick={() => handleArchive(receipt)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </button>
                  )}

                  {/* Delete button */}
                  {canDelete(receipt) && (
                    <button
                      onClick={() => setDeleteTarget(receipt)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-red-600 rounded-md text-xs font-medium hover:bg-red-50 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <ReceiptUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            setMessage({ type: 'success', text: 'Receipt uploaded successfully!' });
            loadReceipts();
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Receipt"
        message="Are you sure you want to delete this receipt? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
}

function ReceiptUploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [tagType, setTagType] = useState<TagType>('yacht');
  const [yachtId, setYachtId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [estimateId, setEstimateId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Options
  const [yachts, setYachts] = useState<YachtOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [estimates, setEstimates] = useState<EstimateOption[]>([]);

  useEffect(() => {
    loadYachts();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (tagType === 'yacht' && yachtId) {
      loadEstimates('yacht', yachtId);
    } else if (tagType === 'customer' && customerId) {
      loadEstimates('customer', customerId);
    } else {
      setEstimates([]);
      setEstimateId('');
    }
  }, [tagType, yachtId, customerId]);

  const loadYachts = async () => {
    const { data } = await supabase
      .from('yachts')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setYachts(data);
  };

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name, business_name')
      .eq('is_active', true)
      .order('last_name');
    if (data) setCustomers(data);
  };

  const loadEstimates = async (type: 'yacht' | 'customer', id: string) => {
    let query = supabase
      .from('estimates')
      .select('id, estimate_number, work_title, customer_name')
      .not('status', 'eq', 'archived')
      .order('created_at', { ascending: false })
      .limit(20);

    if (type === 'yacht') {
      query = query.eq('yacht_id', id);
    } else {
      query = query.eq('customer_vessel_id', id);
    }

    const { data } = await query;
    if (data) setEstimates(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB');
      return;
    }

    setFile(selected);
    setError('');

    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (tagType === 'yacht' && !yachtId) {
      setError('Please select a yacht');
      return;
    }

    if (tagType === 'customer' && !customerId) {
      setError('Please select a customer');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 10);
      const filePath = `${user.id}/${timestamp}-${randomStr}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);

      const insertData: Record<string, unknown> = {
        user_id: user.id,
        receipt_url: urlData.publicUrl,
        amount: parseFloat(amount),
        description: description.trim() || null,
        tag_type: tagType,
        receipt_date: receiptDate,
        yacht_id: tagType === 'yacht' ? yachtId : null,
        customer_id: tagType === 'customer' ? customerId : null,
        estimate_id: estimateId || null,
      };

      const { error: insertError } = await supabase.from('receipts').insert(insertData);
      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to upload receipt');
    } finally {
      setUploading(false);
    }
  };

  const getCustomerDisplayName = (c: CustomerOption) => {
    return c.business_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[99999] overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Upload Receipt</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Photo</label>
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">Take photo or select file</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, HEIC, or PDF up to 10MB</p>
              </div>
            ) : (
              <div className="relative">
                {preview ? (
                  <img src={preview} alt="Receipt preview" className="w-full h-48 object-contain bg-gray-100 rounded-lg" />
                ) : (
                  <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm text-gray-500">{file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Date and Amount row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief note about the purchase"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Tag Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tag To</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(TAG_LABELS) as [TagType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTagType(key);
                    setYachtId('');
                    setCustomerId('');
                    setEstimateId('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    tagType === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {TAG_ICONS[key]}
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Yacht Selector */}
          {tagType === 'yacht' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Yacht</label>
              <select
                value={yachtId}
                onChange={(e) => { setYachtId(e.target.value); setEstimateId(''); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">-- Select Yacht --</option>
                {yachts.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Selector */}
          {tagType === 'customer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Customer</label>
              <select
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setEstimateId(''); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{getCustomerDisplayName(c)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Estimate Selector (optional, shown when yacht or customer selected) */}
          {estimates.length > 0 && (tagType === 'yacht' || tagType === 'customer') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link to Estimate (optional)</label>
              <select
                value={estimateId}
                onChange={(e) => setEstimateId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- None --</option>
                {estimates.map(est => (
                  <option key={est.id} value={est.id}>
                    {est.estimate_number} {est.work_title ? `- ${est.work_title}` : ''} {est.customer_name ? `(${est.customer_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
