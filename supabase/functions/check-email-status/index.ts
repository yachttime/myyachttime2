import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    if (!resendApiKey) {
      throw new Error('Resend API key not configured');
    }

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

    const { repairRequestId } = await req.json();

    if (!repairRequestId) {
      throw new Error('Repair request ID is required');
    }

    // Fetch repair request
    const { data: repairRequest, error: repairError } = await supabase
      .from('repair_requests')
      .select('deposit_resend_email_id, deposit_email_sent_at, resend_email_id, estimate_email_sent_at, email_delivered_at, deposit_email_delivered_at, notification_resend_email_id, notification_email_sent_at, notification_email_delivered_at')
      .eq('id', repairRequestId)
      .single();

    if (repairError || !repairRequest) {
      throw new Error('Repair request not found');
    }

    // Determine which email to check (notification, deposit, or estimate)
    // Priority: notification > deposit > estimate
    const emailId = repairRequest.notification_resend_email_id || repairRequest.deposit_resend_email_id || repairRequest.resend_email_id;
    const isNotificationEmail = !!repairRequest.notification_resend_email_id && !repairRequest.deposit_resend_email_id;
    const isDepositEmail = !!repairRequest.deposit_resend_email_id;

    if (!emailId) {
      throw new Error('No email has been sent for this request');
    }

    // Fetch email status from Resend
    const response = await fetch(
      `https://api.resend.com/emails/${emailId}`,
      {
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', errorText);
      throw new Error('Failed to fetch email status from Resend');
    }

    const emailData = await response.json();
    console.log('Email status from Resend:', emailData);

    // Update database based on email status
    const updateData: any = {};

    // Map Resend events to our database fields
    if (isNotificationEmail) {
      // Notification email tracking (manager notifications)
      if (emailData.last_event === 'delivered') {
        updateData.notification_email_delivered_at = new Date().toISOString();
      } else if (emailData.last_event === 'bounced') {
        updateData.notification_email_bounced_at = new Date().toISOString();
      } else if (emailData.last_event === 'opened') {
        updateData.notification_email_opened_at = new Date().toISOString();
        if (!repairRequest.notification_email_delivered_at) {
          updateData.notification_email_delivered_at = new Date().toISOString();
        }
      } else if (emailData.last_event === 'clicked') {
        updateData.notification_email_clicked_at = new Date().toISOString();
        if (!repairRequest.notification_email_delivered_at) {
          updateData.notification_email_delivered_at = new Date().toISOString();
        }
      }
    } else if (isDepositEmail) {
      // Deposit email tracking
      if (emailData.last_event === 'delivered') {
        updateData.deposit_email_delivered_at = new Date().toISOString();
      } else if (emailData.last_event === 'bounced') {
        updateData.deposit_email_bounced_at = new Date().toISOString();
      } else if (emailData.last_event === 'opened') {
        updateData.deposit_email_opened_at = new Date().toISOString();
        if (!repairRequest.deposit_email_delivered_at) {
          updateData.deposit_email_delivered_at = new Date().toISOString();
        }
      } else if (emailData.last_event === 'clicked') {
        updateData.deposit_email_clicked_at = new Date().toISOString();
        if (!repairRequest.deposit_email_delivered_at) {
          updateData.deposit_email_delivered_at = new Date().toISOString();
        }
      }
    } else {
      // Estimate email tracking
      if (emailData.last_event === 'delivered') {
        updateData.email_delivered_at = new Date().toISOString();
      } else if (emailData.last_event === 'bounced') {
        updateData.email_bounced_at = new Date().toISOString();
      } else if (emailData.last_event === 'opened') {
        updateData.email_opened_at = new Date().toISOString();
        if (!repairRequest.email_delivered_at) {
          updateData.email_delivered_at = new Date().toISOString();
        }
      } else if (emailData.last_event === 'clicked') {
        updateData.email_clicked_at = new Date().toISOString();
        if (!repairRequest.email_delivered_at) {
          updateData.email_delivered_at = new Date().toISOString();
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('repair_requests')
        .update(updateData)
        .eq('id', repairRequestId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailStatus: emailData.last_event,
        updated: Object.keys(updateData).length > 0,
        emailData: {
          status: emailData.last_event,
          sent_at: emailData.created_at,
          to: emailData.to,
          subject: emailData.subject,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error checking email status:', error);
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
