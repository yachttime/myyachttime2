import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  repairRequestId: string;
  recipientEmail: string;
  recipientName?: string;
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

    const { repairRequestId, recipientEmail, recipientName }: EmailRequest = await req.json();

    if (!repairRequestId || !recipientEmail) {
      throw new Error('Repair request ID and recipient email are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address');
    }

    // Fetch repair request details
    const { data: repairRequest, error: repairError } = await supabase
      .from('repair_requests')
      .select('*')
      .eq('id', repairRequestId)
      .single();

    if (repairError || !repairRequest) {
      throw new Error('Repair request not found');
    }

    // Verify this is a retail customer request
    if (!repairRequest.is_retail_customer) {
      throw new Error('This feature is only for retail customer repair requests');
    }

    // Check if user has access (staff/manager/mechanic/master only)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, first_name, last_name')
      .eq('user_id', user.id)
      .single();

    const hasAccess = profile?.role === 'staff' || profile?.role === 'manager' || profile?.role === 'mechanic' || profile?.role === 'master';

    if (!hasAccess) {
      throw new Error('Unauthorized to send estimate emails');
    }

    // Download attachment if it exists
    let attachmentData = null;

    if (repairRequest.file_url && repairRequest.file_name) {
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
    } else {
      console.log('No repair file to attach:', {
        hasUrl: !!repairRequest.file_url,
        hasFilename: !!repairRequest.file_name
      });
    }

    // Generate approval tokens
    const approveToken = crypto.randomUUID();
    const denyToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

    // Store approval tokens
    await supabase
      .from('repair_request_approval_tokens')
      .insert([
        {
          repair_request_id: repairRequestId,
          token: approveToken,
          action_type: 'approve',
          expires_at: expiresAt.toISOString(),
        },
        {
          repair_request_id: repairRequestId,
          token: denyToken,
          action_type: 'deny',
          expires_at: expiresAt.toISOString(),
        },
      ]);

    // Build approval URLs
    const functionUrl = `${supabaseUrl}/functions/v1/handle-repair-approval`;
    const approveUrl = `${functionUrl}?token=${approveToken}`;
    const denyUrl = `${functionUrl}?token=${denyToken}`;

    // Build email HTML content
    const estimateAmount = repairRequest.estimated_repair_cost
      ? `$${parseFloat(repairRequest.estimated_repair_cost).toFixed(2)}`
      : 'TBD';

    const subject = `Repair Estimate: ${repairRequest.title}`;
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
            <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>

            <p>Thank you for your repair inquiry. We've reviewed your request and prepared an estimate for your approval.</p>

            <div class="estimate-details">
              <h3 style="margin-top: 0; color: #f97316;">Repair Details</h3>
              <p><strong>Service:</strong> ${repairRequest.title}</p>
              ${repairRequest.description ? `<p><strong>Description:</strong> ${repairRequest.description}</p>` : ''}
              <p><strong>Estimated Cost:</strong> <span style="font-size: 1.25em; color: #f97316; font-weight: bold;">${estimateAmount}</span></p>
              <p><strong>Request Date:</strong> ${new Date(repairRequest.created_at).toLocaleDateString()}</p>
            </div>

            <div class="approval-section">
              <h3 style="margin-top: 0; color: #92400e;">Approve or Deny This Estimate</h3>
              <p>Please review the estimate above. Click the button below to approve or deny this work:</p>
              <div class="button-container">
                <a href="${approveUrl}" class="button approve-button">✓ Approve Estimate</a>
                <a href="${denyUrl}" class="button deny-button">✗ Deny Estimate</a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 15px;">Once you approve, we will schedule your repair and keep you updated throughout the process.</p>
              <p style="font-size: 14px; color: #666;">If you have questions before deciding, please contact us at service@azmarine.net or 928-637-6500.</p>
            </div>

            ${attachmentData ? '<p><strong>Attached:</strong> Additional documentation or photos related to your repair request.</p>' : ''}

            <div class="contact-info">
              <h4 style="margin-top: 0; color: #f97316;">Questions?</h4>
              <p>If you have any questions about this estimate or would like to discuss the repair in more detail, please don't hesitate to reach out.</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> service@azmarine.net</p>
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

    // Send email using Resend if API key is configured
    if (resendApiKey) {
      let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
      fromEmail = fromEmail.trim();

      // Validate the from email format
      const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
      if (!emailFormatRegex.test(fromEmail)) {
        console.error('Invalid RESEND_FROM_EMAIL format:', fromEmail);
        throw new Error(`Invalid from email format: "${fromEmail}". Expected format: "email@example.com" or "Name <email@example.com>"`);
      }

      console.log('Using from email:', fromEmail);

      const emailPayload: any = {
        from: fromEmail,
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
        tags: [
          {
            name: 'category',
            value: 'repair-estimate',
          },
          {
            name: 'repair_request_id',
            value: repairRequestId,
          },
        ],
      };

      // Enable click and open tracking
      emailPayload.headers = {
        'X-Entity-Ref-ID': repairRequestId,
      };

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
        let errorMessage = 'Failed to send email via Resend';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = `Resend Error: ${errorData.message}`;

            if (errorData.message.includes('You can only send testing emails to your own email address')) {
              errorMessage += '\n\nTo fix this:\n1. Go to resend.com/domains and verify your domain\n2. In Supabase Edge Functions, add RESEND_FROM_EMAIL secret (e.g., "Yacht Mgmt <noreply@yourdomain.com>")\n3. Or for testing, only send emails to your verified address';
            }
          }
        } catch {
          errorMessage = `Resend Error (${emailResponse.status}): ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const emailData = await emailResponse.json();
      console.log('Email sent successfully:', emailData);

      // Update repair request to mark that estimate email was sent
      await supabase
        .from('repair_requests')
        .update({
          estimate_email_sent_at: new Date().toISOString(),
          resend_email_id: emailData.id,
          estimate_email_recipient: recipientEmail,
        })
        .eq('id', repairRequestId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Estimate email sent successfully',
          emailId: emailData.id,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      // Resend API key not configured
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email service not configured. Please add RESEND_API_KEY to enable email sending.',
          message: 'Resend not configured',
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
  } catch (error) {
    console.error('Error sending repair estimate email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
