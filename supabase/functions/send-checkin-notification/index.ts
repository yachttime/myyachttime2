import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckInNotificationRequest {
  ownerName: string;
  yachtName: string;
  checkInTime: string;
  eventType: 'check_in' | 'check_out' | 'trip_inspection';
  companyId: string;
  inspectorId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: CheckInNotificationRequest = await req.json();
    const { ownerName, yachtName, checkInTime, eventType, companyId, inspectorId } = payload;

    if (!ownerName || !yachtName || !companyId) {
      throw new Error('ownerName, yachtName, and companyId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://myyachttime.com';
    let fromEmail = (Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com').trim();

    // For trip inspections include mechanic role; for check-in/out use staff and master only
    const rolesToNotify = eventType === 'trip_inspection'
      ? ['staff', 'master', 'mechanic']
      : ['staff', 'master'];

    const { data: staffUsers, error: staffError } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name, email, phone, notification_email, notification_phone, email_notifications_enabled, sms_notifications_enabled, sms_consent_given, role')
      .in('role', rolesToNotify)
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (staffError) throw staffError;

    if (!staffUsers || staffUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No users to notify', emailsSent: 0, smsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailRecipients: Array<{ email: string; name: string }> = [];
    const smsRecipients: Array<{ phone: string; name: string }> = [];

    for (const user of staffUsers) {
      // Don't notify the inspector about their own inspection
      if (inspectorId && user.user_id === inspectorId) continue;

      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Team Member';

      if (user.email_notifications_enabled !== false) {
        const emailAddress = user.notification_email || user.email;
        if (emailAddress && emailRegex.test(emailAddress)) {
          emailRecipients.push({ email: emailAddress, name: userName });
        }
      }

      if (user.sms_notifications_enabled && user.sms_consent_given) {
        const phoneNumber = user.notification_phone || user.phone;
        if (phoneNumber) {
          smsRecipients.push({ phone: phoneNumber, name: userName });
        }
      }
    }

    const isTripInspection = eventType === 'trip_inspection';
    const isCheckIn = eventType === 'check_in';
    const eventLabel = isTripInspection ? 'Trip Inspection' : isCheckIn ? 'Check-In' : 'Check-Out';
    const subject = isTripInspection
      ? `Trip Inspection Completed: ${yachtName} — by ${ownerName}`
      : `${eventLabel} Alert: ${ownerName} — ${yachtName}`;
    const smsBody = isTripInspection
      ? `TRIP INSPECTION: ${ownerName} completed a trip inspection on ${yachtName} at ${checkInTime}. Log in to view.`
      : `${eventLabel.toUpperCase()} ALERT: ${ownerName} has ${isCheckIn ? 'checked in to' : 'checked out of'} ${yachtName} at ${checkInTime}. Log in to view.`;

    const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
    if (!emailFormatRegex.test(fromEmail)) {
      fromEmail = 'onboarding@resend.dev';
    }

    let emailsSent = 0;
    let smsSent = 0;

    if (resendApiKey && emailRecipients.length > 0) {
      const headerColor = isTripInspection ? '#0e7490' : isCheckIn ? '#059669' : '#0369a1';
      const badgeColor = isTripInspection ? '#cffafe' : isCheckIn ? '#d1fae5' : '#dbeafe';
      const badgeTextColor = isTripInspection ? '#164e63' : isCheckIn ? '#065f46' : '#1e40af';
      const badgeBorder = isTripInspection ? '#67e8f9' : isCheckIn ? '#6ee7b7' : '#93c5fd';
      const icon = isTripInspection ? '&#128203;' : isCheckIn ? '&#9875;' : '&#128682;';

      for (const recipient of emailRecipients) {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}cc 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .badge { display: inline-block; background: ${badgeColor}; color: ${badgeTextColor}; border: 1px solid ${badgeBorder}; padding: 4px 14px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 16px; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
              .details p { margin: 6px 0; }
              .view-button { display: inline-block; background: ${headerColor}; color: white !important; padding: 13px 36px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; font-size: 15px; }
              .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div style="font-size: 40px; margin-bottom: 10px;">${icon}</div>
                <h1 style="margin: 0; font-size: 24px;">${eventLabel} Alert</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9;">${yachtName}</p>
              </div>
              <div class="content">
                <p>Hello ${recipient.name},</p>
                <span class="badge">${eventLabel}</span>
                <div class="details">
                  <p><strong>${isTripInspection ? 'Inspector' : 'Owner'}:</strong> ${ownerName}</p>
                  <p><strong>Yacht:</strong> ${yachtName}</p>
                  <p><strong>Time:</strong> ${checkInTime}</p>
                  <p><strong>Event:</strong> ${isTripInspection ? 'Trip inspection completed' : isCheckIn ? 'Arrived at vessel' : 'Departed vessel'}</p>
                </div>
                <p style="text-align: center; margin: 25px 0;">
                  <a href="${siteUrl}" class="view-button" style="color: white;">View Dashboard</a>
                </p>
                <p>Best regards,<br>My Yacht Time</p>
              </div>
              <div class="footer">
                <p>This is an automated notification. Please do not reply to this email.</p>
                <p>&copy; ${new Date().getFullYear()} My Yacht Time</p>
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
              tags: [{ name: 'category', value: 'checkin-notification' }],
            }),
          });

          if (emailResponse.ok) {
            emailsSent++;
            console.log(`Email sent to ${recipient.email}`);
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
            console.log(`SMS sent to ${recipient.phone}`);
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
        message: `Sent ${emailsSent} email(s) and ${smsSent} SMS(es)`,
        emailsSent,
        smsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-checkin-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
