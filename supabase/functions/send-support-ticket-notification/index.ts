import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SupportTicketNotificationRequest {
  ticketId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { ticketId }: SupportTicketNotificationRequest = await req.json();

    if (!ticketId) {
      throw new Error('Ticket ID is required');
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

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`
        *,
        user_profiles:user_id (full_name, email_address)
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket not found');
    }

    const { data: staffUsers, error: staffError } = await supabase
      .from('user_profiles')
      .select('email_address, full_name')
      .eq('company_id', ticket.company_id)
      .eq('role', 'master')
      .not('email_address', 'is', null);

    if (staffError) {
      console.error('Error fetching staff users:', staffError);
    }

    const staffEmails = staffUsers?.map(u => u.email_address).filter(Boolean) || [];

    if (staffEmails.length === 0) {
      console.log('No staff emails found to notify');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No staff members found to notify'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const categoryLabels: { [key: string]: string } = {
      'general': 'General Question',
      'billing': 'Billing',
      'technical': 'Technical Issue',
      'account': 'Account Help',
      'feature_request': 'Feature Request',
      'bug_report': 'Bug Report',
      'other': 'Other'
    };

    const priorityColors: { [key: string]: string } = {
      'low': '#6b7280',
      'medium': '#3b82f6',
      'high': '#f97316',
      'urgent': '#ef4444'
    };

    const categoryLabel = categoryLabels[ticket.category] || ticket.category;
    const priorityColor = priorityColors[ticket.priority] || '#3b82f6';
    const siteUrl = Deno.env.get('SITE_URL') || 'https://yourdomain.com';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .ticket-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${priorityColor}; }
          .ticket-meta { display: flex; gap: 15px; margin: 15px 0; flex-wrap: wrap; }
          .meta-item { background: #f3f4f6; padding: 8px 12px; border-radius: 6px; font-size: 14px; }
          .priority-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; color: white; background: ${priorityColor}; font-weight: bold; text-transform: uppercase; font-size: 12px; }
          .message-box { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb; }
          .button { display: inline-block; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; background: #3b82f6; color: white; text-align: center; margin: 20px 0; }
          .button:hover { background: #2563eb; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">New Support Ticket</h1>
            <p style="margin: 10px 0 0 0;">Ticket #${ticket.ticket_number}</p>
          </div>
          <div class="content">
            <p>A new support ticket has been submitted and requires your attention.</p>

            <div class="ticket-details">
              <h2 style="margin-top: 0; color: #1f2937;">${ticket.subject}</h2>

              <div class="ticket-meta">
                <div class="meta-item">
                  <strong>Category:</strong> ${categoryLabel}
                </div>
                <div class="meta-item">
                  <strong>Priority:</strong> <span class="priority-badge">${ticket.priority}</span>
                </div>
                <div class="meta-item">
                  <strong>From:</strong> ${ticket.user_profiles?.full_name || 'Unknown'}
                </div>
                <div class="meta-item">
                  <strong>Submitted:</strong> ${new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>

              <div class="message-box">
                <strong>Message:</strong>
                <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${ticket.message}</p>
              </div>

              ${ticket.attachment_url ? '<p><strong>📎 Attachment:</strong> This ticket includes an attachment.</p>' : ''}
            </div>

            <div style="text-align: center;">
              <a href="${siteUrl}" class="button">View Ticket in Dashboard</a>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              To view and respond to this ticket, log in to your dashboard. You can assign the ticket, update its status, and communicate with the customer directly through the support system.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from your support ticket system.</p>
            <p>&copy; ${new Date().getFullYear()} AZ Marine</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResults = [];

    for (const email of staffEmails) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('Invalid email address:', email);
        emailResults.push({ email, success: false, error: 'Invalid email format' });
        continue;
      }

      try {
        const emailPayload: any = {
          from: fromEmail,
          to: [email],
          subject: `New Support Ticket #${ticket.ticket_number}: ${ticket.subject}`,
          html: htmlContent,
          tags: [
            {
              name: 'category',
              value: 'support-ticket',
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
    console.error('Error in send-support-ticket-notification:', error);
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
