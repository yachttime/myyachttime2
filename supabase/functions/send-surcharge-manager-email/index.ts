import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import PDFDocument from 'npm:pdfkit@0.15.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  invoiceId: string;
  surchargeManagerEmail: string;
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

    doc.font('Helvetica-Bold').fontSize(18).text(companyName, margin, margin);
    doc.font('Helvetica').fontSize(9);
    const addrParts: string[] = [];
    if (companyInfo?.address_line1) addrParts.push(companyInfo.address_line1);
    if (companyInfo?.address_line2) addrParts.push(companyInfo.address_line2);
    const cityStateZip = [companyInfo?.city, companyInfo?.state, companyInfo?.zip_code].filter(Boolean).join(', ');
    if (cityStateZip) addrParts.push(cityStateZip);
    if (companyInfo?.phone) addrParts.push(`Phone: ${companyInfo.phone}`);
    if (companyInfo?.email) addrParts.push(`Email: ${companyInfo.email}`);
    if (addrParts.length > 0) doc.text(addrParts.join('\n'));

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
    if (invoice.work_orders?.work_order_number) {
      doc.text(`Work Order: ${invoice.work_orders.work_order_number}`, pageWidth - margin - 160, doc.y, { width: 160, align: 'right' });
    }

    const dividerY = Math.max(doc.y + 10, 130);
    doc.moveTo(margin, dividerY).lineTo(pageWidth - margin, dividerY).strokeColor('#059669').lineWidth(2).stroke();

    const billToY = dividerY + 14;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555').text('BILL TO', margin, billToY);
    doc.font('Helvetica').fontSize(10).fillColor('#333333').text(invoice.customer_name || '', margin, billToY + 13);
    if (invoice.customer_email) doc.fontSize(9).text(invoice.customer_email);
    if (invoice.customer_phone) doc.text(invoice.customer_phone);
    if (invoice.yachts?.name) doc.text(`Vessel: ${invoice.yachts.name}`);

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

    if (tasks.length === 0 || lineItems.length === 0) {
      doc.rect(margin, rowY, contentWidth, 24).fill('#fafafa');
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
        .text('No line items', margin + 4, rowY + 8, { width: contentWidth });
      rowY += 24;
    }

    doc.moveTo(margin, rowY).lineTo(pageWidth - margin, rowY).strokeColor('#e5e7eb').lineWidth(1).stroke();
    rowY += 16;

    let totalsRowCount = 2;
    if (Number(invoice.deposit_applied) > 0) totalsRowCount++;
    if (Number(invoice.amount_paid) > 0) totalsRowCount++;
    const estimatedTotalsHeight = totalsRowCount * 14 + 4 + 34 + (invoice.notes ? 60 : 0);

    if (rowY + estimatedTotalsHeight > doc.page.height - margin) {
      doc.addPage();
      rowY = margin;
    }

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
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { invoiceId, surchargeManagerEmail }: EmailRequest = await req.json();

    if (!invoiceId || !surchargeManagerEmail) {
      throw new Error('Invoice ID and surcharge manager email are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(surchargeManagerEmail)) {
      throw new Error('Invalid surcharge manager email address');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasAccess = profile?.role === 'master' ||
                      profile?.role === 'staff' ||
                      profile?.role === 'mechanic' ||
                      profile?.role === 'manager';
    if (!hasAccess) throw new Error('Unauthorized to send this email');

    const { data: invoice, error: invoiceError } = await supabase
      .from('estimating_invoices')
      .select('*, yachts(name), work_orders(work_order_number, id)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) throw new Error('Invoice not found');

    const surchargeAmount = Number(invoice.surcharge_amount || 0);
    if (surchargeAmount <= 0) throw new Error('This invoice has no surcharge amount');

    const { data: companyDetails } = await supabase
      .from('company_info')
      .select('*')
      .maybeSingle();

    const { data: companyInfo } = await supabase
      .from('companies')
      .select('name')
      .eq('id', invoice.company_id)
      .maybeSingle();

    const mergedCompany = {
      ...(companyDetails || {}),
      company_name: companyDetails?.company_name || companyInfo?.name || 'AZ Marine',
    };

    const companyName = mergedCompany.company_name;
    const yachtName = invoice.yachts?.name || invoice.yacht_name || 'N/A';
    const workOrderNumber = invoice.work_orders?.work_order_number;
    const workOrderId = invoice.work_orders?.id || invoice.work_order_id;

    let tasks: WorkOrderTask[] = [];
    let lineItems: WorkOrderLineItem[] = [];

    if (workOrderId) {
      const [tasksRes, lineItemsRes] = await Promise.all([
        supabase.from('work_order_tasks').select('id, task_name, task_order').eq('work_order_id', workOrderId).order('task_order'),
        supabase.from('work_order_line_items').select('id, task_id, line_type, description, quantity, unit_price, total_price, work_details, line_order').eq('work_order_id', workOrderId).order('line_order'),
      ]);
      tasks = tasksRes.data || [];
      lineItems = lineItemsRes.data || [];
    }

    const pdfBytes = await buildInvoicePDF(invoice, tasks, lineItems, mergedCompany);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured. Please add RESEND_API_KEY.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromEmail = (Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com').trim();
    const salesCc = 'sales@azmarine.net';
    const subject = `Surcharge Notification — ${invoice.invoice_number} | ${yachtName} | $${surchargeAmount.toFixed(2)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight-box { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .surcharge-amount { font-size: 36px; font-weight: bold; color: #b45309; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .invoice-table { width: 100%; border-collapse: collapse; margin: 16px 0; background: white; border-radius: 8px; overflow: hidden; }
          .invoice-table th { background: #f59e0b; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
          .invoice-table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 22px;">Surcharge Notification</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">${companyName}</p>
          </div>
          <div class="content">
            <div class="highlight-box">
              <p style="margin: 0 0 4px 0; font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em;">Surcharge Amount</p>
              <div class="surcharge-amount">$${surchargeAmount.toFixed(2)}</div>
              <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: 600; color: #374151;">${yachtName}</p>
            </div>

            <table class="invoice-table">
              <tr><th colspan="2">Invoice Details</th></tr>
              <tr><td><strong>Invoice #</strong></td><td>${invoice.invoice_number}</td></tr>
              ${workOrderNumber ? `<tr><td><strong>Work Order</strong></td><td>${workOrderNumber}</td></tr>` : ''}
              <tr><td><strong>Vessel / Yacht</strong></td><td>${yachtName}</td></tr>
              ${invoice.customer_name ? `<tr><td><strong>Customer</strong></td><td>${invoice.customer_name}</td></tr>` : ''}
              <tr><td><strong>Invoice Date</strong></td><td>${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}</td></tr>
              ${invoice.due_date ? `<tr><td><strong>Due Date</strong></td><td>${new Date(invoice.due_date).toLocaleDateString()}</td></tr>` : ''}
              <tr><td><strong>Subtotal</strong></td><td>$${Number(invoice.subtotal || 0).toFixed(2)}</td></tr>
              ${Number(invoice.shop_supplies_amount) > 0 ? `<tr><td><strong>Shop Supplies</strong></td><td>$${Number(invoice.shop_supplies_amount).toFixed(2)}</td></tr>` : ''}
              ${Number(invoice.park_fees_amount) > 0 ? `<tr><td><strong>Park Fees</strong></td><td>$${Number(invoice.park_fees_amount).toFixed(2)}</td></tr>` : ''}
              <tr style="background: #fffbeb;"><td><strong>Surcharge</strong></td><td><strong style="color: #b45309;">$${surchargeAmount.toFixed(2)}</strong></td></tr>
              <tr><td><strong>Tax (${(Number(invoice.tax_rate || 0) * 100).toFixed(2)}%)</strong></td><td>$${Number(invoice.tax_amount || 0).toFixed(2)}</td></tr>
              ${Number(invoice.deposit_applied) > 0 ? `<tr><td><strong>Deposit Applied</strong></td><td style="color:#059669;">-$${Number(invoice.deposit_applied).toFixed(2)}</td></tr>` : ''}
              ${Number(invoice.amount_paid) > 0 ? `<tr><td><strong>Amount Paid</strong></td><td style="color:#059669;">-$${Number(invoice.amount_paid).toFixed(2)}</td></tr>` : ''}
              <tr style="background: #f0fdf4;"><td><strong>Total Amount</strong></td><td><strong>$${Number(invoice.total_amount || 0).toFixed(2)}</strong></td></tr>
            </table>

            <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">A complete copy of the invoice is attached as a PDF for your records.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${companyName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailPayload: any = {
      from: fromEmail,
      to: [surchargeManagerEmail],
      cc: [salesCc],
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: `Invoice-${invoice.invoice_number}.pdf`,
          content: pdfBase64,
        },
      ],
      tags: [
        { name: 'category', value: 'surcharge-manager-notification' },
        { name: 'invoice_id', value: invoiceId },
      ],
      headers: { 'X-Entity-Ref-ID': `surcharge-${invoiceId}` },
    };

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
      let errorMessage = 'Failed to send email';
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) errorMessage = `Email error: ${errorData.message}`;
      } catch {}
      throw new Error(errorMessage);
    }

    const emailData = await emailResponse.json();
    const emailId = emailData.id;

    await supabase
      .from('estimating_invoices')
      .update({
        surcharge_email_sent_at: new Date().toISOString(),
        surcharge_email_recipient: surchargeManagerEmail,
        surcharge_email_resend_id: emailId,
        surcharge_email_delivered_at: null,
        surcharge_email_opened_at: null,
        surcharge_email_clicked_at: null,
        surcharge_email_bounced_at: null,
      })
      .eq('id', invoiceId);

    return new Response(
      JSON.stringify({ success: true, message: `Surcharge notification sent to ${surchargeManagerEmail}`, emailId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending surcharge manager email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
