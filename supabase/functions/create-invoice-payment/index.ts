import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { parseRequestBody, validateRequired, validateUUID } from '../_shared/validation.ts';
import { withErrorHandling, successResponse } from '../_shared/response.ts';

interface InvoicePaymentRequest {
  invoiceId: string;
  recaptchaToken?: string;
  paymentMethodType?: 'card' | 'ach' | 'both';
}

const CREDIT_CARD_FEE_RATE = 0.03;

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

    const { invoiceId, recaptchaToken, paymentMethodType: requestedPaymentMethod } = body;

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

      console.log('reCAPTCHA verified successfully for invoice payment');
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('yacht_invoices')
      .select('*, yachts(name), payment_method_type')
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

    if (invoice.payment_status === 'paid') {
      throw new Error('Invoice is already paid');
    }

    // Deactivate any existing payment link before creating a new one
    if (invoice.stripe_checkout_session_id) {
      try {
        await fetch(`https://api.stripe.com/v1/payment_links/${invoice.stripe_checkout_session_id}`, {
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

    let amount = invoice.invoice_amount_numeric;

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

    const paymentMethodType = requestedPaymentMethod || invoice.payment_method_type || 'card';

    // Apply 3% credit card processing fee only for card-only payments
    const creditCardFee = paymentMethodType === 'card'
      ? Math.round(amount * CREDIT_CARD_FEE_RATE * 100) / 100
      : null;

    const chargeAmount = creditCardFee !== null ? amount + creditCardFee : amount;
    const amountInCents = Math.round(chargeAmount * 100);

    if (amountInCents <= 0) {
      throw new Error(`Invalid invoice amount in cents: ${amountInCents}`);
    }

    // Create Stripe Product
    const productParams = new URLSearchParams({
      'name': `Invoice: ${invoice.repair_title}`,
      'description': `${invoice.yachts?.name || 'Yacht'} - Invoice #${invoiceId.substring(0, 8)}`,
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

    // Create Stripe Price
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

    // Create Payment Link (no expiration, limited to 1 payment)
    const params: Record<string, string> = {
      'line_items[0][price]': priceData.id,
      'line_items[0][quantity]': '1',
      'restrictions[completed_sessions][limit]': '1',
      'after_completion[type]': 'redirect',
      'after_completion[redirect][url]': `${appUrl}/payment-success`,
      'metadata[invoice_id]': invoiceId,
      'metadata[yacht_id]': invoice.yacht_id || '',
      'metadata[payment_type]': 'yacht_invoice',
      'metadata[user_id]': user.id,
      'saved_payment_method_options[allow_redisplay_filters][0]': 'unspecified',
      'custom_text[submit][message]': `You are authorizing a payment of $${(amountInCents / 100).toFixed(2)} for ${invoice.repair_title || 'invoice'}. Please confirm this is correct before proceeding.`,
    };

    if (paymentMethodType === 'card') {
      params['payment_method_types[0]'] = 'card';
    } else if (paymentMethodType === 'ach') {
      params['payment_method_types[0]'] = 'us_bank_account';
    } else if (paymentMethodType === 'both') {
      params['payment_method_types[0]'] = 'card';
      params['payment_method_types[1]'] = 'us_bank_account';
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
      const errorText = await paymentLinkResponse.text();
      console.error('Stripe API error:', {
        status: paymentLinkResponse.status,
        statusText: paymentLinkResponse.statusText,
        error: errorText,
        invoiceId: invoiceId,
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

    const paymentLinkData = await paymentLinkResponse.json();

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('yacht_invoices')
      .update({
        stripe_checkout_session_id: paymentLinkData.id,
        payment_link_url: paymentLinkData.url,
        payment_link_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
        credit_card_fee: creditCardFee,
      })
      .eq('id', invoiceId);

    return successResponse({
      success: true,
      checkoutUrl: paymentLinkData.url,
      sessionId: paymentLinkData.id,
      expiresAt: expiresAt,
      creditCardFee: creditCardFee,
      chargeAmount: chargeAmount,
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    throw error;
  }
}));
