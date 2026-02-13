import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface InvoicePaymentRequest {
  invoiceId: string;
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

    const { invoiceId }: InvoicePaymentRequest = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('yacht_invoices')
      .select('*, yachts(name), payment_method_type')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Check if user has access to this invoice
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, yacht_id')
      .eq('user_id', user.id)
      .single();

    const hasAccess = profile?.role === 'master' ||
                      profile?.role === 'staff' ||
                      profile?.role === 'mechanic' ||
                      (profile?.role === 'manager' && profile?.yacht_id === invoice.yacht_id);

    if (!hasAccess) {
      throw new Error('Unauthorized to access this invoice');
    }

    // Check if already paid
    if (invoice.payment_status === 'paid') {
      throw new Error('Invoice is already paid');
    }

    // If there's an existing checkout session, check if any payment has been completed
    if (invoice.stripe_checkout_session_id) {
      try {
        const sessionResponse = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${invoice.stripe_checkout_session_id}`,
          {
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
            },
          }
        );

        if (sessionResponse.ok) {
          const session = await sessionResponse.json();

          if (session.payment_status === 'paid') {
            // Payment already completed! Update the database and reject new payment attempt
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
            await supabase
              .from('yacht_invoices')
              .update({
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntentId || null,
                payment_method: paymentMethod,
                updated_at: new Date().toISOString(),
              })
              .eq('id', invoiceId);

            throw new Error('Invoice has already been paid. Please refresh the page.');
          }
        }
      } catch (error) {
        // If the error is our "already paid" message, re-throw it
        if (error instanceof Error && error.message.includes('already been paid')) {
          throw error;
        }
        console.error('Error checking existing checkout session:', error);
        // Continue - if we can't check, we'll create new session
      }
    }

    let amount = invoice.invoice_amount_numeric;

    // If numeric amount is not set, try to parse from invoice_amount string
    if (!amount || amount <= 0) {
      if (invoice.invoice_amount) {
        const parsed = parseFloat(invoice.invoice_amount.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
        }
      }
    }

    if (!amount || amount <= 0) {
      console.error('Invoice amount error:', {
        invoice_amount: invoice.invoice_amount,
        invoice_amount_numeric: invoice.invoice_amount_numeric,
        parsed_amount: amount
      });
      throw new Error(`Invalid invoice amount. Please ensure the invoice has a valid amount set. Amount: ${invoice.invoice_amount}`);
    }

    const amountInCents = Math.round(amount * 100);

    if (amountInCents <= 0) {
      throw new Error(`Invalid invoice amount in cents: ${amountInCents}`);
    }

    // Determine payment method types based on invoice setting
    const paymentMethodType = invoice.payment_method_type || 'card';
    const paymentMethods: string[] = [];

    if (paymentMethodType === 'card') {
      paymentMethods.push('card');
    } else if (paymentMethodType === 'ach') {
      paymentMethods.push('us_bank_account');
    } else if (paymentMethodType === 'both') {
      paymentMethods.push('card', 'us_bank_account');
    }

    // Build Stripe checkout session parameters
    // Set expiration to 24 hours from now (maximum allowed by Stripe for Checkout Sessions)
    const expirationTimestamp = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

    const params: Record<string, string> = {
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `Invoice: ${invoice.repair_title}`,
      'line_items[0][price_data][product_data][description]': `${invoice.yachts?.name || 'Yacht'} - Invoice #${invoiceId.substring(0, 8)}`,
      'line_items[0][price_data][unit_amount]': amountInCents.toString(),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'expires_at': expirationTimestamp.toString(),
      'success_url': `${req.headers.get('origin') || supabaseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${req.headers.get('origin') || supabaseUrl}/payment-cancelled`,
      'metadata[invoice_id]': invoiceId,
      'metadata[yacht_id]': invoice.yacht_id,
      'metadata[user_id]': user.id,
    };

    // Add payment method types
    paymentMethods.forEach((method, index) => {
      params[`payment_method_types[${index}]`] = method;
    });

    // Create Stripe Checkout Session
    const session = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!session.ok) {
      const errorText = await session.text();
      console.error('Stripe API error:', {
        status: session.status,
        statusText: session.statusText,
        error: errorText,
        invoiceId: invoiceId,
        amount: amount,
        amountInCents: amountInCents
      });

      let errorMessage = 'Failed to create payment session';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
          errorMessage = `Stripe error: ${errorJson.error.message}`;
        }
      } catch (e) {
        // If we can't parse as JSON, use the text
        if (errorText.includes('No such')) {
          errorMessage = 'Stripe configuration error. Please check your Stripe API key.';
        }
      }

      throw new Error(errorMessage);
    }

    const sessionData = await session.json();

    // Update invoice with checkout session ID and payment link
    await supabase
      .from('yacht_invoices')
      .update({
        stripe_checkout_session_id: sessionData.id,
        payment_link_url: sessionData.url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: sessionData.url,
        sessionId: sessionData.id,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error creating payment:', error);
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