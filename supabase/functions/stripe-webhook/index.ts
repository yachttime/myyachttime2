import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, Stripe-Signature',
};

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_intent?: string;
      payment_status?: string;
      metadata?: {
        invoice_id?: string;
        repair_request_id?: string;
        payment_type?: string;
        yacht_id?: string;
        user_id?: string;
      };
      amount_total?: number;
      payment_method_types?: string[];
    };
  };
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
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // Verify webhook signature if secret is configured
    if (stripeWebhookSecret && signature) {
      // Basic signature verification
      const elements = signature.split(',');
      const timestamp = elements.find(e => e.startsWith('t='))?.substring(2);
      const signatureHash = elements.find(e => e.startsWith('v1='))?.substring(3);

      if (!timestamp || !signatureHash) {
        throw new Error('Invalid signature format');
      }

      const payload = `${timestamp}.${body}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(stripeWebhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBytes = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payload)
      );
      const expectedSignature = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (expectedSignature !== signatureHash) {
        throw new Error('Invalid signature');
      }
    }

    const event: StripeEvent = JSON.parse(body);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing Stripe webhook event:', event.type);

    // Handle checkout session completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      const repairRequestId = session.metadata?.repair_request_id;
      const paymentType = session.metadata?.payment_type;
      const yachtId = session.metadata?.yacht_id;

      // Handle deposit payments for repair requests
      if (paymentType === 'deposit' && repairRequestId) {
        console.log('Processing deposit payment for repair request:', repairRequestId);

        // Fetch payment intent details if available
        let paymentMethod = session.payment_method_types?.[0] || 'card';
        const paymentIntentId = session.payment_intent;

        if (paymentIntentId && stripeSecretKey) {
          try {
            const piResponse = await fetch(
              `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
              {
                headers: {
                  'Authorization': `Bearer ${stripeSecretKey}`,
                },
              }
            );
            if (piResponse.ok) {
              const piData = await piResponse.json();
              paymentMethod = piData.charges?.data?.[0]?.payment_method_details?.type || paymentMethod;
            }
          } catch (error) {
            console.error('Error fetching payment intent:', error);
          }
        }

        // Update repair request with deposit payment info
        const { error: updateError } = await supabase
          .from('repair_requests')
          .update({
            deposit_payment_status: 'paid',
            deposit_paid_at: new Date().toISOString(),
            deposit_stripe_payment_intent_id: paymentIntentId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', repairRequestId);

        if (updateError) {
          console.error('Error updating repair request deposit:', updateError);
          throw updateError;
        }

        // Get repair request details
        const { data: repairRequest } = await supabase
          .from('repair_requests')
          .select(`
            title,
            deposit_amount,
            deposit_email_recipient,
            yachts(name),
            is_retail_customer,
            customer_email,
            customer_name
          `)
          .eq('id', repairRequestId)
          .single();

        // Create notification for staff
        await supabase.from('admin_notifications').insert({
          message: `Deposit received for ${repairRequest?.title || 'repair'} - $${parseFloat(repairRequest?.deposit_amount || 0).toFixed(2)}`,
          yacht_id: yachtId || null,
          reference_id: repairRequestId,
          created_at: new Date().toISOString(),
        });

        // Add message to owner chat if yacht-based
        if (yachtId) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: yachtId,
            sender_role: 'staff',
            message: `Deposit payment confirmed for ${repairRequest?.title || 'repair'} - $${parseFloat(repairRequest?.deposit_amount || 0).toFixed(2)}. Work will begin shortly!`,
            created_at: new Date().toISOString(),
          });
        }

        // Send deposit confirmation email to customer
        const customerEmail = repairRequest?.customer_email || repairRequest?.deposit_email_recipient;
        const customerName = repairRequest?.customer_name || 'Valued Customer';
        const yachtName = repairRequest?.yachts?.name || 'My Yacht Time';

        if (customerEmail) {
          try {
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (!resendApiKey) {
              console.error('RESEND_API_KEY not configured');
            } else {
              const emailResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'My Yacht Time <notifications@myyachttime.com>',
                  to: [customerEmail],
                  subject: `Deposit Confirmed - ${repairRequest?.title}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #3b82f6;">Deposit Confirmed</h2>
                      <p>Dear ${customerName},</p>
                      <p>Thank you! Your deposit payment has been successfully processed.</p>

                      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Deposit Details</h3>
                        <p><strong>Service:</strong> ${repairRequest?.title || 'Repair Service'}</p>
                        <p><strong>Deposit Amount:</strong> $${parseFloat(repairRequest?.deposit_amount || 0).toFixed(2)}</p>
                        <p><strong>Yacht:</strong> ${yachtName}</p>
                        <p><strong>Payment Method:</strong> ${paymentMethod === 'us_bank_account' ? 'ACH Bank Transfer' : 'Credit/Debit Card'}</p>
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
                    { name: 'repair_request_id', value: repairRequestId },
                  ],
                }),
              });

              if (emailResponse.ok) {
                const emailData = await emailResponse.json();
                console.log(`Deposit confirmation email sent to ${customerEmail}, ID: ${emailData.id}`);
              } else {
                const errorText = await emailResponse.text();
                console.error('Failed to send deposit confirmation email:', errorText);
              }
            }
          } catch (emailError) {
            console.error('Error sending deposit confirmation email:', emailError);
          }
        }

        console.log(`Deposit for repair request ${repairRequestId} marked as paid`);

        return new Response(
          JSON.stringify({ received: true }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Handle invoice payments
      if (!invoiceId) {
        console.error('No invoice_id or repair_request_id in session metadata');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch payment intent details if available
      let paymentMethod = session.payment_method_types?.[0] || 'card';
      const paymentIntentId = session.payment_intent;

      if (paymentIntentId && stripeSecretKey) {
        try {
          const piResponse = await fetch(
            `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
            {
              headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
              },
            }
          );
          if (piResponse.ok) {
            const piData = await piResponse.json();
            paymentMethod = piData.charges?.data?.[0]?.payment_method_details?.type || paymentMethod;
          }
        } catch (error) {
          console.error('Error fetching payment intent:', error);
        }
      }

      // Update invoice as paid
      const { error: updateError } = await supabase
        .from('yacht_invoices')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId || null,
          payment_method: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Error updating invoice:', updateError);
        throw updateError;
      }

      // Get invoice details with repair request and customer info
      const { data: invoice } = await supabase
        .from('yacht_invoices')
        .select(`
          repair_title,
          invoice_amount,
          payment_email_recipient,
          yachts(name),
          repair_requests(is_retail_customer, customer_email, customer_name)
        `)
        .eq('id', invoiceId)
        .single();

      // Create notification for staff
      await supabase.from('admin_notifications').insert({
        message: `Payment received for ${invoice?.repair_title || 'invoice'} - ${invoice?.invoice_amount || '$0.00'}`,
        yacht_id: yachtId || null,
        reference_id: invoiceId,
        created_at: new Date().toISOString(),
      });

      // Add message to owner chat
      if (yachtId) {
        await supabase.from('owner_chat_messages').insert({
          yacht_id: yachtId,
          sender_role: 'staff',
          message: `Payment confirmed for ${invoice?.repair_title || 'invoice'} - ${invoice?.invoice_amount || '$0.00'}. Thank you!`,
          created_at: new Date().toISOString(),
        });
      }

      // Send payment confirmation email to customer
      const repairRequest = invoice?.repair_requests;
      const customerEmail = repairRequest?.customer_email || invoice?.payment_email_recipient;
      const customerName = repairRequest?.customer_name || 'Valued Customer';
      const yachtName = invoice?.yachts?.name || 'My Yacht Time';

      if (customerEmail) {
        try {
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (!resendApiKey) {
            console.error('RESEND_API_KEY not configured');
          } else {
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'My Yacht Time <notifications@myyachttime.com>',
                to: [customerEmail],
                subject: `Payment Confirmed - ${invoice?.repair_title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #059669;">Payment Confirmed</h2>
                    <p>Dear ${customerName},</p>
                    <p>Thank you! Your payment has been successfully processed.</p>

                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0;">Payment Details</h3>
                      <p><strong>Service:</strong> ${invoice?.repair_title || 'Service'}</p>
                      <p><strong>Amount Paid:</strong> ${invoice?.invoice_amount || '$0.00'}</p>
                      <p><strong>Yacht:</strong> ${yachtName}</p>
                      <p><strong>Payment Method:</strong> ${paymentMethod === 'us_bank_account' ? 'ACH Bank Transfer' : 'Credit/Debit Card'}</p>
                    </div>

                    <p>A receipt has been sent to your email from Stripe.</p>
                    <p>If you have any questions, please don't hesitate to contact us.</p>

                    <p>Best regards,<br>My Yacht Time Team</p>
                  </div>
                `,
                tags: [
                  { name: 'category', value: 'payment_confirmation' },
                  { name: 'invoice_id', value: invoiceId },
                ],
              }),
            });

            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              console.log(`Payment confirmation email sent to ${customerEmail}, ID: ${emailData.id}`);

              // Update email engagement tracking
              await supabase
                .from('yacht_invoices')
                .update({
                  payment_confirmation_email_sent_at: new Date().toISOString(),
                  payment_confirmation_resend_id: emailData.id,
                })
                .eq('id', invoiceId);
            } else {
              const errorText = await emailResponse.text();
              console.error('Failed to send payment confirmation email:', errorText);
            }
          }
        } catch (emailError) {
          console.error('Error sending payment confirmation email:', emailError);
        }
      }

      console.log(`Invoice ${invoiceId} marked as paid`);
    }

    // Handle payment intent succeeded (backup)
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Try to find invoice by payment intent ID
      const { data: invoice } = await supabase
        .from('yacht_invoices')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .single();

      if (invoice && invoice.payment_status !== 'paid') {
        await supabase
          .from('yacht_invoices')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice.id);

        console.log(`Invoice ${invoice.id} marked as paid via payment_intent.succeeded`);
      }
    }

    // Handle failed payments
    if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
      const object = event.data.object;
      const invoiceId = object.metadata?.invoice_id;

      if (invoiceId) {
        const { error: updateError } = await supabase
          .from('yacht_invoices')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        if (updateError) {
          console.error(`Error marking invoice ${invoiceId} as failed:`, updateError);
        } else {
          console.log(`Invoice ${invoiceId} marked as failed`);
        }
      } else {
        console.log(`No invoice_id found in ${event.type} event metadata`);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({
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