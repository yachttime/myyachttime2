import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

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
      .select('role, first_name, last_name')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['staff', 'manager', 'master', 'mechanic'].includes(profile.role)) {
      throw new Error('Unauthorized: Only staff, mechanics, managers, and master users can send bulk emails');
    }

    const { recipients, cc_recipients, subject, message, yacht_name, attachments }: BulkEmailRequest = await req.json();

    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    if (!subject || !message) {
      throw new Error('Subject and message are required');
    }

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

    const emailPayload: any = {
      from: fromEmail,
      to: recipients,
      subject: subject,
      html: htmlContent,
      tags: [
        {
          name: 'category',
          value: 'bulk-message',
        },
      ],
    };

    if (cc_recipients && cc_recipients.length > 0) {
      emailPayload.cc = cc_recipients;
    }

    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        content_type: att.contentType,
      }));
    }

    console.log('Sending bulk email to:', recipients.length, 'recipients');

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

    // Log email in staff_messages for tracking and audit trail
    const recipientsArray = recipients.map((email, index) => {
      const recipient = typeof email === 'string' ? email : email;
      const name = recipient;
      return { email: recipient, name };
    });

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
        resend_email_id: emailData.id,
      })
      .select()
      .single();

    if (staffMessageError) {
      console.error('Error creating staff message:', staffMessageError);
    } else {
      console.log('Staff message created successfully:', staffMessageData);
    }

    // If yacht_name is provided, also save to owner_chat_messages so it appears in owner chat
    if (yacht_name) {
      console.log('Saving message to owner chat for yacht:', yacht_name);

      // Get yacht_id from yacht name
      const { data: yachtData, error: yachtError } = await supabase
        .from('yachts')
        .select('id')
        .eq('name', yacht_name)
        .single();

      if (yachtError) {
        console.error('Error finding yacht:', yachtError);
      } else if (yachtData) {
        const chatMessage = `Email Sent: ${subject}\n\n${message}`;

        const { error: chatError } = await supabase
          .from('owner_chat_messages')
          .insert({
            yacht_id: yachtData.id,
            user_id: user.id,
            message: chatMessage,
          });

        if (chatError) {
          console.error('Error saving to owner chat:', chatError);
        } else {
          console.log('Message saved to owner chat successfully');
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent successfully to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`,
        emailId: emailData.id,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending bulk email:', error);
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
