import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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
      .select('*, yachts(name), work_orders(work_order_number)')
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

    const companyName = companyInfo?.name || 'AZ Marine';
    const yachtName = invoice.yachts?.name;
    const workOrderNumber = invoice.work_orders?.work_order_number;

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
              ${invoice.deposit_applied > 0 ? `<p><strong>Deposit Applied:</strong> -$${Number(invoice.deposit_applied).toFixed(2)}</p>` : ''}
              ${invoice.amount_paid > 0 ? `<p><strong>Amount Paid:</strong> -$${Number(invoice.amount_paid).toFixed(2)}</p>` : ''}
              <p><strong>Balance Due:</strong> $${Number(invoice.balance_due || invoice.total_amount).toFixed(2)}</p>
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
