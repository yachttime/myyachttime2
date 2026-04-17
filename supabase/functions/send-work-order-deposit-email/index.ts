import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    const { workOrderId, recipientEmail, recipientName, surchargeCcEmail, surchargeCcNote } = await req.json();

    if (!workOrderId || !recipientEmail) {
      throw new Error('Work order ID and recipient email are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) throw new Error('Invalid email address');

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('*, yachts(name)')
      .eq('id', workOrderId)
      .single();

    if (woError || !workOrder) throw new Error('Work order not found');
    if (!workOrder.deposit_payment_link_url) throw new Error('Deposit payment link not generated yet');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasAccess = profile?.role === 'staff' || profile?.role === 'master' || profile?.role === 'mechanic' || profile?.role === 'manager';
    if (!hasAccess) throw new Error('Unauthorized to send this deposit request');

    const yachtName = workOrder.yachts?.name || workOrder.customer_name || 'your vessel';
    const depositAmount = workOrder.deposit_amount ? `$${parseFloat(workOrder.deposit_amount).toFixed(2)}` : '$0.00';
    const subject = `Deposit Request: Work Order ${workOrder.work_order_number}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2; }
          .button { display: inline-block; background: #0891b2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Deposit Request</h1>
            <p style="margin: 10px 0 0 0;">${yachtName}</p>
          </div>
          <div class="content">
            <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>
            <p>A deposit is required to begin the work on your upcoming service.</p>
            <div class="details">
              <h3 style="margin-top: 0; color: #0891b2;">Work Order Details</h3>
              <p><strong>Work Order:</strong> ${workOrder.work_order_number}</p>
              ${workOrder.is_retail_customer ? `<p><strong>Customer:</strong> ${workOrder.customer_name || ''}</p>` : `<p><strong>Vessel:</strong> ${yachtName}</p>`}
              <p><strong>Deposit Required:</strong> <span style="font-size: 20px; color: #0891b2; font-weight: bold;">${depositAmount}</span></p>
            </div>
            <p>Please click the button below to securely pay the deposit via Stripe:</p>
            <div style="text-align: center;">
              <a href="${workOrder.deposit_payment_link_url}" class="button" style="color: white;">Pay Deposit Now</a>
            </div>
            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:<br>
            <a href="${workOrder.deposit_payment_link_url}" style="color: #0891b2; word-break: break-all;">${workOrder.deposit_payment_link_url}</a></p>
            <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; font-size: 14px;">
              <strong>Important:</strong> This payment link is valid for 30 days. Work will begin once the deposit is received.
            </p>
            <p>If you have any questions, please contact us.</p>
            <p>Thank you for your business.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Marine Service Management</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!resendApiKey) throw new Error('Email service not configured');

    let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    fromEmail = fromEmail.trim();

    const emailPayload: any = {
      from: fromEmail,
      to: [recipientEmail],
      subject,
      html: htmlContent,
      tags: [{ name: 'category', value: 'work-order-deposit-request' }],
    };

    if (surchargeCcEmail) {
      emailPayload.cc = [surchargeCcEmail];
      if (surchargeCcNote) {
        emailPayload.html = htmlContent + `
          <div style="margin-top:24px;padding:14px 18px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;font-family:Arial,sans-serif;font-size:13px;color:#92400e;">
            <strong>Note to Surcharge Department:</strong><br>${surchargeCcNote.replace(/\n/g, '<br>')}
          </div>`;
      }
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailData = await response.json();

    await supabase
      .from('work_orders')
      .update({
        deposit_email_sent_at: new Date().toISOString(),
        deposit_email_recipient: recipientEmail,
      })
      .eq('id', workOrderId);

    return new Response(
      JSON.stringify({ success: true, message: 'Deposit request email sent successfully', emailId: emailData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending work order deposit email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
