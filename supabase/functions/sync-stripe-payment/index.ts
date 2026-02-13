import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncRequest {
  invoice_id?: string;
  repair_request_id?: string;
  is_deposit?: boolean;
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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { invoice_id, repair_request_id, is_deposit, payment_intent_id } = body as SyncRequest & { payment_intent_id?: string };

    // Handle manual payment intent sync (when we have the payment intent ID directly)
    if (payment_intent_id && (is_deposit || invoice_id)) {
      console.log('Manual sync with payment intent:', payment_intent_id);

      // Fetch payment intent from Stripe
      const piResponse = await fetch(
        `https://api.stripe.com/v1/payment_intents/${payment_intent_id}`,
        {
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        }
      );

      if (!piResponse.ok) {
        throw new Error('Failed to fetch payment intent from Stripe');
      }

      const paymentIntent = await piResponse.json();

      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment intent status is ${paymentIntent.status}, not succeeded`);
      }

      const paymentMethod = paymentIntent.charges?.data?.[0]?.payment_method_details?.type || 'card';

      // Update deposit
      if (is_deposit && repair_request_id) {
        const { data: repairRequest } = await supabase
          .from('repair_requests')
          .select('*, yachts(name)')
          .eq('id', repair_request_id)
          .single();

        if (!repairRequest) {
          throw new Error('Repair request not found');
        }

        await supabase
          .from('repair_requests')
          .update({
            deposit_payment_status: 'paid',
            deposit_paid_at: new Date().toISOString(),
            deposit_stripe_payment_intent_id: payment_intent_id,
            deposit_payment_method_type: paymentMethod,
            updated_at: new Date().toISOString(),
          })
          .eq('id', repair_request_id);

        await supabase.from('admin_notifications').insert({
          message: `Deposit payment received for ${repairRequest.title} - $${parseFloat(repairRequest.deposit_amount).toFixed(2)}`,
          yacht_id: repairRequest.yacht_id || null,
          reference_id: repair_request_id,
          created_at: new Date().toISOString(),
        });

        if (repairRequest.yacht_id) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: repairRequest.yacht_id,
            sender_role: 'staff',
            message: `Deposit payment confirmed for ${repairRequest.title} - $${parseFloat(repairRequest.deposit_amount).toFixed(2)}. Work will begin shortly!`,
            created_at: new Date().toISOString(),
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Deposit manually synced and marked as paid',
            payment_intent_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update invoice
      if (invoice_id) {
        const { data: invoice } = await supabase
          .from('yacht_invoices')
          .select('*, repair_requests(is_retail_customer, customer_email, customer_name), yachts(name)')
          .eq('id', invoice_id)
          .single();

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        await supabase
          .from('yacht_invoices')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: payment_intent_id,
            payment_method: paymentMethod,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice_id);

        await supabase.from('admin_notifications').insert({
          message: `Payment received for ${invoice.repair_title || 'invoice'} - ${invoice.invoice_amount || '$0.00'}`,
          yacht_id: invoice.yacht_id || null,
          reference_id: invoice_id,
          created_at: new Date().toISOString(),
        });

        if (invoice.yacht_id) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: invoice.yacht_id,
            sender_role: 'staff',
            message: `Payment confirmed for ${invoice.repair_title || 'invoice'} - ${invoice.invoice_amount || '$0.00'}. Thank you!`,
            created_at: new Date().toISOString(),
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Invoice manually synced and marked as paid',
            payment_intent_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle deposit sync
    if (is_deposit && repair_request_id) {
      // Get the repair request
      const { data: repairRequest, error: fetchError } = await supabase
        .from('repair_requests')
        .select('*, yachts(name)')
        .eq('id', repair_request_id)
        .single();

      if (fetchError || !repairRequest) {
        throw new Error('Repair request not found');
      }

      // Check if already paid
      if (repairRequest.deposit_payment_status === 'paid') {
        return new Response(
          JSON.stringify({ success: true, message: 'Deposit already marked as paid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If we have a payment link ID, check its status
      if (repairRequest.deposit_stripe_checkout_session_id) {
        const paymentLinkId = repairRequest.deposit_stripe_checkout_session_id;
        console.log('Checking payment link:', paymentLinkId);

        // Check for successful payments via this link
        // We need to check checkout sessions created from this payment link
        const sessionsResponse = await fetch(
          `https://api.stripe.com/v1/checkout/sessions?payment_link=${paymentLinkId}&limit=100`,
          {
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
            },
          }
        );

        if (sessionsResponse.ok) {
          const sessions = await sessionsResponse.json();
          console.log(`Found ${sessions.data.length} checkout sessions for payment link`);

          // Find ALL paid sessions (in case of double payment)
          const paidSessions = sessions.data.filter((s: any) => s.payment_status === 'paid');
          console.log(`Found ${paidSessions.length} paid sessions`);

          if (paidSessions.length > 0) {
            // Use the first paid session for updating the database
            const paidSession = paidSessions[0];
            const paymentIntentId = paidSession.payment_intent;
            let paymentMethod = paidSession.payment_method_types?.[0] || 'card';

            // Log all payment intents if there are multiple
            if (paidSessions.length > 1) {
              console.warn(`⚠️ DUPLICATE PAYMENTS DETECTED: ${paidSessions.length} payments found`);
              const allPaymentIntents = paidSessions.map((s: any) => s.payment_intent);
              console.warn('Payment Intent IDs:', allPaymentIntents);
            }

            // Fetch payment intent details for more info
            if (paymentIntentId) {
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

            // Update repair request as paid
            const { error: updateError } = await supabase
              .from('repair_requests')
              .update({
                deposit_payment_status: 'paid',
                deposit_paid_at: new Date().toISOString(),
                deposit_stripe_payment_intent_id: paymentIntentId || null,
                deposit_payment_method_type: paymentMethod,
                updated_at: new Date().toISOString(),
              })
              .eq('id', repair_request_id);

            if (updateError) {
              throw updateError;
            }

            // Create notification for staff
            await supabase.from('admin_notifications').insert({
              message: `Deposit payment received for ${repairRequest.title} - $${parseFloat(repairRequest.deposit_amount).toFixed(2)}`,
              yacht_id: repairRequest.yacht_id || null,
              reference_id: repair_request_id,
              created_at: new Date().toISOString(),
            });

            // Add message to owner chat if yacht-related
            if (repairRequest.yacht_id) {
              await supabase.from('owner_chat_messages').insert({
                yacht_id: repairRequest.yacht_id,
                sender_role: 'staff',
                message: `Deposit payment confirmed for ${repairRequest.title} - $${parseFloat(repairRequest.deposit_amount).toFixed(2)}. Work will begin shortly!`,
                created_at: new Date().toISOString(),
              });
            }

            return new Response(
              JSON.stringify({
                success: true,
                message: 'Deposit synced and marked as paid',
                payment_intent_id: paymentIntentId
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          console.error('Failed to fetch checkout sessions:', sessionsResponse.status, await sessionsResponse.text());
        }

        return new Response(
          JSON.stringify({ success: false, message: 'No paid checkout session found for this deposit link' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, message: 'No Stripe payment link ID found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle invoice sync
    if (!invoice_id) {
      throw new Error('invoice_id or repair_request_id is required');
    }

    // Get the invoice
    const { data: invoice, error: fetchError } = await supabase
      .from('yacht_invoices')
      .select('*, repair_requests(is_retail_customer, customer_email, customer_name), yachts(name)')
      .eq('id', invoice_id)
      .single();

    if (fetchError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Check if already paid
    if (invoice.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ success: true, message: 'Invoice already marked as paid' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have a checkout session ID, check its status
    if (invoice.stripe_checkout_session_id) {
      const sessionResponse = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${invoice.stripe_checkout_session_id}`,
        {
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        }
      );

      if (!sessionResponse.ok) {
        throw new Error('Failed to fetch Stripe session');
      }

      const session = await sessionResponse.json();

      // Check if session is paid
      if (session.payment_status === 'paid') {
        const paymentIntentId = session.payment_intent;
        let paymentMethod = session.payment_method_types?.[0] || 'card';

        // Fetch payment intent details for more info
        if (paymentIntentId) {
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
          .eq('id', invoice_id);

        if (updateError) {
          throw updateError;
        }

        // Create notification for staff
        await supabase.from('admin_notifications').insert({
          message: `Payment received for ${invoice.repair_title || 'invoice'} - ${invoice.invoice_amount || '$0.00'}`,
          yacht_id: invoice.yacht_id || null,
          reference_id: invoice_id,
          created_at: new Date().toISOString(),
        });

        // Add message to owner chat if yacht-related
        if (invoice.yacht_id) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: invoice.yacht_id,
            sender_role: 'staff',
            message: `Payment confirmed for ${invoice.repair_title || 'invoice'} - ${invoice.invoice_amount || '$0.00'}. Thank you!`,
            created_at: new Date().toISOString(),
          });
        }

        // Send payment confirmation email
        const repairRequest = invoice.repair_requests;
        const customerEmail = repairRequest?.customer_email || invoice.payment_email_recipient;
        const customerName = repairRequest?.customer_name || 'Valued Customer';
        const yachtName = invoice.yachts?.name || 'My Yacht Time';

        if (customerEmail) {
          try {
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (resendApiKey) {
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
                        <p><strong>Payment Method:</strong> ${paymentMethod === 'us_bank_account' ? 'ACH Bank Transfer' : 'Credit/Debit Card'}</p>
                      </div>

                      <p>A receipt has been sent to your email from Stripe.</p>
                      <p>If you have any questions, please don't hesitate to contact us.</p>

                      <p>Best regards,<br>My Yacht Time Team</p>
                    </div>
                  `,
                  tags: [
                    { name: 'category', value: 'payment_confirmation' },
                    { name: 'invoice_id', value: invoice_id },
                  ],
                }),
              });

              if (emailResponse.ok) {
                const emailData = await emailResponse.json();
                await supabase
                  .from('yacht_invoices')
                  .update({
                    payment_confirmation_email_sent_at: new Date().toISOString(),
                    payment_confirmation_resend_id: emailData.id,
                  })
                  .eq('id', invoice_id);
              }
            }
          } catch (emailError) {
            console.error('Error sending payment confirmation email:', emailError);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Invoice synced and marked as paid',
            payment_intent_id: paymentIntentId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Stripe session status: ${session.payment_status}`,
            session_status: session.status
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: 'No Stripe session ID found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
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
