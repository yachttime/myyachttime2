import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    const body = await req.json();
    const estimatingInvoiceId: string | undefined = body.estimatingInvoiceId;
    const invoiceId: string | undefined = body.invoiceId;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, yacht_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const isStaff = profile?.role === 'master' ||
                    profile?.role === 'staff' ||
                    profile?.role === 'mechanic';

    if (estimatingInvoiceId) {
      const { data: invoice, error: invoiceError } = await supabase
        .from('estimating_invoices')
        .select('id, yacht_id, payment_status, final_payment_stripe_checkout_session_id')
        .eq('id', estimatingInvoiceId)
        .maybeSingle();

      if (invoiceError || !invoice) {
        throw new Error('Invoice not found');
      }

      const hasAccess = isStaff ||
        (profile?.role === 'manager' && profile?.yacht_id === invoice.yacht_id);

      if (!hasAccess) {
        throw new Error('Unauthorized to access this invoice');
      }

      if (invoice.payment_status === 'paid') {
        throw new Error('Cannot delete payment link for paid invoice');
      }

      if (invoice.final_payment_stripe_checkout_session_id) {
        try {
          await fetch(
            `https://api.stripe.com/v1/payment_links/${invoice.final_payment_stripe_checkout_session_id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ 'active': 'false' }).toString(),
            }
          );
        } catch (err) {
          console.error('Error deactivating Stripe payment link:', err);
        }
      }

      await supabase
        .from('estimating_invoices')
        .update({
          final_payment_stripe_checkout_session_id: null,
          final_payment_link_url: null,
          final_payment_link_expires_at: null,
          final_payment_email_sent_at: null,
          final_payment_resend_email_id: null,
          final_payment_email_recipient: null,
          final_payment_email_delivered_at: null,
          final_payment_email_opened_at: null,
          final_payment_email_clicked_at: null,
          final_payment_email_bounced_at: null,
          email_open_count: 0,
          email_click_count: 0,
        })
        .eq('id', estimatingInvoiceId);

    } else if (invoiceId) {
      const { data: invoice, error: invoiceError } = await supabase
        .from('yacht_invoices')
        .select('*, yachts(name)')
        .eq('id', invoiceId)
        .maybeSingle();

      if (invoiceError || !invoice) {
        throw new Error('Invoice not found');
      }

      const hasAccess = isStaff ||
        (profile?.role === 'manager' && profile?.yacht_id === invoice.yacht_id);

      if (!hasAccess) {
        throw new Error('Unauthorized to access this invoice');
      }

      if (invoice.payment_status === 'paid') {
        throw new Error('Cannot delete payment link for paid invoice');
      }

      if (invoice.stripe_checkout_session_id) {
        try {
          await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${invoice.stripe_checkout_session_id}/expire`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );
        } catch (err) {
          console.error('Error expiring Stripe checkout session:', err);
        }
      }

      await supabase
        .from('yacht_invoices')
        .update({
          stripe_checkout_session_id: null,
          payment_link_url: null,
          payment_link_expires_at: null,
          payment_email_sent_at: null,
          resend_email_id: null,
          payment_email_recipient: null,
          payment_email_all_recipients: null,
          payment_email_delivered_at: null,
          payment_email_opened_at: null,
          payment_link_clicked_at: null,
          payment_email_bounced_at: null,
          email_open_count: 0,
          email_click_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

    } else {
      throw new Error('Invoice ID is required');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment link deleted successfully',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error deleting payment link:', error);
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
