import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Printer, AlertCircle, Calendar, ChevronDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  invoice_date: string;
  payment_status: string;
  tax_amount: number;
  tax_rate: number;
  subtotal: number;
  shop_supplies_amount: number;
  park_fees_amount: number;
  surcharge_amount: number;
  total_amount: number;
}

interface LaborRow {
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  payment_status: string;
  work_title: string | null;
  total_hours: number;
  total_labor_amount: number;
  employees: string[];
  employeeHours: Record<string, number>;
  labor_cost: number;
}

interface Props {
  onClose: () => void;
}

type ReportType = 'tax' | 'surcharge' | 'shop_supplies' | 'park_fees' | 'labor';

export function TaxSurchargeReport({ onClose }: Props) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [laborRows, setLaborRows] = useState<LaborRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('tax');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [presetPercent, setPresetPercent] = useState<string>('');
  const [companyName, setCompanyName] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCompanyName();
  }, []);

  useEffect(() => {
    if (reportType === 'labor') {
      loadLaborReport();
    } else {
      loadReport();
    }
  }, [dateFrom, dateTo, reportType]);

  async function loadCompanyName() {
    const { data } = await supabase
      .from('company_info')
      .select('company_name')
      .maybeSingle();
    if (data?.company_name) setCompanyName(data.company_name);
  }

  async function loadReport() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('estimating_invoices')
        .select('id, invoice_number, customer_name, customer_email, customer_phone, invoice_date, payment_status, tax_amount, tax_rate, subtotal, shop_supplies_amount, park_fees_amount, surcharge_amount, total_amount')
        .eq('archived', false)
        .gte('invoice_date', dateFrom)
        .lte('invoice_date', dateTo)
        .order('invoice_date', { ascending: true });

      if (fetchError) throw fetchError;

      const filtered = (data || []).filter(row => {
        const amount = getAmount(row as ReportRow);
        return amount > 0;
      });

      setRows(filtered as ReportRow[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function loadLaborReport() {
    try {
      setLoading(true);
      setError(null);

      const { data: invoices, error: invError } = await supabase
        .from('estimating_invoices')
        .select('id, invoice_number, customer_name, invoice_date, payment_status, work_order_id, work_orders!estimating_invoices_work_order_id_fkey(work_title)')
        .eq('archived', false)
        .gte('invoice_date', dateFrom)
        .lte('invoice_date', dateTo)
        .order('invoice_date', { ascending: true });

      if (invError) throw invError;
      if (!invoices || invoices.length === 0) {
        setLaborRows([]);
        return;
      }

      const invoiceIds = invoices.map(i => i.id);

      const { data: lineItems, error: liError } = await supabase
        .from('estimating_invoice_line_items')
        .select('invoice_id, quantity, total_price')
        .in('invoice_id', invoiceIds)
        .eq('line_type', 'labor');

      if (liError) throw liError;

      const workOrderIds = invoices
        .map(i => i.work_order_id)
        .filter((id): id is string => !!id);

      let employeesByWorkOrder: Record<string, string[]> = {};
      let employeeHoursByWorkOrder: Record<string, Record<string, number>> = {};
      let rateByEmployeeName: Record<string, number> = {};

      if (workOrderIds.length > 0) {
        const { data: workOrderTasks } = await supabase
          .from('work_order_tasks')
          .select('id, work_order_id')
          .in('work_order_id', workOrderIds);

        const taskIds = (workOrderTasks || []).map((t: any) => t.id);
        const taskWorkOrderMap: Record<string, string> = {};
        (workOrderTasks || []).forEach((t: any) => { taskWorkOrderMap[t.id] = t.work_order_id; });

        const [{ data: allLaborItems }, { data: taskAssignments }] = await Promise.all([
          supabase
            .from('work_order_line_items')
            .select('id, work_order_id, task_id, assigned_employee_id, quantity')
            .in('work_order_id', workOrderIds)
            .eq('line_type', 'labor'),
          taskIds.length > 0
            ? supabase
                .from('work_order_task_assignments')
                .select('task_id, employee_id')
                .in('task_id', taskIds)
            : Promise.resolve({ data: [] }),
        ]);

        const allEmployeeIds = new Set<string>();
        (allLaborItems || []).forEach((li: any) => li.assigned_employee_id && allEmployeeIds.add(li.assigned_employee_id));
        (taskAssignments || []).forEach((ta: any) => ta.employee_id && allEmployeeIds.add(ta.employee_id));

        let userMap: Record<string, string> = {};
        if (allEmployeeIds.size > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('user_id, first_name, last_name, rate_of_pay')
            .in('user_id', [...allEmployeeIds]);

          (users || []).forEach((u: any) => {
            const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
            userMap[u.user_id] = name;
            if (u.rate_of_pay != null) rateByEmployeeName[name] = Number(u.rate_of_pay);
          });
        }

        const taskEmpsByTask: Record<string, string[]> = {};
        (taskAssignments || []).forEach((ta: any) => {
          const taskId = ta.task_id;
          const empId = ta.employee_id;
          if (!taskId || !empId) return;
          const name = userMap[empId];
          if (!name) return;
          if (!taskEmpsByTask[taskId]) taskEmpsByTask[taskId] = [];
          if (!taskEmpsByTask[taskId].includes(name)) taskEmpsByTask[taskId].push(name);
        });

        (allLaborItems || []).forEach((li: any) => {
          const woId = li.work_order_id;
          const taskId = li.task_id;
          if (!woId) return;
          const hrs = Number(li.quantity) || 0;
          if (!employeesByWorkOrder[woId]) employeesByWorkOrder[woId] = [];
          if (!employeeHoursByWorkOrder[woId]) employeeHoursByWorkOrder[woId] = {};

          if (li.assigned_employee_id) {
            const name = userMap[li.assigned_employee_id];
            if (name) {
              if (!employeesByWorkOrder[woId].includes(name)) employeesByWorkOrder[woId].push(name);
              employeeHoursByWorkOrder[woId][name] = (employeeHoursByWorkOrder[woId][name] || 0) + hrs;
            }
          } else if (taskId && taskEmpsByTask[taskId] && taskEmpsByTask[taskId].length > 0) {
            const taskEmps = taskEmpsByTask[taskId];
            const hrsEach = hrs / taskEmps.length;
            taskEmps.forEach(name => {
              if (!employeesByWorkOrder[woId].includes(name)) employeesByWorkOrder[woId].push(name);
              employeeHoursByWorkOrder[woId][name] = (employeeHoursByWorkOrder[woId][name] || 0) + hrsEach;
            });
          }
        });
      }

      const laborByInvoice: Record<string, { hours: number; amount: number }> = {};
      (lineItems || []).forEach(li => {
        if (!laborByInvoice[li.invoice_id]) {
          laborByInvoice[li.invoice_id] = { hours: 0, amount: 0 };
        }
        laborByInvoice[li.invoice_id].hours += Number(li.quantity) || 0;
        laborByInvoice[li.invoice_id].amount += Number(li.total_price) || 0;
      });

      const result: LaborRow[] = invoices
        .filter(inv => laborByInvoice[inv.id] && laborByInvoice[inv.id].hours > 0)
        .map(inv => ({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          invoice_date: inv.invoice_date,
          payment_status: inv.payment_status,
          work_title: (inv as any).work_orders?.work_title || null,
          total_hours: laborByInvoice[inv.id]?.hours || 0,
          total_labor_amount: laborByInvoice[inv.id]?.amount || 0,
          employees: (inv.work_order_id && employeesByWorkOrder[inv.work_order_id]) || [],
          employeeHours: (inv.work_order_id && employeeHoursByWorkOrder[inv.work_order_id]) || {},
          labor_cost: (() => {
            const empHours = (inv.work_order_id && employeeHoursByWorkOrder[inv.work_order_id]) || {};
            return Object.entries(empHours).reduce((sum, [name, hrs]) => {
              const rate = rateByEmployeeName[name];
              return rate != null ? sum + hrs * rate : sum;
            }, 0);
          })(),
        }));

      setLaborRows(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load labor report');
    } finally {
      setLoading(false);
    }
  }

  function getAmount(row: ReportRow): number {
    switch (reportType) {
      case 'tax': return row.tax_amount || 0;
      case 'surcharge': return row.surcharge_amount || 0;
      case 'shop_supplies': return row.shop_supplies_amount || 0;
      case 'park_fees': return row.park_fees_amount || 0;
      default: return 0;
    }
  }

  function getReportLabel(): string {
    switch (reportType) {
      case 'tax': return 'Sales Tax';
      case 'surcharge': return 'Surcharge';
      case 'shop_supplies': return 'Shop Supplies';
      case 'park_fees': return 'Park Fees';
      case 'labor': return 'Labor';
    }
  }

  function getTotal(): number {
    return rows.reduce((sum, r) => sum + getAmount(r), 0);
  }

  function getTotalSales(): number {
    return rows.reduce((sum, r) => sum + (r.subtotal || 0), 0);
  }

  function getTaxableAmount(): number {
    return rows.reduce((sum, r) => {
      if (!r.tax_rate || r.tax_rate === 0 || !r.tax_amount) return sum;
      return sum + (r.tax_amount / r.tax_rate);
    }, 0);
  }

  function getNonTaxableAmount(): number {
    return getTotalSales() - getTaxableAmount();
  }

  function getTotalLaborHours(): number {
    return laborRows.reduce((sum, r) => sum + r.total_hours, 0);
  }

  function getTotalLaborAmount(): number {
    return laborRows.reduce((sum, r) => sum + r.total_labor_amount, 0);
  }

  function getTotalLaborCost(): number {
    return laborRows.reduce((sum, r) => sum + r.labor_cost, 0);
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric'
    });
  }

  async function handlePrint() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    let { data: companyData } = await supabase
      .from('company_info')
      .select('company_name, address, city, state, zip, phone, email')
      .maybeSingle();

    let y = 40;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(companyData?.company_name || companyName || 'Company', margin, y);

    y += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    if (companyData?.address) {
      doc.text(`${companyData.address}, ${companyData.city || ''}, ${companyData.state || ''} ${companyData.zip || ''}`, margin, y);
      y += 14;
    }
    if (companyData?.phone) { doc.text(companyData.phone, margin, y); y += 14; }

    y += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`${getReportLabel()} Report`, margin, y);

    y += 16;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${formatDate(dateFrom)} – ${formatDate(dateTo)}`, margin, y);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, y, { align: 'right' });

    y += 20;

    if (reportType === 'labor') {
      const pdfPct = parseFloat(presetPercent);
      const hasPdfPreset = !isNaN(pdfPct) && pdfPct > 0;

      const tableRows: any[] = [];
      laborRows.forEach(row => {
        const empWithHours = row.employees.length > 0
          ? row.employees.map(emp => {
              const hrs = row.employeeHours[emp];
              return hrs > 0 ? `${emp} (${hrs.toFixed(2)}h)` : emp;
            }).join(', ')
          : '—';
        const laborCostStr = row.labor_cost > 0 ? `$${row.labor_cost.toFixed(2)}` : '—';
        tableRows.push([
          row.invoice_number,
          formatDate(row.invoice_date),
          row.customer_name,
          row.work_title || '—',
          row.total_hours.toFixed(2),
          `$${row.total_labor_amount.toFixed(2)}`,
          laborCostStr,
          empWithHours,
        ]);
        if (hasPdfPreset) {
          const pdfPresetAmount = row.total_labor_amount * (pdfPct / 100);
          tableRows.push([
            { content: `${pdfPct}% of labor amount`, colSpan: 5, styles: { fillColor: [254, 243, 199] as [number, number, number], textColor: [146, 64, 14] as [number, number, number], fontSize: 7, fontStyle: 'italic' as const } },
            { content: `$${pdfPresetAmount.toFixed(2)}`, styles: { fillColor: [254, 243, 199] as [number, number, number], textColor: [146, 64, 14] as [number, number, number], fontSize: 7, fontStyle: 'bold' as const, halign: 'right' as const } },
            { content: '', styles: { fillColor: [254, 243, 199] as [number, number, number] } },
            { content: '', styles: { fillColor: [254, 243, 199] as [number, number, number] } },
          ]);
          if (row.labor_cost > 0) {
            const diff = pdfPresetAmount - row.labor_cost;
            const isPos = diff >= 0;
            tableRows.push([
              { content: `Difference (% \u2212 labor cost)`, colSpan: 5, styles: { fillColor: [254, 243, 199] as [number, number, number], textColor: [120, 120, 120] as [number, number, number], fontSize: 7, fontStyle: 'italic' as const } },
              { content: `${isPos ? '+' : ''}$${diff.toFixed(2)}`, styles: { fillColor: [254, 243, 199] as [number, number, number], textColor: isPos ? [21, 128, 61] as [number, number, number] : [185, 28, 28] as [number, number, number], fontSize: 7, fontStyle: 'bold' as const, halign: 'right' as const } },
              { content: '', styles: { fillColor: [254, 243, 199] as [number, number, number] } },
              { content: '', styles: { fillColor: [254, 243, 199] as [number, number, number] } },
            ]);
          }
        }
        tableRows.push([
          { content: 'Notes:', colSpan: 8, styles: { minCellHeight: 36, fillColor: [255, 255, 255] as [number, number, number], textColor: [180, 180, 180] as [number, number, number], fontSize: 7, fontStyle: 'italic' as const, lineColor: [210, 210, 210] as [number, number, number], lineWidth: 0.3 } },
        ]);
      });

      autoTable(doc, {
        startY: y,
        head: [['Invoice #', 'Date', 'Customer', 'Work Title', 'Total Hrs', 'Labor Amount', 'Labor Cost', 'Employees']],
        body: tableRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 4, textColor: [30, 30, 30] as [number, number, number] },
        headStyles: { fillColor: [37, 99, 235] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 48 },
          2: { cellWidth: 70 },
          3: { cellWidth: 70 },
          4: { cellWidth: 40, halign: 'right' as const },
          5: { cellWidth: 60, halign: 'right' as const },
          6: { cellWidth: 60, halign: 'right' as const, textColor: [185, 28, 28] as [number, number, number] },
          7: { cellWidth: 'auto' as const },
        }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 16;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`${laborRows.length} invoice${laborRows.length !== 1 ? 's' : ''}`, margin, finalY);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`Total Labor Hours: ${getTotalLaborHours().toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });

      finalY += 14;
      doc.text(`Total Labor Amount: $${getTotalLaborAmount().toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });

      const totalLaborCost = getTotalLaborCost();
      if (totalLaborCost > 0) {
        finalY += 14;
        doc.setTextColor(185, 28, 28);
        doc.text(`Total Labor Cost: $${totalLaborCost.toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });
        doc.setTextColor(30, 30, 30);
      }

      if (hasPdfPreset) {
        finalY += 14;
        const presetTotal = laborRows.reduce((sum, r) => sum + r.total_labor_amount * (pdfPct / 100), 0);
        doc.setTextColor(146, 64, 14);
        doc.text(`Total at ${pdfPct}%: $${presetTotal.toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });
      }
    } else {
      const tableRows = rows.map(row => [
        row.invoice_number,
        formatDate(row.invoice_date),
        row.customer_name,
        row.customer_phone || '',
        row.customer_email || '',
        row.payment_status.charAt(0).toUpperCase() + row.payment_status.slice(1),
        `$${getAmount(row).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Invoice #', 'Date', 'Customer', 'Phone', 'Email', 'Status', getReportLabel()]],
        body: tableRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 4, textColor: [30, 30, 30] as [number, number, number] },
        headStyles: { fillColor: [37, 99, 235] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 60 },
          2: { cellWidth: 110 },
          3: { cellWidth: 80 },
          4: { cellWidth: 120 },
          5: { cellWidth: 50 },
          6: { cellWidth: 60, halign: 'right' as const }
        }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 16;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`${rows.length} invoice${rows.length !== 1 ? 's' : ''}`, margin, finalY);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`Total Sales: $${getTotalSales().toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });

      finalY += 16;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(21, 128, 61);
      doc.text(`Total Taxable Amount: $${getTaxableAmount().toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });

      finalY += 16;
      doc.setTextColor(80, 80, 80);
      doc.text(`Total Non-Taxable Amount: $${getNonTaxableAmount().toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });

      finalY += 16;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`Total ${getReportLabel()} Collected: $${getTotal().toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });
    }

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  }

  const total = getTotal();
  const isLaborReport = reportType === 'labor';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tax & Surcharge Report</h2>
            <p className="text-sm text-gray-500 mt-0.5">Filter by date range and report type</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={loading || (isLaborReport ? laborRows.length === 0 : rows.length === 0)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              Print / Export PDF
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Report Type</label>
              <div className="relative">
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                  className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                >
                  <option value="tax">Sales Tax</option>
                  <option value="surcharge">Surcharge</option>
                  <option value="shop_supplies">Shop Supplies</option>
                  <option value="park_fees">Park Fees</option>
                  <option value="labor">Labor</option>
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Preset %</label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="e.g. 40"
                  value={presetPercent}
                  onChange={(e) => setPresetPercent(e.target.value)}
                  className="w-24 pl-3 pr-7 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-2.5 text-gray-400 text-sm pointer-events-none">%</span>
              </div>
            </div>

            {isLaborReport ? (
              <div className="ml-auto flex items-center gap-6">
                <div className="text-right border-r border-gray-200 pr-6">
                  <div className="text-xs text-gray-500">Invoices</div>
                  <div className="text-lg font-bold text-gray-900">{laborRows.length}</div>
                  <div className="text-xs text-gray-400">with labor</div>
                </div>
                <div className="text-right border-r border-gray-200 pr-6">
                  <div className="text-xs text-gray-500">Total Labor Hours</div>
                  <div className="text-lg font-bold text-blue-700">{getTotalLaborHours().toFixed(2)}</div>
                  <div className="text-xs text-gray-400">hours billed</div>
                </div>
                <div className="text-right border-r border-gray-200 pr-6">
                  <div className="text-xs text-gray-500">Total Labor Amount</div>
                  <div className="text-lg font-bold text-gray-900">${getTotalLaborAmount().toFixed(2)}</div>
                  <div className="text-xs text-gray-500">labor revenue</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total Labor Cost</div>
                  <div className="text-lg font-bold text-red-700">${getTotalLaborCost().toFixed(2)}</div>
                  <div className="text-xs text-gray-400">employee cost</div>
                </div>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-6">
                <div className="text-right border-r border-gray-200 pr-6">
                  <div className="text-xs text-gray-500">Total Sales</div>
                  <div className="text-lg font-bold text-gray-900">${getTotalSales().toFixed(2)}</div>
                  <div className="text-xs text-gray-400">{rows.length} invoice{rows.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="text-right border-r border-gray-200 pr-6">
                  <div className="text-xs text-gray-500">Taxable Amount</div>
                  <div className="text-lg font-bold text-green-700">${getTaxableAmount().toFixed(2)}</div>
                  <div className="text-xs text-gray-400">Taxed @ {rows.length > 0 && rows[0].tax_rate ? (rows[0].tax_rate * 100).toFixed(2) : '0'}%</div>
                </div>
                <div className="text-right border-r border-gray-200 pr-6">
                  <div className="text-xs text-gray-500">Non-Taxable Amount</div>
                  <div className="text-lg font-bold text-gray-600">${getNonTaxableAmount().toFixed(2)}</div>
                  <div className="text-xs text-gray-400">Tax exempt</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">{rows.length} invoice{rows.length !== 1 ? 's' : ''}</div>
                  <div className="text-lg font-bold text-gray-900">${total.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Total {getReportLabel()}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto" ref={printRef}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-6 text-red-700 bg-red-50 m-6 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : isLaborReport ? (
            laborRows.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg font-medium">No labor found</p>
                <p className="text-sm mt-1">No invoices with labor line items in this date range</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Work Title</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Hrs</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Labor Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Labor Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Employees Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {laborRows.map((row) => {
                    const pct = parseFloat(presetPercent);
                    const hasPreset = !isNaN(pct) && pct > 0;
                    const presetAmount = hasPreset ? row.total_labor_amount * (pct / 100) : 0;
                    return (
                      <React.Fragment key={row.invoice_id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-blue-700">{row.invoice_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.invoice_date)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.customer_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.work_title || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-blue-700 text-right">{row.total_hours.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">${row.total_labor_amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right">
                            {row.labor_cost > 0
                              ? <span className="text-red-700">${row.labor_cost.toFixed(2)}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {row.employees.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.employees.map((emp, i) => {
                                  const hrs = row.employeeHours[emp];
                                  return (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800">
                                      {emp}
                                      {hrs > 0 && (
                                        <span className="text-blue-500 font-normal">({hrs.toFixed(2)}h)</span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                        {hasPreset && (
                          <>
                            <tr className="bg-amber-50 border-t border-amber-100">
                              <td colSpan={5} className="px-4 py-1.5 text-xs text-amber-700 font-medium pl-8">
                                {pct}% of labor amount
                              </td>
                              <td className="px-4 py-1.5 text-xs font-bold text-amber-700 text-right">
                                ${presetAmount.toFixed(2)}
                              </td>
                              <td colSpan={2} />
                            </tr>
                            {row.labor_cost > 0 && (() => {
                              const diff = presetAmount - row.labor_cost;
                              const isPositive = diff >= 0;
                              return (
                                <tr className="bg-amber-50 border-t border-amber-100">
                                  <td colSpan={5} className="px-4 py-1.5 text-xs font-medium pl-8 text-gray-500 italic">
                                    Difference (% − labor cost)
                                  </td>
                                  <td className={`px-4 py-1.5 text-xs font-bold text-right ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                                    {isPositive ? '+' : ''}${diff.toFixed(2)}
                                  </td>
                                  <td colSpan={2} />
                                </tr>
                              );
                            })()}
                          </>
                        )}
                        <tr className="border-b border-gray-200">
                          <td colSpan={8} className="h-10" />
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900">
                      Totals ({laborRows.length} invoice{laborRows.length !== 1 ? 's' : ''})
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-blue-700 text-right">
                      {getTotalLaborHours().toFixed(2)} hrs
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      ${getTotalLaborAmount().toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-red-700 text-right">
                      {getTotalLaborCost() > 0 ? `$${getTotalLaborCost().toFixed(2)}` : '—'}
                    </td>
                    <td />
                  </tr>
                  {(() => {
                    const pct = parseFloat(presetPercent);
                    if (isNaN(pct) || pct <= 0) return null;
                    const presetTotal = laborRows.reduce((sum, r) => sum + r.total_labor_amount * (pct / 100), 0);
                    return (
                      <tr className="bg-amber-50 border-t border-amber-200">
                        <td colSpan={5} className="px-4 py-2 text-sm font-bold text-amber-700">
                          Total at {pct}%
                        </td>
                        <td className="px-4 py-2 text-sm font-bold text-amber-700 text-right">
                          ${presetTotal.toFixed(2)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            )
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg font-medium">No invoices found</p>
              <p className="text-sm mt-1">No invoices with {getReportLabel().toLowerCase()} in this date range</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">{getReportLabel()}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-700">{row.invoice_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.invoice_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.customer_phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.customer_email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(row.payment_status)}`}>
                        {row.payment_status.charAt(0).toUpperCase() + row.payment_status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      ${getAmount(row).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm font-bold text-gray-900">
                    Total Sales (Subtotal)
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                    ${getTotalSales().toFixed(2)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-green-700">
                    Total Taxable Amount
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-700 text-right">
                    ${getTaxableAmount().toFixed(2)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-600">
                    Total Non-Taxable Amount
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-600 text-right">
                    ${getNonTaxableAmount().toFixed(2)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td colSpan={6} className="px-4 py-3 text-sm font-bold text-gray-900">
                    Total {getReportLabel()} Collected
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                    ${total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
