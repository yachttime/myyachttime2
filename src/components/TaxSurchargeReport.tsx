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
  shop_supplies_amount: number;
  park_fees_amount: number;
  surcharge_amount: number;
  total_amount: number;
}

interface Props {
  onClose: () => void;
}

type ReportType = 'tax' | 'surcharge' | 'shop_supplies' | 'park_fees';

export function TaxSurchargeReport({ onClose }: Props) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('tax');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [companyName, setCompanyName] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCompanyName();
  }, []);

  useEffect(() => {
    loadReport();
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
        .select('id, invoice_number, customer_name, customer_email, customer_phone, invoice_date, payment_status, tax_amount, tax_rate, shop_supplies_amount, park_fees_amount, surcharge_amount, total_amount')
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

  function getAmount(row: ReportRow): number {
    switch (reportType) {
      case 'tax': return row.tax_amount || 0;
      case 'surcharge': return row.surcharge_amount || 0;
      case 'shop_supplies': return row.shop_supplies_amount || 0;
      case 'park_fees': return row.park_fees_amount || 0;
    }
  }

  function getReportLabel(): string {
    switch (reportType) {
      case 'tax': return 'Sales Tax';
      case 'surcharge': return 'Surcharge';
      case 'shop_supplies': return 'Shop Supplies';
      case 'park_fees': return 'Park Fees';
    }
  }

  function getTotal(): number {
    return rows.reduce((sum, r) => sum + getAmount(r), 0);
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
      styles: { fontSize: 8, cellPadding: 4, textColor: [30, 30, 30] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 60 },
        2: { cellWidth: 110 },
        3: { cellWidth: 80 },
        4: { cellWidth: 120 },
        5: { cellWidth: 50 },
        6: { cellWidth: 60, halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 16;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`Total ${getReportLabel()} Collected: $${getTotal().toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });
    doc.text(`${rows.length} invoice${rows.length !== 1 ? 's' : ''}`, margin, finalY);

    doc.output('dataurlnewwindow');
  }

  const total = getTotal();

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
              disabled={loading || rows.length === 0}
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

            <div className="ml-auto flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-gray-500">{rows.length} invoice{rows.length !== 1 ? 's' : ''}</div>
                <div className="text-lg font-bold text-gray-900">${total.toFixed(2)}</div>
                <div className="text-xs text-gray-500">Total {getReportLabel()}</div>
              </div>
            </div>
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
