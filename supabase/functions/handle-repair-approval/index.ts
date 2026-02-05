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
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
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
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
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
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
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
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
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
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
          },
        }
      );
    }

    // Fetch repair request details for display
    const { data: repairRequest } = await supabaseAdmin
      .from('repair_requests')
      .select('title, description')
      .eq('id', tokenData.repair_request_id)
      .single();

    const action = tokenData.action_type === 'approve' ? 'Approved' : 'Denied';
    const actionColor = tokenData.action_type === 'approve' ? '#10b981' : '#ef4444';
    const siteUrl = Deno.env.get('SITE_URL') || 'https://yourdomain.com';

    return new Response(
      generateSuccessPage(action, actionColor, repairRequest?.title || 'Repair Request', siteUrl),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
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
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  }
});

function generateSuccessPage(action: string, color: string, title: string, siteUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${action} - MyYachtTime</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          padding: 40px;
          text-align: center;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: ${color};
          margin: 0 0 10px 0;
          font-size: 32px;
        }
        .title {
          color: #666;
          font-size: 18px;
          margin: 20px 0;
          padding: 15px;
          background: #f9fafb;
          border-radius: 8px;
        }
        p {
          color: #666;
          line-height: 1.6;
          margin: 15px 0;
        }
        .button {
          display: inline-block;
          background: #dc2626;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          margin-top: 20px;
          transition: background 0.3s;
        }
        .button:hover {
          background: #b91c1c;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">${action === 'Approved' ? '&#10003;' : '&#10007;'}</div>
        <h1>Request ${action}</h1>
        <div class="title">${title}</div>
        <p>The repair request has been successfully ${action.toLowerCase()}. The team has been notified of your decision.</p>
        <p>You can now close this window or visit MyYachtTime to view more details.</p>
        <a href="${siteUrl}" class="button">Go to MyYachtTime</a>
      </div>
    </body>
    </html>
  `;
}

function generateErrorPage(title: string, message: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - MyYachtTime</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          padding: 40px;
          text-align: center;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: #dc2626;
          margin: 0 0 10px 0;
          font-size: 32px;
        }
        p {
          color: #666;
          line-height: 1.6;
          margin: 15px 0;
        }
        .button {
          display: inline-block;
          background: #dc2626;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          margin-top: 20px;
          transition: background 0.3s;
        }
        .button:hover {
          background: #b91c1c;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${Deno.env.get('SITE_URL') || 'https://yourdomain.com'}" class="button">Go to MyYachtTime</a>
      </div>
    </body>
    </html>
  `;
}
