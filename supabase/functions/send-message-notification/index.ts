import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationPayload {
  messageType: 'yacht_message' | 'staff_message';
  messageId: string;
  yachtId?: string;
  yachtName?: string;
  senderName: string;
  messageContent: string;
  notificationType?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: NotificationPayload = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing notification:', payload);

    const { data: staffUsers, error: staffError } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name, email, phone, notification_email, notification_phone, email_notifications_enabled, sms_notifications_enabled, role, yacht_id')
      .in('role', ['staff', 'manager', 'mechanic']);

    if (staffError) {
      console.error('Error fetching staff users:', staffError);
      throw staffError;
    }

    if (!staffUsers || staffUsers.length === 0) {
      console.log('No staff users found to notify');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No staff users to notify',
          emailsSent: 0,
          smsSent: 0
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Found ${staffUsers.length} staff users`);

    const emailNotifications: Array<{to: string, name: string}> = [];
    const smsNotifications: Array<{phone: string, name: string}> = [];

    for (const user of staffUsers) {
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Staff Member';
      
      let shouldNotify = true;

      if (user.role === 'manager' && payload.yachtId) {
        if (user.yacht_id !== payload.yachtId) {
          console.log(`Skipping manager ${userName} - not assigned to yacht ${payload.yachtId}`);
          shouldNotify = false;
        }
      }

      if (!shouldNotify) {
        continue;
      }
      
      if (user.email_notifications_enabled) {
        const emailAddress = user.notification_email || user.email;
        if (emailAddress) {
          emailNotifications.push({ to: emailAddress, name: userName });
        }
      }

      if (user.sms_notifications_enabled) {
        const phoneNumber = user.notification_phone || user.phone;
        if (phoneNumber) {
          smsNotifications.push({ phone: phoneNumber, name: userName });
        }
      }
    }

    console.log(`Prepared ${emailNotifications.length} email notifications`);
    console.log(`Prepared ${smsNotifications.length} SMS notifications`);

    const emailSubject = payload.messageType === 'yacht_message'
      ? `New Yacht Message: ${payload.yachtName || 'Unknown Yacht'}`
      : `New Staff Message`;

    const emailBody = `
Hello,

A new message has been received in the yacht management system.

Message Type: ${payload.messageType === 'yacht_message' ? 'Yacht Message' : 'Staff Message'}
${payload.yachtName ? `Yacht: ${payload.yachtName}\n` : ''}Sender: ${payload.senderName}
${payload.notificationType ? `Type: ${payload.notificationType}\n` : ''}
Message: ${payload.messageContent}

Please log in to the yacht management system to view and respond to this message.

This is an automated notification. Please do not reply to this message.
`;

    const smsBody = `New ${payload.messageType === 'yacht_message' ? 'yacht' : 'staff'} message from ${payload.senderName}${payload.yachtName ? ` for ${payload.yachtName}` : ''}. Log in to view details.`;

    for (const email of emailNotifications) {
      console.log(`[EMAIL] To: ${email.to}`);
      console.log(`[EMAIL] Subject: ${emailSubject}`);
      console.log(`[EMAIL] Body: ${emailBody}`);
    }

    for (const sms of smsNotifications) {
      console.log(`[SMS] To: ${sms.phone}`);
      console.log(`[SMS] Message: ${smsBody}`);
    }

    const response = {
      success: true,
      message: 'Notifications processed successfully',
      emailsSent: emailNotifications.length,
      smsSent: smsNotifications.length,
      details: {
        emails: emailNotifications.map(e => ({ to: e.to, subject: emailSubject })),
        sms: smsNotifications.map(s => ({ to: s.phone, preview: smsBody.substring(0, 50) + '...' })),
      },
      note: 'Email and SMS sending requires service provider configuration (Resend, SendGrid, Twilio, etc.). All notifications have been logged to console for testing.'
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in send-message-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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