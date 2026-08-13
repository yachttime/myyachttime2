import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Printer, AlertCircle, Calendar, ChevronDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BreakdownRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  payment_status: string;
  archived: boolean;
  parts_total: number;
  labor_total: number;
  shop_supplies: number;
  park_fees: number;
  surcharge: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

interface Props {
  onClose: () => void;
}

export function SalesBreakdownReport({ onClose }: Props) {
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  }, [dateFrom, dateTo]);

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

      const { data: invoices, error: invError } = await supabase
        .from('estimating_invoices')
        .select('id, invoice_number, customer_name, invoice_date, payment_status, subtotal, tax_amount, total_amount, shop_supplies_amount, park_fees_amount, surcharge_amount, discount_amount, archived')
        .gte('invoice_date', dateFrom)
        .lte('invoice_date', dateTo)
        .order('invoice_date', { ascending: true });

      if (invError) throw invError;
      if (!invoices || invoices.length === 0) {
        setRows([]);
        return;
      }

      const invoiceIds = invoices.map(i => i.id);

      const { data: lineItems, error: liError } = await supabase
        .from('estimating_invoice_line_items')
        .select('invoice_id, line_type, total_price')
        .in('invoice_id', invoiceIds);

      if (liError) throw liError;

      const totalsByInvoice: Record<string, { parts: number; labor: number }> = {};
      (lineItems || []).forEach(li => {
        if (!totalsByInvoice[li.invoice_id]) {
          totalsByInvoice[li.invoice_id] = { parts: 0, labor: 0 };
        }
        const price = Number(li.total_price) || 0;
        if (li.line_type === 'part') {
          totalsByInvoice[li.invoice_id].parts += price;
        } else if (li.line_type === 'labor') {
          totalsByInvoice[li.invoice_id].labor += price;
        }
      });

      const result: BreakdownRow[] = invoices.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name || '—',
        invoice_date: inv.invoice_date,
        payment_status: inv.payment_status,
        archived: inv.archived ?? false,
        parts_total: totalsByInvoice[inv.id]?.parts || 0,
        labor_total: totalsByInvoice[inv.id]?.labor || 0,
        shop_supplies: Number(inv.shop_supplies_amount) || 0,
        park_fees: Number(inv.park_fees_amount) || 0,
        surcharge: Number(inv.surcharge_amount) || 0,
        subtotal: Number(inv.subtotal) || 0,
        discount_amount: Number(inv.discount_amount) || 0,
        tax_amount: Number(inv.tax_amount) || 0,
        total_amount: Number(inv.total_amount) || 0,
      }));

      setRows(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
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
      month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'America/Phoenix'
    });
  }

  function sum(field: keyof BreakdownRow): number {
    return rows.reduce((acc, r) => acc + (r[field] as number), 0);
  }

  async function handlePrint() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
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
    doc.text('Sales Breakdown — QB Reconciliation Report', margin, y);

    y += 16;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${formatDate(dateFrom)} – ${formatDate(dateTo)}`, margin, y);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Phoenix' })}`, pageWidth - margin, y, { align: 'right' });

    y += 20;

    const tableRows = rows.map(row => [
      row.archived ? `${row.invoice_number} (Arch)` : row.invoice_number,
      formatDate(row.invoice_date),
      row.customer_name,
      `$${row.parts_total.toFixed(2)}`,
      `$${row.labor_total.toFixed(2)}`,
      `$${row.shop_supplies.toFixed(2)}`,
      `$${row.park_fees.toFixed(2)}`,
      `$${row.surcharge.toFixed(2)}`,
      `${row.subtotal.toFixed(2)}`,
      row.discount_amount > 0 ? `-${row.discount_amount.toFixed(2)}` : '—',
      `${(row.total_amount - row.tax_amount).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Invoice #', 'Date', 'Customer', 'Parts', 'Labor', 'Shop Supplies', 'Park Fees', 'Surcharge', 'Subtotal', 'Discount', 'Grand Total']],
      body: tableRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 3, textColor: [30, 30, 30] as [number, number, number] },
      headStyles: { fillColor: [37, 99, 235] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 48 },
        2: { cellWidth: 80 },
        3: { cellWidth: 50, halign: 'right' as const },
        4: { cellWidth: 50, halign: 'right' as const },
        5: { cellWidth: 50, halign: 'right' as const },
        6: { cellWidth: 45, halign: 'right' as const },
        7: { cellWidth: 50, halign: 'right' as const },
        8: { cellWidth: 52, halign: 'right' as const },
        9: { cellWidth: 45, halign: 'right' as const },
        10: { cellWidth: 55, halign: 'right' as const },
      },
      foot: [[
        { content: 'TOTALS', colSpan: 3, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        `$${sum('parts_total').toFixed(2)}`,
        `$${sum('labor_total').toFixed(2)}`,
        `$${sum('shop_supplies').toFixed(2)}`,
        `$${sum('park_fees').toFixed(2)}`,
        `$${sum('surcharge').toFixed(2)}`,
        `${sum('subtotal').toFixed(2)}`,
        `-${sum('discount_amount').toFixed(2)}`,
        `${(sum('total_amount') - sum('tax_amount')).toFixed(2)}`,
      ]],
      footStyles: { fillColor: [241, 245, 249] as [number, number, number], textColor: [30, 30, 30] as [number, number, number], fontSize: 8, fontStyle: 'bold' as const },
    });

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Sales Breakdown — QB Reconciliation</h2>
            <p className="text-sm text-gray-500 mt-0.5">Per-invoice breakdown of parts, labor, fees, and totals to compare against QuickBooks</p>
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
              <div className="text-right border-r border-gray-200 pr-6">
                <div className="text-xs text-gray-500">Total Parts</div>
                <div className="text-lg font-bold text-blue-700">${sum('parts_total').toFixed(2)}</div>
              </div>
              <div className="text-right border-r border-gray-200 pr-6">
                <div className="text-xs text-gray-500">Total Labor</div>
                <div className="text-lg font-bold text-blue-700">${sum('labor_total').toFixed(2)}</div>
              </div>
              <div className="text-right border-r border-gray-200 pr-6">
                <div className="text-xs text-gray-500">Total Subtotal</div>
                <div className="text-lg font-bold text-gray-900">${sum('subtotal').toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Grand Total</div>
                <div className="text-lg font-bold text-gray-900">${(sum('total_amount') - sum('tax_amount')).toFixed(2)}</div>
                <div className="text-xs text-gray-400">{rows.length} invoice{rows.length !== 1 ? 's' : ''}</div>
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
              <p className="text-sm mt-1">No invoices in this date range</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Parts</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Labor</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Shop Supplies</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Park Fees</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Surcharge</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Subtotal</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Discount</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Grand Total</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className={`hover:bg-gray-50 ${row.archived ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-3 text-sm font-medium text-blue-700">
                      {row.invoice_number}
                      {row.archived && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600">Archived</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatDate(row.invoice_date)}</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900">{row.customer_name}</td>
                    <td className="px-3 py-3 text-sm text-gray-900 text-right">${row.parts_total.toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-gray-900 text-right">${row.labor_total.toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700 text-right">${row.shop_supplies.toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700 text-right">${row.park_fees.toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700 text-right">${row.surcharge.toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-gray-900 text-right">${row.subtotal.toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700 text-right">
                      {row.discount_amount > 0 ? <span className="text-red-600">-${row.discount_amount.toFixed(2)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">${(row.total_amount - row.tax_amount).toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(row.payment_status)}`}>
                        {row.payment_status.charAt(0).toUpperCase() + row.payment_status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 sticky bottom-0">
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-sm font-bold text-gray-900">
                    Totals ({rows.length} invoice{rows.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-3 py-3 text-sm font-bold text-blue-700 text-right">${sum('parts_total').toFixed(2)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-blue-700 text-right">${sum('labor_total').toFixed(2)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">${sum('shop_supplies').toFixed(2)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">${sum('park_fees').toFixed(2)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">${sum('surcharge').toFixed(2)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">${sum('subtotal').toFixed(2)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-red-600 text-right">-${sum('discount_amount').toFixed(2)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">${(sum('total_amount') - sum('tax_amount')).toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
