import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function buildApprovalEmailHtml(
  ownerName: string,
  vesselName: string,
  seasonName: string,
  startDate: string,
  endDate: string,
  annualFee: number,
  grandTotal: number,
  staffSignatureName: string,
  approvedAt: string
): string {
  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Phoenix' });
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vessel Management Agreement — Fully Executed</title>
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
              <p style="margin:8px 0 0;color:#bae6fd;font-size:14px;">Vessel Management Agreement — Fully Executed</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#1e293b;padding:40px;">

              <!-- Success Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#064e3b;border:1px solid #065f46;border-radius:8px;margin:0 0 32px;">
                <tr>
                  <td style="padding:20px 24px;text-align:center;">
                    <p style="margin:0 0 4px;color:#6ee7b7;font-size:28px;">&#10003;</p>
                    <p style="margin:0;color:#34d399;font-size:16px;font-weight:700;">Agreement Fully Executed</p>
                    <p style="margin:4px 0 0;color:#a7f3d0;font-size:13px;">${formatDate(approvedAt)}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#cbd5e1;font-size:16px;line-height:1.6;">Hello ${ownerName},</p>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                Great news! Your <strong style="color:#ffffff;">Vessel Management Agreement</strong> for <strong style="color:#38bdf8;">${vesselName}</strong> has been signed and approved by AZ Marine. Both parties have now executed this agreement.
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
                        <td style="padding:4px 0;color:#e2e8f0;font-size:13px;text-align:right;">${formatDate(startDate)} &ndash; ${formatDate(endDate)}</td>
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

              <!-- Signatures Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;margin:0 0 32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Signatures</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#94a3b8;font-size:13px;">Owner / Manager</td>
                        <td style="padding:6px 0;color:#34d399;font-size:13px;font-weight:600;text-align:right;">${ownerName} &#10003;</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#94a3b8;font-size:13px;">AZ Marine</td>
                        <td style="padding:6px 0;color:#34d399;font-size:13px;font-weight:600;text-align:right;">${staffSignatureName} &#10003;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#cbd5e1;font-size:14px;line-height:1.6;">
                Please keep this email for your records. If you have any questions about your agreement or the upcoming season, don&apos;t hesitate to reach out to the AZ Marine team.
              </p>
              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">We look forward to a great season with you!</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #1e293b;">
              <p style="margin:0 0 8px;color:#475569;font-size:12px;">AZ Marine Services</p>
              <p style="margin:0;color:#475569;font-size:11px;">
                You received this email because your vessel management agreement was approved.
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
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com';

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

    const { agreementId }: { agreementId: string } = await req.json();

    if (!agreementId) {
      return new Response(JSON.stringify({ error: 'agreementId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const recipientEmail = agreement.manager_billing_approval_email || agreement.manager_email;
    const recipientName = agreement.manager_billing_approval_name || agreement.manager_name || 'Valued Manager';

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'No recipient email found on agreement' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured — approval email not sent');
      return new Response(JSON.stringify({ success: false, error: 'Email service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const annualFee = Number(agreement.annual_fee) || 8000;
    const grandTotal = Number(agreement.grand_total) || annualFee;
    const approvedAt = agreement.staff_signature_date || new Date().toISOString();

    const htmlContent = buildApprovalEmailHtml(
      recipientName,
      agreement.vessel_name || 'Your Vessel',
      agreement.season_name || 'Season Agreement',
      agreement.start_date || '',
      agreement.end_date || '',
      annualFee,
      grandTotal,
      agreement.staff_signature_name || 'AZ Marine',
      approvedAt
    );

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: `Agreement Approved: ${agreement.vessel_name || 'Your Vessel'} \u2014 ${agreement.season_name || 'Vessel Management Agreement'}`,
        html: htmlContent,
        tags: [
          { name: 'category', value: 'agreement-approved' },
          { name: 'agreement_id', value: agreementId },
        ],
        headers: { 'X-Entity-Ref-ID': agreementId },
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData);
      return new Response(JSON.stringify({ error: `Email send failed: ${resendData.message || 'Unknown error'}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Agreement approval email sent:', resendData.id, 'to:', recipientEmail, 'for agreement:', agreementId);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id, sentTo: recipientEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('send-agreement-notification error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
