import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { validateUUID } from '../_shared/validation.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const htmlHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Access-Control-Allow-Origin': '*',
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(generateErrorPage('Invalid Link', 'This approval link is invalid or incomplete.'), {
        status: 400, headers: htmlHeaders,
      });
    }

    try {
      validateUUID(token, 'token');
    } catch {
      return new Response(generateErrorPage('Invalid Token Format', 'This approval link has an invalid format. Please contact support.'), {
        status: 400, headers: htmlHeaders,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://myyachttime.vercel.app';

    const { data: tokenData, error: tokenError } = await supabase
      .from('repair_request_approval_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(generateErrorPage('Invalid Token', 'This approval link is invalid or has expired.'), {
        status: 404, headers: htmlHeaders,
      });
    }

    // Check if this specific token is already used
    if (tokenData.used_at) {
      return new Response(generateErrorPage('Link Already Used', 'This approval link has already been used. The repair request has been processed.'), {
        status: 400, headers: htmlHeaders,
      });
    }

    // Check if ANY token for this repair request has already been used
    const { data: existingTokens } = await supabase
      .from('repair_request_approval_tokens')
      .select('action_type, used_at')
      .eq('repair_request_id', tokenData.repair_request_id)
      .not('used_at', 'is', null);

    if (existingTokens && existingTokens.length > 0) {
      const usedAction = existingTokens[0].action_type === 'approve' ? 'approved' : 'denied';
      return new Response(
        generateErrorPage('Request Already Processed', `This repair request has already been ${usedAction}. Please check your email or log in to MyYachtTime for the current status.`),
        { status: 400, headers: htmlHeaders }
      );
    }

    // Check if token has expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(generateErrorPage('Link Expired', 'This approval link has expired. Please log in to MyYachtTime to approve or deny this request.'), {
        status: 400, headers: htmlHeaders,
      });
    }

    // Fetch repair request details for display
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: repairRequest } = await supabaseAdmin
      .from('repair_requests')
      .select('title, description, estimated_repair_cost, customer_name, is_retail_customer, yacht_id, yachts(name)')
      .eq('id', tokenData.repair_request_id)
      .maybeSingle();

    const action = tokenData.action_type === 'approve' ? 'approve' : 'deny';
    const actionLabel = action === 'approve' ? 'Approve' : 'Deny';

    let displayName = 'Unknown';
    if (repairRequest?.is_retail_customer && repairRequest?.customer_name) {
      displayName = repairRequest.customer_name;
    } else if (repairRequest?.yachts) {
      const yachtsData = Array.isArray(repairRequest.yachts) ? repairRequest.yachts[0] : repairRequest.yachts;
      displayName = yachtsData?.name || 'Unknown';
    }

    const title = repairRequest?.title || 'Repair Request';
    const description = repairRequest?.description || '';
    const costValue = repairRequest?.estimated_repair_cost;
    const estimateDisplay = costValue ? `$${parseFloat(costValue).toFixed(2)}` : 'TBD';

    // ── POST: Actually process the approval ────────────────────────────────
    if (req.method === 'POST') {
      const now = new Date().toISOString();

      await supabaseAdmin
        .from('repair_request_approval_tokens')
        .update({ used_at: now })
        .eq('repair_request_id', tokenData.repair_request_id);

      const newStatus = tokenData.action_type === 'approve' ? 'approved' : 'rejected';
      const { error: updateError } = await supabaseAdmin
        .from('repair_requests')
        .update({ status: newStatus })
        .eq('id', tokenData.repair_request_id);

      if (updateError) {
        console.error('Error updating repair request:', updateError);
        return new Response(
          JSON.stringify({ error: 'There was an error processing your request. Please try again or contact support.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const redirectUrl = new URL(`${siteUrl}/repair-approval-success.html`);
      redirectUrl.searchParams.set('action', newStatus === 'approved' ? 'approved' : 'denied');
      redirectUrl.searchParams.set('customer', encodeURIComponent(displayName));
      redirectUrl.searchParams.set('title', encodeURIComponent(title));
      redirectUrl.searchParams.set('description', encodeURIComponent(description));
      if (costValue) redirectUrl.searchParams.set('cost', costValue.toString());

      return new Response(
        JSON.stringify({ success: true, redirectUrl: redirectUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── GET: Return JSON for the static page to consume ────────────────────
    const acceptHeader = req.headers.get('Accept') || '';
    if (acceptHeader.includes('application/json')) {
      return new Response(
        JSON.stringify({ action, actionLabel, displayName, title, description, estimateDisplay }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: redirect to static page (handles direct browser link clicks)
    const staticPageUrl = new URL(`${siteUrl}/repair-approval.html`);
    staticPageUrl.searchParams.set('token', token);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': staticPageUrl.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    console.error('Error in handle-repair-approval:', error);
    return new Response(generateErrorPage('Error', 'An unexpected error occurred. Please try again or contact support.'), {
      status: 500, headers: htmlHeaders,
    });
  }
});

function generateConfirmationPage(opts: {
  token: string;
  action: string;
  actionLabel: string;
  displayName: string;
  title: string;
  description: string;
  estimateDisplay: string;
  functionUrl: string;
  siteUrl: string;
}): string {
  const isApprove = opts.action === 'approve';
  const color = isApprove ? '#10b981' : '#ef4444';
  const colorHover = isApprove ? '#059669' : '#dc2626';
  const bgGradient = isApprove
    ? 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)'
    : 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)';
  const icon = isApprove ? '&#10003;' : '&#10007;';
  const confirmText = isApprove ? 'Yes, Approve Estimate' : 'Yes, Deny Estimate';
  const warningText = isApprove
    ? 'By clicking confirm, you are approving this repair. Work will begin shortly after your approval.'
    : 'By clicking confirm, you are denying this repair. The team will be notified not to proceed.';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm ${opts.actionLabel} - MyYachtTime</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: ${bgGradient};
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 560px;
      width: 100%;
      background: white;
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: ${color};
      color: white;
      padding: 28px 30px;
      text-align: center;
    }
    .header .icon { font-size: 52px; margin-bottom: 8px; }
    .header h1 { margin: 0; font-size: 26px; }
    .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 15px; }
    .body { padding: 28px 30px; }
    .details {
      background: #f9fafb;
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 20px;
      border-left: 4px solid ${color};
    }
    .detail-row { display: flex; gap: 10px; margin-bottom: 10px; font-size: 14px; }
    .detail-row:last-child { margin-bottom: 0; }
    .detail-label { font-weight: bold; color: #374151; min-width: 120px; }
    .detail-value { color: #6b7280; flex: 1; }
    .detail-value.cost { color: #059669; font-weight: bold; font-size: 17px; }
    .warning {
      background: ${isApprove ? '#ecfdf5' : '#fef2f2'};
      border: 1px solid ${isApprove ? '#a7f3d0' : '#fecaca'};
      color: ${isApprove ? '#065f46' : '#991b1b'};
      padding: 14px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 22px;
    }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      flex: 1;
      min-width: 130px;
      padding: 13px 20px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      transition: background 0.2s, transform 0.1s;
    }
    .btn:active { transform: scale(0.97); }
    .btn-confirm { background: ${color}; color: white; }
    .btn-confirm:hover { background: ${colorHover}; }
    .btn-cancel { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    .btn-cancel:hover { background: #e5e7eb; }
    .processing { display: none; text-align: center; padding: 20px 0; color: #6b7280; font-size: 15px; }
    form { margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">${icon}</div>
      <h1>Confirm ${opts.actionLabel}</h1>
      <p>Please review the details before confirming</p>
    </div>
    <div class="body">
      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Customer / Vessel</span>
          <span class="detail-value">${escapeHtml(opts.displayName)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Service</span>
          <span class="detail-value">${escapeHtml(opts.title)}</span>
        </div>
        ${opts.description ? `<div class="detail-row">
          <span class="detail-label">Description</span>
          <span class="detail-value">${escapeHtml(opts.description)}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Estimated Cost</span>
          <span class="detail-value cost">${escapeHtml(opts.estimateDisplay)}</span>
        </div>
      </div>
      <div class="warning">${warningText}</div>
      <div id="actions" class="actions">
        <form method="POST" action="${opts.functionUrl}?token=${opts.token}" style="flex:1;" onsubmit="handleSubmit(event)">
          <button type="submit" class="btn btn-confirm" style="width:100%;">${confirmText}</button>
        </form>
        <a href="${opts.siteUrl}" class="btn btn-cancel">Cancel</a>
      </div>
      <div id="processing" class="processing">
        Processing your response&hellip;
      </div>
    </div>
  </div>
  <script>
    function handleSubmit(e) {
      document.getElementById('actions').style.display = 'none';
      document.getElementById('processing').style.display = 'block';
    }
  </script>
</body>
</html>`;
}

function generateErrorPage(title: string, message: string): string {
  const siteUrl = Deno.env.get('SITE_URL') || 'https://myyachttime.vercel.app';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - MyYachtTime</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      margin: 0; padding: 20px; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .container {
      max-width: 500px; background: white; border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2); padding: 40px; text-align: center;
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #dc2626; margin: 0 0 10px 0; font-size: 32px; }
    p { color: #666; line-height: 1.6; margin: 15px 0; }
    .button {
      display: inline-block; background: #dc2626; color: white;
      padding: 12px 30px; text-decoration: none; border-radius: 6px;
      font-weight: bold; margin-top: 20px; transition: background 0.3s;
    }
    .button:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#9888;&#65039;</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="${siteUrl}" class="button">Go to MyYachtTime</a>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
