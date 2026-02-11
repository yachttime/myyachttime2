import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, svix-id, svix-timestamp, svix-signature',
};

interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.delivered_delayed' | 'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    created_at: string;
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    click?: {
      ipAddress: string;
      link: string;
      timestamp: string;
      userAgent: string;
    };
    open?: {
      ipAddress: string;
      timestamp: string;
      userAgent: string;
    };
  };
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
    const resendWebhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');

    const body = await req.text();

    // Verify webhook signature using Svix (Resend uses Svix for webhooks)
    if (resendWebhookSecret) {
      const svixId = req.headers.get('svix-id');
      const svixTimestamp = req.headers.get('svix-timestamp');
      const svixSignature = req.headers.get('svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('Missing svix headers');
        return new Response(
          JSON.stringify({ error: 'Missing webhook signature headers' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Verify signature
      const signedContent = `${svixId}.${svixTimestamp}.${body}`;
      const encoder = new TextEncoder();

      // Svix uses base64-encoded secret
      const secretBytes = Uint8Array.from(atob(resendWebhookSecret.split('_')[1] || resendWebhookSecret), c => c.charCodeAt(0));

      const key = await crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBytes = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signedContent)
      );

      const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

      // Extract the actual signature from the header (format: v1,signature)
      const signatures = svixSignature.split(' ');
      let isValid = false;

      for (const sig of signatures) {
        const [, signature] = sig.split(',');
        if (signature === expectedSignature) {
          isValid = true;
          break;
        }
      }

      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const event: ResendWebhookEvent = JSON.parse(body);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing Resend webhook event:', event.type, 'for email:', event.data.email_id);

    // Try to find the email in yacht_invoices
    const { data: invoice } = await supabase
      .from('yacht_invoices')
      .select('*')
      .eq('resend_email_id', event.data.email_id)
      .maybeSingle();

    // Try to find the email in repair_requests (estimate emails)
    const { data: repairRequest } = await supabase
      .from('repair_requests')
      .select('*')
      .eq('resend_email_id', event.data.email_id)
      .maybeSingle();

    // Try to find the email in repair_requests (notification emails)
    const { data: repairNotification } = await supabase
      .from('repair_requests')
      .select('*')
      .eq('notification_resend_email_id', event.data.email_id)
      .maybeSingle();

    // Try to find the email in repair_requests (deposit emails)
    const { data: depositRequest } = await supabase
      .from('repair_requests')
      .select('*')
      .eq('deposit_resend_email_id', event.data.email_id)
      .maybeSingle();

    // Try to find the email in staff_messages
    const { data: staffMessage } = await supabase
      .from('staff_messages')
      .select('*')
      .eq('resend_email_id', event.data.email_id)
      .maybeSingle();

    if (!invoice && !repairRequest && !repairNotification && !depositRequest && !staffMessage) {
      console.log('No record found for email_id:', event.data.email_id);
      return new Response(
        JSON.stringify({ received: true, message: 'No record found for this email' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Prepare update data based on event type
    const updateData: Record<string, any> = {};
    const eventTimestamp = new Date(event.created_at).toISOString();

    // Handle yacht_invoices tracking
    if (invoice) {
      switch (event.type) {
        case 'email.delivered':
          if (!invoice.payment_email_delivered_at) {
            updateData.payment_email_delivered_at = eventTimestamp;
          }
          break;

        case 'email.opened':
          if (!invoice.payment_email_opened_at) {
            updateData.payment_email_opened_at = eventTimestamp;
          }
          updateData.email_open_count = (invoice.email_open_count || 0) + 1;
          break;

        case 'email.clicked':
          if (!invoice.payment_link_clicked_at) {
            updateData.payment_link_clicked_at = eventTimestamp;
          }
          updateData.email_click_count = (invoice.email_click_count || 0) + 1;
          break;

        case 'email.bounced':
          if (!invoice.payment_email_bounced_at) {
            updateData.payment_email_bounced_at = eventTimestamp;
          }
          break;

        case 'email.delivered_delayed':
          console.log('Email delivery delayed for invoice:', invoice.id);
          break;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();

        const { error: updateError } = await supabase
          .from('yacht_invoices')
          .update(updateData)
          .eq('id', invoice.id);

        if (updateError) {
          console.error('Error updating invoice:', updateError);
          throw updateError;
        }

        console.log('Updated invoice:', invoice.id, 'with data:', updateData);
      }
    }

    // Handle repair_requests tracking (estimate emails)
    if (repairRequest) {
      const repairUpdateData: Record<string, any> = {};

      switch (event.type) {
        case 'email.delivered':
          if (!repairRequest.email_delivered_at) {
            repairUpdateData.email_delivered_at = eventTimestamp;
          }
          break;

        case 'email.opened':
          if (!repairRequest.email_opened_at) {
            repairUpdateData.email_opened_at = eventTimestamp;
          }
          break;

        case 'email.clicked':
          if (!repairRequest.email_clicked_at) {
            repairUpdateData.email_clicked_at = eventTimestamp;
          }
          break;

        case 'email.bounced':
          if (!repairRequest.email_bounced_at) {
            repairUpdateData.email_bounced_at = eventTimestamp;
          }
          break;
      }

      if (Object.keys(repairUpdateData).length > 0) {
        const { error: updateError } = await supabase
          .from('repair_requests')
          .update(repairUpdateData)
          .eq('id', repairRequest.id);

        if (updateError) {
          console.error('Error updating repair request:', updateError);
        } else {
          console.log('Updated repair request:', repairRequest.id, 'with data:', repairUpdateData);
        }
      }
    }

    // Handle repair_requests notification tracking (manager notification emails)
    if (repairNotification) {
      const notificationUpdateData: Record<string, any> = {};

      switch (event.type) {
        case 'email.delivered':
          if (!repairNotification.notification_email_delivered_at) {
            notificationUpdateData.notification_email_delivered_at = eventTimestamp;
          }
          break;

        case 'email.opened':
          if (!repairNotification.notification_email_opened_at) {
            notificationUpdateData.notification_email_opened_at = eventTimestamp;
          }
          break;

        case 'email.clicked':
          if (!repairNotification.notification_email_clicked_at) {
            notificationUpdateData.notification_email_clicked_at = eventTimestamp;
          }
          break;

        case 'email.bounced':
          if (!repairNotification.notification_email_bounced_at) {
            notificationUpdateData.notification_email_bounced_at = eventTimestamp;
          }
          break;
      }

      if (Object.keys(notificationUpdateData).length > 0) {
        const { error: updateError } = await supabase
          .from('repair_requests')
          .update(notificationUpdateData)
          .eq('id', repairNotification.id);

        if (updateError) {
          console.error('Error updating repair notification:', updateError);
        } else {
          console.log('Updated repair notification:', repairNotification.id, 'with data:', notificationUpdateData);
        }
      }
    }

    // Handle repair_requests deposit tracking
    if (depositRequest) {
      const depositUpdateData: Record<string, any> = {};

      switch (event.type) {
        case 'email.delivered':
          if (!depositRequest.deposit_email_delivered_at) {
            depositUpdateData.deposit_email_delivered_at = eventTimestamp;
          }
          break;

        case 'email.opened':
          if (!depositRequest.deposit_email_opened_at) {
            depositUpdateData.deposit_email_opened_at = eventTimestamp;
          }
          break;

        case 'email.clicked':
          if (!depositRequest.deposit_email_clicked_at) {
            depositUpdateData.deposit_email_clicked_at = eventTimestamp;
          }
          break;

        case 'email.bounced':
          if (!depositRequest.deposit_email_bounced_at) {
            depositUpdateData.deposit_email_bounced_at = eventTimestamp;
          }
          break;
      }

      if (Object.keys(depositUpdateData).length > 0) {
        const { error: updateError } = await supabase
          .from('repair_requests')
          .update(depositUpdateData)
          .eq('id', depositRequest.id);

        if (updateError) {
          console.error('Error updating deposit request:', updateError);
        } else {
          console.log('Updated deposit request:', depositRequest.id, 'with data:', depositUpdateData);
        }
      }
    }

    // Handle staff_messages tracking
    if (staffMessage) {
      const staffUpdateData: Record<string, any> = {};

      switch (event.type) {
        case 'email.delivered':
          if (!staffMessage.email_delivered_at) {
            staffUpdateData.email_delivered_at = eventTimestamp;
          }
          break;

        case 'email.opened':
          if (!staffMessage.email_opened_at) {
            staffUpdateData.email_opened_at = eventTimestamp;
          }
          staffUpdateData.email_open_count = (staffMessage.email_open_count || 0) + 1;
          break;

        case 'email.clicked':
          if (!staffMessage.email_clicked_at) {
            staffUpdateData.email_clicked_at = eventTimestamp;
          }
          staffUpdateData.email_click_count = (staffMessage.email_click_count || 0) + 1;
          break;

        case 'email.bounced':
          if (!staffMessage.email_bounced_at) {
            staffUpdateData.email_bounced_at = eventTimestamp;
          }
          break;

        case 'email.delivered_delayed':
          console.log('Email delivery delayed for staff message:', staffMessage.id);
          break;
      }

      if (Object.keys(staffUpdateData).length > 0) {
        const { error: updateError } = await supabase
          .from('staff_messages')
          .update(staffUpdateData)
          .eq('id', staffMessage.id);

        if (updateError) {
          console.error('Error updating staff message:', updateError);
        } else {
          console.log('Updated staff message:', staffMessage.id, 'with data:', staffUpdateData);
        }
      }
    }

    // Insert engagement event for historical tracking (only for invoices)
    if (invoice) {
      const { error: eventError } = await supabase
        .from('invoice_engagement_events')
        .insert({
          invoice_id: invoice.id,
          event_type: event.type,
          occurred_at: eventTimestamp,
          resend_event_data: event,
        });

      if (eventError) {
        console.error('Error inserting engagement event:', eventError);
        // Don't throw - this is not critical
      }
    }

    // Add yacht history log for email engagement events
    if (invoice && Object.keys(updateData).length > 0 && invoice.yacht_id && invoice.repair_title) {
      // Get yacht name
      const { data: yacht } = await supabase
        .from('yachts')
        .select('name')
        .eq('id', invoice.yacht_id)
        .single();

      let historyAction = '';
      const recipient = invoice.payment_email_recipient || event.data.to[0] || 'recipient';

      switch (event.type) {
        case 'email.delivered':
          historyAction = `Payment email for "${invoice.repair_title}" delivered to ${recipient}`;
          break;
        case 'email.opened':
          const openCount = (invoice.email_open_count || 0) + 1;
          historyAction = `Payment email for "${invoice.repair_title}" opened by ${recipient}${openCount > 1 ? ` (${openCount}x)` : ''}`;
          break;
        case 'email.clicked':
          const clickCount = (invoice.email_click_count || 0) + 1;
          historyAction = `Payment link for "${invoice.repair_title}" clicked by ${recipient}${clickCount > 1 ? ` (${clickCount}x)` : ''}`;
          break;
        case 'email.bounced':
          historyAction = `Payment email for "${invoice.repair_title}" bounced for ${recipient}`;
          break;
      }

      if (historyAction && yacht) {
        await supabase.from('yacht_history_logs').insert({
          yacht_id: invoice.yacht_id,
          yacht_name: yacht.name,
          action: historyAction,
          reference_id: invoice.id,
          reference_type: 'yacht_invoice',
          created_at: eventTimestamp,
          created_by: null,
          created_by_name: 'System',
        });
      }
    }

    console.log('Successfully processed event:', event.type, 'for invoice:', invoice.id);

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({
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
