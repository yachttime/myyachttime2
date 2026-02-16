import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  repairRequestId: string;
  recipientEmail: string;
  recipientName?: string;
  recaptchaToken?: string;
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

    const { repairRequestId, recipientEmail, recipientName, recaptchaToken }: EmailRequest = await req.json();

    if (!repairRequestId || !recipientEmail) {
      throw new Error('Repair request ID and recipient email are required');
    }

    // Verify reCAPTCHA token (anti-fraud compliance requirement)
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

      console.log('reCAPTCHA verified successfully for deposit request email');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address');
    }

    // Fetch repair request details
    const { data: repairRequest, error: repairError } = await supabase
      .from('repair_requests')
      .select('*, yachts(name)')
      .eq('id', repairRequestId)
      .single();

    if (repairError || !repairRequest) {
      throw new Error('Repair request not found');
    }

    if (!repairRequest.deposit_payment_link_url) {
      throw new Error('Deposit payment link not generated yet');
    }

    // Check if user has access to this repair request
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, yacht_id')
      .eq('user_id', user.id)
      .single();

    const isRetailCustomer = repairRequest.is_retail_customer;
    const hasAccess = profile?.role === 'staff' ||
                      profile?.role === 'master' ||
                      (!isRetailCustomer && profile?.role === 'manager' && profile?.yacht_id === repairRequest.yacht_id);

    if (!hasAccess) {
      throw new Error('Unauthorized to send this deposit request');
    }

    const yachtName = repairRequest.yachts?.name || (isRetailCustomer ? 'your vessel' : 'Your Yacht');
    const subject = `Deposit Request: ${repairRequest.title}`;
    const depositAmount = repairRequest.deposit_amount ? `$${parseFloat(repairRequest.deposit_amount).toFixed(2)}` : '$0.00';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .button:hover { background: #2563eb; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .highlight { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 4px; font-size: 14px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Deposit Request</h1>
            ${!isRetailCustomer ? `<p style="margin: 10px 0 0 0;">${yachtName}</p>` : ''}
          </div>
          <div class="content">
            <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>

            <p>To begin work on ${isRetailCustomer ? 'your approved repair request' : `your approved repair request for <strong>${yachtName}</strong>`}, we require a deposit payment.</p>

            <div class="details">
              <h3 style="margin-top: 0; color: #3b82f6;">Repair Details</h3>
              <p><strong>Service:</strong> ${repairRequest.title}</p>
              ${repairRequest.description ? `<p><strong>Description:</strong> ${repairRequest.description}</p>` : ''}
              ${repairRequest.estimated_repair_cost ? `<p><strong>Estimated Total Cost:</strong> ${repairRequest.estimated_repair_cost}</p>` : ''}
              <p><strong>Deposit Required:</strong> <span style="font-size: 20px; color: #3b82f6; font-weight: bold;">${depositAmount}</span></p>
            </div>

            <div class="highlight">
              <strong>Why we need a deposit:</strong> This deposit secures your spot in our schedule and covers initial materials and parts needed to begin your repair work.
            </div>

            <p>Please click the button below to securely pay the deposit via Stripe:</p>

            <div style="text-align: center;">
              <a href="${repairRequest.deposit_payment_link_url}" class="button" style="color: white;">Pay Deposit Now</a>
            </div>

            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:<br>
            <a href="${repairRequest.deposit_payment_link_url}" style="color: #3b82f6; word-break: break-all;">${repairRequest.deposit_payment_link_url}</a></p>

            <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; font-size: 14px;">
              <strong>Important:</strong> For security reasons, this payment link expires in 7 days. Work will begin once the deposit is received.
            </p>

            <p>Once your deposit is received, we will begin work on your repair immediately. The remaining balance will be due upon completion.</p>

            <p>If you have any questions about this deposit request, please don't hesitate to contact us.</p>

            <p>Thank you for choosing our service.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Yacht Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email using Resend if API key is configured
    if (resendApiKey) {
      let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
      fromEmail = fromEmail.trim();

      // Validate the from email format
      const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
      if (!emailFormatRegex.test(fromEmail)) {
        console.error('Invalid RESEND_FROM_EMAIL format:', fromEmail);
        throw new Error(`Invalid from email format: "${fromEmail}". Expected format: "email@example.com" or "Name <email@example.com>"`);
      }

      console.log('Using from email:', fromEmail);

      // Fetch secondary email for CC if yacht is assigned
      let ccEmails: string[] = [];
      if (repairRequest.yacht_id) {
        const { data: ownerProfiles } = await supabase
          .from('user_profiles')
          .select('secondary_email')
          .eq('yacht_id', repairRequest.yacht_id)
          .eq('role', 'owner')
          .not('secondary_email', 'is', null);

        if (ownerProfiles && ownerProfiles.length > 0) {
          ccEmails = ownerProfiles
            .map(p => p.secondary_email)
            .filter((email): email is string => !!email && email !== recipientEmail);
        }
      }

      const emailPayload: any = {
        from: fromEmail,
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
        tags: [
          {
            name: 'category',
            value: 'deposit-request',
          },
        ],
      };

      if (ccEmails.length > 0) {
        emailPayload.cc = ccEmails;
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
        console.error('Resend API error:', errorText);
        throw new Error(`Failed to send email: ${errorText}`);
      }

      const emailData = await response.json();
      console.log('Email sent successfully:', emailData.id);

      // Update repair request with email tracking info
      await supabase
        .from('repair_requests')
        .update({
          deposit_email_sent_at: new Date().toISOString(),
          deposit_resend_email_id: emailData.id,
          deposit_email_recipient: recipientEmail,
        })
        .eq('id', repairRequestId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Deposit request email sent successfully',
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
      throw new Error('Email service not configured');
    }
  } catch (error) {
    console.error('Error sending deposit request email:', error);
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
