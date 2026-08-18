import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all estimating invoices that are unpaid or processing with a Stripe payment link
    const { data: invoices, error: fetchError } = await supabase
      .from('estimating_invoices')
      .select('id, invoice_number, total_amount, deposit_applied, amount_paid, balance_due, payment_status, final_payment_stripe_checkout_session_id, final_payment_method_type, customer_email, customer_name, yacht_id')
      .in('payment_status', ['unpaid', 'processing'])
      .not('final_payment_stripe_checkout_session_id', 'is', null)
      .eq('archived', false);

    if (fetchError) throw fetchError;

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, checked: 0, updated: 0, message: 'No pending invoices to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let checked = 0;
    let updated = 0;
    const updates: Array<{ invoice_number: string; old_status: string; new_status: string; amount_paid: number | null }> = [];

    for (const invoice of invoices) {
      checked++;
      const paymentLinkId = invoice.final_payment_stripe_checkout_session_id;

      try {
        // Query Stripe for checkout sessions associated with this payment link
        const sessionsResponse = await fetch(
          `https://api.stripe.com/v1/checkout/sessions?payment_link=${paymentLinkId}&limit=10`,
          { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
        );

        if (!sessionsResponse.ok) {
          console.error(`Failed to fetch sessions for ${invoice.invoice_number}: ${sessionsResponse.status}`);
          continue;
        }

        const sessions = await sessionsResponse.json();
        const paidSessions = sessions.data.filter((s: any) => s.payment_status === 'paid');
        const processingSessions = sessions.data.filter((s: any) =>
          s.payment_status === 'unpaid' && s.status === 'complete'
        );

        // Handle paid sessions
        if (paidSessions.length > 0) {
          const paidSession = paidSessions[0];
          const paymentIntentId = paidSession.payment_intent;
          const amountPaid = (paidSession.amount_total || 0) / 100;

          let paymentMethod = paidSession.payment_method_types?.[0] || 'card';

          if (paymentIntentId) {
            try {
              const piResponse = await fetch(
                `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
                { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
              );
              if (piResponse.ok) {
                const piData = await piResponse.json();
                paymentMethod = piData.charges?.data?.[0]?.payment_method_details?.type || paymentMethod;
              }
            } catch (err) {
              console.error(`Error fetching PI for ${invoice.invoice_number}:`, err);
            }
          }

          const newAmountPaid = (invoice.amount_paid || 0) + amountPaid;
          const newBalanceDue = Math.max(0, (invoice.total_amount || 0) - (invoice.deposit_applied || 0) - newAmountPaid);
          const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial';

          await supabase
            .from('estimating_invoices')
            .update({
              payment_status: newStatus,
              amount_paid: newAmountPaid,
              balance_due: newBalanceDue,
              final_payment_stripe_payment_intent_id: paymentIntentId || null,
              final_payment_paid_at: new Date().toISOString(),
              final_payment_method_type: paymentMethod === 'us_bank_account' ? 'ach' : 'card',
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);

          updated++;
          updates.push({
            invoice_number: invoice.invoice_number,
            old_status: invoice.payment_status,
            new_status: newStatus,
            amount_paid: amountPaid,
          });

          await supabase.from('admin_notifications').insert({
            message: `Payment synced for Invoice ${invoice.invoice_number} - $${amountPaid.toFixed(2)} ${newStatus === 'paid' ? '(PAID IN FULL)' : ''}`,
            yacht_id: invoice.yacht_id || null,
            reference_id: invoice.id,
            created_at: new Date().toISOString(),
          });

          continue;
        }

        // Handle processing sessions (ACH submitted, awaiting settlement)
        if (processingSessions.length > 0 && invoice.payment_status !== 'processing') {
          const processingSession = processingSessions[0];
          const paymentIntentId = processingSession.payment_intent;

          let paymentMethod = processingSession.payment_method_types?.[0] || 'us_bank_account';
          if (paymentIntentId) {
            try {
              const piResponse = await fetch(
                `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
                { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
              );
              if (piResponse.ok) {
                const piData = await piResponse.json();
                if (piData.status === 'processing') {
                  paymentMethod = piData.payment_method_types?.[0] || paymentMethod;
                }
              }
            } catch (err) {
              console.error(`Error fetching PI for ${invoice.invoice_number}:`, err);
            }
          }

          await supabase
            .from('estimating_invoices')
            .update({
              payment_status: 'processing',
              stripe_payment_intent_id: paymentIntentId || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);

          updated++;
          updates.push({
            invoice_number: invoice.invoice_number,
            old_status: invoice.payment_status,
            new_status: 'processing',
            amount_paid: null,
          });
        }
      } catch (err) {
        console.error(`Error syncing invoice ${invoice.invoice_number}:`, err);
      }
    }

    // Also check yacht invoices (legacy) that are pending with Stripe links
    const { data: legacyInvoices } = await supabase
      .from('yacht_invoices')
      .select('id, invoice_amount, payment_status, stripe_checkout_session_id, yacht_id, repair_title')
      .in('payment_status', ['pending', 'processing'])
      .not('stripe_checkout_session_id', 'is', null);

    if (legacyInvoices) {
      for (const invoice of legacyInvoices) {
        checked++;
        const checkoutId = invoice.stripe_checkout_session_id;
        const isPaymentLink = checkoutId.startsWith('plink_');

        try {
          let session: any = null;

          if (isPaymentLink) {
            const sessionsResponse = await fetch(
              `https://api.stripe.com/v1/checkout/sessions?payment_link=${checkoutId}&limit=10`,
              { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
            );
            if (!sessionsResponse.ok) continue;
            const sessionsData = await sessionsResponse.json();
            session = sessionsData.data.find((s: any) => s.payment_status === 'paid') ||
                      sessionsData.data.find((s: any) => s.payment_status === 'unpaid' && s.status === 'complete') ||
                      null;
          } else {
            const sessionResponse = await fetch(
              `https://api.stripe.com/v1/checkout/sessions/${checkoutId}`,
              { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
            );
            if (!sessionResponse.ok) continue;
            session = await sessionResponse.json();
          }

          if (!session) continue;

          if (session.payment_status === 'paid') {
            const paymentIntentId = session.payment_intent;
            let paymentMethod = session.payment_method_types?.[0] || 'card';

            if (paymentIntentId) {
              try {
                const piResponse = await fetch(
                  `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
                  { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
                );
                if (piResponse.ok) {
                  const piData = await piResponse.json();
                  paymentMethod = piData.charges?.data?.[0]?.payment_method_details?.type || paymentMethod;
                }
              } catch (err) {
                console.error(`Error fetching PI for legacy invoice:`, err);
              }
            }

            await supabase
              .from('yacht_invoices')
              .update({
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntentId || null,
                payment_method: paymentMethod,
                updated_at: new Date().toISOString(),
              })
              .eq('id', invoice.id);

            updated++;
            updates.push({
              invoice_number: `Legacy: ${invoice.repair_title || invoice.id.substring(0, 8)}`,
              old_status: invoice.payment_status,
              new_status: 'paid',
              amount_paid: null,
            });

            await supabase.from('admin_notifications').insert({
              message: `Payment synced for ${invoice.repair_title || 'invoice'} - ${invoice.invoice_amount || '$0.00'}`,
              yacht_id: invoice.yacht_id || null,
              reference_id: invoice.id,
              created_at: new Date().toISOString(),
            });
          } else if (session.status === 'complete' && session.payment_status === 'unpaid' && invoice.payment_status !== 'processing') {
            await supabase
              .from('yacht_invoices')
              .update({
                payment_status: 'processing',
                stripe_payment_intent_id: session.payment_intent || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', invoice.id);

            updated++;
            updates.push({
              invoice_number: `Legacy: ${invoice.repair_title || invoice.id.substring(0, 8)}`,
              old_status: invoice.payment_status,
              new_status: 'processing',
              amount_paid: null,
            });
          }
        } catch (err) {
          console.error(`Error syncing legacy invoice ${invoice.id}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked,
        updated,
        updates,
        message: `Checked ${checked} invoices, updated ${updated}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync all error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
