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
        work_order_id?: string;
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
      const workOrderId = session.metadata?.work_order_id;
      const paymentType = session.metadata?.payment_type;
      const yachtId = session.metadata?.yacht_id;

      // Handle deposit payments for repair requests
      if (paymentType === 'deposit' && repairRequestId) {
        console.log('Processing deposit payment for repair request:', repairRequestId);

        // Check if deposit is already paid
        const { data: existingRequest } = await supabase
          .from('repair_requests')
          .select('deposit_payment_status, deposit_paid_at, deposit_stripe_payment_intent_id')
          .eq('id', repairRequestId)
          .single();

        if (existingRequest?.deposit_payment_status === 'paid' && existingRequest.deposit_paid_at) {
          console.log('Deposit already paid for repair request:', repairRequestId, 'Ignoring duplicate payment.');

          // Log this as a potential duplicate payment that may need refunding
          await supabase.from('admin_notifications').insert({
            message: `⚠️ DUPLICATE DEPOSIT PAYMENT detected for repair ${repairRequestId.substring(0, 8)}. Original payment: ${existingRequest.deposit_stripe_payment_intent_id}. New payment intent: ${session.payment_intent}. Please review and refund if necessary.`,
            yacht_id: yachtId || null,
            reference_id: repairRequestId,
            created_at: new Date().toISOString(),
          });

          return new Response(
            JSON.stringify({ received: true, warning: 'Duplicate payment detected' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
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

        // Update repair request with deposit payment info
        const { data: updatedRequest, error: updateError } = await supabase
          .from('repair_requests')
          .update({
            deposit_payment_status: 'paid',
            deposit_paid_at: new Date().toISOString(),
            deposit_stripe_payment_intent_id: paymentIntentId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', repairRequestId)
          .eq('deposit_payment_status', 'pending') // Only update if still pending
          .select('deposit_stripe_checkout_session_id')
          .single();

        if (updateError) {
          console.error('Error updating repair request deposit:', updateError);
          throw updateError;
        }

        // Deactivate the payment link to prevent further payments
        if (updatedRequest?.deposit_stripe_checkout_session_id) {
          try {
            const deactivateResponse = await fetch(
              `https://api.stripe.com/v1/payment_links/${updatedRequest.deposit_stripe_checkout_session_id}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${stripeSecretKey}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ 'active': 'false' }).toString(),
              }
            );

            if (deactivateResponse.ok) {
              console.log('Successfully deactivated deposit payment link:', updatedRequest.deposit_stripe_checkout_session_id);
            } else {
              console.error('Failed to deactivate payment link:', await deactivateResponse.text());
            }
          } catch (deactivateError) {
            console.error('Error deactivating payment link:', deactivateError);
            // Don't throw - payment was successful, just log the error
          }
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

                // Update email tracking
                await supabase
                  .from('repair_requests')
                  .update({
                    deposit_confirmation_email_sent_at: new Date().toISOString(),
                    deposit_confirmation_resend_id: emailData.id,
                  })
                  .eq('id', repairRequestId);
              } else {
                const errorText = await emailResponse.text();
                console.error('Failed to send deposit confirmation email:', errorText);
              }
            }
          } catch (emailError) {
            console.error('Error sending deposit confirmation email:', emailError);
          }
        } else {
          console.error('No customer email found for deposit confirmation');
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

      // Handle deposit payments for work orders
      if (paymentType === 'work_order_deposit' && workOrderId) {
        console.log('Processing deposit payment for work order:', workOrderId);

        const { data: existingWorkOrder } = await supabase
          .from('work_orders')
          .select('deposit_payment_status, deposit_paid_at, deposit_stripe_payment_intent_id')
          .eq('id', workOrderId)
          .single();

        if (existingWorkOrder?.deposit_payment_status === 'paid' && existingWorkOrder.deposit_paid_at) {
          console.log('Deposit already paid for work order:', workOrderId, 'Ignoring duplicate payment.');

          await supabase.from('admin_notifications').insert({
            message: `⚠️ DUPLICATE DEPOSIT PAYMENT detected for work order ${workOrderId.substring(0, 8)}. Original payment: ${existingWorkOrder.deposit_stripe_payment_intent_id}. New payment intent: ${session.payment_intent}. Please review and refund if necessary.`,
            yacht_id: yachtId || null,
            reference_id: workOrderId,
            created_at: new Date().toISOString(),
          });

          return new Response(
            JSON.stringify({ received: true, warning: 'Duplicate payment detected' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

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

        const { data: updatedWorkOrder, error: updateError } = await supabase
          .from('work_orders')
          .update({
            deposit_payment_status: 'paid',
            deposit_paid_at: new Date().toISOString(),
            deposit_stripe_payment_intent_id: paymentIntentId || null,
            deposit_payment_method_type: paymentMethod === 'us_bank_account' ? 'ach' : 'card',
            updated_at: new Date().toISOString(),
          })
          .eq('id', workOrderId)
          .eq('deposit_payment_status', 'pending')
          .select('work_order_number')
          .single();

        if (updateError) {
          console.error('Error updating work order deposit:', updateError);
          throw updateError;
        }

        const { data: workOrder } = await supabase
          .from('work_orders')
          .select(`
            work_order_number,
            deposit_amount,
            customer_name,
            customer_email,
            yachts(name)
          `)
          .eq('id', workOrderId)
          .single();

        await supabase.from('admin_notifications').insert({
          message: `Deposit received for Work Order ${workOrder?.work_order_number || workOrderId.substring(0, 8)} - $${parseFloat(workOrder?.deposit_amount || 0).toFixed(2)}`,
          yacht_id: yachtId || null,
          reference_id: workOrderId,
          created_at: new Date().toISOString(),
        });

        if (yachtId) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: yachtId,
            sender_role: 'staff',
            message: `Deposit payment confirmed for Work Order ${workOrder?.work_order_number} - $${parseFloat(workOrder?.deposit_amount || 0).toFixed(2)}. Work will begin shortly!`,
            created_at: new Date().toISOString(),
          });
        }

        const customerEmail = workOrder?.customer_email;
        const customerName = workOrder?.customer_name || 'Valued Customer';
        const yachtName = workOrder?.yachts?.name || 'My Yacht Time';

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
                  subject: `Deposit Confirmed - Work Order ${workOrder?.work_order_number}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #3b82f6;">Deposit Confirmed</h2>
                      <p>Dear ${customerName},</p>
                      <p>Thank you! Your deposit payment has been successfully processed.</p>

                      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Deposit Details</h3>
                        <p><strong>Work Order:</strong> ${workOrder?.work_order_number}</p>
                        <p><strong>Deposit Amount:</strong> $${parseFloat(workOrder?.deposit_amount || 0).toFixed(2)}</p>
                        <p><strong>Yacht:</strong> ${yachtName}</p>
                        <p><strong>Payment Method:</strong> ${paymentMethod === 'us_bank_account' ? 'ACH Bank Transfer' : 'Credit/Debit Card'}</p>
                      </div>

                      <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0;"><strong>What's Next?</strong></p>
                        <p style="margin: 10px 0 0 0;">Our team will begin work immediately. You'll be notified once the work is complete and the final invoice is ready.</p>
                      </div>

                      <p>A receipt has been sent to your email from Stripe.</p>
                      <p>If you have any questions, please don't hesitate to contact us.</p>

                      <p>Best regards,<br>My Yacht Time Team</p>
                    </div>
                  `,
                  tags: [
                    { name: 'category', value: 'deposit_confirmation' },
                    { name: 'work_order_id', value: workOrderId },
                  ],
                }),
              });

              if (emailResponse.ok) {
                const emailData = await emailResponse.json();
                console.log(`Deposit confirmation email sent to ${customerEmail}, ID: ${emailData.id}`);

                await supabase
                  .from('work_orders')
                  .update({
                    deposit_confirmation_email_sent_at: new Date().toISOString(),
                  })
                  .eq('id', workOrderId);
              }
            }
          } catch (emailError) {
            console.error('Error sending deposit confirmation email:', emailError);
          }
        }

        console.log(`Deposit for work order ${workOrderId} marked as paid`);

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

      // Handle estimating invoice payments
      if (paymentType === 'estimating_invoice_payment' && invoiceId) {
        console.log('Processing payment for estimating invoice:', invoiceId);

        const { data: existingInvoice } = await supabase
          .from('estimating_invoices')
          .select('payment_status, balance_due, amount_paid')
          .eq('id', invoiceId)
          .single();

        if (existingInvoice?.payment_status === 'paid' && existingInvoice.balance_due === 0) {
          console.log('Invoice already paid:', invoiceId, 'Ignoring duplicate payment.');

          await supabase.from('admin_notifications').insert({
            message: `⚠️ DUPLICATE INVOICE PAYMENT detected for estimating invoice ${invoiceId.substring(0, 8)}. Please review and refund if necessary.`,
            yacht_id: yachtId || null,
            reference_id: invoiceId,
            created_at: new Date().toISOString(),
          });

          return new Response(
            JSON.stringify({ received: true, warning: 'Duplicate payment detected' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        let paymentMethod = session.payment_method_types?.[0] || 'card';
        const paymentIntentId = session.payment_intent;
        const amountPaid = (session.amount_total || 0) / 100;

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

        const { data: invoice } = await supabase
          .from('estimating_invoices')
          .select('*, yachts(name), work_orders(work_order_number)')
          .eq('id', invoiceId)
          .single();

        const newAmountPaid = (invoice?.amount_paid || 0) + amountPaid;
        const newBalanceDue = invoice?.total_amount - invoice?.deposit_applied - newAmountPaid;
        const newPaymentStatus = newBalanceDue <= 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid';

        const { error: updateError } = await supabase
          .from('estimating_invoices')
          .update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            payment_status: newPaymentStatus,
            final_payment_stripe_payment_intent_id: paymentIntentId || null,
            final_payment_paid_at: new Date().toISOString(),
            final_payment_method_type: paymentMethod === 'us_bank_account' ? 'ach' : 'card',
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);

        if (updateError) {
          console.error('Error updating estimating invoice:', updateError);
          throw updateError;
        }

        await supabase.from('admin_notifications').insert({
          message: `Payment received for Invoice ${invoice?.invoice_number} - $${amountPaid.toFixed(2)} ${newPaymentStatus === 'paid' ? '(PAID IN FULL)' : ''}`,
          yacht_id: yachtId || null,
          reference_id: invoiceId,
          created_at: new Date().toISOString(),
        });

        if (yachtId) {
          await supabase.from('owner_chat_messages').insert({
            yacht_id: yachtId,
            sender_role: 'staff',
            message: `Payment confirmed for Invoice ${invoice?.invoice_number} - $${amountPaid.toFixed(2)}. ${newPaymentStatus === 'paid' ? 'Paid in full. Thank you!' : `Balance remaining: $${newBalanceDue.toFixed(2)}`}`,
            created_at: new Date().toISOString(),
          });
        }

        const customerEmail = invoice?.customer_email;
        const customerName = invoice?.customer_name || 'Valued Customer';
        const yachtName = invoice?.yachts?.name || 'My Yacht Time';

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
                  subject: `Payment Confirmed - Invoice ${invoice?.invoice_number}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #059669;">Payment Confirmed</h2>
                      <p>Dear ${customerName},</p>
                      <p>Thank you! Your payment has been successfully processed.</p>

                      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Payment Details</h3>
                        <p><strong>Invoice:</strong> ${invoice?.invoice_number}</p>
                        <p><strong>Work Order:</strong> ${invoice?.work_orders?.work_order_number || 'N/A'}</p>
                        <p><strong>Amount Paid:</strong> $${amountPaid.toFixed(2)}</p>
                        <p><strong>Yacht:</strong> ${yachtName}</p>
                        <p><strong>Payment Method:</strong> ${paymentMethod === 'us_bank_account' ? 'ACH Bank Transfer' : 'Credit/Debit Card'}</p>
                        ${newPaymentStatus === 'paid' ? '<p style="color: #059669; font-weight: bold;">✓ PAID IN FULL</p>' : `<p><strong>Balance Remaining:</strong> $${newBalanceDue.toFixed(2)}</p>`}
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

                await supabase
                  .from('estimating_invoices')
                  .update({
                    final_payment_confirmation_email_sent_at: new Date().toISOString(),
                  })
                  .eq('id', invoiceId);
              }
            }
          } catch (emailError) {
            console.error('Error sending payment confirmation email:', emailError);
          }
        }

        console.log(`Payment for estimating invoice ${invoiceId} processed: $${amountPaid.toFixed(2)}, status: ${newPaymentStatus}`);

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

      // Handle legacy yacht invoice payments
      if (!invoiceId) {
        console.error('No invoice_id or repair_request_id in session metadata');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if invoice is already paid
      const { data: existingInvoice } = await supabase
        .from('yacht_invoices')
        .select('payment_status, paid_at, stripe_payment_intent_id')
        .eq('id', invoiceId)
        .single();

      if (existingInvoice?.payment_status === 'paid' && existingInvoice.paid_at) {
        console.log('Invoice already paid:', invoiceId, 'Ignoring duplicate payment.');

        // Log this as a potential duplicate payment that may need refunding
        await supabase.from('admin_notifications').insert({
          message: `⚠️ DUPLICATE INVOICE PAYMENT detected for invoice ${invoiceId.substring(0, 8)}. Original payment: ${existingInvoice.stripe_payment_intent_id}. New payment intent: ${session.payment_intent}. Please review and refund if necessary.`,
          yacht_id: yachtId || null,
          reference_id: invoiceId,
          created_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({ received: true, warning: 'Duplicate payment detected' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
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
        .eq('id', invoiceId)
        .eq('payment_status', 'pending'); // Only update if still pending

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