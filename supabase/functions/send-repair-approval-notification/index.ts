import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RepairStatusNotification {
  repairRequestId: string;
  repairTitle: string;
  yachtName: string;
  actorName: string;
  eventType: 'approved' | 'rejected' | 'paid';
  estimatedCost?: string;
  finalAmount?: string;
  rejectionReason?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: RepairStatusNotification = await req.json();
    const { repairRequestId, repairTitle, yachtName, actorName, eventType, estimatedCost, finalAmount, rejectionReason } = payload;

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

      if (user.email_notifications_enabled) {
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

    const eventConfig = {
      approved: {
        subject: `Repair Approved: ${repairTitle}`,
        headerColor: '#10b981',
        headerColorEnd: '#059669',
        headerTitle: 'Repair Request Approved',
        headerSubtitle: 'Ready to Proceed',
        statusBoxColor: '#d1fae5',
        statusBoxBorder: '#10b981',
        statusText: 'A repair request has been approved and is ready to proceed.',
        detailsTitle: 'Approval Details',
        detailsTitleColor: '#10b981',
        actorLabel: 'Approved By',
        smsText: `APPROVED: Repair "${repairTitle}" for ${yachtName} was approved by ${actorName}.`,
        actionText: 'The repair work can now proceed. Please coordinate with the team to schedule and complete the work.',
      },
      rejected: {
        subject: `Repair Rejected: ${repairTitle}`,
        headerColor: '#ef4444',
        headerColorEnd: '#dc2626',
        headerTitle: 'Repair Request Rejected',
        headerSubtitle: 'Action Required',
        statusBoxColor: '#fee2e2',
        statusBoxBorder: '#ef4444',
        statusText: 'A repair request has been rejected.',
        detailsTitle: 'Rejection Details',
        detailsTitleColor: '#ef4444',
        actorLabel: 'Rejected By',
        smsText: `REJECTED: Repair "${repairTitle}" for ${yachtName} was rejected by ${actorName}.`,
        actionText: 'Please review the rejection reason and follow up with the owner as needed.',
      },
      paid: {
        subject: `Repair Invoice Paid: ${repairTitle}`,
        headerColor: '#3b82f6',
        headerColorEnd: '#2563eb',
        headerTitle: 'Repair Invoice Paid',
        headerSubtitle: 'Payment Received',
        statusBoxColor: '#dbeafe',
        statusBoxBorder: '#3b82f6',
        statusText: 'A repair invoice has been paid in full.',
        detailsTitle: 'Payment Details',
        detailsTitleColor: '#3b82f6',
        actorLabel: 'Recorded By',
        smsText: `PAID: Invoice for repair "${repairTitle}" on ${yachtName} has been paid.`,
        actionText: 'The repair request has been fully settled. No further action is required.',
      },
    };

    const cfg = eventConfig[eventType];

    let emailsSent = 0;
    let smsSent = 0;

    if (resendApiKey && emailRecipients.length > 0) {
      const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
      if (!emailFormatRegex.test(fromEmail)) {
        fromEmail = 'onboarding@resend.dev';
      }

      for (const recipient of emailRecipients) {
        const amountLine = eventType === 'paid' && finalAmount
          ? `<p><strong>Amount Paid:</strong> $${finalAmount}</p>`
          : eventType === 'approved' && estimatedCost
          ? `<p><strong>Estimated Cost:</strong> $${estimatedCost}</p>`
          : '';

        const rejectionLine = eventType === 'rejected' && rejectionReason
          ? `<p><strong>Reason:</strong> ${rejectionReason}</p>`
          : '';

        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, ${cfg.headerColor} 0%, ${cfg.headerColorEnd} 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .status-box { background: ${cfg.statusBoxColor}; border-left: 4px solid ${cfg.statusBoxBorder}; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .view-button { display: inline-block; background: ${cfg.headerColor}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; font-size: 16px; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">${cfg.headerTitle}</h1>
                <p style="margin: 10px 0 0 0;">${cfg.headerSubtitle}</p>
              </div>
              <div class="content">
                <p>Hello ${recipient.name},</p>
                <div class="status-box">
                  <p style="margin: 0; font-weight: bold;">${cfg.statusText}</p>
                </div>
                <div class="details">
                  <h3 style="margin-top: 0; color: ${cfg.detailsTitleColor};">${cfg.detailsTitle}</h3>
                  <p><strong>Yacht:</strong> ${yachtName}</p>
                  <p><strong>Repair:</strong> ${repairTitle}</p>
                  <p><strong>${cfg.actorLabel}:</strong> ${actorName}</p>
                  ${amountLine}
                  ${rejectionLine}
                  <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                <p style="text-align: center; margin: 25px 0;">
                  <a href="${siteUrl}" class="view-button" style="color: white;">View in System</a>
                </p>
                <p style="margin-top: 30px;">${cfg.actionText}</p>
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
              subject: cfg.subject,
              html: htmlContent,
              tags: [{ name: 'category', value: `repair-${eventType}` }],
            }),
          });

          if (emailResponse.ok) {
            emailsSent++;
            console.log(`Email sent to ${recipient.email} for repair ${eventType}`);
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
            Body: cfg.smsText,
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
            console.log(`SMS sent to ${recipient.phone} for repair ${eventType}`);
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
        message: `Sent ${emailsSent} email(s) and ${smsSent} SMS for repair ${eventType}`,
        emailsSent,
        smsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-repair-approval-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
