import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        generateErrorPage('Invalid Link', 'This approval link is invalid or incomplete.'),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'inline',
          },
        }
      );
    }

    // Initialize Supabase client with anon key to validate token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch the token details
    const { data: tokenData, error: tokenError } = await supabase
      .from('repair_request_approval_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(
        generateErrorPage('Invalid Token', 'This approval link is invalid or has expired.'),
        {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'inline',
          },
        }
      );
    }

    // Check if token has already been used
    if (tokenData.used_at) {
      return new Response(
        generateErrorPage('Link Already Used', 'This approval link has already been used. The repair request has been processed.'),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'inline',
          },
        }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        generateErrorPage('Link Expired', 'This approval link has expired. Please log in to MyYachtTime to approve or deny this request.'),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'inline',
          },
        }
      );
    }

    // Use service role key to update the repair request
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Mark token as used
    await supabaseAdmin
      .from('repair_request_approval_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    // Update the repair request status
    const newStatus = tokenData.action_type === 'approve' ? 'approved' : 'rejected';
    const { error: updateError } = await supabaseAdmin
      .from('repair_requests')
      .update({ status: newStatus })
      .eq('id', tokenData.repair_request_id);

    if (updateError) {
      console.error('Error updating repair request:', updateError);
      return new Response(
        generateErrorPage('Update Failed', 'There was an error processing your request. Please try again or contact support.'),
        {
          status: 500,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': 'inline',
          },
        }
      );
    }

    // Fetch repair request details for display
    const { data: repairRequest } = await supabaseAdmin
      .from('repair_requests')
      .select(`
        title,
        description,
        estimated_cost,
        retail_customer_name,
        yacht_id,
        yachts(name)
      `)
      .eq('id', tokenData.repair_request_id)
      .single();

    const action = tokenData.action_type === 'approve' ? 'Approved' : 'Denied';
    const actionColor = tokenData.action_type === 'approve' ? '#10b981' : '#ef4444';
    const buttonColor = tokenData.action_type === 'approve' ? '#10b981' : '#dc2626';
    const buttonColorHover = tokenData.action_type === 'approve' ? '#059669' : '#b91c1c';
    const siteUrl = Deno.env.get('SITE_URL') || 'https://myyachttime.vercel.app';

    return new Response(
      generateSuccessPage(action, actionColor, buttonColor, buttonColorHover, repairRequest, siteUrl),
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': 'inline',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in handle-repair-approval:', error);
    return new Response(
      generateErrorPage('Error', 'An unexpected error occurred. Please try again or contact support.'),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': 'inline',
        },
      }
    );
  }
});

function generateSuccessPage(action: string, color: string, buttonColor: string, buttonColorHover: string, repairRequest: any, siteUrl: string): string {
  const yachtName = repairRequest?.yachts?.name || repairRequest?.retail_customer_name || 'Unknown';
  const title = repairRequest?.title || 'Repair Request';
  const description = repairRequest?.description || 'No description provided';
  const estimatedCost = repairRequest?.estimated_cost
    ? `$${parseFloat(repairRequest.estimated_cost).toFixed(2)}`
    : 'Not specified';

  const approvalMessage = action === 'Approved'
    ? 'Your approval has been recorded. The team will proceed with the repair work.'
    : 'Your denial has been recorded. The team has been notified and will not proceed with this work.';

  const icon = action === 'Approved' ? '&#10003;' : '&#10007;';
  const messageBackground = action === 'Approved' ? '#d1fae5' : '#fee2e2';
  const messageColor = action === 'Approved' ? '#065f46' : '#991b1b';
  const customerLabel = repairRequest?.retail_customer_name ? 'Customer' : 'Yacht';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + action + ' - MyYachtTime</title><style>body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:600px;background:white;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);padding:40px;text-align:center}.icon{font-size:64px;margin-bottom:20px}h1{color:' + color + ';margin:0 0 10px 0;font-size:32px}.subtitle{color:#666;font-size:16px;margin-bottom:30px}.details{background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0;text-align:left}.detail-row{margin-bottom:15px;padding-bottom:15px;border-bottom:1px solid #e5e7eb}.detail-row:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}.detail-label{font-weight:bold;color:#374151;font-size:14px;display:block;margin-bottom:5px}.detail-value{color:#6b7280;font-size:16px;word-wrap:break-word}.detail-value.cost{font-size:24px;color:#059669;font-weight:bold}p{color:#666;line-height:1.6;margin:15px 0}.success-message{background:' + messageBackground + ';color:' + messageColor + ';padding:15px;border-radius:8px;margin:20px 0;font-weight:500}.button{display:inline-block;background:' + buttonColor + ';color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold;margin-top:20px;transition:background 0.3s}.button:hover{background:' + buttonColorHover + '}</style></head><body><div class="container"><div class="icon">' + icon + '</div><h1>Request ' + action + '</h1><p class="subtitle">The repair request has been ' + action.toLowerCase() + '</p><div class="details"><div class="detail-row"><span class="detail-label">' + customerLabel + '</span><span class="detail-value">' + yachtName + '</span></div><div class="detail-row"><span class="detail-label">Request Title</span><span class="detail-value">' + title + '</span></div><div class="detail-row"><span class="detail-label">Description</span><span class="detail-value">' + description + '</span></div><div class="detail-row"><span class="detail-label">Estimated Cost</span><span class="detail-value cost">' + estimatedCost + '</span></div></div><div class="success-message">' + approvalMessage + '</div><p>You can now close this window or visit MyYachtTime to view more details.</p><a href="' + siteUrl + '" class="button">Go to MyYachtTime</a></div></body></html>';
}

function generateErrorPage(title: string, message: string): string {
  const siteUrl = Deno.env.get('SITE_URL') || 'https://myyachttime.vercel.app';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + title + ' - MyYachtTime</title><style>body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:500px;background:white;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);padding:40px;text-align:center}.icon{font-size:64px;margin-bottom:20px}h1{color:#dc2626;margin:0 0 10px 0;font-size:32px}p{color:#666;line-height:1.6;margin:15px 0}.button{display:inline-block;background:#dc2626;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:bold;margin-top:20px;transition:background 0.3s}.button:hover{background:#b91c1c}</style></head><body><div class="container"><div class="icon">⚠️</div><h1>' + title + '</h1><p>' + message + '</p><a href="' + siteUrl + '" class="button">Go to MyYachtTime</a></div></body></html>';
}
