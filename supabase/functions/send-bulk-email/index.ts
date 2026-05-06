import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { parseRequestBody, validateRequired, validateEmailArray, validateStringLength } from '../_shared/validation.ts';
import { withErrorHandling, successResponse } from '../_shared/response.ts';

interface Attachment {
  filename: string;
  content: string;
  contentType: string;
  size: number;
}

interface BulkEmailRequest {
  recipients: string[];
  cc_recipients?: string[];
  subject: string;
  message: string;
  yacht_name?: string;
  attachments?: Attachment[];
}

Deno.serve(withErrorHandling(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('Email service not configured. Please add RESEND_API_KEY.');
    }

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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, first_name, last_name, company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['staff', 'manager', 'master', 'mechanic'].includes(profile.role)) {
      throw new Error('Unauthorized: Only staff, mechanics, managers, and master users can send bulk emails');
    }

    const body = await parseRequestBody<BulkEmailRequest>(req);
    validateRequired(body, ['recipients', 'subject', 'message']);

    // Validate recipients without the 100-address cap — large broadcasts are batched internally
    if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
      throw new Error('recipients must be a non-empty array');
    }
    const emailRegexPre = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients: string[] = body.recipients.map((e: any, i: number) => {
      if (typeof e !== 'string' || !emailRegexPre.test(e)) {
        throw new Error(`recipients[${i}] is not a valid email address`);
      }
      return e as string;
    });

    validateStringLength(body.subject, 'subject', { min: 1, max: 500 });
    validateStringLength(body.message, 'message', { min: 1, max: 50000 });

    let cc_recipients: string[] | undefined;
    if (body.cc_recipients && body.cc_recipients.length > 0) {
      cc_recipients = validateEmailArray(body.cc_recipients, 'cc_recipients');
    }

    const { subject, message, yacht_name, attachments } = body;

    if (attachments && attachments.length > 0) {
      const maxAttachmentSize = 40 * 1024 * 1024;
      let totalSize = 0;

      for (const attachment of attachments) {
        totalSize += attachment.size;
        if (totalSize > maxAttachmentSize) {
          throw new Error('Total attachment size cannot exceed 40MB');
        }
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }

    if (cc_recipients) {
      for (const email of cc_recipients) {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid CC email address: ${email}`);
        }
      }
    }

    let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    fromEmail = fromEmail.trim();

    const senderName = profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : 'Yacht Management Team';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .message-body { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0891b2; white-space: pre-wrap; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Message from Yacht Management</h1>
            ${yacht_name ? `<p style="margin: 10px 0 0 0; font-size: 2em; font-weight: 600;">${yacht_name}</p>` : ''}
          </div>
          <div class="content">
            <div class="message-body">
              ${message}
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Sent by: ${senderName}
            </p>
            <p style="color: #666; font-size: 13px; margin-top: 10px; font-style: italic;">
              Please do not reply to this email. If you need to contact us, email us direct at <a href="mailto:sales@azmarine.net" style="color: #0891b2;">sales@azmarine.net</a>
            </p>
          </div>
          <div class="footer">
            <p>This message was sent via the Yacht Management System.</p>
            <p>&copy; ${new Date().getFullYear()} Yacht Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const attachmentPayload = attachments && attachments.length > 0
      ? attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType,
        }))
      : undefined;

    const tags = [{ name: 'category', value: 'bulk-message' }];

    let resendEmailIds: string[] = [];
    let primaryEmailId: string | null = null;
    let recipientEmailIdMap: Array<{ email: string; resendEmailId: string }> = [];

    console.log('Sending bulk email to:', recipients.length, 'recipients');

    if (recipients.length === 1) {
      const emailPayload: any = {
        from: fromEmail,
        to: recipients,
        subject,
        html: htmlContent,
        tags,
      };
      if (cc_recipients && cc_recipients.length > 0) emailPayload.cc = cc_recipients;
      if (attachmentPayload) emailPayload.attachments = attachmentPayload;

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
              errorMessage += '\n\nTo fix this:\n1. Go to resend.com/domains and verify your domain\n2. In Supabase Edge Functions, add RESEND_FROM_EMAIL secret\n3. Or for testing, only send emails to your verified address';
            }
          }
        } catch {
          errorMessage = `Resend Error (${emailResponse.status}): ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const emailData = await emailResponse.json();
      primaryEmailId = emailData.id;
      resendEmailIds = [emailData.id];
      recipientEmailIdMap = [{ email: recipients[0], resendEmailId: emailData.id }];
      console.log('Single email sent successfully:', emailData.id);
    } else {
      // Resend batch API limit is 100 per call — chunk and send in multiple requests
      const BATCH_SIZE = 100;
      const allSentEmails: Array<{ id: string }> = [];

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const chunk = recipients.slice(i, i + BATCH_SIZE);
        const batchPayload = chunk.map(recipient => {
          const item: any = {
            from: fromEmail,
            to: [recipient],
            subject,
            html: htmlContent,
            tags,
          };
          if (cc_recipients && cc_recipients.length > 0) item.cc = cc_recipients;
          if (attachmentPayload) item.attachments = attachmentPayload;
          return item;
        });

        console.log(`Sending batch ${Math.floor(i / BATCH_SIZE) + 1}: recipients ${i + 1}–${i + chunk.length}`);

        const batchResponse = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batchPayload),
        });

        if (!batchResponse.ok) {
          const errorText = await batchResponse.text();
          console.error('Resend batch API error:', errorText);
          let errorMessage = 'Failed to send email via Resend';
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.message) {
              errorMessage = `Resend Error: ${errorData.message}`;
              if (errorData.message.includes('You can only send testing emails to your own email address')) {
                errorMessage += '\n\nTo fix this:\n1. Go to resend.com/domains and verify your domain\n2. In Supabase Edge Functions, add RESEND_FROM_EMAIL secret\n3. Or for testing, only send emails to your verified address';
              }
            }
          } catch {
            errorMessage = `Resend Error (${batchResponse.status}): ${errorText}`;
          }
          throw new Error(errorMessage);
        }

        const batchData = await batchResponse.json();
        const chunkSent: Array<{ id: string }> = Array.isArray(batchData) ? batchData : (batchData.data || []);
        allSentEmails.push(...chunkSent);
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} sent successfully:`, chunkSent.length, 'emails');
      }

      resendEmailIds = allSentEmails.map((e: { id: string }) => e.id).filter(Boolean);
      primaryEmailId = resendEmailIds[0] || null;
      recipientEmailIdMap = recipients.map((email, idx) => ({
        email,
        resendEmailId: allSentEmails[idx]?.id || '',
      })).filter(r => r.resendEmailId);
    }

    const recipientsArray = recipients.map(email => ({ email, name: email }));

    console.log('Creating staff message for tracking...');

    const attachmentInfo = attachments && attachments.length > 0
      ? ` with ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}`
      : '';

    const { data: staffMessageData, error: staffMessageError } = await supabase
      .from('staff_messages')
      .insert({
        message: `Bulk email sent: "${subject}" to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}${yacht_name ? ` (${yacht_name})` : ''}${attachmentInfo}`,
        notification_type: 'bulk_email',
        created_by: user.id,
        email_subject: subject,
        email_body: message,
        email_recipients: recipientsArray,
        email_cc_recipients: cc_recipients || [],
        yacht_name: yacht_name || null,
        email_sent_at: new Date().toISOString(),
        resend_email_id: primaryEmailId,
        resend_email_ids: resendEmailIds.length > 0 ? resendEmailIds : null,
        company_id: profile.company_id || null,
      })
      .select()
      .single();

    if (staffMessageError) {
      console.error('Error creating staff message:', staffMessageError);
    } else {
      console.log('Staff message created successfully:', staffMessageData);

      if (staffMessageData && recipientEmailIdMap.length > 0) {
        const trackingRows = recipientEmailIdMap.map(r => ({
          staff_message_id: staffMessageData.id,
          resend_email_id: r.resendEmailId,
          recipient_email: r.email,
          recipient_name: r.email,
        }));

        const { error: trackingError } = await supabase
          .from('staff_message_recipient_tracking')
          .insert(trackingRows);

        if (trackingError) {
          console.error('Error creating recipient tracking rows:', trackingError);
        } else {
          console.log('Recipient tracking rows created:', trackingRows.length);
        }
      }
    }

    if (yacht_name) {
      console.log('Saving message to yacht messages for yacht:', yacht_name);

      const { data: yachtData, error: yachtError } = await supabase
        .from('yachts')
        .select('id')
        .eq('name', yacht_name)
        .single();

      if (yachtError) {
        console.error('Error finding yacht:', yachtError);
      } else if (yachtData) {
        const notificationMessage = `Email Sent: ${subject}\n\n${message}`;

        const { error: notificationError } = await supabase
          .from('admin_notifications')
          .insert({
            user_id: user.id,
            yacht_id: yachtData.id,
            notification_type: 'email_sent',
            message: notificationMessage,
          });

        if (notificationError) {
          console.error('Error saving to admin notifications:', notificationError);
        } else {
          console.log('Message saved to yacht messages successfully');
        }
      }
    }

    return successResponse({
      success: true,
      message: `Email sent successfully to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`,
      emailId: primaryEmailId,
    });
  } catch (error) {
    console.error('Error sending bulk email:', error);
    throw error;
  }
}));
