import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { parseRequestBody, validateRequired, validateUUID } from '../_shared/validation.ts';
import { withErrorHandling, successResponse } from '../_shared/response.ts';

interface DepositPaymentRequest {
  repairRequestId: string;
  recaptchaToken?: string;
}

Deno.serve(withErrorHandling(async (req: Request) => {
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

    const body = await parseRequestBody<DepositPaymentRequest>(req);
    validateRequired(body, ['repairRequestId']);
    validateUUID(body.repairRequestId, 'repairRequestId');

    const { repairRequestId, recaptchaToken } = body;

    // Verify reCAPTCHA token (anti-fraud compliance requirement)
    if (recaptchaToken) {
      const verifyUrl = `${supabaseUrl}/functions/v1/verify-recaptcha`;
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptchaToken })
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }

      console.log('reCAPTCHA verified successfully for deposit payment');
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

    // Get payment method type (default to 'card' for backward compatibility)
    const paymentMethodType = repairRequest.deposit_payment_method_type || 'card';

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

    // If there's an existing payment link, check if any payment has been completed
    if (repairRequest.deposit_stripe_checkout_session_id) {
      try {
        // Check for any completed checkout sessions for this payment link
        const sessionsResponse = await fetch(
          `https://api.stripe.com/v1/checkout/sessions?payment_link=${repairRequest.deposit_stripe_checkout_session_id}&limit=10`,
          {
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
            },
          }
        );

        if (sessionsResponse.ok) {
          const sessions = await sessionsResponse.json();
          const paidSession = sessions.data.find((s: any) => s.payment_status === 'paid');

          if (paidSession) {
            // Payment already exists! Update the database and reject new payment attempt
            const paymentIntentId = paidSession.payment_intent;
            let paymentMethod = paidSession.payment_method_types?.[0] || 'card';

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
            await supabase
              .from('repair_requests')
              .update({
                deposit_payment_status: 'paid',
                deposit_paid_at: new Date().toISOString(),
                deposit_stripe_payment_intent_id: paymentIntentId || null,
                deposit_payment_method_type: paymentMethod,
                updated_at: new Date().toISOString(),
              })
              .eq('id', repairRequestId);

            throw new Error('Deposit has already been paid. Please refresh the page.');
          }
        }
      } catch (error) {
        // If the error is our "already paid" message, re-throw it
        if (error instanceof Error && error.message.includes('already been paid')) {
          throw error;
        }
        console.error('Error checking existing payment sessions:', error);
        // Continue - if we can't check, we'll deactivate and create new link
      }

      // Deactivate the old payment link

      try {
        const deactivateResponse = await fetch(`https://api.stripe.com/v1/payment_links/${repairRequest.deposit_stripe_checkout_session_id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ 'active': 'false' }).toString(),
        });

        if (deactivateResponse.ok) {
          console.log('Successfully deactivated old payment link:', repairRequest.deposit_stripe_checkout_session_id);
        } else {
          const errorText = await deactivateResponse.text();
          console.log('Failed to deactivate old payment link (might already be inactive):', errorText);
        }
      } catch (deactivateError) {
        console.error('Error deactivating old payment link:', deactivateError);
        // Continue anyway - the old link might already be inactive or deleted
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

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const expirationTimestamp = Math.floor(expiresAt.getTime() / 1000);

    // First, create a Stripe Product
    const productParams = new URLSearchParams({
      'name': `Deposit: ${repairRequest.title}`,
      'description': `${repairRequest.yachts?.name || 'Yacht'} - Deposit for Repair #${repairRequestId.substring(0, 8)}`,
    });

    const productResponse = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: productParams.toString(),
    });

    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      console.error('Stripe Product creation error:', errorText);
      throw new Error('Failed to create Stripe product');
    }

    const productData = await productResponse.json();

    // Then, create a Price for the product
    const priceParams = new URLSearchParams({
      'product': productData.id,
      'currency': 'usd',
      'unit_amount': amountInCents.toString(),
    });

    const priceResponse = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: priceParams.toString(),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      console.error('Stripe Price creation error:', errorText);
      throw new Error('Failed to create Stripe price');
    }

    const priceData = await priceResponse.json();

    // Build Stripe Payment Link parameters
    const params: Record<string, string> = {
      'line_items[0][price]': priceData.id,
      'line_items[0][quantity]': '1',
      'after_completion[type]': 'redirect',
      'after_completion[redirect][url]': `${req.headers.get('origin') || supabaseUrl}/payment-success`,
      'metadata[repair_request_id]': repairRequestId,
      'metadata[payment_type]': 'deposit',
      'metadata[yacht_id]': repairRequest.yacht_id || '',
      'metadata[user_id]': user.id,
    };

    // Add payment methods based on payment_method_type
    if (paymentMethodType === 'card') {
      params['payment_method_types[0]'] = 'card';
    } else if (paymentMethodType === 'ach') {
      params['payment_method_types[0]'] = 'us_bank_account';
    } else if (paymentMethodType === 'both') {
      params['payment_method_types[0]'] = 'card';
      params['payment_method_types[1]'] = 'us_bank_account';
    }

    // Create Stripe Payment Link
    const paymentLink = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!paymentLink.ok) {
      const errorText = await paymentLink.text();
      console.error('Stripe API error:', {
        status: paymentLink.status,
        statusText: paymentLink.statusText,
        error: errorText,
        repairRequestId: repairRequestId,
        amount: amount,
        amountInCents: amountInCents
      });

      let errorMessage = 'Failed to create payment link';
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

    const paymentLinkData = await paymentLink.json();

    // Update repair request with payment link ID and URL
    await supabase
      .from('repair_requests')
      .update({
        deposit_stripe_checkout_session_id: paymentLinkData.id,
        deposit_payment_link_url: paymentLinkData.url,
        deposit_link_expires_at: expiresAt.toISOString(),
        deposit_requested_at: new Date().toISOString(),
        deposit_requested_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', repairRequestId);

    return successResponse({
      success: true,
      checkoutUrl: paymentLinkData.url,
      sessionId: paymentLinkData.id,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating deposit payment:', error);
    throw error;
  }
}));
