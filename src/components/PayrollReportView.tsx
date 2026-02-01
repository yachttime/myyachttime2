import React, { useState, useEffect } from 'react';
import { Download, Calendar, Users, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TimeEntry, getPayrollPeriodsForDateRange } from '../utils/timeClockHelpers';
import { generatePayrollReportPDF } from '../utils/pdfGenerator';

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

export function PayrollReportView() {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employeeReports, setEmployeeReports] = useState<EmployeeReport[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    loadUsers();
    setDefaultDates();
  }, []);

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

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
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
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-5 h-5" />
                <span className="font-medium">{employeeReports.length} Employees</span>
              </div>
            </div>
          </div>

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
                    Grand Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employeeReports.map(report => (
                  <tr key={report.user.user_id} className="hover:bg-gray-50">
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                      {report.grandTotalHours.toFixed(2)}
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
