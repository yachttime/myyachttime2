import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { parseRequestBody, validateRequired, validateEmailArray, validateStringLength } from '../_shared/validation.ts';
import { withErrorHandling, successResponse } from '../_shared/response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Supabase edge function body limit is ~6MB — stay well under it
const MAX_BODY_BYTES = 5 * 1024 * 1024;

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Check Content-Length before attempting to parse body — avoids worker crash on oversized payloads
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return new Response(
      JSON.stringify({ error: 'Request body too large. Total attachments must be under 4MB.' }),
      { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured. Please add RESEND_API_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, first_name, last_name, company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['staff', 'manager', 'master', 'mechanic'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only staff, mechanics, managers, and master users can send bulk emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: BulkEmailRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    validateRequired(body, ['recipients', 'subject', 'message']);

    if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'recipients must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients: string[] = body.recipients.map((e: any, i: number) => {
      if (typeof e !== 'string' || !emailRegex.test(e)) {
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
      const maxTotalSize = 4 * 1024 * 1024;
      let totalSize = 0;
      for (const attachment of attachments) {
        totalSize += attachment.size;
        if (totalSize > maxTotalSize) {
          return new Response(
            JSON.stringify({ error: 'Total attachment size cannot exceed 4MB' }),
            { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@myyachttime.com';
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
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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

    // Store a truncated version of the message body to avoid DB payload issues
    const emailBodyForStorage = message.length > 5000 ? message.slice(0, 5000) + '...' : message;

    const { data: staffMessageData, error: staffMessageError } = await supabase
      .from('staff_messages')
      .insert({
        message: `Bulk email sent: "${subject}" to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}${yacht_name ? ` (${yacht_name})` : ''}${attachmentInfo}`,
        notification_type: 'bulk_email',
        created_by: user.id,
        email_subject: subject,
        email_body: emailBodyForStorage,
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
      console.log('Staff message created successfully:', staffMessageData?.id);

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
        .ilike('name', yacht_name)
        .maybeSingle();

      if (yachtError) {
        console.error('Error finding yacht:', yachtError);
      } else if (yachtData) {
        const notificationMessage = `Email Sent: ${subject}\n\n${emailBodyForStorage}`;

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

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent successfully to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`,
        emailId: primaryEmailId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unhandled error in send-bulk-email:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
