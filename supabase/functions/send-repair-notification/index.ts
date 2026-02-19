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

    const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
    if (!emailFormatRegex.test(fromEmail)) {
      console.error('Invalid RESEND_FROM_EMAIL format:', fromEmail);
      throw new Error(`Invalid from email format: "${fromEmail}". Expected format: "email@example.com" or "Name <email@example.com>"`);
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://yourdomain.com';

    // Fetch full repair request details including estimate PDF URL
    const { data: repairRequest, error: repairError } = await supabase
      .from('repair_requests')
      .select('*, yachts(name)')
      .eq('id', repairRequestId)
      .single();

    if (repairError) {
      console.error('Error fetching repair request:', repairError);
    }

    const estimateAmount = repairRequest?.estimated_repair_cost
      ? `$${parseFloat(repairRequest.estimated_repair_cost).toFixed(2)}`
      : 'TBD';

    // Download repair photo attachment if it exists
    let repairPhotoAttachment = null;
    if (repairRequest?.file_url && repairRequest?.file_name) {
      try {
        let filePath = repairRequest.file_url;
        if (filePath.includes('/repair-files/')) {
          filePath = filePath.split('/repair-files/')[1];
        } else if (filePath.includes('/object/public/repair-files/')) {
          filePath = filePath.split('/object/public/repair-files/')[1];
        }

        const { data: fileData, error: fileError } = await supabase.storage
          .from('repair-files')
          .download(filePath);

        if (fileError) {
          console.error('Error downloading repair file from storage:', fileError);
        } else if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const base64Content = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          repairPhotoAttachment = {
            filename: repairRequest.file_name,
            content: base64Content,
          };
        }
      } catch (error) {
        console.error('Error processing repair photo attachment:', error);
      }
    }

    // Download estimate PDF if this repair request came from an estimate
    let estimatePdfAttachment = null;
    if (repairRequest?.estimate_pdf_url) {
      try {
        console.log('Downloading estimate PDF from:', repairRequest.estimate_pdf_url);
        const pdfResponse = await fetch(repairRequest.estimate_pdf_url);
        if (pdfResponse.ok) {
          const pdfArrayBuffer = await pdfResponse.arrayBuffer();
          const base64Pdf = btoa(
            new Uint8Array(pdfArrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          const estimateNumber = repairRequest.estimate_id ? `EST-${repairRequest.estimate_id.substring(0, 8).toUpperCase()}` : 'Estimate';
          estimatePdfAttachment = {
            filename: `${estimateNumber}-${yachtName.replace(/\s+/g, '-')}.pdf`,
            content: base64Pdf,
          };
          console.log('Successfully prepared estimate PDF attachment');
        } else {
          console.error('Failed to fetch estimate PDF, status:', pdfResponse.status);
        }
      } catch (error) {
        console.error('Error downloading estimate PDF:', error);
      }
    }

    const subject = `New Repair Request: ${repairTitle} — ${yachtName}`;

    // Send email to each manager
    const emailResults = [];
    let firstSuccessfulEmailId: string | null = null;

    for (let i = 0; i < managerEmails.length; i++) {
      const email = managerEmails[i];
      const name = managerNames && managerNames[i] ? managerNames[i] : '';

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('Invalid email address:', email);
        emailResults.push({ email, success: false, error: 'Invalid email format' });
        continue;
      }

      // Reuse existing unused, unexpired tokens for this manager email if available
      const { data: existingTokens } = await supabase
        .from('repair_request_approval_tokens')
        .select('*')
        .eq('repair_request_id', repairRequestId)
        .eq('manager_email', email)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString());

      let approveToken: string;
      let denyToken: string;

      const existingApprove = existingTokens?.find(t => t.action_type === 'approve');
      const existingDeny = existingTokens?.find(t => t.action_type === 'deny');

      if (existingApprove && existingDeny) {
        approveToken = existingApprove.token;
        denyToken = existingDeny.token;
      } else {
        approveToken = crypto.randomUUID();
        denyToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const tokensToInsert = [];
        if (!existingApprove) {
          tokensToInsert.push({ repair_request_id: repairRequestId, token: approveToken, action_type: 'approve', manager_email: email, expires_at: expiresAt.toISOString() });
        } else {
          approveToken = existingApprove.token;
        }
        if (!existingDeny) {
          tokensToInsert.push({ repair_request_id: repairRequestId, token: denyToken, action_type: 'deny', manager_email: email, expires_at: expiresAt.toISOString() });
        } else {
          denyToken = existingDeny.token;
        }

        if (tokensToInsert.length > 0) {
          const { error: tokenError } = await supabase
            .from('repair_request_approval_tokens')
            .insert(tokensToInsert);

          if (tokenError) {
            console.error('Error creating tokens for:', email, tokenError);
            emailResults.push({ email, success: false, error: `Token creation failed: ${tokenError.message}` });
            continue;
          }
        }
      }

      const approveUrl = `${supabaseUrl}/functions/v1/handle-repair-approval?token=${approveToken}`;
      const denyUrl = `${supabaseUrl}/functions/v1/handle-repair-approval?token=${denyToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .estimate-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316; }
            .estimate-details h3 { margin-top: 0; color: #f97316; }
            .estimate-details p { margin: 6px 0; }
            .cost-highlight { font-size: 1.4em; color: #f97316; font-weight: bold; }
            .approval-section { background: #fef3c7; border: 2px solid #f59e0b; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .approval-section h3 { margin-top: 0; color: #92400e; }
            .button-container { display: flex; gap: 15px; justify-content: center; margin: 20px 0; flex-wrap: wrap; }
            .button { display: inline-block; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
            .approve-button { background: #10b981; color: white; }
            .deny-button { background: #ef4444; color: white; }
            .attachment-note { background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 16px; border-radius: 8px; margin: 15px 0; font-size: 14px; color: #1e40af; }
            .contact-info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .contact-info h4 { margin-top: 0; color: #f97316; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Repair Estimate</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">AZ Marine Services — Action Required</p>
            </div>
            <div class="content">
              <p>Hello${name ? ` ${name}` : ''},</p>
              <p>A repair request has been submitted for <strong>${yachtName}</strong> and requires your approval before work can begin.</p>

              <div class="estimate-details">
                <h3>Repair Details</h3>
                <p><strong>Yacht:</strong> ${yachtName}</p>
                <p><strong>Service:</strong> ${repairTitle}</p>
                ${repairRequest?.description ? `<p><strong>Description:</strong> ${repairRequest.description}</p>` : ''}
                <p><strong>Estimated Cost:</strong> <span class="cost-highlight">${estimateAmount}</span></p>
                <p><strong>Submitted By:</strong> ${submitterName}</p>
                <p><strong>Request Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              ${estimatePdfAttachment ? `
              <div class="attachment-note">
                <strong>📄 Estimate PDF Attached</strong> — A detailed estimate PDF is attached to this email for your review.
              </div>
              ` : ''}

              ${repairPhotoAttachment ? `
              <div class="attachment-note">
                <strong>📎 Photo Attached</strong> — A photo related to this repair request is included as an attachment.
              </div>
              ` : ''}

              <div class="approval-section">
                <h3>Approve or Deny This Repair</h3>
                <p>Please review the details above and click below to approve or deny this work. Your response is required before repairs can proceed.</p>
                <div class="button-container">
                  <a href="${approveUrl}" target="_blank" rel="noopener noreferrer" class="button approve-button">✓ Approve Repair</a>
                  <a href="${denyUrl}" target="_blank" rel="noopener noreferrer" class="button deny-button">✗ Deny Repair</a>
                </div>
                <p style="font-size: 13px; color: #78350f; margin-top: 15px;">These approval links expire in 7 days. After approving, we will schedule your repair and keep you updated throughout the process.</p>
              </div>

              <div class="contact-info">
                <h4>Questions?</h4>
                <p>If you have any questions about this estimate or would like to discuss the repair, please reach out to us directly.</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> sales@azmarine.net</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> 928-637-6500</p>
              </div>

              <p>We appreciate your business and look forward to serving you.</p>
              <p>Best regards,<br>AZ Marine Service Team</p>
            </div>
            <div class="footer">
              <p>This estimate is valid for 30 days from the date above.</p>
              <p>&copy; ${new Date().getFullYear()} AZ Marine Services</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const emailPayload: any = {
          from: fromEmail,
          to: [email],
          subject,
          html: htmlContent,
          tags: [
            { name: 'category', value: 'repair-notification' },
          ],
        };

        // Attach estimate PDF first (most important), then repair photo
        const attachments = [];
        if (estimatePdfAttachment) attachments.push(estimatePdfAttachment);
        if (repairPhotoAttachment) attachments.push(repairPhotoAttachment);
        if (attachments.length > 0) emailPayload.attachments = attachments;

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

          // Track the first successful email ID for webhook-based delivery/open/click tracking
          if (!firstSuccessfulEmailId) {
            firstSuccessfulEmailId = emailData.id;
          }
        }
      } catch (error) {
        console.error('Error sending email to:', email, error);
        emailResults.push({ email, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    const failCount = emailResults.length - successCount;

    // Update repair request with correct notification tracking fields
    if (firstSuccessfulEmailId) {
      const sentEmails = emailResults.filter(r => r.success).map(r => r.email);
      await supabase
        .from('repair_requests')
        .update({
          notification_email_sent_at: new Date().toISOString(),
          notification_resend_email_id: firstSuccessfulEmailId,
          notification_recipients: sentEmails.join(', '),
        })
        .eq('id', repairRequestId);
    }

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
