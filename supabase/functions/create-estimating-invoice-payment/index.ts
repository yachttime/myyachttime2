import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { parseRequestBody, validateRequired, validateUUID } from '../_shared/validation.ts';
import { withErrorHandling, successResponse } from '../_shared/response.ts';

interface InvoicePaymentRequest {
  invoiceId: string;
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

    const body = await parseRequestBody<InvoicePaymentRequest>(req);
    validateRequired(body, ['invoiceId']);
    validateUUID(body.invoiceId, 'invoiceId');

    const { invoiceId, recaptchaToken } = body;

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

    const { data: invoice, error: invoiceError } = await supabase
      .from('estimating_invoices')
      .select('*, yachts(name), work_orders(work_order_number)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

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

    const balanceDue = invoice.balance_due || (invoice.total_amount - invoice.deposit_applied - invoice.amount_paid);

    if (balanceDue <= 0) {
      throw new Error('Invoice is already paid in full');
    }

    if (invoice.payment_status === 'paid') {
      throw new Error('Invoice is already marked as paid');
    }

    const paymentMethodType = invoice.final_payment_method_type || 'card';

    const appUrl = Deno.env.get('APP_URL') ||
                   Deno.env.get('SITE_URL') ||
                   req.headers.get('origin') ||
                   req.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                   'https://azmarineservices.com';

    const stripeParams: Record<string, string> = {
      'mode': 'payment',
      'payment_method_types[]': paymentMethodType === 'ach' ? 'us_bank_account' : 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `Invoice ${invoice.invoice_number} - Balance Due`,
      'line_items[0][price_data][product_data][description]': invoice.yachts?.name
        ? `Yacht: ${invoice.yachts.name} | WO: ${invoice.work_orders?.work_order_number || 'N/A'}`
        : `Work Order: ${invoice.work_orders?.work_order_number || 'N/A'}`,
      'line_items[0][price_data][unit_amount]': Math.round(balanceDue * 100).toString(),
      'line_items[0][quantity]': '1',
      'success_url': `${appUrl}/estimating?payment=success&type=invoice&session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${appUrl}/estimating?payment=cancelled`,
      'metadata[invoice_id]': invoiceId,
      'metadata[payment_type]': 'estimating_invoice_payment',
      'expires_at': Math.floor((Date.now() + 23 * 60 * 60 * 1000) / 1000).toString(),
    };

    if (invoice.customer_email) {
      stripeParams['customer_email'] = invoice.customer_email;
    }

    const checkoutSession = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(stripeParams),
    });

    if (!checkoutSession.ok) {
      const errorData = await checkoutSession.json();
      console.error('Stripe API error:', errorData);
      throw new Error('Failed to create payment session');
    }

    const session = await checkoutSession.json();

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('estimating_invoices')
      .update({
        final_payment_stripe_checkout_session_id: session.id,
        final_payment_link_url: session.url,
        final_payment_link_expires_at: expiresAt,
        final_payment_method_type: paymentMethodType,
      })
      .eq('id', invoiceId);

    if (updateError) {
      throw new Error('Failed to update invoice with payment link');
    }

    return successResponse({
      checkoutUrl: session.url,
      sessionId: session.id,
      expiresAt: expiresAt,
      balanceDue: balanceDue,
    });
  } catch (error) {
    console.error('Error in create-estimating-invoice-payment:', error);
    throw error;
  }
}));
