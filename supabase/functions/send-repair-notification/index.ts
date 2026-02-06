import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
  repairRequestId: string;
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { managerEmails, managerNames, repairTitle, yachtName, submitterName, repairRequestId }: RepairNotificationRequest = await req.json();

    if (!managerEmails || managerEmails.length === 0) {
      throw new Error('No manager emails provided');
    }

    if (!repairRequestId) {
      throw new Error('Repair request ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const siteUrl = Deno.env.get('SITE_URL') || 'https://yourdomain.com';

    // Fetch repair request to check for attachments
    const { data: repairRequest, error: repairError } = await supabase
      .from('repair_requests')
      .select('file_url, file_name')
      .eq('id', repairRequestId)
      .single();

    if (repairError) {
      console.error('Error fetching repair request:', repairError);
    }

    // Download attachment if it exists
    let attachmentData = null;
    if (repairRequest?.file_url && repairRequest?.file_name) {
      try {
        console.log('Attempting to download repair attachment:', {
          url: repairRequest.file_url,
          filename: repairRequest.file_name
        });

        // Extract the file path from the full URL
        let filePath = repairRequest.file_url;

        // Remove the base URL and bucket name to get just the file path
        if (filePath.includes('/repair-files/')) {
          filePath = filePath.split('/repair-files/')[1];
        } else if (filePath.includes('/object/public/repair-files/')) {
          filePath = filePath.split('/object/public/repair-files/')[1];
        }

        console.log('Extracted file path:', filePath);

        const { data: fileData, error: fileError } = await supabase.storage
          .from('repair-files')
          .download(filePath);

        if (fileError) {
          console.error('Error downloading repair file from storage:', fileError);
        } else if (fileData) {
          console.log('Successfully downloaded file, size:', fileData.size);

          const arrayBuffer = await fileData.arrayBuffer();
          const base64Content = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );

          attachmentData = {
            filename: repairRequest.file_name,
            content: base64Content,
          };

          console.log('Successfully prepared attachment:', repairRequest.file_name);
        }
      } catch (error) {
        console.error('Error processing repair attachment:', error);
      }
    }

    // Send email to each manager
    const emailResults = [];
    for (let i = 0; i < managerEmails.length; i++) {
      const email = managerEmails[i];
      const name = managerNames && managerNames[i] ? managerNames[i] : '';

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('Invalid email address:', email);
        emailResults.push({ email, success: false, error: 'Invalid email format' });
        continue;
      }

      // Generate approval and denial tokens for this manager
      const approveToken = generateSecureToken();
      const denyToken = generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 168); // Token expires in 7 days

      // Store tokens in database
      const { error: tokenError } = await supabase
        .from('repair_request_approval_tokens')
        .insert([
          {
            repair_request_id: repairRequestId,
            token: approveToken,
            action_type: 'approve',
            manager_email: email,
            expires_at: expiresAt.toISOString()
          },
          {
            repair_request_id: repairRequestId,
            token: denyToken,
            action_type: 'deny',
            manager_email: email,
            expires_at: expiresAt.toISOString()
          }
        ]);

      if (tokenError) {
        console.error('Error creating tokens for:', email, tokenError);
        emailResults.push({ email, success: false, error: `Token creation failed: ${tokenError.message}` });
        continue;
      }

      // Create approval/denial URLs
      const approveUrl = `${supabaseUrl}/functions/v1/handle-repair-approval?token=${approveToken}`;
      const denyUrl = `${supabaseUrl}/functions/v1/handle-repair-approval?token=${denyToken}`;

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
            .action-buttons { text-align: center; margin: 30px 0; }
            .approve-button { display: inline-block; background: #10b981; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px; font-size: 16px; }
            .deny-button { display: inline-block; background: #ef4444; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px; font-size: 16px; }
            .view-link { display: inline-block; color: #dc2626; text-decoration: underline; margin-top: 10px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            .expiry-notice { background: #fef3c7; border: 1px solid #fbbf24; padding: 10px; border-radius: 6px; margin: 15px 0; font-size: 14px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">⚠️ New Repair Request</h1>
              <p style="margin: 10px 0 0 0;">Requires Your Approval</p>
            </div>
            <div class="content">
              <p>Hello${name ? ` ${name}` : ''},</p>

              <div class="alert-box">
                <p style="margin: 0; font-weight: bold;">A new repair request has been submitted and requires your approval.</p>
              </div>

              <div class="details">
                <h3 style="margin-top: 0; color: #dc2626;">Repair Request Details</h3>
                <p><strong>Yacht:</strong> ${yachtName}</p>
                <p><strong>Title:</strong> ${repairTitle}</p>
                <p><strong>Submitted By:</strong> ${submitterName}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>

              <p style="text-align: center; margin: 25px 0 10px 0; font-size: 18px; font-weight: bold;">Take Action Now:</p>

              <div class="action-buttons">
                <a href="${approveUrl}" class="approve-button" style="color: white;">✓ Approve Request</a>
                <a href="${denyUrl}" class="deny-button" style="color: white;">✗ Deny Request</a>
              </div>

              <div class="expiry-notice">
                ⏰ These quick action links expire in 7 days
              </div>

              <p style="text-align: center; margin-top: 25px;">
                Or <a href="${siteUrl}" class="view-link">log in to MyYachtTime</a> to view full details
              </p>

              <p style="margin-top: 30px;">If you have any questions or need assistance, please contact the service team.</p>

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
        const emailPayload: any = {
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

        // Add attachment if available
        if (attachmentData) {
          emailPayload.attachments = [attachmentData];
        }

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

          // Store the first successful email ID for tracking
          if (emailResults.filter(r => r.success).length === 1) {
            await supabase
              .from('repair_requests')
              .update({
                notification_resend_email_id: emailData.id,
                notification_email_sent_at: new Date().toISOString()
              })
              .eq('id', repairRequestId);
          }
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