import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { payment_type, payment_id } = await req.json();

    if (!payment_type || !payment_id) {
      return new Response(
        JSON.stringify({ error: 'Missing payment_type or payment_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle deposit confirmation resend
    if (payment_type === 'deposit') {
      const { data: repairRequest } = await supabase
        .from('repair_requests')
        .select(`
          id,
          title,
          deposit_amount,
          deposit_paid_at,
          deposit_stripe_payment_intent_id,
          customer_email,
          deposit_email_recipient,
          customer_name,
          yacht_id,
          yachts(name)
        `)
        .eq('id', payment_id)
        .single();

      if (!repairRequest) {
        return new Response(
          JSON.stringify({ error: 'Repair request not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!repairRequest.deposit_paid_at) {
        return new Response(
          JSON.stringify({ error: 'Deposit has not been paid yet' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const customerEmail = repairRequest.customer_email || repairRequest.deposit_email_recipient;
      const customerName = repairRequest.customer_name || 'Valued Customer';
      const yachtName = repairRequest.yachts?.name || 'My Yacht Time';

      if (!customerEmail) {
        return new Response(
          JSON.stringify({ error: 'No customer email found' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Send deposit confirmation email
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'My Yacht Time <notifications@myyachttime.com>',
          to: [customerEmail],
          subject: `Deposit Confirmed - ${repairRequest.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Deposit Confirmed</h2>
              <p>Dear ${customerName},</p>
              <p>Thank you! Your deposit payment has been successfully processed.</p>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Deposit Details</h3>
                <p><strong>Service:</strong> ${repairRequest.title || 'Repair Service'}</p>
                <p><strong>Deposit Amount:</strong> $${parseFloat(repairRequest.deposit_amount || 0).toFixed(2)}</p>
                <p><strong>Yacht:</strong> ${yachtName}</p>
                <p><strong>Payment Date:</strong> ${new Date(repairRequest.deposit_paid_at).toLocaleDateString()}</p>
              </div>

              <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0;"><strong>What's Next?</strong></p>
                <p style="margin: 10px 0 0 0;">Our team will begin work on your repair immediately. You'll be notified once the work is complete and the final invoice is ready.</p>
              </div>

              <p>A receipt has been sent to your email from Stripe.</p>
              <p>If you have any questions, please don't hesitate to contact us.</p>

              <p>Best regards,<br>My Yacht Time Team</p>
            </div>
          `,
          tags: [
            { name: 'category', value: 'deposit_confirmation' },
            { name: 'repair_request_id', value: payment_id },
          ],
        }),
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();

        // Update email tracking
        await supabase
          .from('repair_requests')
          .update({
            deposit_confirmation_email_sent_at: new Date().toISOString(),
            deposit_confirmation_resend_id: emailData.id,
          })
          .eq('id', payment_id);

        return new Response(
          JSON.stringify({ success: true, message: 'Deposit confirmation email sent', email_id: emailData.id }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        const errorText = await emailResponse.text();
        console.error('Failed to send deposit confirmation email:', errorText);
        throw new Error('Failed to send email');
      }
    }

    // Handle invoice confirmation resend
    if (payment_type === 'invoice') {
      const { data: invoice } = await supabase
        .from('yacht_invoices')
        .select(`
          id,
          repair_title,
          invoice_amount,
          paid_at,
          stripe_payment_intent_id,
          payment_email_recipient,
          yacht_id,
          yachts(name),
          repair_requests(is_retail_customer, customer_email, customer_name)
        `)
        .eq('id', payment_id)
        .single();

      if (!invoice) {
        return new Response(
          JSON.stringify({ error: 'Invoice not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!invoice.paid_at) {
        return new Response(
          JSON.stringify({ error: 'Invoice has not been paid yet' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const repairRequest = invoice.repair_requests;
      const customerEmail = repairRequest?.customer_email || invoice.payment_email_recipient;
      const customerName = repairRequest?.customer_name || 'Valued Customer';
      const yachtName = invoice.yachts?.name || 'My Yacht Time';

      if (!customerEmail) {
        return new Response(
          JSON.stringify({ error: 'No customer email found' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Send payment confirmation email
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'My Yacht Time <notifications@myyachttime.com>',
          to: [customerEmail],
          subject: `Payment Confirmed - ${invoice.repair_title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Payment Confirmed</h2>
              <p>Dear ${customerName},</p>
              <p>Thank you! Your payment has been successfully processed.</p>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Payment Details</h3>
                <p><strong>Service:</strong> ${invoice.repair_title || 'Service'}</p>
                <p><strong>Amount Paid:</strong> ${invoice.invoice_amount || '$0.00'}</p>
                <p><strong>Yacht:</strong> ${yachtName}</p>
                <p><strong>Payment Date:</strong> ${new Date(invoice.paid_at).toLocaleDateString()}</p>
              </div>

              <p>A receipt has been sent to your email from Stripe.</p>
              <p>If you have any questions, please don't hesitate to contact us.</p>

              <p>Best regards,<br>My Yacht Time Team</p>
            </div>
          `,
          tags: [
            { name: 'category', value: 'payment_confirmation' },
            { name: 'invoice_id', value: payment_id },
          ],
        }),
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();

        // Update email tracking
        await supabase
          .from('yacht_invoices')
          .update({
            payment_confirmation_email_sent_at: new Date().toISOString(),
            payment_confirmation_resend_id: emailData.id,
          })
          .eq('id', payment_id);

        return new Response(
          JSON.stringify({ success: true, message: 'Payment confirmation email sent', email_id: emailData.id }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        const errorText = await emailResponse.text();
        console.error('Failed to send payment confirmation email:', errorText);
        throw new Error('Failed to send email');
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid payment_type' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
