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
    if (invoice.work_orders?.work_order_number) {
      doc.text(`Work Order: ${invoice.work_orders.work_order_number}`, pageWidth - margin - 160, doc.y, { width: 160, align: 'right' });
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

      // Task header row
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

    // Bottom border for table
    doc.moveTo(margin, rowY).lineTo(pageWidth - margin, rowY).strokeColor('#e5e7eb').lineWidth(1).stroke();
    rowY += 16;

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

    // Notes
    if (invoice.notes) {
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
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { invoiceId, recipientEmail, recipientName }: EmailRequest = await req.json();

    if (!invoiceId || !recipientEmail) {
      throw new Error('Invoice ID and recipient email are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address');
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('estimating_invoices')
      .select('*, yachts(name), work_orders(work_order_number, id)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    const paymentLink = invoice.final_payment_link_url || invoice.payment_link;
    if (!paymentLink) {
      throw new Error('Payment link not generated yet');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, yacht_id, first_name, last_name, company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasAccess = profile?.role === 'master' ||
                      profile?.role === 'staff' ||
                      profile?.role === 'mechanic' ||
                      profile?.role === 'manager';

    if (!hasAccess) {
      throw new Error('Unauthorized to send this invoice');
    }

    const { data: companyInfo } = await supabase
      .from('companies')
      .select('name')
      .eq('id', invoice.company_id)
      .maybeSingle();

    const { data: companyDetails } = await supabase
      .from('company_info')
      .select('*')
      .maybeSingle();

    const mergedCompany = {
      ...(companyDetails || {}),
      company_name: companyDetails?.company_name || companyInfo?.name || 'AZ Marine',
    };

    const companyName = mergedCompany.company_name;
    const yachtName = invoice.yachts?.name;
    const workOrderNumber = invoice.work_orders?.work_order_number;
    const workOrderId = invoice.work_orders?.id || invoice.work_order_id;

    // Fetch line items for PDF
    let tasks: WorkOrderTask[] = [];
    let lineItems: WorkOrderLineItem[] = [];

    if (workOrderId) {
      const [tasksRes, lineItemsRes] = await Promise.all([
        supabase
          .from('work_order_tasks')
          .select('id, task_name, task_order')
          .eq('work_order_id', workOrderId)
          .order('task_order'),
        supabase
          .from('work_order_line_items')
          .select('id, task_id, line_type, description, quantity, unit_price, total_price, work_details, line_order')
          .eq('work_order_id', workOrderId)
          .order('line_order'),
      ]);
      tasks = tasksRes.data || [];
      lineItems = lineItemsRes.data || [];
    }

    // Build PDF
    const pdfBytes = await buildInvoicePDF(invoice, tasks, lineItems, mergedCompany);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    const subject = `Invoice ${invoice.invoice_number} - Payment Request`;

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
          .button { display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .attachment-note { background: #ecfdf5; border-left: 4px solid #059669; padding: 12px; border-radius: 4px; font-size: 14px; margin: 16px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Payment Request</h1>
            ${yachtName ? `<p style="margin: 10px 0 0 0;">${yachtName}</p>` : ''}
          </div>
          <div class="content">
            <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>
            <p>You have received a payment request from <strong>${companyName}</strong>${yachtName ? ` for work completed on <strong>${yachtName}</strong>` : ''}.</p>
            <div class="invoice-details">
              <h3 style="margin-top: 0; color: #059669;">Invoice Details</h3>
              <p><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
              ${workOrderNumber ? `<p><strong>Work Order:</strong> ${workOrderNumber}</p>` : ''}
              ${invoice.customer_name ? `<p><strong>Customer:</strong> ${invoice.customer_name}</p>` : ''}
              <p><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}</p>
              ${invoice.due_date ? `<p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}
              <p><strong>Total Amount:</strong> $${Number(invoice.total_amount || 0).toFixed(2)}</p>
              ${Number(invoice.deposit_applied) > 0 ? `<p><strong>Deposit Applied:</strong> -$${Number(invoice.deposit_applied).toFixed(2)}</p>` : ''}
              ${Number(invoice.amount_paid) > 0 ? `<p><strong>Amount Paid:</strong> -$${Number(invoice.amount_paid).toFixed(2)}</p>` : ''}
              <p><strong>Balance Due:</strong> $${Number(invoice.balance_due ?? invoice.total_amount ?? 0).toFixed(2)}</p>
            </div>
            <div class="attachment-note">
              <strong>A PDF copy of your invoice is attached</strong> to this email for your records.
            </div>
            <p>Please click the button below to securely pay this invoice:</p>
            <div style="text-align: center;">
              <a href="${paymentLink}" class="button">Pay Invoice Now</a>
            </div>
            <p style="font-size: 14px; color: #666;">Or copy and paste this link:<br>
            <a href="${paymentLink}" style="color: #059669; word-break: break-all;">${paymentLink}</a></p>
            <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; font-size: 14px;">
              <strong>Important:</strong> This payment link expires in 30 days. Please complete your payment at your earliest convenience.
            </p>
            <p>If you have any questions, please contact us.</p>
            <p>Thank you for your business.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${companyName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured. Please add RESEND_API_KEY.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let fromEmail = (Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev').trim();

    const emailPayload: any = {
      from: fromEmail,
      to: [recipientEmail],
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: `Invoice-${invoice.invoice_number}.pdf`,
          content: pdfBase64,
        },
      ],
      tags: [
        { name: 'category', value: 'estimating-invoice-payment' },
        { name: 'invoice_id', value: invoiceId },
      ],
      headers: { 'X-Entity-Ref-ID': invoiceId },
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
    console.log('Email sent successfully:', emailData.id);

    await supabase
      .from('estimating_invoices')
      .update({
        final_payment_email_sent_at: new Date().toISOString(),
        final_payment_email_recipient: recipientEmail,
        customer_email: recipientEmail,
      })
      .eq('id', invoiceId);

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully', emailId: emailData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending estimating invoice payment email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
