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

    const paymentMethodType = workOrder.deposit_payment_method_type || 'card';

    const checkoutSession = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'payment_method_types[]': paymentMethodType === 'ach' ? 'us_bank_account' : 'card',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `Work Order ${workOrder.work_order_number} - Deposit`,
        'line_items[0][price_data][product_data][description]': workOrder.yachts?.name ? `Yacht: ${workOrder.yachts.name}` : 'Marine Service Deposit',
        'line_items[0][price_data][unit_amount]': Math.round(workOrder.deposit_amount * 100).toString(),
        'line_items[0][quantity]': '1',
        'success_url': `${supabaseUrl.replace('.supabase.co', '')}/estimating?payment=success&type=deposit`,
        'cancel_url': `${supabaseUrl.replace('.supabase.co', '')}/estimating?payment=cancelled`,
        'metadata[work_order_id]': workOrderId,
        'metadata[payment_type]': 'work_order_deposit',
        'customer_email': workOrder.customer_email || '',
        'expires_at': Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000).toString(),
      }),
    });

    if (!checkoutSession.ok) {
      const errorData = await checkoutSession.json();
      console.error('Stripe API error:', errorData);
      throw new Error('Failed to create payment session');
    }

    const session = await checkoutSession.json();

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
