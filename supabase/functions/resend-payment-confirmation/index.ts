import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import PDFDocument from 'npm:pdfkit@0.15.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

async function buildReceiptPDF(invoice: any, tasks: WorkOrderTask[], lineItems: WorkOrderLineItem[], companyInfo: any): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const doc = new PDFDocument({ margin: 54, size: 'LETTER' });

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => {
      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      const buf = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { buf.set(c, offset); offset += c.length; }
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

    const titleY = margin;
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#059669')
      .text('PAYMENT RECEIPT', pageWidth - margin - 200, titleY, { width: 200, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
      .text(`Invoice #: ${invoice.invoice_number}`, pageWidth - margin - 200, titleY + 30, { width: 200, align: 'right' });
    const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : new Date(invoice.created_at).toLocaleDateString();
    doc.text(`Invoice Date: ${invoiceDate}`, pageWidth - margin - 200, doc.y, { width: 200, align: 'right' });
    const paidAt = invoice.final_payment_paid_at || new Date().toISOString();
    doc.text(`Payment Date: ${new Date(paidAt).toLocaleDateString()}`, pageWidth - margin - 200, doc.y, { width: 200, align: 'right' });
    if (invoice.work_orders?.work_order_number) {
      doc.text(`Work Order: ${invoice.work_orders.work_order_number}`, pageWidth - margin - 200, doc.y, { width: 200, align: 'right' });
    }

    const dividerY = Math.max(doc.y + 10, 130);
    doc.moveTo(margin, dividerY).lineTo(pageWidth - margin, dividerY).strokeColor('#059669').lineWidth(2).stroke();

    const stampY = dividerY + 8;
    doc.rect(margin, stampY, 120, 28).strokeColor('#059669').lineWidth(2).stroke();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#059669')
      .text('PAID IN FULL', margin + 4, stampY + 7, { width: 112, align: 'center' });

    const billToY = stampY;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555').text('BILL TO', pageWidth - margin - 200, billToY);
    doc.font('Helvetica').fontSize(10).fillColor('#333333').text(invoice.customer_name || '', pageWidth - margin - 200, billToY + 13);
    if (invoice.customer_email) doc.fontSize(9).text(invoice.customer_email, pageWidth - margin - 200, doc.y);
    if (invoice.customer_phone) doc.text(invoice.customer_phone, pageWidth - margin - 200, doc.y);
    if (invoice.yachts?.name) doc.text(`Vessel: ${invoice.yachts.name}`, pageWidth - margin - 200, doc.y);

    const tableTopY = Math.max(doc.y, stampY + 40) + 16;
    const colX = {
      type: margin, desc: margin + 55,
      qty: margin + contentWidth - 210,
      unit: margin + contentWidth - 150,
      total: margin + contentWidth - 70,
    };
    const colWidths = { type: 50, desc: colX.qty - colX.desc - 10, qty: 55, unit: 75, total: 70 };

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
      const taskItems = lineItems.filter(li => li.task_id === task.id).sort((a, b) => a.line_order - b.line_order);
      if (taskItems.length === 0) continue;

      doc.rect(margin, rowY, contentWidth, 16).fill('#f3f4f6');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827')
        .text(task.task_name, colX.type + 4, rowY + 4, { width: contentWidth - 8 });
      rowY += 16;

      for (const item of taskItems) {
        const descText = item.description + (item.work_details ? `\n${item.work_details}` : '');
        const descHeight = doc.heightOfString(descText, { width: colWidths.desc, fontSize: 8 });
        const rowHeight = Math.max(descHeight + 10, 18);
        if (rowY + rowHeight > doc.page.height - 80) { doc.addPage(); rowY = margin; }
        if (rowIndex % 2 === 0) doc.rect(margin, rowY, contentWidth, rowHeight).fill('#fafafa');
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
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text('No line items', margin + 4, rowY + 8, { width: contentWidth });
      rowY += 24;
    }

    doc.moveTo(margin, rowY).lineTo(pageWidth - margin, rowY).strokeColor('#e5e7eb').lineWidth(1).stroke();
    rowY += 16;

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
    if (Number(invoice.deposit_applied) > 0) addTotalRow('Deposit Applied:', `-$${Number(invoice.deposit_applied).toFixed(2)}`, false, '#059669');
    if (Number(invoice.amount_paid) > 0) addTotalRow('Amount Paid:', `-$${Number(invoice.amount_paid).toFixed(2)}`, false, '#059669');

    rowY += 4;
    doc.rect(totalsLabelX - 8, rowY - 4, 230 + 8, 26).fill('#059669');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('white')
      .text('Balance Due:', totalsLabelX, rowY + 3, { width: 145, align: 'right' });
    const remaining = Math.max(0, Number(invoice.balance_due ?? 0));
    doc.text(`$${remaining.toFixed(2)}`, totalsValueX, rowY + 3, { width: totalsWidth, align: 'right' });
    rowY += 34;

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

    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fromEmail = (Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com').trim();

    const { payment_type, payment_id } = await req.json();

    if (!payment_type || !payment_id) {
      return new Response(JSON.stringify({ error: 'Missing payment_type or payment_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Deposit confirmation (repair request) ──────────────────────────────
    if (payment_type === 'deposit') {
      const { data: repairRequest } = await supabase
        .from('repair_requests')
        .select('id, title, deposit_amount, deposit_paid_at, deposit_stripe_payment_intent_id, customer_email, deposit_email_recipient, customer_name, yacht_id, yachts(name)')
        .eq('id', payment_id)
        .single();

      if (!repairRequest) {
        return new Response(JSON.stringify({ error: 'Repair request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!repairRequest.deposit_paid_at) {
        return new Response(JSON.stringify({ error: 'Deposit has not been paid yet' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const customerEmail = repairRequest.customer_email || repairRequest.deposit_email_recipient;
      if (!customerEmail) {
        return new Response(JSON.stringify({ error: 'No customer email found' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: companyDetails } = await supabase.from('company_info').select('*').maybeSingle();
      const companyName = companyDetails?.company_name || 'AZ Marine';
      const customerName = repairRequest.customer_name || 'Valued Customer';
      const yachtName = repairRequest.yachts?.name || '';
      const depositAmount = parseFloat(repairRequest.deposit_amount || 0).toFixed(2);

      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 32px 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
          .next-steps { background: #ecfdf5; padding: 16px; border-radius: 8px; border-left: 4px solid #059669; margin: 16px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .badge { display: inline-block; background: #059669; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
        </style></head><body>
        <div class="container">
          <div class="header">
            <div style="font-size: 48px; margin-bottom: 8px;">&#10003;</div>
            <h1 style="margin: 0; font-size: 24px;">Deposit Confirmed</h1>
            ${yachtName ? `<p style="margin: 8px 0 0 0; opacity: 0.9;">${yachtName}</p>` : ''}
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Your deposit payment has been successfully received. Thank you!</p>
            <div class="card">
              <h3 style="margin-top: 0; color: #059669;">Deposit Receipt</h3>
              <p><strong>Service:</strong> ${repairRequest.title}</p>
              ${yachtName ? `<p><strong>Vessel:</strong> ${yachtName}</p>` : ''}
              <p><strong>Deposit Amount:</strong> <span style="font-size: 20px; color: #059669; font-weight: bold;">$${depositAmount}</span></p>
              <p><strong>Payment Date:</strong> ${new Date(repairRequest.deposit_paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p style="margin-bottom: 0;"><span class="badge">DEPOSIT PAID</span></p>
            </div>
            <div class="next-steps">
              <strong>What happens next?</strong><br>
              Our team will begin work on your service immediately. You will be notified once the work is complete and the final invoice is ready.
            </div>
            <p>A separate receipt has also been sent to you by Stripe for your records.</p>
            <p>Thank you for choosing <strong>${companyName}</strong>.</p>
          </div>
          <div class="footer"><p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p></div>
        </div></body></html>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [customerEmail],
          subject: `Deposit Confirmed - ${repairRequest.title}`,
          html,
          tags: [{ name: 'category', value: 'deposit_confirmation' }, { name: 'repair_request_id', value: payment_id }],
        }),
      });

      if (!emailResponse.ok) throw new Error('Failed to send email');

      const emailData = await emailResponse.json();
      await supabase.from('repair_requests').update({
        deposit_confirmation_email_sent_at: new Date().toISOString(),
        deposit_confirmation_resend_id: emailData.id,
      }).eq('id', payment_id);

      return new Response(JSON.stringify({ success: true, message: 'Deposit confirmation email sent', email_id: emailData.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Estimating invoice payment confirmation ────────────────────────────
    if (payment_type === 'estimating_invoice') {
      const { data: invoice } = await supabase
        .from('estimating_invoices')
        .select('*, yachts(name), work_orders(work_order_number, id)')
        .eq('id', payment_id)
        .single();

      if (!invoice) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!invoice.final_payment_paid_at) {
        return new Response(JSON.stringify({ error: 'Invoice has not been paid yet' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const customerEmail = invoice.customer_email;
      if (!customerEmail) {
        return new Response(JSON.stringify({ error: 'No customer email found' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: companyDetails } = await supabase.from('company_info').select('*').maybeSingle();
      const { data: companyInfo } = await supabase.from('companies').select('name').eq('id', invoice.company_id).maybeSingle();
      const mergedCompany = {
        ...(companyDetails || {}),
        company_name: companyDetails?.company_name || companyInfo?.name || 'AZ Marine',
      };

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

      const pdfBytes = await buildReceiptPDF(invoice, tasks, lineItems, mergedCompany);
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

      const customerName = invoice.customer_name || 'Valued Customer';
      const yachtName = invoice.yachts?.name || '';
      const companyName = mergedCompany.company_name;
      const paidInFull = invoice.payment_status === 'paid';
      const balanceDue = Math.max(0, Number(invoice.balance_due ?? 0));
      const methodLabel = invoice.final_payment_method_type === 'ach' ? 'ACH Bank Transfer' : 'Credit/Debit Card';

      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 32px 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
          .balance-note { background: #fef3c7; padding: 14px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 16px 0; }
          .attachment-note { background: #ecfdf5; border-left: 4px solid #059669; padding: 12px; border-radius: 4px; font-size: 14px; margin: 16px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .badge { display: inline-block; background: #059669; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
        </style></head><body>
        <div class="container">
          <div class="header">
            <div style="font-size: 48px; margin-bottom: 8px;">&#10003;</div>
            <h1 style="margin: 0; font-size: 24px;">Payment Confirmed</h1>
            ${yachtName ? `<p style="margin: 8px 0 0 0; opacity: 0.9;">${yachtName}</p>` : ''}
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Your payment has been successfully processed. Thank you!</p>
            <div class="card">
              <h3 style="margin-top: 0; color: #059669;">Payment Receipt</h3>
              <p><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
              ${invoice.work_orders?.work_order_number ? `<p><strong>Work Order:</strong> ${invoice.work_orders.work_order_number}</p>` : ''}
              ${yachtName ? `<p><strong>Vessel:</strong> ${yachtName}</p>` : ''}
              <p><strong>Amount Paid:</strong> <span style="font-size: 20px; color: #059669; font-weight: bold;">$${Number(invoice.amount_paid || 0).toFixed(2)}</span></p>
              <p><strong>Payment Method:</strong> ${methodLabel}</p>
              <p><strong>Payment Date:</strong> ${new Date(invoice.final_payment_paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              ${paidInFull
                ? `<p style="margin-bottom: 0;"><span class="badge">PAID IN FULL</span></p>`
                : `<p><strong>Remaining Balance:</strong> $${balanceDue.toFixed(2)}</p>`
              }
            </div>
            <div class="attachment-note">
              <strong>A PDF receipt is attached</strong> to this email for your records.
            </div>
            ${!paidInFull ? `
            <div class="balance-note">
              <strong>Remaining balance of $${balanceDue.toFixed(2)}</strong> is still outstanding. You will receive a separate payment request for the remaining amount.
            </div>` : ''}
            <p>A separate receipt has also been sent to you by Stripe for your records.</p>
            <p>Thank you for choosing <strong>${companyName}</strong>.</p>
          </div>
          <div class="footer"><p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p></div>
        </div></body></html>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [customerEmail],
          subject: `Payment Confirmed - Invoice ${invoice.invoice_number}`,
          html,
          attachments: [{ filename: `Receipt-Invoice-${invoice.invoice_number}.pdf`, content: pdfBase64 }],
          tags: [{ name: 'category', value: 'payment_confirmation' }, { name: 'invoice_id', value: payment_id }],
        }),
      });

      if (!emailResponse.ok) throw new Error('Failed to send email');

      const emailData = await emailResponse.json();
      await supabase.from('estimating_invoices').update({
        final_payment_confirmation_email_sent_at: new Date().toISOString(),
      }).eq('id', payment_id);

      return new Response(JSON.stringify({ success: true, message: 'Payment confirmation email sent', email_id: emailData.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Legacy yacht invoice confirmation ──────────────────────────────────
    if (payment_type === 'invoice') {
      const { data: invoice } = await supabase
        .from('yacht_invoices')
        .select('id, repair_title, invoice_amount, paid_at, stripe_payment_intent_id, payment_email_recipient, yacht_id, yachts(name), repair_requests(is_retail_customer, customer_email, customer_name)')
        .eq('id', payment_id)
        .single();

      if (!invoice) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!invoice.paid_at) {
        return new Response(JSON.stringify({ error: 'Invoice has not been paid yet' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const repairRequest = invoice.repair_requests;
      const customerEmail = repairRequest?.customer_email || invoice.payment_email_recipient;
      if (!customerEmail) {
        return new Response(JSON.stringify({ error: 'No customer email found' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: companyDetails } = await supabase.from('company_info').select('*').maybeSingle();
      const companyName = companyDetails?.company_name || 'AZ Marine';
      const customerName = repairRequest?.customer_name || 'Valued Customer';
      const yachtName = invoice.yachts?.name || '';

      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 32px 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .badge { display: inline-block; background: #059669; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
        </style></head><body>
        <div class="container">
          <div class="header">
            <div style="font-size: 48px; margin-bottom: 8px;">&#10003;</div>
            <h1 style="margin: 0; font-size: 24px;">Payment Confirmed</h1>
            ${yachtName ? `<p style="margin: 8px 0 0 0; opacity: 0.9;">${yachtName}</p>` : ''}
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Your payment has been successfully processed. Thank you!</p>
            <div class="card">
              <h3 style="margin-top: 0; color: #059669;">Payment Receipt</h3>
              <p><strong>Service:</strong> ${invoice.repair_title || 'Service'}</p>
              ${yachtName ? `<p><strong>Vessel:</strong> ${yachtName}</p>` : ''}
              <p><strong>Amount Paid:</strong> <span style="font-size: 20px; color: #059669; font-weight: bold;">${invoice.invoice_amount || '$0.00'}</span></p>
              <p><strong>Payment Date:</strong> ${new Date(invoice.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p style="margin-bottom: 0;"><span class="badge">PAID IN FULL</span></p>
            </div>
            <p>A separate receipt has also been sent to you by Stripe for your records.</p>
            <p>Thank you for choosing <strong>${companyName}</strong>.</p>
          </div>
          <div class="footer"><p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p></div>
        </div></body></html>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [customerEmail],
          subject: `Payment Confirmed - ${invoice.repair_title}`,
          html,
          tags: [{ name: 'category', value: 'payment_confirmation' }, { name: 'invoice_id', value: payment_id }],
        }),
      });

      if (!emailResponse.ok) throw new Error('Failed to send email');

      const emailData = await emailResponse.json();
      await supabase.from('yacht_invoices').update({
        payment_confirmation_email_sent_at: new Date().toISOString(),
        payment_confirmation_resend_id: emailData.id,
      }).eq('id', payment_id);

      return new Response(JSON.stringify({ success: true, message: 'Payment confirmation email sent', email_id: emailData.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid payment_type' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
