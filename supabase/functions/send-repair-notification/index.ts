import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RepairNotificationRequest {
  managerEmails: string[];
  managerNames: string[];
  repairTitle: string;
  yachtName: string;
  submitterName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { managerEmails, managerNames, repairTitle, yachtName, submitterName }: RepairNotificationRequest = await req.json();

    if (!managerEmails || managerEmails.length === 0) {
      throw new Error('No manager emails provided');
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured - emails will not be sent');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email service not configured',
          message: 'RESEND_API_KEY not set in environment variables'
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    fromEmail = fromEmail.trim();

    // Validate the from email format
    const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
    if (!emailFormatRegex.test(fromEmail)) {
      console.error('Invalid RESEND_FROM_EMAIL format:', fromEmail);
      throw new Error(`Invalid from email format: "${fromEmail}". Expected format: "email@example.com" or "Name <email@example.com>"`);
    }

    const subject = `New Repair Request: ${repairTitle}`;

    // Send email to each manager
    const emailResults = [];
    for (let i = 0; i < managerEmails.length; i++) {
      const email = managerEmails[i];
      const name = managerNames && managerNames[i] ? managerNames[i] : '';

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('Invalid email address:', email);
        continue;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .action-button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">⚠️ New Repair Request</h1>
              <p style="margin: 10px 0 0 0;">Requires Your Attention</p>
            </div>
            <div class="content">
              <p>Hello${name ? ` ${name}` : ''},</p>

              <div class="alert-box">
                <p style="margin: 0; font-weight: bold;">A new repair request has been submitted and requires your review.</p>
              </div>

              <div class="details">
                <h3 style="margin-top: 0; color: #dc2626;">Repair Request Details</h3>
                <p><strong>Yacht:</strong> ${yachtName}</p>
                <p><strong>Title:</strong> ${repairTitle}</p>
                <p><strong>Submitted By:</strong> ${submitterName}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>

              <p>Please log in to the yacht management system to review this repair request, view additional details, and take appropriate action.</p>

              <p style="text-align: center;">
                <a href="${Deno.env.get('SITE_URL') || 'https://yourdomain.com'}" class="action-button" style="color: white;">Review Repair Request</a>
              </p>

              <p>If you have any questions or need assistance, please contact the service team.</p>

              <p>Best regards,<br>
              Yacht Management System</p>
            </div>
            <div class="footer">
              <p>This is an automated notification. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Yacht Management System</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const emailPayload = {
          from: fromEmail,
          to: [email],
          subject: subject,
          html: htmlContent,
          tags: [
            {
              name: 'category',
              value: 'repair-notification',
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
          emailResults.push({ email, success: false, error: errorText });
        } else {
          const emailData = await emailResponse.json();
          console.log('Email sent successfully to:', email, 'ID:', emailData.id);
          emailResults.push({ email, success: true, emailId: emailData.id });
        }
      } catch (error) {
        console.error('Error sending email to:', email, error);
        emailResults.push({ email, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    const failCount = emailResults.length - successCount;

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `Sent ${successCount} of ${emailResults.length} notifications`,
        successCount,
        failCount,
        results: emailResults
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in send-repair-notification:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
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