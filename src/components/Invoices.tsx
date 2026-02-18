import React, { useState, useEffect } from 'react';
import { Receipt, Search, Download, Mail, DollarSign, Eye, CheckCircle, Clock, XCircle, ExternalLink, Archive, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoicesProps {
  userId: string;
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
  work_order_id: string | null;
  work_order_number?: string;
  yacht_id: string | null;
  yacht_name?: string;
  created_at: string;
  notes: string | null;
  deposit_applied: number | null;
  balance_due: number | null;
  payment_link: string | null;
  payment_link_expires_at: string | null;
  payment_email_sent_at: string | null;
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
}

export function Invoices({ userId }: InvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('estimating_invoices')
        .select(`
          *,
          work_orders!estimating_invoices_work_order_id_fkey(work_order_number),
          yachts!estimating_invoices_yacht_id_fkey(name)
        `)
        .eq('archived', false)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const formattedInvoices = data?.map(inv => ({
        ...inv,
        work_order_number: inv.work_orders?.work_order_number,
        yacht_name: inv.yachts?.name
      })) || [];

      setInvoices(formattedInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchArchivedInvoices() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('estimating_invoices')
        .select(`
          *,
          work_orders!estimating_invoices_work_order_id_fkey(work_order_number),
          yachts!estimating_invoices_yacht_id_fkey(name)
        `)
        .eq('archived', true)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const formattedInvoices = data?.map(inv => ({
        ...inv,
        work_order_number: inv.work_orders?.work_order_number,
        yacht_name: inv.yachts?.name
      })) || [];

      setInvoices(formattedInvoices);
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
          .select('*')
          .eq('work_order_id', workOrderId)
          .order('line_order')
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (lineItemsResult.error) throw lineItemsResult.error;

      setWorkOrderTasks(tasksResult.data || []);
      setWorkOrderLineItems(lineItemsResult.data || []);
    } catch (error) {
      console.error('Error fetching work order details:', error);
      setWorkOrderTasks([]);
      setWorkOrderLineItems([]);
    }
  }

  async function handleViewInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setShowDetails(true);

    if (invoice.work_order_id) {
      await fetchWorkOrderDetails(invoice.work_order_id);
    } else {
      setWorkOrderTasks([]);
      setWorkOrderLineItems([]);
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.work_order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.yacht_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
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
    if (!invoice.customer_email) {
      alert('No email address on file for this customer');
      return;
    }

    if (confirm(`Send invoice ${invoice.invoice_number} to ${invoice.customer_email}?`)) {
      alert('Email functionality will be implemented');
    }
  }

  async function handleDownloadPDF(invoice: Invoice) {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
      });

      const pageWidth = 8.5;
      const margin = 0.75;
      let yPos = margin;

      // Company header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', pageWidth / 2, yPos, { align: 'center' });
      yPos += 0.4;

      // Invoice number and date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice #: ${invoice.invoice_number}`, margin, yPos);
      yPos += 0.2;
      doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, margin, yPos);
      yPos += 0.2;
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, margin, yPos);
      yPos += 0.4;

      // Customer info
      doc.setFont('helvetica', 'bold');
      doc.text('Bill To:', margin, yPos);
      yPos += 0.2;
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.customer_name, margin, yPos);
      yPos += 0.15;
      if (invoice.customer_email) {
        doc.text(invoice.customer_email, margin, yPos);
        yPos += 0.15;
      }
      if (invoice.customer_phone) {
        doc.text(invoice.customer_phone, margin, yPos);
        yPos += 0.15;
      }
      if (invoice.yacht_name) {
        doc.text(`Yacht: ${invoice.yacht_name}`, margin, yPos);
        yPos += 0.15;
      }
      if (invoice.work_order_number) {
        doc.text(`Work Order: ${invoice.work_order_number}`, margin, yPos);
        yPos += 0.15;
      }
      yPos += 0.3;

      // Line items table
      if (workOrderTasks.length > 0 && workOrderLineItems.length > 0) {
        const tableData: any[] = [];

        workOrderTasks.forEach(task => {
          const taskItems = workOrderLineItems.filter(item => item.task_id === task.id);
          if (taskItems.length > 0) {
            // Add task header
            tableData.push([
              { content: task.task_name, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
            ]);

            // Add line items
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

      // Totals
      const totalsX = pageWidth - margin - 2;
      doc.setFontSize(10);

      doc.text('Subtotal:', totalsX, yPos);
      doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 0.2;

      doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(2)}%):`, totalsX, yPos);
      doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 0.2;

      if (invoice.deposit_applied && invoice.deposit_applied > 0) {
        doc.text('Deposit Applied:', totalsX, yPos);
        doc.text(`-$${invoice.deposit_applied.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 0.2;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const finalLabel = (invoice.deposit_applied && invoice.deposit_applied > 0) ? 'Balance Due:' : 'Total:';
      const finalAmount = (invoice.balance_due !== null && invoice.balance_due !== invoice.total_amount)
        ? invoice.balance_due
        : invoice.total_amount;

      doc.text(finalLabel, totalsX, yPos);
      doc.text(`$${finalAmount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });

      // Notes
      if (invoice.notes) {
        yPos += 0.4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Notes:', margin, yPos);
        yPos += 0.2;
        doc.setFont('helvetica', 'normal');
        const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - (margin * 2));
        doc.text(noteLines, margin, yPos);
      }

      // Save the PDF
      doc.save(`${invoice.invoice_number}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  }

  async function handleRequestPayment(invoice: Invoice) {
    if (!invoice.customer_email) {
      alert('No email address on file for this customer');
      return;
    }

    if (!confirm(`Send payment request for invoice ${invoice.invoice_number} to ${invoice.customer_email}?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke(
        'create-estimating-invoice-payment',
        {
          body: {
            invoiceId: invoice.id,
            recipientEmail: invoice.customer_email
          }
        }
      );

      if (error) throw error;

      alert('Payment link sent successfully!');
      fetchInvoices();
    } catch (error) {
      console.error('Error requesting payment:', error);
      alert('Failed to send payment request. Please try again.');
    }
  }

  async function handleCopyPaymentLink(invoice: Invoice) {
    if (!invoice.payment_link) return;

    try {
      await navigator.clipboard.writeText(invoice.payment_link);
      alert('Payment link copied to clipboard!');
    } catch (error) {
      console.error('Error copying link:', error);
      alert('Failed to copy payment link');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoices</h1>
        <p className="text-gray-600">Manage and track customer invoices</p>
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
                  Customer
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
                  <td colSpan={7} className="px-6 py-12 text-center">
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
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{invoice.customer_name}</div>
                      {invoice.yacht_name && (
                        <div className="text-xs text-gray-500">{invoice.yacht_name}</div>
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.payment_status)}`}>
                        {getStatusIcon(invoice.payment_status)}
                        {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(invoice)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          Open
                        </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                {selectedInvoice.customer_email && (
                  <button
                    onClick={() => handleSendEmail(selectedInvoice)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
                  >
                    <Mail className="w-4 h-4" />
                    Send Email
                  </button>
                )}
                {selectedInvoice.payment_status !== 'paid' && selectedInvoice.customer_email && !selectedInvoice.payment_link && (
                  <button
                    onClick={() => handleRequestPayment(selectedInvoice)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
                  >
                    <DollarSign className="w-4 h-4" />
                    Request Payment
                  </button>
                )}
                {selectedInvoice.payment_link && selectedInvoice.payment_status !== 'paid' && (
                  <button
                    onClick={() => handleCopyPaymentLink(selectedInvoice)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Copy Payment Link
                  </button>
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
                      <span className="text-gray-600">Invoice Date:</span>
                      <span className="text-gray-900">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Due Date:</span>
                      <span className="text-gray-900">{new Date(selectedInvoice.due_date).toLocaleDateString()}</span>
                    </div>
                    {selectedInvoice.work_order_number && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Work Order:</span>
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
                          <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
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
                                      <p className="text-sm text-gray-600 mt-1 ml-[3.75rem]">{item.work_details}</p>
                                    )}
                                    <div className="flex gap-4 mt-2 ml-[3.75rem] text-sm text-gray-600">
                                      <span>Qty: {item.quantity}</span>
                                      <span>Unit Price: ${item.unit_price.toFixed(2)}</span>
                                      {item.is_taxable && (
                                        <span className="text-blue-600">Taxable</span>
                                      )}
                                    </div>
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

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({(selectedInvoice.tax_rate * 100).toFixed(2)}%):</span>
                    <span className="text-gray-900">${selectedInvoice.tax_amount.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.deposit_applied && selectedInvoice.deposit_applied > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Deposit Applied:</span>
                      <span className="text-green-600">-${selectedInvoice.deposit_applied.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-lg font-bold text-gray-900">
                        {selectedInvoice.deposit_applied && selectedInvoice.deposit_applied > 0 ? 'Balance Due:' : 'Total:'}
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        ${(selectedInvoice.balance_due !== null && selectedInvoice.balance_due !== selectedInvoice.total_amount
                          ? selectedInvoice.balance_due
                          : selectedInvoice.total_amount
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
    </div>
  );
}
