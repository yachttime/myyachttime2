import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { parseRequestBody, validateRequired, validateUUID } from '../_shared/validation.ts';
import { withErrorHandling, successResponse } from '../_shared/response.ts';

interface DepositPaymentRequest {
  workOrderId: string;
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
    validateRequired(body, ['workOrderId']);
    validateUUID(body.workOrderId, 'workOrderId');

    const { workOrderId, recaptchaToken } = body;

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
    }

    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('*, yachts(name)')
      .eq('id', workOrderId)
      .single();

    if (workOrderError || !workOrder) {
      throw new Error('Work order not found');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, yacht_id')
      .eq('user_id', user.id)
      .single();

    const hasAccess = profile?.role === 'master' ||
                      profile?.role === 'staff' ||
                      profile?.role === 'mechanic' ||
                      (profile?.role === 'manager' && profile?.yacht_id === workOrder.yacht_id);

    if (!hasAccess) {
      throw new Error('Unauthorized to access this work order');
    }

    if (!workOrder.deposit_amount || workOrder.deposit_amount <= 0) {
      throw new Error('No deposit amount set for this work order');
    }

    if (workOrder.deposit_payment_status === 'paid') {
      throw new Error('Deposit is already paid');
    }

    if (workOrder.deposit_stripe_checkout_session_id) {
      try {
        const deactivateResponse = await fetch(`https://api.stripe.com/v1/payment_links/${workOrder.deposit_stripe_checkout_session_id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ 'active': 'false' }).toString(),
        });

        if (deactivateResponse.ok) {
          console.log('Deactivated old payment link:', workOrder.deposit_stripe_checkout_session_id);
        }
      } catch (deactivateError) {
        console.error('Error deactivating old payment link:', deactivateError);
      }
    }

    const amount = parseFloat(workOrder.deposit_amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Invalid deposit amount: ${workOrder.deposit_amount}`);
    }

    const amountInCents = Math.round(amount * 100);

    const productParams = new URLSearchParams({
      'name': `Work Order ${workOrder.work_order_number} - Deposit`,
      'description': `${workOrder.yachts?.name || 'Yacht'} - Work Order Deposit`,
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

    const paymentMethodType = workOrder.deposit_payment_method_type || 'card';
    const params: Record<string, string> = {
      'line_items[0][price]': priceData.id,
      'line_items[0][quantity]': '1',
      'after_completion[type]': 'redirect',
      'after_completion[redirect][url]': `${req.headers.get('origin') || supabaseUrl}/payment-success`,
      'metadata[work_order_id]': workOrderId,
      'metadata[payment_type]': 'work_order_deposit',
      'metadata[user_id]': user.id,
    };

    if (paymentMethodType === 'card') {
      params['payment_method_types[0]'] = 'card';
    } else if (paymentMethodType === 'ach') {
      params['payment_method_types[0]'] = 'us_bank_account';
    } else if (paymentMethodType === 'both') {
      params['payment_method_types[0]'] = 'card';
      params['payment_method_types[1]'] = 'us_bank_account';
    }

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
        workOrderId: workOrderId,
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

    const session = await paymentLink.json();

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        deposit_stripe_checkout_session_id: session.id,
        deposit_payment_link_url: session.url,
        deposit_payment_status: 'pending',
        deposit_requested_at: new Date().toISOString(),
        deposit_requested_by: user.id,
        deposit_link_expires_at: expiresAt,
        deposit_payment_method_type: paymentMethodType,
      })
      .eq('id', workOrderId);

    if (updateError) {
      throw new Error('Failed to update work order with payment link');
    }

    return successResponse({
      checkoutUrl: session.url,
      sessionId: session.id,
      expiresAt: expiresAt,
    });
  } catch (error) {
    console.error('Error in create-work-order-deposit-payment:', error);
    throw error;
  }
}));
