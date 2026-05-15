import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OwnerRepairNotificationRequest {
  repairRequestId: string;
  repairTitle: string;
  repairDescription?: string;
  yachtName: string;
  submitterName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: OwnerRepairNotificationRequest = await req.json();
    const { repairRequestId, repairTitle, repairDescription, yachtName, submitterName } = payload;

    if (!repairRequestId) {
      throw new Error('Repair request ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: staffUsers, error: staffError } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name, email, phone, notification_email, notification_phone, email_notifications_enabled, sms_notifications_enabled, role')
      .in('role', ['staff', 'master'])
      .eq('is_active', true);

    if (staffError) throw staffError;

    if (!staffUsers || staffUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No staff/master users to notify', emailsSent: 0, smsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://yourdomain.com';
    let fromEmail = (Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev').trim();

    const emailRecipients: Array<{ email: string; name: string }> = [];
    const smsRecipients: Array<{ phone: string; name: string }> = [];

    for (const user of staffUsers) {
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Team Member';

      if (user.email_notifications_enabled !== false) {
        const emailAddress = user.notification_email || user.email;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailAddress && emailRegex.test(emailAddress)) {
          emailRecipients.push({ email: emailAddress, name: userName });
        }
      }

      if (user.sms_notifications_enabled) {
        const phoneNumber = user.notification_phone || user.phone;
        if (phoneNumber) {
          smsRecipients.push({ phone: phoneNumber, name: userName });
        }
      }
    }

    const subject = `Owner Repair Request: ${repairTitle} — ${yachtName}`;
    const smsBody = `NEW OWNER REQUEST: "${repairTitle}" submitted for ${yachtName} by ${submitterName}. Log in to review.`;

    let emailsSent = 0;
    let smsSent = 0;

    if (resendApiKey && emailRecipients.length > 0) {
      const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
      if (!emailFormatRegex.test(fromEmail)) {
        fromEmail = 'onboarding@resend.dev';
      }

      const descriptionBlock = repairDescription
        ? `<p style="margin: 0;"><strong>Description:</strong> ${repairDescription}</p>`
        : '';

      for (const recipient of emailRecipients) {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .alert-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
              .view-button { display: inline-block; background: #0369a1; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; font-size: 16px; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Owner Repair Request</h1>
                <p style="margin: 10px 0 0 0;">Action Required</p>
              </div>
              <div class="content">
                <p>Hello ${recipient.name},</p>
                <div class="alert-box">
                  <p style="margin: 0; font-weight: bold;">An owner has submitted a new repair request and it requires your attention.</p>
                </div>
                <div class="details">
                  <h3 style="margin-top: 0; color: #0369a1;">Request Details</h3>
                  <p style="margin: 0;"><strong>Yacht:</strong> ${yachtName}</p>
                  <p style="margin: 8px 0 0 0;"><strong>Submitted By:</strong> ${submitterName}</p>
                  <p style="margin: 8px 0 0 0;"><strong>Title:</strong> ${repairTitle}</p>
                  ${descriptionBlock}
                  <p style="margin: 8px 0 0 0;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <p style="text-align: center; margin: 25px 0;">
                  <a href="${siteUrl}" class="view-button" style="color: white;">View Request</a>
                </p>
                <p>Please review and take appropriate action.</p>
                <p>Best regards,<br>Yacht Management System</p>
              </div>
              <div class="footer">
                <p>This is an automated notification. Please do not reply to this email.</p>
                <p>&copy; ${new Date().getFullYear()} Yacht Management System</p>
              </div>
            </div>
          </body>
          </html>
        `;

        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [recipient.email],
              subject,
              html: htmlContent,
              tags: [{ name: 'category', value: 'owner-repair-request' }],
            }),
          });

          if (emailResponse.ok) {
            emailsSent++;
          } else {
            const errText = await emailResponse.text();
            console.error(`Email failed for ${recipient.email}:`, errText);
          }
        } catch (err) {
          console.error(`Email error for ${recipient.email}:`, err);
        }
      }
    }

    if (twilioAccountSid && twilioAuthToken && twilioPhone && smsRecipients.length > 0) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      for (const recipient of smsRecipients) {
        try {
          const formData = new URLSearchParams({
            To: recipient.phone,
            From: twilioPhone,
            Body: smsBody,
          });

          const smsResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          });

          if (smsResponse.ok) {
            smsSent++;
          } else {
            const errText = await smsResponse.text();
            console.error(`SMS failed for ${recipient.phone}:`, errText);
          }
        } catch (err) {
          console.error(`SMS error for ${recipient.phone}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${emailsSent} email(s) and ${smsSent} SMS for owner repair request`,
        emailsSent,
        smsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-owner-repair-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
