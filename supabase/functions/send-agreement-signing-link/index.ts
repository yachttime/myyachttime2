import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  agreementId: string;
  recipientEmail: string;
  recipientName?: string;
  signingUrl: string;
}

function buildEmailHtml(
  recipientName: string,
  vesselName: string,
  seasonName: string,
  startDate: string,
  endDate: string,
  annualFee: number,
  grandTotal: number,
  signingUrl: string,
  expiryDays: number
): string {
  const formatDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vessel Management Agreement — Action Required</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0e4b6e 0%,#0891b2 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">AZ Marine</h1>
              <p style="margin:8px 0 0;color:#bae6fd;font-size:14px;">Vessel Management Agreement</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#1e293b;padding:40px;">
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:16px;line-height:1.6;">
                Hello ${recipientName},
              </p>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                A <strong style="color:#ffffff;">Vessel Management Agreement</strong> has been prepared for <strong style="color:#38bdf8;">${vesselName}</strong> and is ready for your signature.
              </p>

              <!-- Agreement Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;margin:0 0 32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Agreement</p>
                    <p style="margin:0 0 16px;color:#ffffff;font-size:16px;font-weight:600;">${seasonName}</p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;color:#94a3b8;font-size:13px;">Period</td>
                        <td style="padding:4px 0;color:#e2e8f0;font-size:13px;text-align:right;">${formatDate(startDate)} – ${formatDate(endDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#94a3b8;font-size:13px;">Annual Management Fee</td>
                        <td style="padding:4px 0;color:#e2e8f0;font-size:13px;text-align:right;">$${annualFee.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0 4px;color:#ffffff;font-size:14px;font-weight:600;border-top:1px solid #334155;">Grand Total</td>
                        <td style="padding:12px 0 4px;color:#34d399;font-size:15px;font-weight:700;text-align:right;border-top:1px solid #334155;">$${grandTotal.toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="${signingUrl}"
                       style="display:inline-block;background-color:#0891b2;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;letter-spacing:0.02em;">
                      Review &amp; Sign Agreement
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instructions -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;margin:0 0 24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">How to Sign</p>
                    <ol style="margin:0;padding-left:20px;color:#cbd5e1;font-size:14px;line-height:1.8;">
                      <li>Click the button above to open the agreement</li>
                      <li>Review all terms carefully</li>
                      <li>Enter your full legal name and click <strong style="color:#ffffff;">Sign Agreement</strong></li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- Expiry Notice -->
              <p style="margin:0 0 24px;color:#f59e0b;font-size:13px;text-align:center;">
                This signing link expires in <strong>${expiryDays} days</strong>. Please sign before the link expires.
              </p>

              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                If the button above does not work, copy and paste this link into your browser:<br/>
                <a href="${signingUrl}" style="color:#38bdf8;word-break:break-all;">${signingUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #1e293b;">
              <p style="margin:0 0 8px;color:#475569;font-size:12px;">AZ Marine Services</p>
              <p style="margin:0;color:#475569;font-size:11px;">
                You received this email because an agreement was prepared for your vessel.<br/>
                If you believe this was sent in error, please contact us.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'AZ Marine <noreply@azmarine.com>';

    // Auth: must be a logged-in master user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Only master users can send signing links' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { agreementId, recipientEmail, recipientName, signingUrl }: EmailRequest = await req.json();

    if (!agreementId || !recipientEmail || !signingUrl) {
      return new Response(JSON.stringify({ error: 'agreementId, recipientEmail, and signingUrl are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the agreement
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: agreement, error: agError } = await serviceSupabase
      .from('vessel_management_agreements')
      .select('*')
      .eq('id', agreementId)
      .maybeSingle();

    if (agError || !agreement) {
      return new Response(JSON.stringify({ error: 'Agreement not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!agreement.signing_token) {
      return new Response(JSON.stringify({ error: 'Agreement does not have a signing token. Please generate one first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate days until expiry
    const tokenAge = agreement.signing_token_created_at
      ? Math.floor((Date.now() - new Date(agreement.signing_token_created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const expiryDays = Math.max(1, 30 - tokenAge);

    const displayName = recipientName || agreement.manager_billing_approval_name || agreement.manager_name || 'Valued Manager';
    const annualFee = Number(agreement.annual_fee) || 8000;
    const grandTotal = Number(agreement.grand_total) || annualFee;

    const htmlContent = buildEmailHtml(
      displayName,
      agreement.vessel_name || 'Your Vessel',
      agreement.season_name || 'Season Agreement',
      agreement.start_date || '',
      agreement.end_date || '',
      annualFee,
      grandTotal,
      signingUrl,
      expiryDays
    );

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured — email not sent');
      return new Response(JSON.stringify({ success: false, error: 'Email service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailPayload = {
      from: fromEmail,
      to: [recipientEmail],
      subject: `Action Required: Sign Vessel Management Agreement — ${agreement.vessel_name || 'Your Vessel'}`,
      html: htmlContent,
      tags: [
        { name: 'category', value: 'agreement-signing' },
        { name: 'agreement_id', value: agreementId },
      ],
      headers: { 'X-Entity-Ref-ID': agreementId },
    };

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData);
      return new Response(JSON.stringify({ error: `Email send failed: ${resendData.message || 'Unknown error'}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the agreement with email tracking data
    await serviceSupabase
      .from('vessel_management_agreements')
      .update({
        signing_email_sent_at: new Date().toISOString(),
        signing_email_recipient: recipientEmail,
        signing_email_resend_id: resendData.id,
        // Clear prior engagement tracking when a new email is sent
        signing_email_delivered_at: null,
        signing_email_opened_at: null,
        signing_email_clicked_at: null,
        signing_email_bounced_at: null,
        signing_email_open_count: 0,
        signing_email_click_count: 0,
      })
      .eq('id', agreementId);

    console.log('Agreement signing link email sent:', resendData.id, 'to:', recipientEmail, 'for agreement:', agreementId);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('send-agreement-signing-link error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
