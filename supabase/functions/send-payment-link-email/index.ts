import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import PDFDocument from 'npm:pdfkit@0.15.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  invoiceId: string;
  recipientEmail: string;
  recipientName?: string;
  recaptchaToken?: string;
  additionalRecipients?: { email: string; name?: string }[];
  attachmentBase64?: string;
  attachmentFilename?: string;
  attachmentContentType?: string;
  ccEmail?: string;
}

interface WorkOrderTask {
  id: string;
  task_name: string;
  task_order: number;
}

interface WorkOrderLineItem {
  id: string;
  task_id: string;
  line_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  work_details: string | null;
  line_order: number;
}

async function buildInvoicePDF(invoice: any, tasks: WorkOrderTask[], lineItems: WorkOrderLineItem[], companyInfo: any): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const doc = new PDFDocument({ margin: 54, size: 'LETTER' });

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => {
      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      const buf = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        buf.set(c, offset);
        offset += c.length;
      }
      resolve(buf);
    });
    doc.on('error', reject);

    const margin = 54;
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - margin * 2;

    const companyName = companyInfo?.company_name || companyInfo?.name || 'AZ Marine';

    // Header
    doc.font('Helvetica-Bold').fontSize(18).text(companyName, margin, margin);
    doc.font('Helvetica').fontSize(9);
    const addrParts: string[] = [];
    if (companyInfo?.address_line1) addrParts.push(companyInfo.address_line1);
    if (companyInfo?.address_line2) addrParts.push(companyInfo.address_line2);
    const cityStateZip = [companyInfo?.city, companyInfo?.state, companyInfo?.zip_code].filter(Boolean).join(', ');
    if (cityStateZip) addrParts.push(cityStateZip);
    if (companyInfo?.phone) addrParts.push(`Phone: ${companyInfo.phone}`);
    if (companyInfo?.email) addrParts.push(`Email: ${companyInfo.email}`);
    if (addrParts.length > 0) {
      doc.text(addrParts.join('\n'));
    }

    // Invoice title block (right side)
    const invoiceTitleY = margin;
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#059669')
      .text('INVOICE', pageWidth - margin - 160, invoiceTitleY, { width: 160, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
      .text(`Invoice #: ${invoice.invoice_number}`, pageWidth - margin - 160, invoiceTitleY + 30, { width: 160, align: 'right' });
    const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : new Date(invoice.created_at).toLocaleDateString();
    doc.text(`Date: ${invoiceDate}`, pageWidth - margin - 160, doc.y, { width: 160, align: 'right' });
    if (invoice.due_date) {
      doc.text(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, pageWidth - margin - 160, doc.y, { width: 160, align: 'right' });
    }
    if (invoice.yachts?.name) {
      doc.text(`Vessel: ${invoice.yachts.name}`, pageWidth - margin - 160, doc.y, { width: 160, align: 'right' });
    }

    // Divider
    const dividerY = Math.max(doc.y + 10, 130);
    doc.moveTo(margin, dividerY).lineTo(pageWidth - margin, dividerY).strokeColor('#059669').lineWidth(2).stroke();

    // Bill To
    const billToY = dividerY + 14;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555').text('BILL TO', margin, billToY);
    doc.font('Helvetica').fontSize(10).fillColor('#333333').text(invoice.customer_name || '', margin, billToY + 13);
    if (invoice.customer_email) doc.fontSize(9).text(invoice.customer_email);
    if (invoice.customer_phone) doc.text(invoice.customer_phone);
    if (invoice.yachts?.name) doc.text(`Vessel: ${invoice.yachts.name}`);

    // Service description header if no line items
    if (tasks.length === 0 || lineItems.length === 0) {
      const tableTopY = doc.y + 20;
      doc.rect(margin, tableTopY, contentWidth, 18).fill('#059669');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
        .text('SERVICE DESCRIPTION', margin + 4, tableTopY + 5, { width: contentWidth });
      let rowY = tableTopY + 18;
      doc.rect(margin, rowY, contentWidth, 28).fill('#fafafa');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
        .text(invoice.repair_title || 'Services Rendered', margin + 4, rowY + 5, { width: contentWidth - 8 });
      if (invoice.repair_description) {
        doc.font('Helvetica').fontSize(8).fillColor('#555555')
          .text(invoice.repair_description, margin + 4, rowY + 17, { width: contentWidth - 8 });
      }
      rowY += 28;
      doc.moveTo(margin, rowY).lineTo(pageWidth - margin, rowY).strokeColor('#e5e7eb').lineWidth(1).stroke();
      rowY += 16;

      // Totals
      const totalsLabelX = pageWidth - margin - 230;
      const totalsValueX = pageWidth - margin - 80;
      const totalsWidth = 75;

      const addTotalRow = (label: string, value: string, bold = false, color = '#333333') => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9).fillColor(color);
        doc.text(label, totalsLabelX, rowY, { width: 145, align: 'right' });
        doc.text(value, totalsValueX, rowY, { width: totalsWidth, align: 'right' });
        rowY += bold ? 18 : 14;
      };

      addTotalRow('Subtotal:', `$${Number(invoice.subtotal || invoice.invoice_amount?.replace('$', '') || 0).toFixed(2)}`);
      if (Number(invoice.shop_supplies_amount) > 0) {
        addTotalRow('Shop Supplies:', `$${Number(invoice.shop_supplies_amount).toFixed(2)}`);
      }
      if (Number(invoice.park_fees_amount) > 0) {
        addTotalRow('Park Fees:', `$${Number(invoice.park_fees_amount).toFixed(2)}`);
      }
      if (Number(invoice.surcharge_amount) > 0) {
        addTotalRow('Surcharge:', `$${Number(invoice.surcharge_amount).toFixed(2)}`);
      }
      addTotalRow(`Tax (${(Number(invoice.tax_rate || 0) * 100).toFixed(2)}%):`, `$${Number(invoice.tax_amount || 0).toFixed(2)}`);
      if (Number(invoice.deposit_applied) > 0) {
        addTotalRow('Deposit Applied:', `-$${Number(invoice.deposit_applied).toFixed(2)}`, false, '#059669');
      }
      if (Number(invoice.amount_paid) > 0) {
        addTotalRow('Amount Paid:', `-$${Number(invoice.amount_paid).toFixed(2)}`, false, '#059669');
      }

      const balanceDue = Number(invoice.balance_due ?? invoice.total_amount ?? 0);
      const balanceLabel = (Number(invoice.deposit_applied) > 0 || Number(invoice.amount_paid) > 0) ? 'Balance Due:' : 'Total Due:';
      rowY += 4;
      doc.rect(totalsLabelX - 8, rowY - 4, 230 + 8, 26).fill('#059669');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('white')
        .text(balanceLabel, totalsLabelX, rowY + 3, { width: 145, align: 'right' });
      doc.text(`$${balanceDue.toFixed(2)}`, totalsValueX, rowY + 3, { width: totalsWidth, align: 'right' });

      doc.end();
      return;
    }

    // Line items table
    const tableTopY = doc.y + 20;
    const colX = {
      type: margin,
      desc: margin + 55,
      qty: margin + contentWidth - 210,
      unit: margin + contentWidth - 150,
      total: margin + contentWidth - 70,
    };
    const colWidths = {
      type: 50,
      desc: colX.qty - colX.desc - 10,
      qty: 55,
      unit: 75,
      total: 70,
    };

    // Table header
    doc.rect(margin, tableTopY, contentWidth, 18).fill('#059669');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('white');
    doc.text('TYPE', colX.type + 4, tableTopY + 5, { width: colWidths.type });
    doc.text('DESCRIPTION', colX.desc, tableTopY + 5, { width: colWidths.desc });
    doc.text('QTY', colX.qty, tableTopY + 5, { width: colWidths.qty, align: 'center' });
    doc.text('UNIT PRICE', colX.unit, tableTopY + 5, { width: colWidths.unit, align: 'right' });
    doc.text('TOTAL', colX.total, tableTopY + 5, { width: colWidths.total, align: 'right' });

    let rowY = tableTopY + 18;
    let rowIndex = 0;

    const sortedTasks = [...tasks].sort((a, b) => a.task_order - b.task_order);

    for (const task of sortedTasks) {
      const taskItems = lineItems
        .filter(li => li.task_id === task.id)
        .sort((a, b) => a.line_order - b.line_order);

      if (taskItems.length === 0) continue;

      const taskHeaderHeight = 16;
      doc.rect(margin, rowY, contentWidth, taskHeaderHeight).fill('#f3f4f6');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827')
        .text(task.task_name, colX.type + 4, rowY + 4, { width: contentWidth - 8 });
      rowY += taskHeaderHeight;

      for (const item of taskItems) {
        const descText = item.description + (item.work_details ? `\n${item.work_details}` : '');
        const descHeight = doc.heightOfString(descText, { width: colWidths.desc, fontSize: 8 });
        const rowHeight = Math.max(descHeight + 10, 18);

        if (rowY + rowHeight > doc.page.height - 80) {
          doc.addPage();
          rowY = margin;
        }

        if (rowIndex % 2 === 0) {
          doc.rect(margin, rowY, contentWidth, rowHeight).fill('#fafafa');
        }

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#374151')
          .text(item.line_type.toUpperCase(), colX.type + 4, rowY + 5, { width: colWidths.type });
        doc.font('Helvetica').fontSize(8).fillColor('#374151')
          .text(descText, colX.desc, rowY + 5, { width: colWidths.desc });
        doc.text(item.quantity.toString(), colX.qty, rowY + 5, { width: colWidths.qty, align: 'center' });
        doc.text(`$${Number(item.unit_price).toFixed(2)}`, colX.unit, rowY + 5, { width: colWidths.unit, align: 'right' });
        doc.text(`$${Number(item.total_price).toFixed(2)}`, colX.total, rowY + 5, { width: colWidths.total, align: 'right' });

        rowY += rowHeight;
        rowIndex++;
      }
    }

    // Bottom border
    doc.moveTo(margin, rowY).lineTo(pageWidth - margin, rowY).strokeColor('#e5e7eb').lineWidth(1).stroke();
    rowY += 16;

    let totalsRowCount = 2;
    if (Number(invoice.shop_supplies_amount) > 0) totalsRowCount++;
    if (Number(invoice.park_fees_amount) > 0) totalsRowCount++;
    if (Number(invoice.surcharge_amount) > 0) totalsRowCount++;
    if (Number(invoice.deposit_applied) > 0) totalsRowCount++;
    if (Number(invoice.amount_paid) > 0) totalsRowCount++;
    const estimatedTotalsHeight = totalsRowCount * 14 + 4 + 34 + (invoice.notes ? 60 : 0);

    if (rowY + estimatedTotalsHeight > doc.page.height - margin) {
      doc.addPage();
      rowY = margin;
    }

    // Totals block
    const totalsLabelX = pageWidth - margin - 230;
    const totalsValueX = pageWidth - margin - 80;
    const totalsWidth = 75;

    const addTotalRow = (label: string, value: string, bold = false, color = '#333333') => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9).fillColor(color);
      doc.text(label, totalsLabelX, rowY, { width: 145, align: 'right' });
      doc.text(value, totalsValueX, rowY, { width: totalsWidth, align: 'right' });
      rowY += bold ? 18 : 14;
    };

    addTotalRow('Subtotal:', `$${Number(invoice.subtotal || 0).toFixed(2)}`);
    if (Number(invoice.shop_supplies_amount) > 0) {
      addTotalRow('Shop Supplies:', `$${Number(invoice.shop_supplies_amount).toFixed(2)}`);
    }
    if (Number(invoice.park_fees_amount) > 0) {
      addTotalRow('Park Fees:', `$${Number(invoice.park_fees_amount).toFixed(2)}`);
    }
    if (Number(invoice.surcharge_amount) > 0) {
      addTotalRow('Surcharge:', `$${Number(invoice.surcharge_amount).toFixed(2)}`);
    }
    addTotalRow(`Tax (${(Number(invoice.tax_rate || 0) * 100).toFixed(2)}%):`, `$${Number(invoice.tax_amount || 0).toFixed(2)}`);

    if (Number(invoice.deposit_applied) > 0) {
      addTotalRow('Deposit Applied:', `-$${Number(invoice.deposit_applied).toFixed(2)}`, false, '#059669');
    }
    if (Number(invoice.amount_paid) > 0) {
      addTotalRow('Amount Paid:', `-$${Number(invoice.amount_paid).toFixed(2)}`, false, '#059669');
    }

    const balanceDue = Number(invoice.balance_due ?? invoice.total_amount ?? 0);
    const balanceLabel = (Number(invoice.deposit_applied) > 0 || Number(invoice.amount_paid) > 0) ? 'Balance Due:' : 'Total Due:';

    rowY += 4;
    doc.rect(totalsLabelX - 8, rowY - 4, 230 + 8, 26).fill('#059669');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('white')
      .text(balanceLabel, totalsLabelX, rowY + 3, { width: 145, align: 'right' });
    doc.text(`$${balanceDue.toFixed(2)}`, totalsValueX, rowY + 3, { width: totalsWidth, align: 'right' });
    rowY += 34;

    if (invoice.notes) {
      if (rowY + 60 > doc.page.height - margin) {
        doc.addPage();
        rowY = margin;
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text('Notes:', margin, rowY);
      rowY += 13;
      doc.font('Helvetica').fontSize(9).text(invoice.notes, margin, rowY, { width: contentWidth });
    }

    doc.end();
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { invoiceId, recipientEmail, recipientName, recaptchaToken, additionalRecipients, attachmentBase64, attachmentFilename, attachmentContentType, ccEmail }: EmailRequest = await req.json();

    if (!invoiceId || !recipientEmail) {
      throw new Error('Invoice ID and recipient email are required');
    }

    if (recaptchaToken) {
      const verifyUrl = `${supabaseUrl}/functions/v1/verify-recaptcha`;
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptchaToken })
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address');
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('yacht_invoices')
      .select('*, yachts(name), vessel_management_agreement_id')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.payment_link_url) {
      throw new Error('Payment link not generated yet');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, yacht_id')
      .eq('user_id', user.id)
      .single();

    const isRetailCustomer = !invoice.yacht_id;
    const hasAccess = profile?.role === 'master' ||
                      profile?.role === 'staff' ||
                      profile?.role === 'mechanic' ||
                      (!isRetailCustomer && profile?.role === 'manager' && profile?.yacht_id === invoice.yacht_id);

    if (!hasAccess) {
      throw new Error('Unauthorized to send this invoice');
    }

    // Fetch company info for PDF
    const { data: companyDetails } = await supabase
      .from('company_info')
      .select('*')
      .maybeSingle();

    const mergedCompany = {
      ...(companyDetails || {}),
      company_name: companyDetails?.company_name || 'AZ Marine',
    };

    // Fetch line items for PDF generation
    let tasks: WorkOrderTask[] = [];
    let lineItems: WorkOrderLineItem[] = [];

    if (invoice.work_order_id) {
      const [tasksRes, lineItemsRes] = await Promise.all([
        supabase
          .from('work_order_tasks')
          .select('id, task_name, task_order')
          .eq('work_order_id', invoice.work_order_id)
          .order('task_order'),
        supabase
          .from('work_order_line_items')
          .select('id, task_id, line_type, description, quantity, unit_price, total_price, work_details, line_order')
          .eq('work_order_id', invoice.work_order_id)
          .order('line_order'),
      ]);
      tasks = tasksRes.data || [];
      lineItems = lineItemsRes.data || [];
    }

    // Build PDF from live data
    const pdfBytes = await buildInvoicePDF(invoice, tasks, lineItems, mergedCompany);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
    const pdfFilename = invoice.invoice_number ? `Invoice-${invoice.invoice_number}.pdf` : 'Invoice.pdf';

    // If vessel management agreement is linked, fetch financial terms for email body
    let agreementTermsHtml = '';
    if (invoice.vessel_management_agreement_id) {
      const { data: agreement } = await supabase
        .from('vessel_management_agreements')
        .select('annual_fee, season_trips, off_season_trips, per_trip_fee, total_trip_cost, grand_total, season_name, start_date, end_date')
        .eq('id', invoice.vessel_management_agreement_id)
        .maybeSingle();

      if (agreement) {
        const annualFee = agreement.annual_fee ?? 8000;
        const seasonTrips = agreement.season_trips ?? 0;
        const offSeasonTrips = agreement.off_season_trips ?? 0;
        const perTripFee = agreement.per_trip_fee ?? 350;
        const totalTripCost = agreement.total_trip_cost ?? (seasonTrips + offSeasonTrips) * perTripFee;
        const grandTotal = agreement.grand_total ?? annualFee + totalTripCost;
        const periodText = agreement.start_date && agreement.end_date
          ? `${new Date(agreement.start_date).toLocaleDateString()} – ${new Date(agreement.end_date).toLocaleDateString()}`
          : '';

        agreementTermsHtml = `
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <h3 style="margin-top: 0; color: #0284c7;">Financial Terms – ${agreement.season_name || 'Vessel Management Agreement'}</h3>
            ${periodText ? `<p style="color: #555; font-size: 13px; margin-bottom: 12px;">Agreement Period: ${periodText}</p>` : ''}
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 4px; color: #555;">Annual Management Fee</td>
                <td style="padding: 8px 4px; text-align: right; font-weight: 600;">$${annualFee.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 4px; color: #555;">Season Trips</td>
                <td style="padding: 8px 4px; text-align: right;">${seasonTrips}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 4px; color: #555;">Off-Season Trips</td>
                <td style="padding: 8px 4px; text-align: right;">${offSeasonTrips}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 4px; color: #555;">Per Trip Fee</td>
                <td style="padding: 8px 4px; text-align: right;">$${perTripFee.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 4px; color: #555;">Total Trip Fees (${seasonTrips + offSeasonTrips} trips × $${perTripFee.toFixed(2)})</td>
                <td style="padding: 8px 4px; text-align: right; font-weight: 600;">$${totalTripCost.toFixed(2)}</td>
              </tr>
              <tr style="background: #f0fdf4;">
                <td style="padding: 10px 4px; font-weight: 700; font-size: 15px;">Grand Total Due</td>
                <td style="padding: 10px 4px; text-align: right; font-weight: 700; font-size: 15px; color: #059669;">$${grandTotal.toFixed(2)}</td>
              </tr>
            </table>
            <p style="font-size: 12px; color: #888; margin-top: 10px; margin-bottom: 0;">This is a one-time annual fee. Repairs and maintenance are billed separately.</p>
          </div>`;
      }
    }

    const yachtName = invoice.yachts?.name || (isRetailCustomer ? 'your vessel' : 'Your Yacht');
    const subject = `Payment Request: ${invoice.repair_title}`;

    // Build summary totals for email body
    const subtotal = Number(invoice.subtotal || 0);
    const shopSupplies = Number(invoice.shop_supplies_amount || 0);
    const parkFees = Number(invoice.park_fees_amount || 0);
    const surcharge = Number(invoice.surcharge_amount || 0);
    const taxAmount = Number(invoice.tax_amount || 0);
    const taxRate = Number(invoice.tax_rate || 0);
    const depositApplied = Number(invoice.deposit_applied || 0);
    const amountPaid = Number(invoice.amount_paid || 0);
    const balanceDue = Number(invoice.balance_due ?? invoice.total_amount ?? 0);
    const hasPaymentApplied = depositApplied > 0 || amountPaid > 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
          .totals-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px; }
          .totals-table td { padding: 6px 4px; }
          .totals-table .label { color: #555; }
          .totals-table .value { text-align: right; font-weight: 600; }
          .totals-table .credit { color: #059669; }
          .totals-table .balance-row { background: #059669; color: white; font-weight: 700; font-size: 15px; }
          .totals-table .balance-row td { padding: 10px 4px; }
          .button { display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .attachment-note { background: #ecfdf5; border-left: 4px solid #059669; padding: 12px; border-radius: 4px; font-size: 14px; margin: 16px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Payment Request</h1>
            ${!isRetailCustomer ? `<p style="margin: 10px 0 0 0;">${yachtName}</p>` : ''}
          </div>
          <div class="content">
            <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>

            <p>You have received a payment request for ${isRetailCustomer ? 'maintenance work' : `maintenance work completed on <strong>${yachtName}</strong>`}.</p>

            <div class="invoice-details">
              <h3 style="margin-top: 0; color: #059669;">Invoice Details</h3>
              <p><strong>Service:</strong> ${invoice.repair_title}</p>
              ${invoice.repair_description ? `<p><strong>Description:</strong> ${invoice.repair_description}</p>` : ''}
              <p><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}</p>
              ${invoice.due_date ? `<p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}

              <table class="totals-table">
                <tr>
                  <td class="label">Subtotal</td>
                  <td class="value">$${subtotal.toFixed(2)}</td>
                </tr>
                ${shopSupplies > 0 ? `<tr><td class="label">Shop Supplies</td><td class="value">$${shopSupplies.toFixed(2)}</td></tr>` : ''}
                ${parkFees > 0 ? `<tr><td class="label">Park Fees</td><td class="value">$${parkFees.toFixed(2)}</td></tr>` : ''}
                ${surcharge > 0 ? `<tr><td class="label">Surcharge</td><td class="value">$${surcharge.toFixed(2)}</td></tr>` : ''}
                <tr>
                  <td class="label">Tax (${(taxRate * 100).toFixed(2)}%)</td>
                  <td class="value">$${taxAmount.toFixed(2)}</td>
                </tr>
                ${depositApplied > 0 ? `<tr><td class="label">Deposit Applied</td><td class="value credit">-$${depositApplied.toFixed(2)}</td></tr>` : ''}
                ${amountPaid > 0 ? `<tr><td class="label">Amount Paid</td><td class="value credit">-$${amountPaid.toFixed(2)}</td></tr>` : ''}
                <tr class="balance-row">
                  <td>${hasPaymentApplied ? 'Balance Due' : 'Total Due'}</td>
                  <td style="text-align: right;">$${balanceDue.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            ${agreementTermsHtml}

            <div class="attachment-note">
              <strong>A detailed PDF invoice is attached</strong> to this email for your records.
            </div>

            <p>Please click the button below to securely pay this invoice via Stripe:</p>

            <div style="text-align: center;">
              <a href="${invoice.payment_link_url}" class="button">Pay Invoice Now</a>
            </div>

            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:<br>
            <a href="${invoice.payment_link_url}" style="color: #059669; word-break: break-all;">${invoice.payment_link_url}</a></p>

            <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; font-size: 14px;">
              <strong>Important:</strong> For security reasons, this payment link expires in 30 days. Please complete your payment at your earliest convenience.
            </p>

            <p style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; font-size: 14px;">
              <strong>Payment Due:</strong> Payment is due within 48 hours per our contract.
            </p>

            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

            <p>Thank you for your prompt attention to this matter.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ${mergedCompany.company_name}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (resendApiKey) {
      let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
      fromEmail = fromEmail.trim();

      const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
      if (!emailFormatRegex.test(fromEmail)) {
        throw new Error(`Invalid from email format: "${fromEmail}".`);
      }

      let ccEmails: string[] = [];
      if (invoice.yacht_id) {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

        // CC owner secondary emails
        const { data: ownerProfiles } = await adminSupabase
          .from('user_profiles')
          .select('secondary_email')
          .eq('yacht_id', invoice.yacht_id)
          .eq('role', 'owner')
          .not('secondary_email', 'is', null);

        if (ownerProfiles && ownerProfiles.length > 0) {
          ccEmails = ownerProfiles
            .map(p => p.secondary_email)
            .filter((email): email is string => !!email && email !== recipientEmail);
        }

        // Also CC billing manager secondary emails
        const { data: billingMgrs } = await adminSupabase
          .from('user_profiles')
          .select('secondary_email')
          .eq('yacht_id', invoice.yacht_id)
          .eq('can_approve_billing', true)
          .eq('is_active', true)
          .not('secondary_email', 'is', null);

        if (billingMgrs && billingMgrs.length > 0) {
          for (const m of billingMgrs) {
            const cc = (m.secondary_email ?? '').trim();
            if (cc && cc !== recipientEmail && !ccEmails.includes(cc)) {
              ccEmails.push(cc);
            }
          }
        }
      }

      if (ccEmail && ccEmail.trim() && !ccEmails.includes(ccEmail.trim())) {
        ccEmails.push(ccEmail.trim());
      }

      const allRecipientEmails = [recipientEmail];
      if (additionalRecipients && additionalRecipients.length > 0) {
        for (const r of additionalRecipients) {
          if (r.email && r.email !== recipientEmail) {
            allRecipientEmails.push(r.email);
          }
        }
      }

      const attachments: any[] = [
        {
          filename: pdfFilename,
          content: pdfBase64,
        },
      ];

      if (attachmentBase64 && attachmentFilename) {
        attachments.push({
          filename: attachmentFilename,
          content: attachmentBase64,
          content_type: attachmentContentType || 'application/octet-stream',
        });
      }

      const emailPayload: any = {
        from: fromEmail,
        to: allRecipientEmails,
        subject: subject,
        html: htmlContent,
        attachments,
        tags: [
          { name: 'category', value: 'payment-invoice' },
          { name: 'invoice_id', value: invoiceId },
        ],
        headers: { 'X-Entity-Ref-ID': invoiceId },
      };

      if (ccEmails.length > 0) {
        emailPayload.cc = ccEmails;
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Resend API error:', errorText);
        let errorMessage = 'Failed to send email via Resend';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = `Resend Error: ${errorData.message}`;
            if (errorData.message.includes('You can only send testing emails to your own email address')) {
              errorMessage += '\n\nTo fix this:\n1. Go to resend.com/domains and verify your domain\n2. In Supabase Edge Functions, add RESEND_FROM_EMAIL secret\n3. Or for testing, only send emails to your verified address';
            }
          }
        } catch {
          errorMessage = `Resend Error (${emailResponse.status}): ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const emailData = await emailResponse.json();
      console.log('Email sent successfully:', emailData);

      await supabase
        .from('yacht_invoices')
        .update({
          payment_email_sent_at: new Date().toISOString(),
          resend_email_id: emailData.id,
          payment_email_recipient: recipientEmail,
          payment_email_all_recipients: allRecipientEmails,
        })
        .eq('id', invoiceId);

      if (invoice.yacht_id) {
        await supabase.from('owner_chat_messages').insert({
          yacht_id: invoice.yacht_id,
          sender_role: 'staff',
          message: `Payment link email sent to ${recipientEmail} for invoice: ${invoice.repair_title}`,
          created_at: new Date().toISOString(),
        });

        const yachtHistoryName = invoice.yachts?.name || 'Unknown Yacht';
        await supabase.from('yacht_history_logs').insert({
          yacht_id: invoice.yacht_id,
          yacht_name: yachtHistoryName,
          action: `Payment email for "${invoice.repair_title}" sent to ${recipientEmail}`,
          reference_id: invoice.id,
          reference_type: 'yacht_invoice',
          created_at: new Date().toISOString(),
          created_by: user.id,
          created_by_name: profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : 'Staff',
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          emailId: emailData.id,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email service not configured. Please add RESEND_API_KEY to enable email sending.',
          message: 'Resend not configured',
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error sending payment link email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
