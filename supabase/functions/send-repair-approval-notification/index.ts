import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RepairApprovalNotification {
  repairRequestId: string;
  repairTitle: string;
  yachtName: string;
  approverName: string;
  estimatedCost?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { repairRequestId, repairTitle, yachtName, approverName, estimatedCost }: RepairApprovalNotification = await req.json();

    if (!repairRequestId) {
      throw new Error('Repair request ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all staff and master users
    const { data: staffUsers, error: staffError } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name, email, notification_email, email_notifications_enabled, role')
      .in('role', ['staff', 'master', 'mechanic'])
      .eq('is_active', true);

    if (staffError) {
      console.error('Error fetching staff users:', staffError);
      throw staffError;
    }

    if (!staffUsers || staffUsers.length === 0) {
      console.log('No staff/master users found to notify');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No staff/master users to notify',
          emailsSent: 0
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Found ${staffUsers.length} staff/master users to notify`);

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

    const subject = `✅ Repair Approved: ${repairTitle}`;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://yourdomain.com';

    // Prepare list of email recipients
    const emailRecipients: Array<{email: string, name: string}> = [];

    for (const user of staffUsers) {
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Team Member';

      // Check if user has email notifications enabled
      if (user.email_notifications_enabled) {
        const emailAddress = user.notification_email || user.email;
        if (emailAddress) {
          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(emailAddress)) {
            emailRecipients.push({ email: emailAddress, name: userName });
          }
        }
      }
    }

    if (emailRecipients.length === 0) {
      console.log('No valid email recipients found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No email recipients with notifications enabled',
          emailsSent: 0
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Sending approval notification to ${emailRecipients.length} recipients`);

    // Send email to each recipient
    const emailResults = [];
    for (const recipient of emailRecipients) {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .view-button { display: inline-block; background: #10b981; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; font-size: 16px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✅ Repair Request Approved</h1>
              <p style="margin: 10px 0 0 0;">Ready to Proceed</p>
            </div>
            <div class="content">
              <p>Hello ${recipient.name},</p>

              <div class="success-box">
                <p style="margin: 0; font-weight: bold;">A repair request has been approved and is ready to proceed.</p>
              </div>

              <div class="details">
                <h3 style="margin-top: 0; color: #10b981;">Approval Details</h3>
                <p><strong>Yacht:</strong> ${yachtName}</p>
                <p><strong>Repair:</strong> ${repairTitle}</p>
                <p><strong>Approved By:</strong> ${approverName}</p>
                ${estimatedCost ? `<p><strong>Estimated Cost:</strong> $${estimatedCost}</p>` : ''}
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>

              <p style="text-align: center; margin: 25px 0;">
                <a href="${siteUrl}" class="view-button" style="color: white;">View in System</a>
              </p>

              <p style="margin-top: 30px;">The repair work can now proceed. Please coordinate with the team to schedule and complete the work.</p>

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
          to: [recipient.email],
          subject: subject,
          html: htmlContent,
          tags: [
            {
              name: 'category',
              value: 'repair-approval',
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
          console.error('Resend API error for', recipient.email, ':', errorText);
          emailResults.push({ email: recipient.email, success: false, error: errorText });
        } else {
          const emailData = await emailResponse.json();
          console.log('Approval email sent successfully to:', recipient.email, 'ID:', emailData.id);
          emailResults.push({ email: recipient.email, success: true, emailId: emailData.id });
        }
      } catch (error) {
        console.error('Error sending email to:', recipient.email, error);
        emailResults.push({
          email: recipient.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    const failCount = emailResults.length - successCount;

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `Sent ${successCount} of ${emailResults.length} approval notifications`,
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
    console.error('Error in send-repair-approval-notification:', error);
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
