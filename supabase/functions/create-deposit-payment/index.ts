import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DepositPaymentRequest {
  repairRequestId: string;
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

    const { repairRequestId }: DepositPaymentRequest = await req.json();

    if (!repairRequestId) {
      throw new Error('Repair request ID is required');
    }

    // Fetch repair request details
    const { data: repairRequest, error: repairError } = await supabase
      .from('repair_requests')
      .select('*, yachts(name)')
      .eq('id', repairRequestId)
      .single();

    if (repairError || !repairRequest) {
      throw new Error('Repair request not found');
    }

    // Check if user has access to this repair request
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, yacht_id')
      .eq('user_id', user.id)
      .single();

    const hasAccess = profile?.role === 'master' ||
                      profile?.role === 'staff' ||
                      profile?.role === 'mechanic' ||
                      (profile?.role === 'manager' && profile?.yacht_id === repairRequest.yacht_id);

    if (!hasAccess) {
      throw new Error('Unauthorized to access this repair request');
    }

    // Check if deposit amount is set
    if (!repairRequest.deposit_amount || repairRequest.deposit_amount <= 0) {
      throw new Error('No deposit amount set for this repair request');
    }

    // Check if already paid
    if (repairRequest.deposit_payment_status === 'paid') {
      throw new Error('Deposit is already paid');
    }

    // If there's an existing checkout session, expire it first
    if (repairRequest.deposit_stripe_checkout_session_id) {
      try {
        const expireResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${repairRequest.deposit_stripe_checkout_session_id}/expire`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        });

        if (expireResponse.ok) {
          console.log('Successfully expired old checkout session:', repairRequest.deposit_stripe_checkout_session_id);
        } else {
          const errorText = await expireResponse.text();
          console.log('Failed to expire old session (might already be expired):', errorText);
        }
      } catch (expireError) {
        console.error('Error expiring old checkout session:', expireError);
        // Continue anyway - the old session might already be expired or deleted
      }
    }

    const amount = parseFloat(repairRequest.deposit_amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Invalid deposit amount: ${repairRequest.deposit_amount}`);
    }

    const amountInCents = Math.round(amount * 100);

    if (amountInCents <= 0) {
      throw new Error(`Invalid deposit amount in cents: ${amountInCents}`);
    }

    // Build Stripe checkout session parameters
    // Set expiration to 30 days from now
    const expirationTimestamp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

    const params: Record<string, string> = {
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `Deposit: ${repairRequest.title}`,
      'line_items[0][price_data][product_data][description]': `${repairRequest.yachts?.name || 'Yacht'} - Deposit for Repair #${repairRequestId.substring(0, 8)}`,
      'line_items[0][price_data][unit_amount]': amountInCents.toString(),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'expires_at': expirationTimestamp.toString(),
      'success_url': `${req.headers.get('origin') || supabaseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${req.headers.get('origin') || supabaseUrl}/payment-cancelled`,
      'metadata[repair_request_id]': repairRequestId,
      'metadata[payment_type]': 'deposit',
      'metadata[yacht_id]': repairRequest.yacht_id || '',
      'metadata[user_id]': user.id,
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'us_bank_account',
    };

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
        repairRequestId: repairRequestId,
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
        if (errorText.includes('No such')) {
          errorMessage = 'Stripe configuration error. Please check your Stripe API key.';
        }
      }

      throw new Error(errorMessage);
    }

    const sessionData = await session.json();

    // Update repair request with checkout session ID and payment link
    const expiresAt = new Date(expirationTimestamp * 1000).toISOString();
    await supabase
      .from('repair_requests')
      .update({
        deposit_stripe_checkout_session_id: sessionData.id,
        deposit_payment_link_url: sessionData.url,
        deposit_link_expires_at: expiresAt,
        deposit_requested_at: new Date().toISOString(),
        deposit_requested_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', repairRequestId);

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
    console.error('Error creating deposit payment:', error);
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
