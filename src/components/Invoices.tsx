import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Search, Printer, Mail, DollarSign, Eye, CheckCircle, Clock, XCircle, ExternalLink, Archive, RotateCcw, RefreshCw, X, Copy, CreditCard, AlertCircle, MousePointer, Download, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Toast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';

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
  payment_link_created_at: string | null;
  payment_email_sent_at: string | null;
  payment_email_recipient: string | null;
  payment_email_delivered_at: string | null;
  payment_email_opened_at: string | null;
  payment_email_clicked_at: string | null;
  payment_email_bounced_at: string | null;
  stripe_payment_intent_id: string | null;
  payment_method_type: string | null;
  paid_at: string | null;
  payment_confirmation_email_sent_at: string | null;
  email_open_count: number | null;
  email_click_count: number | null;
  amount_paid: number | null;
  final_payment_link_url: string | null;
  final_payment_link_expires_at: string | null;
  final_payment_email_sent_at: string | null;
  final_payment_email_recipient: string | null;
  final_payment_email_delivered_at: string | null;
  final_payment_email_opened_at: string | null;
  final_payment_email_clicked_at: string | null;
  final_payment_email_bounced_at: string | null;
  final_payment_method_type: string | null;
  final_payment_paid_at: string | null;
  final_payment_confirmation_email_sent_at: string | null;
  final_payment_stripe_checkout_session_id: string | null;
  final_payment_stripe_payment_intent_id: string | null;
  final_payment_resend_email_id: string | null;
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
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [syncPaymentLoading, setSyncPaymentLoading] = useState(false);
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [emailPrompt, setEmailPrompt] = useState<{ invoice: Invoice; email: string; emailOnly?: boolean } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [checkPaymentModal, setCheckPaymentModal] = useState(false);
  const [checkPaymentLoading, setCheckPaymentLoading] = useState(false);
  const [checkForm, setCheckForm] = useState({ checkNumber: '', amount: '', depositAccount: '', notes: '' });
  const [qbBankAccounts, setQbBankAccounts] = useState<{ qbo_account_id: string; account_name: string; account_number: string | null }[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchQbBankAccounts();
  }, []);

  async function fetchQbBankAccounts() {
    const { data } = await supabase
      .from('quickbooks_accounts')
      .select('qbo_account_id, account_name, account_number')
      .eq('account_type', 'Bank')
      .eq('active', true)
      .order('account_number');
    if (data) setQbBankAccounts(data);
  }

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
      showToast('No email address on file for this customer', 'error');
      return;
    }

    const confirmed = await confirm({
      title: 'Send Invoice',
      message: `Send invoice ${invoice.invoice_number} to ${invoice.customer_email}?`,
      confirmText: 'Send',
      variant: 'info'
    });

    if (confirmed) {
      showToast('Email functionality will be implemented', 'info');
    }
  }

  async function handlePrintInvoice(invoice: Invoice) {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
      });

      const pageWidth = 8.5;
      const margin = 0.75;
      let yPos = margin;

      // Fetch company info
      const { data: companyInfo } = await supabase
        .from('company_info')
        .select('*')
        .maybeSingle();

      // Add logo if available
      let logoAdded = false;
      let logoWidth = 0;
      let logoHeight = 0;

      if (companyInfo?.logo_url) {
        try {
          const logoResponse = await fetch(companyInfo.logo_url);
          const logoBlob = await logoResponse.blob();

          await new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              try {
                const base64data = reader.result as string;

                const img = new Image();
                img.onload = () => {
                  try {
                    const maxLogoWidth = 1.8;
                    const maxLogoHeight = 1.3;

                    const aspectRatio = img.width / img.height;
                    logoWidth = maxLogoWidth;
                    logoHeight = logoWidth / aspectRatio;

                    if (logoHeight > maxLogoHeight) {
                      logoHeight = maxLogoHeight;
                      logoWidth = logoHeight * aspectRatio;
                    }

                    doc.addImage(base64data, 'PNG', margin, yPos, logoWidth, logoHeight);
                    logoAdded = true;
                    resolve();
                  } catch (err) {
                    console.warn('Could not add logo to PDF:', err);
                    resolve();
                  }
                };
                img.onerror = () => {
                  console.warn('Could not load logo image');
                  resolve();
                };
                img.src = base64data;
              } catch (err) {
                console.warn('Could not process logo:', err);
                resolve();
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(logoBlob);
          });
        } catch (err) {
          console.warn('Could not load logo for PDF:', err);
        }
      }

      // Company information next to logo or centered
      if (logoAdded) {
        const companyInfoX = margin + logoWidth + 0.15;
        const originalYPos = yPos;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(companyInfo?.company_name || 'AZ Marine', companyInfoX, yPos);
        yPos += 0.13;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        if (companyInfo?.address_line1) {
          doc.text(companyInfo.address_line1, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.address_line2) {
          doc.text(companyInfo.address_line2, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
          const cityStateZip = [
            companyInfo?.city,
            companyInfo?.state,
            companyInfo?.zip_code
          ].filter(Boolean).join(', ');
          doc.text(cityStateZip, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.phone) {
          doc.text(`Phone: ${companyInfo.phone}`, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.email) {
          doc.text(`Email: ${companyInfo.email}`, companyInfoX, yPos);
          yPos += 0.11;
        }

        if (companyInfo?.website) {
          doc.text(`Web: ${companyInfo.website}`, companyInfoX, yPos);
          yPos += 0.11;
        }

        yPos = Math.max(yPos, originalYPos + logoHeight);
        yPos += 0.15;
      } else {
        if (companyInfo?.company_name) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(companyInfo.company_name, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.15;
        } else {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('AZ Marine', pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.15;
        }

        if (companyInfo?.address_line1) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(companyInfo.address_line1, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.12;
        }

        if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
          const cityStateZip = [
            companyInfo?.city,
            companyInfo?.state,
            companyInfo?.zip_code
          ].filter(Boolean).join(', ');
          doc.text(cityStateZip, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.12;
        }

        if (companyInfo?.phone) {
          doc.text(`Phone: ${companyInfo.phone}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.12;
        }

        if (companyInfo?.email) {
          doc.text(`Email: ${companyInfo.email}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += 0.12;
        }

        yPos += 0.15;
      }

      // Draw separator line
      doc.setLineWidth(0.01);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 0.2;

      // Invoice header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Invoice #: ${invoice.invoice_number}`, margin, yPos);

      // Status on right side
      const status = invoice.payment_status.toUpperCase();
      const statusWidth = doc.getTextWidth(status);
      doc.text(status, pageWidth - margin - statusWidth, yPos);
      yPos += 0.3;

      // Invoice details and customer info side by side
      const leftColX = margin;
      const rightColX = pageWidth / 2 + 0.25;
      const leftStartY = yPos;

      // Left column - Invoice Details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Details', leftColX, yPos);
      yPos += 0.18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, leftColX, yPos);
      yPos += 0.14;
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, leftColX, yPos);
      yPos += 0.14;

      if (invoice.work_order_number) {
        doc.text(`Work Order: ${invoice.work_order_number}`, leftColX, yPos);
        yPos += 0.14;
      }

      // Right column - Customer Information
      yPos = leftStartY;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Customer Information', rightColX, yPos);
      yPos += 0.18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(invoice.customer_name, rightColX, yPos);
      yPos += 0.14;

      if (invoice.customer_email) {
        doc.text(invoice.customer_email, rightColX, yPos);
        yPos += 0.14;
      }

      if (invoice.customer_phone) {
        doc.text(invoice.customer_phone, rightColX, yPos);
        yPos += 0.14;
      }

      if (invoice.yacht_name) {
        doc.text(`Yacht: ${invoice.yacht_name}`, rightColX, yPos);
        yPos += 0.14;
      }

      yPos = Math.max(yPos, leftStartY + 0.6);
      yPos += 0.2;

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

      // Open PDF in new tab for printing
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Error printing invoice:', error);
      showToast('Error printing invoice. Please try again.', 'error');
    }
  }

  async function handleRequestPayment(invoice: Invoice) {
    if (!invoice.customer_email) {
      setEmailPrompt({ invoice, email: '' });
      return;
    }
    await generatePaymentLink(invoice, invoice.customer_email);
  }

  async function generatePaymentLink(invoice: Invoice, recipientEmail: string) {
    const confirmed = await confirm({
      title: 'Generate Payment Link',
      message: `Send payment request for invoice ${invoice.invoice_number} to ${recipientEmail}?`,
      confirmText: 'Generate & Send',
      variant: 'info'
    });

    if (!confirmed) return;

    setPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-estimating-invoice-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: invoice.id,
            recipientEmail
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment link');
      }

      await supabase.from('estimating_invoices').update({ customer_email: recipientEmail }).eq('id', invoice.id);

      const emailResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimating-invoice-payment-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoiceId: invoice.id, recipientEmail })
        }
      );

      if (!emailResponse.ok) {
        const emailErr = await emailResponse.json();
        console.error('Email send failed:', emailErr);
        showToast('Payment link created but email failed to send. Use "Email Payment Link" to retry.', 'info');
      } else {
        showToast('Payment link generated and emailed successfully!', 'success');
      }

      if (activeTab === 'active') {
        await fetchInvoices();
      } else {
        await fetchArchivedInvoices();
      }

      if (showDetails) {
        const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', invoice.id).maybeSingle();
        if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
      }
    } catch (error: any) {
      console.error('Error requesting payment:', error);
      showToast(error.message || 'Failed to send payment request. Please try again.', 'error');
    } finally {
      setPaymentLoading(false);
    }
  }

  async function handleCopyPaymentLink(invoice: Invoice) {
    const link = invoice.final_payment_link_url || invoice.payment_link;
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      showToast('Payment link copied to clipboard!', 'success');
    } catch (error) {
      console.error('Error copying link:', error);
      showToast('Failed to copy payment link', 'error');
    }
  }

  async function handleSyncPaymentStatus() {
    if (!selectedInvoice) return;

    setSyncPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stripe-payment`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estimating_invoice_id: selectedInvoice.id
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message || 'Payment status synced successfully!', 'success');
        await fetchInvoices();
        const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', selectedInvoice.id).maybeSingle();
        if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
      } else {
        showToast(result.message || 'Payment not yet completed in Stripe', 'info');
      }
    } catch (error: any) {
      console.error('Error syncing payment status:', error);
      showToast(error.message || 'Failed to sync payment status', 'error');
    } finally {
      setSyncPaymentLoading(false);
    }
  }

  async function handleRegeneratePaymentLink() {
    if (!selectedInvoice) return;

    const confirmed = await confirm({
      title: 'Regenerate Payment Link',
      message: 'This will delete the expired payment link and create a new one. Continue?',
      confirmText: 'Regenerate',
      variant: 'warning'
    });

    if (!confirmed) return;

    setRegenerateLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const deleteApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-invoice-payment-link`;
      const deleteResponse = await fetch(deleteApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estimatingInvoiceId: selectedInvoice.id
        })
      });

      const deleteResult = await deleteResponse.json();
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete old payment link');
      }

      const createApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-estimating-invoice-payment`;
      const createResponse = await fetch(createApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id
        })
      });

      const createResult = await createResponse.json();
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create new payment link');
      }

      showToast('Payment link regenerated successfully!', 'success');
      await fetchInvoices();
      const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', selectedInvoice.id).maybeSingle();
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (error: any) {
      console.error('Error regenerating payment link:', error);
      showToast(error.message || 'Failed to regenerate payment link', 'error');
    } finally {
      setRegenerateLoading(false);
    }
  }

  async function handleDeletePaymentLink() {
    if (!selectedInvoice) return;

    const confirmed = await confirm({
      title: 'Delete Payment Link',
      message: 'Are you sure you want to delete this payment link? You can generate a new one after making changes to the invoice.',
      confirmText: 'Delete',
      variant: 'danger'
    });

    if (!confirmed) return;

    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-invoice-payment-link`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estimatingInvoiceId: selectedInvoice.id
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete payment link');
      }

      showToast('Payment link deleted. You can now generate a new payment link.', 'success');
      await fetchInvoices();
      const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', selectedInvoice.id).maybeSingle();
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (error: any) {
      console.error('Error deleting payment link:', error);
      showToast(error.message || 'Failed to delete payment link', 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleEmailPaymentLinkWithEmail(invoice: Invoice, recipientEmail: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      await supabase.from('estimating_invoices').update({ customer_email: recipientEmail }).eq('id', invoice.id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimating-invoice-payment-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoiceId: invoice.id, recipientEmail })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      showToast('Payment link email sent successfully!', 'success');
      await fetchInvoices();
      const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', invoice.id).maybeSingle();
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (error: any) {
      console.error('Error sending email:', error);
      showToast(error.message || 'Failed to send payment link email', 'error');
    }
  }

  async function handleEmailPaymentLink() {
    if (!selectedInvoice) return;
    if (!selectedInvoice.customer_email) {
      setEmailPrompt({ invoice: selectedInvoice, email: '', emailOnly: true });
      return;
    }

    const confirmed = await confirm({
      title: 'Email Payment Link',
      message: `Send payment link to ${selectedInvoice.customer_email}?`,
      confirmText: 'Send Email',
      variant: 'info'
    });

    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimating-invoice-payment-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: selectedInvoice.id,
            recipientEmail: selectedInvoice.customer_email
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      showToast('Payment link email sent successfully!', 'success');
      await fetchInvoices();
      const { data: fresh } = await supabase.from('estimating_invoices').select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)').eq('id', selectedInvoice.id).maybeSingle();
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (error: any) {
      console.error('Error sending email:', error);
      showToast(error.message || 'Failed to send payment link email', 'error');
    }
  }

  async function handleRecordCheckPayment() {
    if (!selectedInvoice) return;
    const amount = parseFloat(checkForm.amount);
    if (!checkForm.checkNumber.trim()) {
      showToast('Check number is required', 'error');
      return;
    }
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    setCheckPaymentLoading(true);
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile?.company_id) throw new Error('Company not found');

      const balanceDue = selectedInvoice.balance_due ?? selectedInvoice.total_amount;
      const isFullPayment = amount >= balanceDue;

      const { error: paymentError } = await supabase
        .from('estimating_payments')
        .insert({
          company_id: profile.company_id,
          payment_type: 'invoice',
          invoice_id: selectedInvoice.id,
          work_order_id: selectedInvoice.work_order_id,
          yacht_id: selectedInvoice.yacht_id,
          customer_name: selectedInvoice.customer_name,
          customer_email: selectedInvoice.customer_email,
          amount,
          payment_method: 'check',
          reference_number: checkForm.checkNumber.trim(),
          notes: checkForm.notes.trim() || null,
          recorded_by: userId,
          payment_date: new Date().toISOString()
        });

      if (paymentError) throw paymentError;

      const invoiceUpdates: Record<string, unknown> = {
        check_number: checkForm.checkNumber.trim(),
        check_payment_amount: amount,
        check_payment_recorded_at: new Date().toISOString(),
        payment_method_type: 'check'
      };

      if (isFullPayment) {
        invoiceUpdates.payment_status = 'paid';
        invoiceUpdates.paid_at = new Date().toISOString();
        invoiceUpdates.amount_paid = amount;
      }

      const { error: invoiceError } = await supabase
        .from('estimating_invoices')
        .update(invoiceUpdates)
        .eq('id', selectedInvoice.id);

      if (invoiceError) throw invoiceError;

      setCheckPaymentModal(false);
      setCheckForm({ checkNumber: '', amount: '', depositAccount: '', notes: '' });
      showToast(`Check #${checkForm.checkNumber} recorded successfully`, 'success');

      if (activeTab === 'active') {
        await fetchInvoices();
      } else {
        await fetchArchivedInvoices();
      }

      const { data: fresh } = await supabase
        .from('estimating_invoices')
        .select('*, work_orders!estimating_invoices_work_order_id_fkey(work_order_number), yachts!estimating_invoices_yacht_id_fkey(name)')
        .eq('id', selectedInvoice.id)
        .maybeSingle();
      if (fresh) setSelectedInvoice({ ...fresh, work_order_number: fresh.work_orders?.work_order_number, yacht_name: fresh.yachts?.name });
    } catch (err: any) {
      console.error('Error recording check payment:', err);
      showToast(err.message || 'Failed to record check payment', 'error');
    } finally {
      setCheckPaymentLoading(false);
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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <ConfirmDialog />

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
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                  onClick={() => handlePrintInvoice(selectedInvoice)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
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
                      <span className="text-gray-500">Invoice Date:</span>
                      <span className="text-gray-900">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Due Date:</span>
                      <span className="text-gray-900">{new Date(selectedInvoice.due_date).toLocaleDateString()}</span>
                    </div>
                    {selectedInvoice.work_order_number && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Work Order:</span>
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
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
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
                                      <p className="text-sm text-gray-500 mt-1 ml-[3.75rem]">{item.work_details}</p>
                                    )}
                                    <div className="flex gap-4 mt-2 ml-[3.75rem] text-sm text-gray-500">
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

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="text-gray-900">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax ({(selectedInvoice.tax_rate * 100).toFixed(2)}%):</span>
                    <span className="text-gray-900">${selectedInvoice.tax_amount.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.deposit_applied && selectedInvoice.deposit_applied > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Deposit Applied:</span>
                      <span className="text-green-600">-${selectedInvoice.deposit_applied.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-2 mt-2">
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

              {/* Payment Collection Section */}
              <div className="border-t border-gray-200 pt-6">
                {(() => {
                  const paymentLink = selectedInvoice.final_payment_link_url || selectedInvoice.payment_link;
                  const emailSentAt = selectedInvoice.final_payment_email_sent_at || selectedInvoice.payment_email_sent_at;
                  const emailRecipient = selectedInvoice.final_payment_email_recipient || selectedInvoice.payment_email_recipient;
                  const emailDeliveredAt = selectedInvoice.final_payment_email_delivered_at || selectedInvoice.payment_email_delivered_at;
                  const emailOpenedAt = selectedInvoice.final_payment_email_opened_at || selectedInvoice.payment_email_opened_at;
                  const emailClickedAt = selectedInvoice.final_payment_email_clicked_at || selectedInvoice.payment_email_clicked_at;
                  const emailBouncedAt = selectedInvoice.final_payment_email_bounced_at || selectedInvoice.payment_email_bounced_at;
                  const confirmationEmailSentAt = selectedInvoice.final_payment_confirmation_email_sent_at || selectedInvoice.payment_confirmation_email_sent_at;
                  const paidAt = selectedInvoice.final_payment_paid_at || selectedInvoice.paid_at;

                  return (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Receipt className="w-5 h-5 text-green-600" />
                        <h5 className="font-semibold text-green-700">Payment Details</h5>
                        {selectedInvoice.payment_status !== 'paid' && !emailSentAt && !paymentLink && (
                          <span className="ml-auto bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Payment Not Requested
                          </span>
                        )}
                        {selectedInvoice.payment_status !== 'paid' && emailClickedAt && (
                          <span className="ml-auto bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Viewed Invoice
                          </span>
                        )}
                        {selectedInvoice.payment_status !== 'paid' && !emailClickedAt && emailOpenedAt && (
                          <span className="ml-auto bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Opened Email
                          </span>
                        )}
                        {selectedInvoice.payment_status !== 'paid' && !emailOpenedAt && emailDeliveredAt && (
                          <span className="ml-auto bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold">
                            Email Delivered
                          </span>
                        )}
                        {selectedInvoice.payment_status !== 'paid' && emailSentAt && !emailDeliveredAt && !emailOpenedAt && !emailClickedAt && (
                          <span className="ml-auto bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                            Email Sent
                          </span>
                        )}
                        {selectedInvoice.payment_status === 'paid' && (
                          <span className="ml-auto bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Paid
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">Amount:</span> {(selectedInvoice.balance_due ?? selectedInvoice.total_amount).toFixed(2)}
                        </p>
                        {paidAt && (
                          <p className="text-xs text-green-600">
                            Paid on: {new Date(paidAt).toLocaleDateString()} at {new Date(paidAt).toLocaleTimeString()}
                          </p>
                        )}
                        {(selectedInvoice as any).check_number && (
                          <div className="mt-2 p-2 bg-white border border-green-200 rounded flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-gray-700">Check #{(selectedInvoice as any).check_number}</p>
                              {(selectedInvoice as any).check_payment_amount && (
                                <p className="text-xs text-gray-500">${parseFloat((selectedInvoice as any).check_payment_amount).toFixed(2)} recorded {(selectedInvoice as any).check_payment_recorded_at ? `on ${new Date((selectedInvoice as any).check_payment_recorded_at).toLocaleDateString()}` : ''}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {emailSentAt && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Email Engagement</p>
                            <div className="space-y-1">
                              {emailRecipient && (
                                <div className="flex items-center gap-2 text-xs text-blue-600 mb-2">
                                  <Mail className="w-3 h-3" />
                                  <span className="font-medium">To: {emailRecipient}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Mail className="w-3 h-3 text-blue-500" />
                                <span>Sent: {new Date(emailSentAt).toLocaleDateString()} at {new Date(emailSentAt).toLocaleTimeString()}</span>
                              </div>
                              {emailDeliveredAt && (
                                <div className="flex items-center gap-2 text-xs text-green-600">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Delivered: {new Date(emailDeliveredAt).toLocaleDateString()} at {new Date(emailDeliveredAt).toLocaleTimeString()}</span>
                                </div>
                              )}
                              {emailOpenedAt && (
                                <div className="flex items-center gap-2 text-xs text-blue-600">
                                  <Eye className="w-3 h-3" />
                                  <span>Opened: {new Date(emailOpenedAt).toLocaleDateString()} at {new Date(emailOpenedAt).toLocaleTimeString()}</span>
                                  {(selectedInvoice.email_open_count ?? 0) > 1 && (
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">
                                      {selectedInvoice.email_open_count}x
                                    </span>
                                  )}
                                </div>
                              )}
                              {emailClickedAt && (
                                <div className="flex items-center gap-2 text-xs text-blue-700">
                                  <MousePointer className="w-3 h-3" />
                                  <span>Clicked: {new Date(emailClickedAt).toLocaleDateString()} at {new Date(emailClickedAt).toLocaleTimeString()}</span>
                                  {(selectedInvoice.email_click_count ?? 0) > 1 && (
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">
                                      {selectedInvoice.email_click_count}x
                                    </span>
                                  )}
                                </div>
                              )}
                              {selectedInvoice.payment_status === 'paid' && confirmationEmailSentAt && (
                                <div className="flex items-center gap-2 text-xs text-green-600 pt-2 border-t border-green-200 mt-2">
                                  <CheckCircle className="w-3 h-3" />
                                  <span className="font-medium">Payment Confirmation Sent: {new Date(confirmationEmailSentAt).toLocaleDateString()} at {new Date(confirmationEmailSentAt).toLocaleTimeString()}</span>
                                </div>
                              )}
                              {emailBouncedAt && (
                                <div className="flex items-center gap-2 text-xs text-red-600">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Bounced: {new Date(emailBouncedAt).toLocaleDateString()} at {new Date(emailBouncedAt).toLocaleTimeString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {paymentLink && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs text-gray-500 mb-2">Payment Link:</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                value={paymentLink}
                                className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-xs text-gray-700"
                              />
                              <button
                                onClick={() => handleCopyPaymentLink(selectedInvoice)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" />
                                Copy
                              </button>
                              <button
                                onClick={handleEmailPaymentLink}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1"
                              >
                                <Mail className="w-3 h-3" />
                                Email
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedInvoice.payment_status !== 'paid' && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-green-200">
                          {!paymentLink && (
                            <button
                              onClick={() => handleRequestPayment(selectedInvoice)}
                              disabled={paymentLoading}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              <CreditCard className="w-3 h-3" />
                              {paymentLoading ? 'Generating...' : 'Generate Payment Link'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const balanceDue = selectedInvoice.balance_due ?? selectedInvoice.total_amount;
                              setCheckForm({ checkNumber: '', amount: balanceDue.toFixed(2), depositAccount: '', notes: '' });
                              setCheckPaymentModal(true);
                            }}
                            className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            Record Check
                          </button>
                          {paymentLink && (
                            <>
                              <button
                                onClick={handleSyncPaymentStatus}
                                disabled={syncPaymentLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" />
                                {syncPaymentLoading ? 'Syncing...' : 'Sync Payment'}
                              </button>
                              <button
                                onClick={handleRegeneratePaymentLink}
                                disabled={regenerateLoading}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" />
                                {regenerateLoading ? 'Regenerating...' : 'Regenerate Payment Link'}
                              </button>
                              <button
                                onClick={handleDeletePaymentLink}
                                disabled={deleteLoading}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                {deleteLoading ? 'Deleting...' : 'Delete Payment Link'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {selectedInvoice.notes && (
                <div className="border-t border-gray-200 pt-6 mt-6">
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
      {emailPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Enter Customer Email</h3>
            <p className="text-sm text-slate-400 mb-4">
              No email on file for this invoice. Enter an email address to {emailPrompt.emailOnly ? 'send the payment link.' : 'generate and send the payment link.'}
            </p>
            <input
              type="email"
              value={emailPrompt.email}
              onChange={(e) => setEmailPrompt({ ...emailPrompt, email: e.target.value })}
              placeholder="customer@example.com"
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailPrompt.email) {
                  const { invoice, email, emailOnly } = emailPrompt;
                  setEmailPrompt(null);
                  if (emailOnly) {
                    handleEmailPaymentLinkWithEmail(invoice, email);
                  } else {
                    generatePaymentLink(invoice, email);
                  }
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEmailPrompt(null)}
                className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!emailPrompt.email) return;
                  const { invoice, email, emailOnly } = emailPrompt;
                  setEmailPrompt(null);
                  if (emailOnly) {
                    handleEmailPaymentLinkWithEmail(invoice, email);
                  } else {
                    generatePaymentLink(invoice, email);
                  }
                }}
                disabled={!emailPrompt.email}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50"
              >
                {emailPrompt.emailOnly ? 'Send Email' : 'Generate & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-700" />
                <h3 className="text-lg font-semibold text-gray-900">Record Check Payment</h3>
              </div>
              <button onClick={() => setCheckPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                <p className="font-medium">{selectedInvoice.invoice_number} — {selectedInvoice.customer_name}</p>
                <p className="text-gray-500 text-xs mt-0.5">Balance due: ${(selectedInvoice.balance_due ?? selectedInvoice.total_amount).toFixed(2)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Check Number *</label>
                  <input
                    type="text"
                    value={checkForm.checkNumber}
                    onChange={(e) => setCheckForm({ ...checkForm, checkNumber: e.target.value })}
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
                    value={checkForm.amount}
                    onChange={(e) => setCheckForm({ ...checkForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Deposit to Account (QuickBooks)</label>
                <select
                  value={checkForm.depositAccount}
                  onChange={(e) => setCheckForm({ ...checkForm, depositAccount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="">— Select bank account —</option>
                  {qbBankAccounts.map((acct) => (
                    <option key={acct.qbo_account_id} value={acct.qbo_account_id}>
                      {acct.account_number ? `${acct.account_number} - ` : ''}{acct.account_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={checkForm.notes}
                  onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value })}
                  placeholder="e.g. received at front desk"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
              </div>

              {checkForm.amount && parseFloat(checkForm.amount) > 0 && (
                <div className={`p-3 rounded-lg text-xs font-medium ${parseFloat(checkForm.amount) >= (selectedInvoice.balance_due ?? selectedInvoice.total_amount) ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                  {parseFloat(checkForm.amount) >= (selectedInvoice.balance_due ?? selectedInvoice.total_amount)
                    ? 'This will mark the invoice as fully paid.'
                    : `Partial payment — $${((selectedInvoice.balance_due ?? selectedInvoice.total_amount) - parseFloat(checkForm.amount)).toFixed(2)} will remain due.`}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 pb-5">
              <button
                onClick={() => setCheckPaymentModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordCheckPayment}
                disabled={checkPaymentLoading || !checkForm.checkNumber.trim() || !checkForm.amount}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-semibold disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {checkPaymentLoading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
