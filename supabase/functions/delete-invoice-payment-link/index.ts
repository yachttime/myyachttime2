import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DeletePaymentLinkRequest {
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

    const { invoiceId }: DeletePaymentLinkRequest = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('yacht_invoices')
      .select('*, yachts(name)')
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

    const hasAccess = profile?.role === 'staff' ||
                      (profile?.role === 'manager' && profile?.yacht_id === invoice.yacht_id);

    if (!hasAccess) {
      throw new Error('Unauthorized to access this invoice');
    }

    if (invoice.payment_status === 'paid') {
      throw new Error('Cannot delete payment link for paid invoice');
    }

    if (invoice.stripe_checkout_session_id) {
      const expireResponse = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${invoice.stripe_checkout_session_id}/expire`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!expireResponse.ok) {
        const errorText = await expireResponse.text();
        console.error('Stripe API error:', errorText);
      }
    }

    await supabase
      .from('yacht_invoices')
      .update({
        stripe_checkout_session_id: null,
        payment_link_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

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
