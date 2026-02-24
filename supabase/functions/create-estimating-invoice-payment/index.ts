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

    // Deactivate any previous payment link for this invoice
    if (invoice.final_payment_stripe_checkout_session_id) {
      try {
        await fetch(`https://api.stripe.com/v1/payment_links/${invoice.final_payment_stripe_checkout_session_id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ 'active': 'false' }).toString(),
        });
      } catch (err) {
        console.error('Error deactivating old payment link:', err);
      }
    }

    const paymentMethodType = invoice.final_payment_method_type || 'card';
    const amountInCents = Math.round(balanceDue * 100);

    const yachtName = invoice.yachts?.name;
    const workOrderNumber = invoice.work_orders?.work_order_number;

    // Create Stripe product
    const productParams = new URLSearchParams({
      'name': `Invoice ${invoice.invoice_number} - Balance Due`,
      'description': yachtName
        ? `Vessel: ${yachtName} | WO: ${workOrderNumber || 'N/A'}`
        : `Work Order: ${workOrderNumber || 'N/A'}`,
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

    // Create Stripe price
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

    const appUrl = Deno.env.get('SITE_URL') ||
                   req.headers.get('origin') ||
                   req.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                   'https://azmarineservices.com';

    // Create Stripe Payment Link (does not expire, we manage 30-day window ourselves)
    const params: Record<string, string> = {
      'line_items[0][price]': priceData.id,
      'line_items[0][quantity]': '1',
      'after_completion[type]': 'redirect',
      'after_completion[redirect][url]': `${appUrl}/estimating?payment=success&type=invoice`,
      'metadata[invoice_id]': invoiceId,
      'metadata[payment_type]': 'estimating_invoice_payment',
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

    // Nacha ACH classification compliance (effective March 20, 2026)
    // Marine services are services, not physical goods
    if (paymentMethodType === 'ach' || paymentMethodType === 'both') {
      params['payment_intent_data[payment_method_options][us_bank_account][mandate_options][transaction_type]'] = 'personal';
    }

    if (invoice.customer_email) {
      params['customer_creation'] = 'always';
    }

    const paymentLinkResponse = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!paymentLinkResponse.ok) {
      const errorData = await paymentLinkResponse.json();
      console.error('Stripe API error:', errorData);
      throw new Error('Failed to create payment link');
    }

    const paymentLink = await paymentLinkResponse.json();

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('estimating_invoices')
      .update({
        final_payment_stripe_checkout_session_id: paymentLink.id,
        final_payment_link_url: paymentLink.url,
        final_payment_link_expires_at: expiresAt,
        final_payment_method_type: paymentMethodType,
      })
      .eq('id', invoiceId);

    if (updateError) {
      throw new Error('Failed to update invoice with payment link');
    }

    return successResponse({
      checkoutUrl: paymentLink.url,
      sessionId: paymentLink.id,
      expiresAt: expiresAt,
      balanceDue: balanceDue,
    });
  } catch (error) {
    console.error('Error in create-estimating-invoice-payment:', error);
    throw error;
  }
}));
