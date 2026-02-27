import React, { useState, useEffect } from 'react';
import { Download, Calendar, Users, Clock, Plus, Edit2, Trash2, X, Check, CheckCircle, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TimeEntry, getPayrollPeriodsForDateRange } from '../utils/timeClockHelpers';
import { generatePayrollReportPDF } from '../utils/pdfGenerator';
import { useConfirm } from '../hooks/useConfirm';

interface PayPeriod {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  year: number;
  period_number: number;
  is_processed: boolean;
  notes?: string;
}

interface UserProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  employee_type: 'hourly' | 'salary';
}

interface WorkOrderTimeEntry {
  work_order_number: string;
  work_order_id: string;
  yacht_name?: string;
  customer_name?: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  notes?: string;
}

interface EmployeeReport {
  user: UserProfile;
  entries: TimeEntry[];
  workOrderEntries: WorkOrderTimeEntry[];
  totalStandardHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  totalWorkOrderHours: number;
  grandTotalHours: number;
}

interface PaidEmployeeSummary {
  user_id: string;
  first_name: string;
  last_name: string;
  employee_type: string;
  standardHours: number;
  overtimeHours: number;
  workOrderHours: number;
  grandTotal: number;
}

export function PayrollReportView() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employeeReports, setEmployeeReports] = useState<EmployeeReport[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [showPayPeriodForm, setShowPayPeriodForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PayPeriod | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activePayPeriod, setActivePayPeriod] = useState<PayPeriod | null>(null);
  const [paidEmployeeIds, setPaidEmployeeIds] = useState<Set<string>>(new Set());
  const [assigningPayroll, setAssigningPayroll] = useState<string | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);
  const [periodDetailData, setPeriodDetailData] = useState<Record<string, PaidEmployeeSummary[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [printingPeriodId, setPrintingPeriodId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    period_start: '',
    period_end: '',
    pay_date: '',
    year: new Date().getFullYear(),
    period_number: 1,
    notes: ''
  });

  useEffect(() => {
    loadUsers();
    loadPayPeriods();
    setDefaultDates();
  }, [selectedYear]);

  const setDefaultDates = () => {
    const today = new Date();
    const day = today.getDate();

    if (day <= 15) {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 27);
      const end = new Date(today.getFullYear(), today.getMonth(), 11);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else {
      const start = new Date(today.getFullYear(), today.getMonth(), 12);
      const end = new Date(today.getFullYear(), today.getMonth(), 26);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name, employee_type')
      .in('role', ['staff', 'mechanic', 'master'])
      .eq('is_active', true)
      .order('last_name');

    if (data) {
      setAllUsers(data);
      setSelectedUsers(new Set(data.map(u => u.user_id)));
    }
  };

  const loadPayPeriods = async () => {
    const { data } = await supabase
      .from('pay_periods')
      .select('*')
      .eq('year', selectedYear)
      .order('period_number');

    if (data) {
      setPayPeriods(data);
    }
  };

  const handleSavePayPeriod = async () => {
    if (!formData.period_start || !formData.period_end || !formData.pay_date) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingPeriod) {
        const { error } = await supabase
          .from('pay_periods')
          .update({
            period_start: formData.period_start,
            period_end: formData.period_end,
            pay_date: formData.pay_date,
            year: formData.year,
            period_number: formData.period_number,
            notes: formData.notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPeriod.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pay_periods')
          .insert({
            period_start: formData.period_start,
            period_end: formData.period_end,
            pay_date: formData.pay_date,
            year: formData.year,
            period_number: formData.period_number,
            notes: formData.notes || null
          });

        if (error) throw error;
      }

      setShowPayPeriodForm(false);
      setEditingPeriod(null);
      setFormData({
        period_start: '',
        period_end: '',
        pay_date: '',
        year: selectedYear,
        period_number: payPeriods.length + 1,
        notes: ''
      });
      loadPayPeriods();
    } catch (error: any) {
      console.error('Error saving pay period:', error);
      alert(error.message || 'Failed to save pay period');
    }
  };

  const handleEditPayPeriod = (period: PayPeriod) => {
    setEditingPeriod(period);
    setFormData({
      period_start: period.period_start,
      period_end: period.period_end,
      pay_date: period.pay_date,
      year: period.year,
      period_number: period.period_number,
      notes: period.notes || ''
    });
    setShowPayPeriodForm(true);
  };

  const handleDeletePayPeriod = async (id: string) => {
    if (!await confirm({ message: 'Are you sure you want to delete this pay period?', variant: 'danger' })) {
      return;
    }

    try {
      const { error } = await supabase
        .from('pay_periods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadPayPeriods();
    } catch (error) {
      console.error('Error deleting pay period:', error);
      alert('Failed to delete pay period');
    }
  };

  const handleSelectPayPeriod = (period: PayPeriod) => {
    setStartDate(period.period_start);
    setEndDate(period.period_end);
    setActivePayPeriod(period);
    setEmployeeReports([]);
    setPaidEmployeeIds(new Set());
  };

  const loadPaidEmployees = async (periodId: string) => {
    const { data } = await supabase
      .from('staff_time_entries')
      .select('user_id')
      .eq('pay_period_id', periodId);
    if (data && data.length > 0) {
      setPaidEmployeeIds(new Set(data.map((d: any) => d.user_id)));
    }
  };

  const handleTogglePeriodDetail = async (period: PayPeriod) => {
    if (expandedPeriodId === period.id) {
      setExpandedPeriodId(null);
      return;
    }
    setExpandedPeriodId(period.id);

    setLoadingDetail(period.id);
    try {
      const endOfDay = new Date(new Date(period.period_end).setHours(23, 59, 59)).toISOString();
      const startOfDay = new Date(period.period_start).toISOString();

      let query = supabase
        .from('staff_time_entries')
        .select('user_id, standard_hours, overtime_hours, total_hours, work_order_id')
        .not('punch_out_time', 'is', null);

      if (period.is_processed) {
        query = query.eq('pay_period_id', period.id);
      } else {
        query = query
          .gte('punch_in_time', startOfDay)
          .lte('punch_in_time', endOfDay);
      }

      const { data: entries, error: entriesError } = await query;

      if (entriesError) console.error('Period detail fetch error:', entriesError);

      const allEntries = entries || [];

      const uniqueUserIds = [...new Set(allEntries.map((e: any) => e.user_id))];
      const { data: profiles } = uniqueUserIds.length > 0
        ? await supabase
            .from('user_profiles')
            .select('user_id, first_name, last_name, employee_type')
            .in('user_id', uniqueUserIds)
        : { data: [] };

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

      const byUser: Record<string, PaidEmployeeSummary> = {};

      allEntries.forEach((e: any) => {
        const profile = profileMap[e.user_id];
        if (!byUser[e.user_id]) {
          byUser[e.user_id] = {
            user_id: e.user_id,
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            employee_type: profile?.employee_type || '',
            standardHours: 0, overtimeHours: 0, workOrderHours: 0, grandTotal: 0
          };
        }
        if (e.work_order_id) {
          byUser[e.user_id].workOrderHours += parseFloat(e.total_hours || e.standard_hours || 0);
        } else {
          byUser[e.user_id].standardHours += parseFloat(e.standard_hours || 0);
          byUser[e.user_id].overtimeHours += parseFloat(e.overtime_hours || 0);
        }
      });

      const summaries = Object.values(byUser).map(s => ({
        ...s,
        standardHours: Math.round(s.standardHours * 100) / 100,
        overtimeHours: Math.round(s.overtimeHours * 100) / 100,
        workOrderHours: Math.round(s.workOrderHours * 100) / 100,
        grandTotal: Math.round((s.standardHours + s.overtimeHours + s.workOrderHours) * 100) / 100
      }));

      summaries.sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));

      setPeriodDetailData(prev => ({ ...prev, [period.id]: summaries }));
    } catch (err) {
      console.error('Error loading period detail:', err);
    } finally {
      setLoadingDetail(null);
    }
  };

  const handleAssignPayPeriod = async (userId: string) => {
    if (!activePayPeriod) return;
    setAssigningPayroll(userId);
    try {
      const endOfDay = new Date(new Date(activePayPeriod.period_end).setHours(23, 59, 59)).toISOString();
      const { error } = await supabase
        .from('staff_time_entries')
        .update({ pay_period_id: activePayPeriod.id })
        .eq('user_id', userId)
        .gte('punch_in_time', new Date(activePayPeriod.period_start).toISOString())
        .lte('punch_in_time', endOfDay)
        .not('punch_out_time', 'is', null);

      if (error) throw error;

      const newPaid = new Set(paidEmployeeIds);
      newPaid.add(userId);
      setPaidEmployeeIds(newPaid);
      setPeriodDetailData(prev => { const n = { ...prev }; delete n[activePayPeriod.id]; return n; });

      if (newPaid.size >= employeeReports.filter(r => r.grandTotalHours > 0).length) {
        await supabase
          .from('pay_periods')
          .update({ is_processed: true })
          .eq('id', activePayPeriod.id);
        setActivePayPeriod({ ...activePayPeriod, is_processed: true });
        loadPayPeriods();
      }
    } catch (err: any) {
      console.error('Error assigning pay period:', err);
      alert(err.message || 'Failed to assign pay period');
    } finally {
      setAssigningPayroll(null);
    }
  };

  const handleUnassignPayPeriod = async (userId: string) => {
    if (!activePayPeriod) return;
    setAssigningPayroll(userId);
    try {
      const endOfDay = new Date(new Date(activePayPeriod.period_end).setHours(23, 59, 59)).toISOString();
      const { error } = await supabase
        .from('staff_time_entries')
        .update({ pay_period_id: null })
        .eq('user_id', userId)
        .eq('pay_period_id', activePayPeriod.id)
        .gte('punch_in_time', new Date(activePayPeriod.period_start).toISOString())
        .lte('punch_in_time', endOfDay);

      if (error) throw error;

      const newPaid = new Set(paidEmployeeIds);
      newPaid.delete(userId);
      setPaidEmployeeIds(newPaid);
      setPeriodDetailData(prev => { const n = { ...prev }; delete n[activePayPeriod.id]; return n; });

      if (activePayPeriod.is_processed) {
        await supabase
          .from('pay_periods')
          .update({ is_processed: false })
          .eq('id', activePayPeriod.id);
        setActivePayPeriod({ ...activePayPeriod, is_processed: false });
        loadPayPeriods();
      }
    } catch (err: any) {
      console.error('Error unassigning pay period:', err);
    } finally {
      setAssigningPayroll(null);
    }
  };

  const handleNewPayPeriod = () => {
    setEditingPeriod(null);
    setFormData({
      period_start: '',
      period_end: '',
      pay_date: '',
      year: selectedYear,
      period_number: payPeriods.length + 1,
      notes: ''
    });
    setShowPayPeriodForm(true);
  };

  const handlePrintPayPeriod = async (period: PayPeriod) => {
    setPrintingPeriodId(period.id);
    try {
      const endOfDay = new Date(new Date(period.period_end).setHours(23, 59, 59)).toISOString();
      const startOfDay = new Date(period.period_start).toISOString();

      let regularQuery = supabase
        .from('staff_time_entries')
        .select('*')
        .is('work_order_id', null)
        .not('punch_out_time', 'is', null)
        .order('punch_in_time');

      let workOrderQuery = supabase
        .from('staff_time_entries')
        .select(`
          *,
          work_orders!inner (
            work_order_number,
            customer_name,
            yachts (
              name
            )
          )
        `)
        .not('work_order_id', 'is', null)
        .not('punch_out_time', 'is', null)
        .order('punch_in_time');

      if (period.is_processed) {
        regularQuery = regularQuery.eq('pay_period_id', period.id);
        workOrderQuery = workOrderQuery.eq('pay_period_id', period.id);
      } else {
        regularQuery = regularQuery.gte('punch_in_time', startOfDay).lte('punch_in_time', endOfDay);
        workOrderQuery = workOrderQuery.gte('punch_in_time', startOfDay).lte('punch_in_time', endOfDay);
      }

      const [regularResult, workOrderResult, profilesResult, yachtsResult] = await Promise.all([
        regularQuery,
        workOrderQuery,
        supabase.from('user_profiles').select('user_id, first_name, last_name, employee_type').in('role', ['staff', 'mechanic', 'master']).eq('is_active', true).order('last_name'),
        supabase.from('yachts').select('id, name')
      ]);

      const regularEntries = regularResult.data || [];
      const workOrderEntries = workOrderResult.data || [];
      const profiles = profilesResult.data || [];

      const yachtMap: Record<string, string> = {};
      (yachtsResult.data || []).forEach(y => { yachtMap[y.id] = y.name; });

      const allUserIds = new Set([
        ...regularEntries.map((e: any) => e.user_id),
        ...workOrderEntries.map((e: any) => e.user_id)
      ]);

      const reports: any[] = [];
      profiles.forEach(user => {
        if (!allUserIds.has(user.user_id)) return;

        const userEntries = regularEntries.filter((e: any) => e.user_id === user.user_id);
        const totalStandardHours = userEntries.reduce((sum: number, e: any) => sum + (e.standard_hours || 0), 0);
        const totalOvertimeHours = userEntries.reduce((sum: number, e: any) => sum + (e.overtime_hours || 0), 0);
        const totalHours = totalStandardHours + totalOvertimeHours;

        const userWorkOrderEntries = workOrderEntries
          .filter((e: any) => e.user_id === user.user_id)
          .map((e: any) => {
            const punchIn = new Date(e.punch_in_time);
            const punchOut = new Date(e.punch_out_time);
            const hours = (punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60);
            return {
              work_order_number: e.work_orders?.work_order_number || 'N/A',
              work_order_id: e.work_order_id,
              yacht_name: e.work_orders?.yachts?.name,
              customer_name: e.work_orders?.customer_name,
              punch_in_time: e.punch_in_time,
              punch_out_time: e.punch_out_time,
              total_hours: Math.round(hours * 100) / 100,
              notes: e.notes
            };
          });

        const totalWorkOrderHours = userWorkOrderEntries.reduce((sum: number, e: any) => sum + e.total_hours, 0);
        const grandTotalHours = totalHours + totalWorkOrderHours;

        reports.push({
          user,
          entries: userEntries,
          workOrderEntries: userWorkOrderEntries,
          totalStandardHours: Math.round(totalStandardHours * 100) / 100,
          totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
          totalHours: Math.round(totalHours * 100) / 100,
          totalWorkOrderHours: Math.round(totalWorkOrderHours * 100) / 100,
          grandTotalHours: Math.round(grandTotalHours * 100) / 100
        });
      });

      reports.sort((a, b) =>
        `${a.user.last_name} ${a.user.first_name}`.localeCompare(`${b.user.last_name} ${b.user.first_name}`)
      );

      await generatePayrollReportPDF(reports, period.period_start, period.period_end, yachtMap);
    } catch (err: any) {
      console.error('Error printing pay period:', err);
      alert(err.message || 'Failed to generate payroll PDF');
    } finally {
      setPrintingPeriodId(null);
    }
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert('Please select start and end dates');
      return;
    }

    if (selectedUsers.size === 0) {
      alert('Please select at least one employee');
      return;
    }

    setLoading(true);
    try {
      const [regularEntriesResult, workOrderEntriesResult] = await Promise.all([
        supabase
          .from('staff_time_entries')
          .select('*')
          .in('user_id', Array.from(selectedUsers))
          .is('work_order_id', null)
          .gte('punch_in_time', new Date(startDate).toISOString())
          .lte('punch_in_time', new Date(new Date(endDate).setHours(23, 59, 59)).toISOString())
          .not('punch_out_time', 'is', null)
          .order('punch_in_time'),

        supabase
          .from('staff_time_entries')
          .select(`
            *,
            work_orders!inner (
              work_order_number,
              customer_name,
              yachts (
                name
              )
            )
          `)
          .in('user_id', Array.from(selectedUsers))
          .not('work_order_id', 'is', null)
          .gte('punch_in_time', new Date(startDate).toISOString())
          .lte('punch_in_time', new Date(new Date(endDate).setHours(23, 59, 59)).toISOString())
          .not('punch_out_time', 'is', null)
          .order('punch_in_time')
      ]);

      if (regularEntriesResult.error) throw regularEntriesResult.error;
      if (workOrderEntriesResult.error) throw workOrderEntriesResult.error;

      const regularEntries = regularEntriesResult.data || [];
      const workOrderEntries = workOrderEntriesResult.data || [];

      const reports: EmployeeReport[] = [];
      allUsers.forEach(user => {
        if (selectedUsers.has(user.user_id)) {
          const userEntries = regularEntries.filter(e => e.user_id === user.user_id);
          const totalStandardHours = userEntries.reduce((sum, e) => sum + (e.standard_hours || 0), 0);
          const totalOvertimeHours = userEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
          const totalHours = totalStandardHours + totalOvertimeHours;

          const userWorkOrderEntries: WorkOrderTimeEntry[] = workOrderEntries
            .filter((e: any) => e.user_id === user.user_id)
            .map((e: any) => {
              const punchIn = new Date(e.punch_in_time);
              const punchOut = new Date(e.punch_out_time);
              const hours = (punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60);

              return {
                work_order_number: e.work_orders?.work_order_number || 'N/A',
                work_order_id: e.work_order_id,
                yacht_name: e.work_orders?.yachts?.name,
                customer_name: e.work_orders?.customer_name,
                punch_in_time: e.punch_in_time,
                punch_out_time: e.punch_out_time,
                total_hours: Math.round(hours * 100) / 100,
                notes: e.notes
              };
            });

          const totalWorkOrderHours = userWorkOrderEntries.reduce((sum, e) => sum + e.total_hours, 0);
          const grandTotalHours = totalHours + totalWorkOrderHours;

          reports.push({
            user,
            entries: userEntries,
            workOrderEntries: userWorkOrderEntries,
            totalStandardHours: Math.round(totalStandardHours * 100) / 100,
            totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
            totalHours: Math.round(totalHours * 100) / 100,
            totalWorkOrderHours: Math.round(totalWorkOrderHours * 100) / 100,
            grandTotalHours: Math.round(grandTotalHours * 100) / 100
          });
        }
      });

      reports.sort((a, b) => {
        const aName = `${a.user.last_name} ${a.user.first_name}`;
        const bName = `${b.user.last_name} ${b.user.first_name}`;
        return aName.localeCompare(bName);
      });

      setEmployeeReports(reports);

      if (activePayPeriod) {
        await loadPaidEmployees(activePayPeriod.id);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (employeeReports.length === 0) {
      alert('Please generate a report first');
      return;
    }

    try {
      const { data: yachts } = await supabase
        .from('yachts')
        .select('id, name');

      const yachtMap: Record<string, string> = {};
      (yachts || []).forEach(y => {
        yachtMap[y.id] = y.name;
      });

      await generatePayrollReportPDF(employeeReports, startDate, endDate, yachtMap);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleAll = () => {
    if (selectedUsers.size === allUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(allUsers.map(u => u.user_id)));
    }
  };

  const grandTotalStandard = employeeReports.reduce((sum, r) => sum + r.totalStandardHours, 0);
  const grandTotalOvertime = employeeReports.reduce((sum, r) => sum + r.totalOvertimeHours, 0);
  const grandTotalTimeClock = grandTotalStandard + grandTotalOvertime;
  const grandTotalWorkOrder = employeeReports.reduce((sum, r) => sum + r.totalWorkOrderHours, 0);
  const grandTotal = grandTotalTimeClock + grandTotalWorkOrder;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-500 mb-2">Payroll Report</h2>
        <p className="text-gray-600">Generate time clock reports for payroll processing</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pay Periods</h3>
            <p className="text-sm text-gray-600">Manage pay cycles for the year</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <button
              onClick={handleNewPayPeriod}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Pay Period
            </button>
          </div>
        </div>

        {showPayPeriodForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">
                {editingPeriod ? 'Edit Pay Period' : 'New Pay Period'}
              </h4>
              <button
                onClick={() => {
                  setShowPayPeriodForm(false);
                  setEditingPeriod(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period Number
                </label>
                <input
                  type="number"
                  value={formData.period_number}
                  onChange={(e) => setFormData({ ...formData, period_number: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period Start
                </label>
                <input
                  type="date"
                  value={formData.period_start}
                  onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period End
                </label>
                <input
                  type="date"
                  value={formData.period_end}
                  onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Date
                </label>
                <input
                  type="date"
                  value={formData.pay_date}
                  onChange={(e) => setFormData({ ...formData, pay_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="Holiday pay, special notes, etc."
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSavePayPeriod}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
              >
                <Check className="w-4 h-4" />
                Save Pay Period
              </button>
            </div>
          </div>
        )}

        {payPeriods.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-6"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period Start</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period End</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pay Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payPeriods.map(period => (
                  <React.Fragment key={period.id}>
                    <tr className={`hover:bg-gray-50 ${expandedPeriodId === period.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleTogglePeriodDetail(period)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="View paid hours for this period"
                        >
                          {expandedPeriodId === period.id
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        <button
                          onClick={() => handleTogglePeriodDetail(period)}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          #{period.period_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(period.period_start).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(period.period_end).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {new Date(period.pay_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{period.notes || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          period.is_processed
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {period.is_processed ? 'Processed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right space-x-2">
                        <button
                          onClick={() => handleSelectPayPeriod(period)}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Use Dates
                        </button>
                        <button
                          onClick={() => handleEditPayPeriod(period)}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDeletePayPeriod(period.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>

                    {expandedPeriodId === period.id && (
                      <tr>
                        <td colSpan={8} className="px-0 py-0">
                          <div className="bg-gray-50 border-t border-b border-blue-100 px-6 py-4">
                            <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-semibold text-gray-800">
                                Paid Hours — Pay Period #{period.period_number} &nbsp;
                                <span className="text-gray-500 font-normal">
                                  ({new Date(period.period_start).toLocaleDateString()} – {new Date(period.period_end).toLocaleDateString()}, Pay Date: {new Date(period.pay_date).toLocaleDateString()})
                                </span>
                              </span>
                            </div>
                            <button
                              onClick={() => handlePrintPayPeriod(period)}
                              disabled={printingPeriodId === period.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
                            >
                              {printingPeriodId === period.id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              ) : (
                                <Printer className="w-3.5 h-3.5" />
                              )}
                              {printingPeriodId === period.id ? 'Generating...' : 'Print Payroll'}
                            </button>
                          </div>

                            {loadingDetail === period.id ? (
                              <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                Loading...
                              </div>
                            ) : !periodDetailData[period.id] || periodDetailData[period.id].length === 0 ? (
                              <p className="text-sm text-gray-500 italic py-2">No hours have been marked as paid for this period yet.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-gray-500 uppercase">
                                    <th className="text-left pb-2 pr-4">Employee</th>
                                    <th className="text-left pb-2 pr-4">Type</th>
                                    <th className="text-right pb-2 pr-4">Standard Hrs</th>
                                    <th className="text-right pb-2 pr-4">Overtime Hrs</th>
                                    <th className="text-right pb-2 pr-4">Work Order Hrs</th>
                                    <th className="text-right pb-2">Total Hrs</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {periodDetailData[period.id].map(s => (
                                    <tr key={s.user_id} className="text-gray-800">
                                      <td className="py-2 pr-4 font-medium">{s.last_name}, {s.first_name}</td>
                                      <td className="py-2 pr-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          s.employee_type === 'hourly' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                        }`}>{s.employee_type}</span>
                                      </td>
                                      <td className="py-2 pr-4 text-right">{s.standardHours.toFixed(2)}</td>
                                      <td className="py-2 pr-4 text-right text-orange-600">{s.overtimeHours.toFixed(2)}</td>
                                      <td className="py-2 pr-4 text-right text-blue-600">{s.workOrderHours.toFixed(2)}</td>
                                      <td className="py-2 text-right font-bold">{s.grandTotal.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="border-t-2 border-gray-300">
                                  <tr className="text-gray-900 font-bold">
                                    <td colSpan={2} className="pt-2 pr-4">TOTAL</td>
                                    <td className="pt-2 pr-4 text-right">
                                      {periodDetailData[period.id].reduce((s, r) => s + r.standardHours, 0).toFixed(2)}
                                    </td>
                                    <td className="pt-2 pr-4 text-right text-orange-600">
                                      {periodDetailData[period.id].reduce((s, r) => s + r.overtimeHours, 0).toFixed(2)}
                                    </td>
                                    <td className="pt-2 pr-4 text-right text-blue-600">
                                      {periodDetailData[period.id].reduce((s, r) => s + r.workOrderHours, 0).toFixed(2)}
                                    </td>
                                    <td className="pt-2 text-right">
                                      {periodDetailData[period.id].reduce((s, r) => s + r.grandTotal, 0).toFixed(2)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No pay periods configured for {selectedYear}</p>
            <p className="text-sm text-gray-500">Click "Add Pay Period" to get started</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pay Period
          </label>
          <select
            value={activePayPeriod?.id || ''}
            onChange={(e) => {
              const period = payPeriods.find(p => p.id === e.target.value) || null;
              if (period) {
                handleSelectPayPeriod(period);
              } else {
                setActivePayPeriod(null);
                setStartDate('');
                setEndDate('');
                setEmployeeReports([]);
                setPaidEmployeeIds(new Set());
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="">-- Select a Pay Period --</option>
            {payPeriods.map(p => (
              <option key={p.id} value={p.id}>
                #{p.period_number} — {new Date(p.period_start).toLocaleDateString()} to {new Date(p.period_end).toLocaleDateString()} (Pay: {new Date(p.pay_date).toLocaleDateString()}){p.is_processed ? ' ✓' : ''}
              </option>
            ))}
          </select>
          {activePayPeriod && (
            <p className="text-xs text-gray-500 mt-1">
              {new Date(activePayPeriod.period_start).toLocaleDateString()} – {new Date(activePayPeriod.period_end).toLocaleDateString()}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Employees
            </label>
            <button
              onClick={toggleAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {selectedUsers.size === allUsers.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {allUsers.map(user => (
                <label
                  key={user.user_id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.user_id)}
                    onChange={() => toggleUser(user.user_id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900">
                    {user.last_name}, {user.first_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({user.employee_type})
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
          >
            <Calendar className="w-5 h-5" />
            Generate Report
          </button>
          {employeeReports.length > 0 && (
            <button
              onClick={handleDownloadPDF}
              className="bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg flex items-center justify-center gap-2 font-semibold"
            >
              <Download className="w-5 h-5" />
              Download PDF
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!loading && employeeReports.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-amber-500">Report Summary</h3>
                <p className="text-sm text-gray-600">
                  {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                </p>
                {activePayPeriod && (
                  <p className="text-xs text-blue-600 font-medium mt-1">
                    Pay Period #{activePayPeriod.period_number} — Pay Date: {new Date(activePayPeriod.pay_date).toLocaleDateString()}
                    {activePayPeriod.is_processed && (
                      <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> Processed
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-5 h-5" />
                <span className="font-medium">{employeeReports.length} Employees</span>
              </div>
            </div>
          </div>

          {activePayPeriod && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 text-sm text-blue-700">
              Click the <strong>Grand Total</strong> for each employee to mark their hours as paid for this pay period. Click again to undo.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Standard Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overtime Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Clock Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Order Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grand Total {activePayPeriod && <span className="normal-case text-blue-500">(click to mark paid)</span>}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employeeReports.map(report => {
                  const isPaid = paidEmployeeIds.has(report.user.user_id);
                  const isAssigning = assigningPayroll === report.user.user_id;
                  return (
                    <tr key={report.user.user_id} className={`hover:bg-gray-50 ${isPaid ? 'bg-green-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {report.user.last_name}, {report.user.first_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          report.user.employee_type === 'hourly'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {report.user.employee_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {report.totalStandardHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-orange-600 font-medium">
                        {report.totalOvertimeHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {report.totalHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-600 font-medium">
                        {report.totalWorkOrderHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {activePayPeriod ? (
                          <button
                            onClick={() => isPaid ? handleUnassignPayPeriod(report.user.user_id) : handleAssignPayPeriod(report.user.user_id)}
                            disabled={isAssigning}
                            title={isPaid ? 'Click to undo — remove from this pay period' : 'Click to mark as paid for this pay period'}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold transition-colors ${
                              isPaid
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                            } disabled:opacity-50`}
                          >
                            {isAssigning ? (
                              <span className="animate-pulse">...</span>
                            ) : isPaid ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Paid
                              </>
                            ) : (
                              report.grandTotalHours.toFixed(2)
                            )}
                          </button>
                        ) : (
                          <span className="text-sm font-bold text-gray-900">{report.grandTotalHours.toFixed(2)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm font-bold text-gray-900">
                    TOTALS
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                    {grandTotalStandard.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-orange-600">
                    {grandTotalOvertime.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                    {grandTotalTimeClock.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-blue-600">
                    {grandTotalWorkOrder.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                    {grandTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && employeeReports.length === 0 && startDate && endDate && (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Click "Generate Report" to view time entries</p>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
