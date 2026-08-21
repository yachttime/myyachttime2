import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface OffSeasonEmailRequest {
  yachtName: string;
  recipientEmail: string;
  recipientName?: string;
  pdfBase64: string;
  estimateCount: number;
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

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

    const { yachtName, recipientEmail, recipientName, pdfBase64, estimateCount }: OffSeasonEmailRequest = await req.json();

    if (!yachtName || !recipientEmail || !pdfBase64) {
      throw new Error('Yacht name, recipient email, and PDF data are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, first_name, last_name')
      .eq('user_id', user.id)
      .single();

    const hasAccess = profile?.role === 'staff' || profile?.role === 'manager' || profile?.role === 'mechanic' || profile?.role === 'master';

    if (!hasAccess) {
      throw new Error('Unauthorized to send off-season estimate emails');
    }

    const subject = `Off-Season Repair Summary: ${yachtName}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .summary { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Off-Season Repair Summary</h1>
            <p style="margin: 10px 0 0 0;">${yachtName}</p>
          </div>
          <div class="content">
            <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>

            <p>Please review the attached off-season repair summary for <strong>${yachtName}</strong>. This document contains ${estimateCount} estimate${estimateCount !== 1 ? 's' : ''} for off-season work that requires your approval.</p>

            <div class="summary">
              <h3 style="margin-top: 0; color: #0d9488;">Summary Details</h3>
              <p><strong>Vessel:</strong> ${yachtName}</p>
              <p><strong>Number of Estimates:</strong> ${estimateCount}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>

            <p>The full details of each estimate, including tasks, line items, and totals, are in the attached PDF. Please review and contact us with any questions or approvals.</p>

            <p>If you have questions, please contact us at sales@azmarine.net or 928-637-6500.</p>

            <p>Best regards,<br>
            AZ Marine Service Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AZ Marine</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (resendApiKey) {
      let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com';
      fromEmail = fromEmail.trim();

      const emailPayload: any = {
        from: fromEmail,
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename: `Off-Season-Repairs-${yachtName.replace(/\s+/g, '-')}.pdf`,
            content: pdfBase64,
          },
        ],
      };

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Resend API error:', errorText);
        throw new Error(`Failed to send email: ${errorText}`);
      }
    } else {
      console.log('No RESEND_API_KEY configured — email not sent');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Off-season summary email sent' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-offseason-estimates-email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
