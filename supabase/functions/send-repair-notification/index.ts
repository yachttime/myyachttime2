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

      // Fetch full repair request details for email
      const { data: fullRepairRequest } = await supabase
        .from('repair_requests')
        .select('*, yachts(name)')
        .eq('id', repairRequestId)
        .single();

      const estimateAmount = fullRepairRequest?.estimated_repair_cost
        ? `$${parseFloat(fullRepairRequest.estimated_repair_cost).toFixed(2)}`
        : 'TBD';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .estimate-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316; }
            .approval-section { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .button-container { display: flex; gap: 15px; justify-content: center; margin: 20px 0; }
            .button { display: inline-block; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: all 0.3s; }
            .approve-button { background: #10b981; color: white; }
            .approve-button:hover { background: #059669; }
            .deny-button { background: #ef4444; color: white; }
            .deny-button:hover { background: #dc2626; }
            .contact-info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Repair Estimate</h1>
              <p style="margin: 10px 0 0 0;">AZ Marine Services</p>
            </div>
            <div class="content">
              <p>Hello${name ? ` ${name}` : ''},</p>

              <p>A repair request has been submitted for your yacht and requires your approval to proceed.</p>

              <div class="estimate-details">
                <h3 style="margin-top: 0; color: #f97316;">Repair Details</h3>
                <p><strong>Yacht:</strong> ${yachtName}</p>
                <p><strong>Service:</strong> ${repairTitle}</p>
                ${fullRepairRequest?.description ? `<p><strong>Description:</strong> ${fullRepairRequest.description}</p>` : ''}
                <p><strong>Estimated Cost:</strong> <span style="font-size: 1.25em; color: #f97316; font-weight: bold;">${estimateAmount}</span></p>
                <p><strong>Submitted By:</strong> ${submitterName}</p>
                <p><strong>Request Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>

              <div class="approval-section">
                <h3 style="margin-top: 0; color: #92400e;">Approve or Deny This Estimate</h3>
                <p>Please review the estimate above. Click the button below to approve or deny this work:</p>
                <div class="button-container">
                  <a href="${approveUrl}" target="_blank" rel="noopener noreferrer" class="button approve-button">✓ Approve Estimate</a>
                  <a href="${denyUrl}" target="_blank" rel="noopener noreferrer" class="button deny-button">✗ Deny Estimate</a>
                </div>
                <p style="font-size: 14px; color: #666; margin-top: 15px;">Once you approve, we will schedule your repair and keep you updated throughout the process.</p>
                <p style="font-size: 14px; color: #666;">If you have questions before deciding, please contact us at sales@azmarine.net or 928-637-6500.</p>
              </div>

              ${attachmentData ? '<p><strong>Attached:</strong> Additional documentation or photos related to your repair request.</p>' : ''}

              <div class="contact-info">
                <h4 style="margin-top: 0; color: #f97316;">Questions?</h4>
                <p>If you have any questions about this estimate or would like to discuss the repair in more detail, please don't hesitate to reach out.</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> sales@azmarine.net</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> 928-637-6500</p>
              </div>

              <p>We appreciate your business and look forward to serving you.</p>

              <p>Best regards,<br>
              AZ Marine Service Team</p>
            </div>
            <div class="footer">
              <p>This estimate is valid for 30 days from the date above.</p>
              <p>&copy; ${new Date().getFullYear()} AZ Marine</p>
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

          // Store the first successful email ID for tracking (using same fields as retail customers)
          if (emailResults.filter(r => r.success).length === 1) {
            await supabase
              .from('repair_requests')
              .update({
                estimate_email_sent_at: new Date().toISOString(),
                resend_email_id: emailData.id,
                estimate_email_recipient: email
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