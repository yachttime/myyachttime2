import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import PDFDocument from 'npm:pdfkit@0.15.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, Stripe-Signature',
};

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_intent?: string;
      payment_status?: string;
      metadata?: {
        invoice_id?: string;
        repair_request_id?: string;
        work_order_id?: string;
        payment_type?: string;
        yacht_id?: string;
        user_id?: string;
      };
      amount_total?: number;
      payment_method_types?: string[];
    };
  };
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
    if (addrParts.length > 0) doc.text(addrParts.join('\n'));

    // Receipt title block
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

    // Paid stamp
    const stampY = dividerY + 8;
    doc.rect(margin, stampY, 120, 28).strokeColor('#059669').lineWidth(2).stroke();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#059669')
      .text('PAID IN FULL', margin + 4, stampY + 7, { width: 112, align: 'center' });

    // Bill To
    const billToY = stampY;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555').text('BILL TO', pageWidth - margin - 200, billToY);
    doc.font('Helvetica').fontSize(10).fillColor('#333333').text(invoice.customer_name || '', pageWidth - margin - 200, billToY + 13);
    if (invoice.customer_email) doc.fontSize(9).text(invoice.customer_email, pageWidth - margin - 200, doc.y);
    if (invoice.customer_phone) doc.text(invoice.customer_phone, pageWidth - margin - 200, doc.y);
    if (invoice.yachts?.name) doc.text(`Vessel: ${invoice.yachts.name}`, pageWidth - margin - 200, doc.y);

    // Line items table
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
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
        .text('No line items', margin + 4, rowY + 8, { width: contentWidth });
      rowY += 24;
    }

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

async function deactivatePaymentLink(stripeSecretKey: string, linkId: string): Promise<void> {
  try {
    await fetch(`https://api.stripe.com/v1/payment_links/${linkId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ 'active': 'false' }).toString(),
    });
    console.log('Deactivated payment link:', linkId);
  } catch (err) {
    console.error('Error deactivating payment link:', err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) throw new Error('Stripe secret key not configured');

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    if (stripeWebhookSecret && signature) {
      const elements = signature.split(',');
      const timestamp = elements.find(e => e.startsWith('t='))?.substring(2);
      const signatureHash = elements.find(e => e.startsWith('v1='))?.substring(3);

      if (!timestamp || !signatureHash) throw new Error('Invalid signature format');

      const payload = `${timestamp}.${body}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(stripeWebhookSecret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const expectedSignature = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      if (expectedSignature !== signatureHash) throw new Error('Invalid signature');
    }

    const event: StripeEvent = JSON.parse(body);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    console.log('Processing Stripe webhook event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      const repairRequestId = session.metadata?.repair_request_id;
      const workOrderId = session.metadata?.work_order_id;
      const paymentType = session.metadata?.payment_type;
      const yachtId = session.metadata?.yacht_id;

      // ── Repair request deposit ──────────────────────────────────────────────
      if (paymentType === 'deposit' && repairRequestId) {
        console.log('Processing deposit payment for repair request:', repairRequestId);

        const { data: existingRequest } = await supabase
          .from('repair_requests')
          .select('deposit_payment_status, deposit_paid_at, deposit_stripe_payment_intent_id')
          .eq('id', repairRequestId)
          .single();

        if (existingRequest?.deposit_payment_status === 'paid' && existingRequest.deposit_paid_at) {
          await supabase.from('admin_notifications').insert({
            message: `DUPLICATE DEPOSIT PAYMENT detected for repair ${repairRequestId.substring(0, 8)}. Original: ${existingRequest.deposit_stripe_payment_intent_id}. New: ${session.payment_intent}. Please review and refund if necessary.`,
            yacht_id: yachtId || null,
            reference_id: repairRequestId,
            created_at: new Date().toISOString(),
          });
          return new Response(JSON.stringify({ received: true, warning: 'Duplicate payment detected' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let paymentMethod = session.payment_method_types?.[0] || 'card';
        const paymentIntentId = session.payment_intent;

        if (paymentIntentId) {
          try {
            const piResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
              headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
            });
            if (piResponse.ok) {
              const piData = await piResponse.json();
              paymentMethod = piData.charges?.data?.[0]?.payment_method_details?.type || paymentMethod;
            }
          } catch (err) { console.error('Error fetching payment intent:', err); }
        }

        const { data: updatedRequest } = await supabase
          .from('repair_requests')
          .update({
            deposit_payment_status: 'paid',
            deposit_paid_at: new Date().toISOString(),
            deposit_stripe_payment_intent_id: paymentIntentId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', repairRequestId)
          .eq('deposit_payment_status', 'pending')
          .select('deposit_stripe_checkout_session_id')
          .single();

        if (updatedRequest?.deposit_stripe_checkout_session_id) {
          await deactivatePaymentLink(stripeSecretKey, updatedRequest.deposit_stripe_checkout_session_id);
        }

        const { data: repairRequest } = await supabase
          .from('repair_requests')
          .select('title, deposit_amount, deposit_email_recipient, yachts(name), is_retail_customer, customer_email, customer_name')
          .eq('id', repairRequestId)
          .single();

        await supabase.from('admin_notifications').insert({
          message: `Deposit received for ${repairRequest?.title || 'repair'} - $${parseFloat(repairRequest?.deposit_amount || 0).toFixed(2)}`,
          yacht_id: yachtId || null,
          reference_id: repairRequestId,
          created_at: new Date().toISOString(),
        });

        if (yachtId) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: yachtId,
            sender_role: 'staff',
            message: `Deposit payment confirmed for ${repairRequest?.title || 'repair'} - $${parseFloat(repairRequest?.deposit_amount || 0).toFixed(2)}. Work will begin shortly!`,
            created_at: new Date().toISOString(),
          });
        }

        const customerEmail = repairRequest?.customer_email || repairRequest?.deposit_email_recipient;
        const customerName = repairRequest?.customer_name || 'Valued Customer';
        const yachtName = repairRequest?.yachts?.name || '';

        if (customerEmail && resendApiKey) {
          try {
            const { data: companyDetails } = await supabase.from('company_info').select('*').maybeSingle();
            const companyName = companyDetails?.company_name || 'AZ Marine';

            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: (Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com').trim(),
                to: [customerEmail],
                subject: `Deposit Confirmed - ${repairRequest?.title}`,
                html: buildDepositConfirmationHtml({
                  customerName,
                  title: repairRequest?.title || 'Repair Service',
                  depositAmount: parseFloat(repairRequest?.deposit_amount || 0).toFixed(2),
                  yachtName,
                  paymentMethod,
                  paidAt: new Date().toISOString(),
                  companyName,
                }),
                tags: [
                  { name: 'category', value: 'deposit_confirmation' },
                  { name: 'repair_request_id', value: repairRequestId },
                ],
              }),
            });

            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              await supabase.from('repair_requests').update({
                deposit_confirmation_email_sent_at: new Date().toISOString(),
                deposit_confirmation_resend_id: emailData.id,
              }).eq('id', repairRequestId);
            }
          } catch (emailError) { console.error('Error sending deposit confirmation email:', emailError); }
        }

        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── Work order deposit ──────────────────────────────────────────────────
      if (paymentType === 'work_order_deposit' && workOrderId) {
        console.log('Processing deposit payment for work order:', workOrderId);

        const { data: existingWorkOrder } = await supabase
          .from('work_orders')
          .select('deposit_payment_status, deposit_paid_at, deposit_stripe_payment_intent_id')
          .eq('id', workOrderId)
          .single();

        if (existingWorkOrder?.deposit_payment_status === 'paid' && existingWorkOrder.deposit_paid_at) {
          await supabase.from('admin_notifications').insert({
            message: `DUPLICATE DEPOSIT PAYMENT detected for work order ${workOrderId.substring(0, 8)}. Original: ${existingWorkOrder.deposit_stripe_payment_intent_id}. New: ${session.payment_intent}. Please review and refund if necessary.`,
            yacht_id: yachtId || null,
            reference_id: workOrderId,
            created_at: new Date().toISOString(),
          });
          return new Response(JSON.stringify({ received: true, warning: 'Duplicate payment detected' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let paymentMethod = session.payment_method_types?.[0] || 'card';
        const paymentIntentId = session.payment_intent;

        if (paymentIntentId) {
          try {
            const piResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
              headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
            });
            if (piResponse.ok) {
              const piData = await piResponse.json();
              paymentMethod = piData.charges?.data?.[0]?.payment_method_details?.type || paymentMethod;
            }
          } catch (err) { console.error('Error fetching payment intent:', err); }
        }

        const { data: updatedWorkOrder } = await supabase
          .from('work_orders')
          .update({
            deposit_payment_status: 'paid',
            deposit_paid_at: new Date().toISOString(),
            deposit_stripe_payment_intent_id: paymentIntentId || null,
            deposit_payment_method_type: paymentMethod === 'us_bank_account' ? 'ach' : 'card',
            updated_at: new Date().toISOString(),
          })
          .eq('id', workOrderId)
          .eq('deposit_payment_status', 'pending')
          .select('work_order_number, deposit_stripe_checkout_session_id')
          .single();

        if (updatedWorkOrder?.deposit_stripe_checkout_session_id) {
          await deactivatePaymentLink(stripeSecretKey, updatedWorkOrder.deposit_stripe_checkout_session_id);
        }

        const { data: workOrder } = await supabase
          .from('work_orders')
          .select('work_order_number, deposit_amount, customer_name, customer_email, yachts(name)')
          .eq('id', workOrderId)
          .single();

        await supabase.from('admin_notifications').insert({
          message: `Deposit received for Work Order ${workOrder?.work_order_number || workOrderId.substring(0, 8)} - $${parseFloat(workOrder?.deposit_amount || 0).toFixed(2)}`,
          yacht_id: yachtId || null,
          reference_id: workOrderId,
          created_at: new Date().toISOString(),
        });

        if (yachtId) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: yachtId,
            sender_role: 'staff',
            message: `Deposit payment confirmed for Work Order ${workOrder?.work_order_number} - $${parseFloat(workOrder?.deposit_amount || 0).toFixed(2)}. Work will begin shortly!`,
            created_at: new Date().toISOString(),
          });
        }

        const customerEmail = workOrder?.customer_email;
        const customerName = workOrder?.customer_name || 'Valued Customer';
        const yachtName = workOrder?.yachts?.name || '';

        if (customerEmail && resendApiKey) {
          try {
            const { data: companyDetails } = await supabase.from('company_info').select('*').maybeSingle();
            const companyName = companyDetails?.company_name || 'AZ Marine';

            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: (Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com').trim(),
                to: [customerEmail],
                subject: `Deposit Confirmed - Work Order ${workOrder?.work_order_number}`,
                html: buildDepositConfirmationHtml({
                  customerName,
                  title: `Work Order ${workOrder?.work_order_number}`,
                  depositAmount: parseFloat(workOrder?.deposit_amount || 0).toFixed(2),
                  yachtName,
                  paymentMethod,
                  paidAt: new Date().toISOString(),
                  companyName,
                }),
                tags: [
                  { name: 'category', value: 'deposit_confirmation' },
                  { name: 'work_order_id', value: workOrderId },
                ],
              }),
            });

            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              await supabase.from('work_orders').update({
                deposit_confirmation_email_sent_at: new Date().toISOString(),
              }).eq('id', workOrderId);
              console.log(`Deposit confirmation email sent, ID: ${emailData.id}`);
            }
          } catch (emailError) { console.error('Error sending deposit confirmation email:', emailError); }
        }

        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── Estimating invoice payment ──────────────────────────────────────────
      if (paymentType === 'estimating_invoice_payment' && invoiceId) {
        console.log('Processing payment for estimating invoice:', invoiceId);

        const { data: existingInvoice } = await supabase
          .from('estimating_invoices')
          .select('payment_status, balance_due, amount_paid')
          .eq('id', invoiceId)
          .single();

        if (existingInvoice?.payment_status === 'paid' && existingInvoice.balance_due === 0) {
          await supabase.from('admin_notifications').insert({
            message: `DUPLICATE INVOICE PAYMENT detected for estimating invoice ${invoiceId.substring(0, 8)}. Please review and refund if necessary.`,
            yacht_id: yachtId || null,
            reference_id: invoiceId,
            created_at: new Date().toISOString(),
          });
          return new Response(JSON.stringify({ received: true, warning: 'Duplicate payment detected' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let paymentMethod = session.payment_method_types?.[0] || 'card';
        const paymentIntentId = session.payment_intent;
        const amountPaid = (session.amount_total || 0) / 100;

        if (paymentIntentId) {
          try {
            const piResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
              headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
            });
            if (piResponse.ok) {
              const piData = await piResponse.json();
              paymentMethod = piData.charges?.data?.[0]?.payment_method_details?.type || paymentMethod;
            }
          } catch (err) { console.error('Error fetching payment intent:', err); }
        }

        const { data: invoice } = await supabase
          .from('estimating_invoices')
          .select('*, yachts(name), work_orders(work_order_number, id)')
          .eq('id', invoiceId)
          .single();

        const newAmountPaid = (invoice?.amount_paid || 0) + amountPaid;
        const newBalanceDue = Math.max(0, invoice?.total_amount - invoice?.deposit_applied - newAmountPaid);
        const newPaymentStatus = newBalanceDue <= 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid';

        await supabase
          .from('estimating_invoices')
          .update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            payment_status: newPaymentStatus,
            final_payment_stripe_payment_intent_id: paymentIntentId || null,
            final_payment_paid_at: new Date().toISOString(),
            final_payment_method_type: paymentMethod === 'us_bank_account' ? 'ach' : 'card',
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        // Deactivate the payment link so it cannot be used again
        if (invoice?.final_payment_stripe_checkout_session_id) {
          await deactivatePaymentLink(stripeSecretKey, invoice.final_payment_stripe_checkout_session_id);
        }

        await supabase.from('admin_notifications').insert({
          message: `Payment received for Invoice ${invoice?.invoice_number} - $${amountPaid.toFixed(2)} ${newPaymentStatus === 'paid' ? '(PAID IN FULL)' : ''}`,
          yacht_id: yachtId || null,
          reference_id: invoiceId,
          created_at: new Date().toISOString(),
        });

        if (yachtId) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: yachtId,
            sender_role: 'staff',
            message: `Payment confirmed for Invoice ${invoice?.invoice_number} - $${amountPaid.toFixed(2)}. ${newPaymentStatus === 'paid' ? 'Paid in full. Thank you!' : `Balance remaining: $${newBalanceDue.toFixed(2)}`}`,
            created_at: new Date().toISOString(),
          });
        }

        const customerEmail = invoice?.customer_email;
        const customerName = invoice?.customer_name || 'Valued Customer';

        if (customerEmail && resendApiKey) {
          try {
            const { data: companyDetails } = await supabase.from('company_info').select('*').maybeSingle();
            const { data: companyInfo } = await supabase.from('companies').select('name').eq('id', invoice.company_id).maybeSingle();
            const mergedCompany = {
              ...(companyDetails || {}),
              company_name: companyDetails?.company_name || companyInfo?.name || 'AZ Marine',
            };

            // Fetch line items for PDF receipt
            let tasks: WorkOrderTask[] = [];
            let lineItems: WorkOrderLineItem[] = [];
            const workOrderId2 = invoice.work_orders?.id || invoice.work_order_id;

            if (workOrderId2) {
              const [tasksRes, lineItemsRes] = await Promise.all([
                supabase.from('work_order_tasks').select('id, task_name, task_order').eq('work_order_id', workOrderId2).order('task_order'),
                supabase.from('work_order_line_items').select('id, task_id, line_type, description, quantity, unit_price, total_price, work_details, line_order').eq('work_order_id', workOrderId2).order('line_order'),
              ]);
              tasks = tasksRes.data || [];
              lineItems = lineItemsRes.data || [];
            }

            const updatedInvoice = {
              ...invoice,
              amount_paid: newAmountPaid,
              balance_due: newBalanceDue,
              final_payment_paid_at: new Date().toISOString(),
            };

            const pdfBytes = await buildReceiptPDF(updatedInvoice, tasks, lineItems, mergedCompany);
            const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: (Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com').trim(),
                to: [customerEmail],
                subject: `Payment Confirmed - Invoice ${invoice?.invoice_number}`,
                html: buildInvoiceConfirmationHtml({
                  customerName,
                  invoiceNumber: invoice?.invoice_number,
                  workOrderNumber: invoice?.work_orders?.work_order_number,
                  amountPaid,
                  yachtName: invoice?.yachts?.name || '',
                  paymentMethod,
                  newPaymentStatus,
                  newBalanceDue,
                  paidAt: new Date().toISOString(),
                  companyName: mergedCompany.company_name,
                }),
                attachments: [{
                  filename: `Receipt-Invoice-${invoice?.invoice_number}.pdf`,
                  content: pdfBase64,
                }],
                tags: [
                  { name: 'category', value: 'payment_confirmation' },
                  { name: 'invoice_id', value: invoiceId },
                ],
              }),
            });

            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              await supabase.from('estimating_invoices').update({
                final_payment_confirmation_email_sent_at: new Date().toISOString(),
              }).eq('id', invoiceId);
              console.log(`Payment confirmation email sent to ${customerEmail}, ID: ${emailData.id}`);
            }
          } catch (emailError) { console.error('Error sending payment confirmation email:', emailError); }
        }

        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── Legacy yacht invoice payments ───────────────────────────────────────
      if (!invoiceId) {
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: existingInvoice } = await supabase
        .from('yacht_invoices')
        .select('payment_status, paid_at, stripe_payment_intent_id')
        .eq('id', invoiceId)
        .single();

      if (existingInvoice?.payment_status === 'paid' && existingInvoice.paid_at) {
        await supabase.from('admin_notifications').insert({
          message: `DUPLICATE INVOICE PAYMENT detected for invoice ${invoiceId.substring(0, 8)}. Original: ${existingInvoice.stripe_payment_intent_id}. New: ${session.payment_intent}. Please review and refund if necessary.`,
          yacht_id: yachtId || null,
          reference_id: invoiceId,
          created_at: new Date().toISOString(),
        });
        return new Response(JSON.stringify({ received: true, warning: 'Duplicate payment detected' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let paymentMethod = session.payment_method_types?.[0] || 'card';
      const paymentIntentId = session.payment_intent;

      if (paymentIntentId) {
        try {
          const piResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
            headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
          });
          if (piResponse.ok) {
            const piData = await piResponse.json();
            paymentMethod = piData.charges?.data?.[0]?.payment_method_details?.type || paymentMethod;
          }
        } catch (err) { console.error('Error fetching payment intent:', err); }
      }

      await supabase.from('yacht_invoices').update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId || null,
        payment_method: paymentMethod,
        updated_at: new Date().toISOString(),
      }).eq('id', invoiceId).eq('payment_status', 'pending');

      const { data: legacyInvoice } = await supabase
        .from('yacht_invoices')
        .select('repair_title, invoice_amount, payment_email_recipient, yachts(name), repair_requests(is_retail_customer, customer_email, customer_name)')
        .eq('id', invoiceId)
        .single();

      await supabase.from('admin_notifications').insert({
        message: `Payment received for ${legacyInvoice?.repair_title || 'invoice'} - ${legacyInvoice?.invoice_amount || '$0.00'}`,
        yacht_id: yachtId || null,
        reference_id: invoiceId,
        created_at: new Date().toISOString(),
      });

      if (yachtId) {
        await supabase.from('owner_chat_messages').insert({
          yacht_id: yachtId,
          sender_role: 'staff',
          message: `Payment confirmed for ${legacyInvoice?.repair_title || 'invoice'} - ${legacyInvoice?.invoice_amount || '$0.00'}. Thank you!`,
          created_at: new Date().toISOString(),
        });
      }

      const legacyRepairRequest = legacyInvoice?.repair_requests;
      const legacyCustomerEmail = legacyRepairRequest?.customer_email || legacyInvoice?.payment_email_recipient;
      const legacyCustomerName = legacyRepairRequest?.customer_name || 'Valued Customer';
      const legacyYachtName = legacyInvoice?.yachts?.name || '';

      if (legacyCustomerEmail && resendApiKey) {
        try {
          const { data: companyDetails } = await supabase.from('company_info').select('*').maybeSingle();
          const companyName = companyDetails?.company_name || 'AZ Marine';

          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: (Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com').trim(),
              to: [legacyCustomerEmail],
              subject: `Payment Confirmed - ${legacyInvoice?.repair_title}`,
              html: buildInvoiceConfirmationHtml({
                customerName: legacyCustomerName,
                invoiceNumber: '',
                workOrderNumber: '',
                amountPaid: parseFloat((legacyInvoice?.invoice_amount || '$0').replace('$', '')) || 0,
                yachtName: legacyYachtName,
                paymentMethod,
                newPaymentStatus: 'paid',
                newBalanceDue: 0,
                paidAt: new Date().toISOString(),
                companyName,
                serviceTitle: legacyInvoice?.repair_title,
              }),
              tags: [
                { name: 'category', value: 'payment_confirmation' },
                { name: 'invoice_id', value: invoiceId },
              ],
            }),
          });

          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            await supabase.from('yacht_invoices').update({
              payment_confirmation_email_sent_at: new Date().toISOString(),
              payment_confirmation_resend_id: emailData.id,
            }).eq('id', invoiceId);
          }
        } catch (emailError) { console.error('Error sending payment confirmation email:', emailError); }
      }
    }

    // ── Backup: payment_intent.succeeded ───────────────────────────────────
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const { data: invoice } = await supabase
        .from('yacht_invoices')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .single();

      if (invoice && invoice.payment_status !== 'paid') {
        await supabase.from('yacht_invoices').update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', invoice.id);
      }
    }

    // ── Failed / expired ────────────────────────────────────────────────────
    if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
      const object = event.data.object;
      const invoiceId = object.metadata?.invoice_id;
      if (invoiceId) {
        await supabase.from('yacht_invoices').update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        }).eq('id', invoiceId);
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildDepositConfirmationHtml(opts: {
  customerName: string;
  title: string;
  depositAmount: string;
  yachtName: string;
  paymentMethod: string;
  paidAt: string;
  companyName: string;
}): string {
  const methodLabel = opts.paymentMethod === 'us_bank_account' ? 'ACH Bank Transfer' : 'Credit/Debit Card';
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 32px 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
      .next-steps { background: #ecfdf5; padding: 16px; border-radius: 8px; border-left: 4px solid #059669; margin: 16px 0; }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
      .badge { display: inline-block; background: #059669; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
    </style>
    </head>
    <body>
    <div class="container">
      <div class="header">
        <div style="font-size: 48px; margin-bottom: 8px;">&#10003;</div>
        <h1 style="margin: 0; font-size: 24px;">Deposit Confirmed</h1>
        ${opts.yachtName ? `<p style="margin: 8px 0 0 0; opacity: 0.9;">${opts.yachtName}</p>` : ''}
      </div>
      <div class="content">
        <p>Hello ${opts.customerName},</p>
        <p>Your deposit payment has been successfully received. Thank you!</p>
        <div class="card">
          <h3 style="margin-top: 0; color: #059669;">Deposit Receipt</h3>
          <p><strong>Service:</strong> ${opts.title}</p>
          ${opts.yachtName ? `<p><strong>Vessel:</strong> ${opts.yachtName}</p>` : ''}
          <p><strong>Deposit Amount:</strong> <span style="font-size: 20px; color: #059669; font-weight: bold;">$${opts.depositAmount}</span></p>
          <p><strong>Payment Method:</strong> ${methodLabel}</p>
          <p><strong>Payment Date:</strong> ${new Date(opts.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p style="margin-bottom: 0;"><span class="badge">DEPOSIT PAID</span></p>
        </div>
        <div class="next-steps">
          <strong>What happens next?</strong><br>
          Our team will begin work on your service immediately. You will be notified once the work is complete and the final invoice is ready.
        </div>
        <p>A separate receipt has also been sent to you by Stripe for your records.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Thank you for choosing <strong>${opts.companyName}</strong>.</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${opts.companyName}. All rights reserved.</p>
      </div>
    </div>
    </body>
    </html>
  `;
}

function buildInvoiceConfirmationHtml(opts: {
  customerName: string;
  invoiceNumber: string;
  workOrderNumber?: string;
  serviceTitle?: string;
  amountPaid: number;
  yachtName: string;
  paymentMethod: string;
  newPaymentStatus: string;
  newBalanceDue: number;
  paidAt: string;
  companyName: string;
}): string {
  const methodLabel = opts.paymentMethod === 'us_bank_account' ? 'ACH Bank Transfer' : 'Credit/Debit Card';
  const paidInFull = opts.newPaymentStatus === 'paid';
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 32px 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
      .balance-note { background: #fef3c7; padding: 14px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 16px 0; }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
      .badge { display: inline-block; background: #059669; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
      .attachment-note { background: #ecfdf5; border-left: 4px solid #059669; padding: 12px; border-radius: 4px; font-size: 14px; margin: 16px 0; }
    </style>
    </head>
    <body>
    <div class="container">
      <div class="header">
        <div style="font-size: 48px; margin-bottom: 8px;">&#10003;</div>
        <h1 style="margin: 0; font-size: 24px;">Payment Confirmed</h1>
        ${opts.yachtName ? `<p style="margin: 8px 0 0 0; opacity: 0.9;">${opts.yachtName}</p>` : ''}
      </div>
      <div class="content">
        <p>Hello ${opts.customerName},</p>
        <p>Your payment has been successfully processed. Thank you!</p>
        <div class="card">
          <h3 style="margin-top: 0; color: #059669;">Payment Receipt</h3>
          ${opts.invoiceNumber ? `<p><strong>Invoice #:</strong> ${opts.invoiceNumber}</p>` : ''}
          ${opts.workOrderNumber ? `<p><strong>Work Order:</strong> ${opts.workOrderNumber}</p>` : ''}
          ${opts.serviceTitle ? `<p><strong>Service:</strong> ${opts.serviceTitle}</p>` : ''}
          ${opts.yachtName ? `<p><strong>Vessel:</strong> ${opts.yachtName}</p>` : ''}
          <p><strong>Amount Paid:</strong> <span style="font-size: 20px; color: #059669; font-weight: bold;">$${opts.amountPaid.toFixed(2)}</span></p>
          <p><strong>Payment Method:</strong> ${methodLabel}</p>
          <p><strong>Payment Date:</strong> ${new Date(opts.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          ${paidInFull
            ? `<p style="margin-bottom: 0;"><span class="badge">PAID IN FULL</span></p>`
            : `<p><strong>Remaining Balance:</strong> $${opts.newBalanceDue.toFixed(2)}</p>`
          }
        </div>
        ${opts.invoiceNumber ? `
        <div class="attachment-note">
          <strong>A PDF receipt is attached</strong> to this email for your records.
        </div>` : ''}
        ${!paidInFull ? `
        <div class="balance-note">
          <strong>Remaining balance of $${opts.newBalanceDue.toFixed(2)}</strong> is still outstanding. You will receive a separate payment request for the remaining amount.
        </div>` : ''}
        <p>A separate receipt has also been sent to you by Stripe.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Thank you for choosing <strong>${opts.companyName}</strong>.</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${opts.companyName}. All rights reserved.</p>
      </div>
    </div>
    </body>
    </html>
  `;
}
