import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  invoiceId: string;
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

    const { invoiceId, recipientEmail, recipientName }: EmailRequest = await req.json();

    if (!invoiceId || !recipientEmail) {
      throw new Error('Invoice ID and recipient email are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address');
    }

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('yacht_invoices')
      .select('*, yachts(name)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.payment_link_url) {
      throw new Error('Payment link not generated yet');
    }

    // Check if user has access to this invoice
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, yacht_id')
      .eq('user_id', user.id)
      .single();

    // For retail customers (no yacht_id), only staff/master/mechanic can send
    // For yacht customers, staff/master/mechanic or the assigned manager can send
    const isRetailCustomer = !invoice.yacht_id;
    const hasAccess = profile?.role === 'master' ||
                      profile?.role === 'staff' ||
                      profile?.role === 'mechanic' ||
                      (!isRetailCustomer && profile?.role === 'manager' && profile?.yacht_id === invoice.yacht_id);

    if (!hasAccess) {
      throw new Error('Unauthorized to send this invoice');
    }

    // First, check if we have an invoice file and download it
    let invoiceAttachment = null;

    if (invoice.invoice_file_url && invoice.invoice_file_name) {
      try {
        console.log('Attempting to download invoice file:', {
          url: invoice.invoice_file_url,
          filename: invoice.invoice_file_name
        });

        // Extract the file path from the full URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/invoice-files/path/to/file.pdf
        let filePath = invoice.invoice_file_url;

        // Remove the base URL and bucket name to get just the file path
        if (filePath.includes('/invoice-files/')) {
          filePath = filePath.split('/invoice-files/')[1];
        } else if (filePath.includes('/object/public/invoice-files/')) {
          filePath = filePath.split('/object/public/invoice-files/')[1];
        }

        console.log('Extracted file path:', filePath);

        const { data: fileData, error: fileError } = await supabase.storage
          .from('invoice-files')
          .download(filePath);

        if (fileError) {
          console.error('Error downloading invoice file from storage:', fileError);
        } else if (fileData) {
          console.log('Successfully downloaded file, size:', fileData.size);

          const arrayBuffer = await fileData.arrayBuffer();
          const base64Content = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );

          invoiceAttachment = {
            filename: invoice.invoice_file_name,
            content: base64Content,
          };

          console.log('Successfully prepared attachment:', invoice.invoice_file_name);
        }
      } catch (error) {
        console.error('Error processing invoice attachment:', error);
      }
    } else {
      console.log('No invoice file to attach:', {
        hasUrl: !!invoice.invoice_file_url,
        hasFilename: !!invoice.invoice_file_name
      });
    }

    // Build email HTML content (after we know if attachment exists)
    const yachtName = invoice.yachts?.name || (isRetailCustomer ? 'your vessel' : 'Your Yacht');
    const subject = `Payment Request: ${invoice.repair_title}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669; }
          .button { display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .button:hover { background: #047857; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Payment Request</h1>
            ${!isRetailCustomer ? `<p style="margin: 10px 0 0 0;">${yachtName}</p>` : ''}
          </div>
          <div class="content">
            <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>

            <p>You have received a payment request for ${isRetailCustomer ? 'maintenance work' : `maintenance work completed on <strong>${yachtName}</strong>`}.</p>

            <div class="invoice-details">
              <h3 style="margin-top: 0; color: #059669;">Invoice Details</h3>
              <p><strong>Service:</strong> ${invoice.repair_title}</p>
              ${invoice.repair_description ? `<p><strong>Description:</strong> ${invoice.repair_description}</p>` : ''}
              <p><strong>Amount:</strong> ${invoice.invoice_amount || '$0.00'}</p>
              <p><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}</p>
            </div>

            <p>Please click the button below to securely pay this invoice via Stripe:</p>

            <div style="text-align: center;">
              <a href="${invoice.payment_link_url}" class="button">Pay Invoice Now</a>
            </div>

            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:<br>
            <a href="${invoice.payment_link_url}" style="color: #059669; word-break: break-all;">${invoice.payment_link_url}</a></p>

            <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; font-size: 14px;">
              <strong>Important:</strong> For security reasons, this payment link expires in 24 hours. Please complete your payment at your earliest convenience.
            </p>

            ${invoiceAttachment ? '<p>The invoice PDF is attached to this email for your records.</p>' : ''}

            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

            <p>Thank you for your prompt attention to this matter.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Yacht Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email using Resend if API key is configured
    if (resendApiKey) {
      // Get custom from address from environment variable, or use default test address
      // To use a verified domain: Set RESEND_FROM_EMAIL to something like "Yacht Management <noreply@yourdomain.com>"
      let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';

      // Trim any whitespace that might cause issues
      fromEmail = fromEmail.trim();

      // Validate the from email format
      const emailFormatRegex = /^(?:[a-zA-Z0-9\s]+ <)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;
      if (!emailFormatRegex.test(fromEmail)) {
        console.error('Invalid RESEND_FROM_EMAIL format:', fromEmail);
        throw new Error(`Invalid from email format: "${fromEmail}". Expected format: "email@example.com" or "Name <email@example.com>"`);
      }

      console.log('Using from email:', fromEmail);

      // Fetch secondary email for CC if yacht is assigned
      let ccEmails: string[] = [];
      if (invoice.yacht_id) {
        const { data: ownerProfiles } = await supabase
          .from('user_profiles')
          .select('secondary_email')
          .eq('yacht_id', invoice.yacht_id)
          .eq('role', 'owner')
          .not('secondary_email', 'is', null);

        if (ownerProfiles && ownerProfiles.length > 0) {
          ccEmails = ownerProfiles
            .map(p => p.secondary_email)
            .filter((email): email is string => !!email && email !== recipientEmail);
        }
      }

      const emailPayload: any = {
        from: fromEmail,
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
        tags: [
          {
            name: 'category',
            value: 'payment-invoice',
          },
          {
            name: 'invoice_id',
            value: invoiceId,
          },
        ],
      };

      if (ccEmails.length > 0) {
        emailPayload.cc = ccEmails;
      }

      // Enable click tracking to track when payment links are clicked
      emailPayload.headers = {
        'X-Entity-Ref-ID': invoiceId,
      };

      if (invoiceAttachment) {
        emailPayload.attachments = [invoiceAttachment];
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

            // Check if it's the test mode restriction
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

      // Update invoice to mark that payment email was sent and store resend_email_id for tracking
      await supabase
        .from('yacht_invoices')
        .update({
          payment_email_sent_at: new Date().toISOString(),
          resend_email_id: emailData.id,
          payment_email_recipient: recipientEmail,
        })
        .eq('id', invoiceId);

      // Log the email in owner chat (only for yacht customers, not retail)
      if (invoice.yacht_id) {
        await supabase.from('owner_chat_messages').insert({
          yacht_id: invoice.yacht_id,
          sender_role: 'staff',
          message: `Payment link email sent to ${recipientEmail} for invoice: ${invoice.repair_title}`,
          created_at: new Date().toISOString(),
        });

        // Log to yacht history
        const yachtName = invoice.yachts?.name || 'Unknown Yacht';
        await supabase.from('yacht_history_logs').insert({
          yacht_id: invoice.yacht_id,
          yacht_name: yachtName,
          action: `Payment email for "${invoice.repair_title}" sent to ${recipientEmail}`,
          reference_id: invoice.id,
          reference_type: 'yacht_invoice',
          created_at: new Date().toISOString(),
          created_by: user.id,
          created_by_name: profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : 'Staff',
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
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
      // Resend API key not configured - return error
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
    console.error('Error sending payment link email:', error);
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