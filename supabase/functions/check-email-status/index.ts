import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function fetchEmailStatus(emailId: string, resendApiKey: string): Promise<string | null> {
  const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { 'Authorization': `Bearer ${resendApiKey}` },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.last_event || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) throw new Error('Resend API key not configured');

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { repairRequestId } = await req.json();
    if (!repairRequestId) throw new Error('Repair request ID is required');

    const { data: repairRequest, error: repairError } = await supabase
      .from('repair_requests')
      .select(`
        deposit_resend_email_id, deposit_email_sent_at,
        deposit_email_delivered_at, deposit_email_opened_at, deposit_email_clicked_at,
        resend_email_id, estimate_email_sent_at,
        email_delivered_at, email_opened_at, email_clicked_at,
        notification_resend_email_id, notification_email_sent_at,
        notification_email_delivered_at, notification_email_opened_at, notification_email_clicked_at
      `)
      .eq('id', repairRequestId)
      .single();

    if (repairError || !repairRequest) throw new Error('Repair request not found');

    const updateData: Record<string, string> = {};
    const statuses: string[] = [];

    // Check notification email independently
    if (repairRequest.notification_resend_email_id) {
      const event = await fetchEmailStatus(repairRequest.notification_resend_email_id, resendApiKey);
      if (event) {
        statuses.push(`notification: ${event}`);
        if (event === 'delivered' && !repairRequest.notification_email_delivered_at) {
          updateData.notification_email_delivered_at = new Date().toISOString();
        } else if (event === 'bounced') {
          updateData.notification_email_bounced_at = new Date().toISOString();
        } else if (event === 'opened') {
          updateData.notification_email_opened_at = new Date().toISOString();
          if (!repairRequest.notification_email_delivered_at) {
            updateData.notification_email_delivered_at = new Date().toISOString();
          }
        } else if (event === 'clicked') {
          updateData.notification_email_clicked_at = new Date().toISOString();
          if (!repairRequest.notification_email_delivered_at) {
            updateData.notification_email_delivered_at = new Date().toISOString();
          }
        }
      }
    }

    // Check deposit email independently
    if (repairRequest.deposit_resend_email_id) {
      const event = await fetchEmailStatus(repairRequest.deposit_resend_email_id, resendApiKey);
      if (event) {
        statuses.push(`deposit: ${event}`);
        if (event === 'delivered' && !repairRequest.deposit_email_delivered_at) {
          updateData.deposit_email_delivered_at = new Date().toISOString();
        } else if (event === 'bounced') {
          updateData.deposit_email_bounced_at = new Date().toISOString();
        } else if (event === 'opened') {
          updateData.deposit_email_opened_at = new Date().toISOString();
          if (!repairRequest.deposit_email_delivered_at) {
            updateData.deposit_email_delivered_at = new Date().toISOString();
          }
        } else if (event === 'clicked') {
          updateData.deposit_email_clicked_at = new Date().toISOString();
          if (!repairRequest.deposit_email_delivered_at) {
            updateData.deposit_email_delivered_at = new Date().toISOString();
          }
        }
      }
    }

    // Check estimate email independently
    if (repairRequest.resend_email_id) {
      const event = await fetchEmailStatus(repairRequest.resend_email_id, resendApiKey);
      if (event) {
        statuses.push(`estimate: ${event}`);
        if (event === 'delivered' && !repairRequest.email_delivered_at) {
          updateData.email_delivered_at = new Date().toISOString();
        } else if (event === 'bounced') {
          updateData.email_bounced_at = new Date().toISOString();
        } else if (event === 'opened') {
          updateData.email_opened_at = new Date().toISOString();
          if (!repairRequest.email_delivered_at) {
            updateData.email_delivered_at = new Date().toISOString();
          }
        } else if (event === 'clicked') {
          updateData.email_clicked_at = new Date().toISOString();
          if (!repairRequest.email_delivered_at) {
            updateData.email_delivered_at = new Date().toISOString();
          }
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('repair_requests')
        .update(updateData)
        .eq('id', repairRequestId);
    }

    const primaryStatus = statuses.length > 0 ? statuses[statuses.length - 1].split(': ')[1] : 'unknown';

    return new Response(
      JSON.stringify({
        success: true,
        emailStatus: primaryStatus,
        allStatuses: statuses,
        updated: Object.keys(updateData).length > 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking email status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
