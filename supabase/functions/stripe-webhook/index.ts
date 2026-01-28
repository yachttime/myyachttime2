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
      const yachtId = session.metadata?.yacht_id;

      if (!invoiceId) {
        console.error('No invoice_id in session metadata');
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

      // Get invoice details for notification
      const { data: invoice } = await supabase
        .from('yacht_invoices')
        .select('repair_title, invoice_amount, yachts(name)')
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