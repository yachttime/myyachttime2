import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { makeQuickBooksAPICall } from '../_shared/quickbooks.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { invoiceId, encrypted_session } = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    if (!encrypted_session) {
      throw new Error('Encrypted session required for QuickBooks operations');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase credentials not configured');
    }

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // Import Supabase client
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user is master or staff
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || !['master', 'staff', 'manager'].includes(profile.role)) {
      throw new Error('Only master, staff, or manager users can push invoices to QuickBooks');
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('yacht_invoices')
      .select(`
        *,
        yachts:yacht_id (id, name),
        customers:customer_id (
          id,
          customer_type,
          first_name,
          last_name,
          business_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          qbo_customer_id
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Verify invoice belongs to the user's company
    if (invoice.company_id !== profile.company_id) {
      throw new Error('Invoice does not belong to your company');
    }

    // Only push paid invoices
    if (invoice.payment_status !== 'paid') {
      throw new Error('Only paid invoices can be pushed to QuickBooks');
    }

    // Get active QuickBooks connection for this company (metadata only)
    const { data: connection, error: connError } = await supabase
      .from('quickbooks_connection')
      .select('id, realm_id, token_expires_at')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      throw new Error('No active QuickBooks connection found. Please connect to QuickBooks first.');
    }

    // Decrypt tokens from volatile memory
    let accessToken = '';
    let currentEncryptedSession = encrypted_session;

    // Check if token needs refresh
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (tokenExpiresAt < fiveMinutesFromNow) {
      const refreshResult = await fetch(`${supabaseUrl}/functions/v1/quickbooks-oauth`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refresh_token',
          encrypted_session: currentEncryptedSession
        }),
      });

      if (!refreshResult.ok) {
        await supabase
          .from('quickbooks_connection')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        await supabase
          .from('admin_notifications')
          .insert({
            company_id: profile.company_id,
            notification_type: 'system_alert',
            title: 'QuickBooks Connection Expired',
            message: 'Your QuickBooks connection has expired and needs to be reconnected. Please go to QuickBooks settings and reconnect your account.',
            is_read: false,
            reference_type: 'quickbooks_connection',
            reference_id: connection.id
          });

        throw new Error('QuickBooks authorization has expired. Please reconnect your QuickBooks account.');
      }

      const refreshData = await refreshResult.json();
      currentEncryptedSession = refreshData.encrypted_session;
    }

    // Decrypt current session to get access token
    const tokenManagerUrl = `${supabaseUrl}/functions/v1/quickbooks-token-manager`;
    const decryptResponse = await fetch(tokenManagerUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'decrypt',
        data: { encrypted_session: currentEncryptedSession }
      })
    });

    if (!decryptResponse.ok) {
      throw new Error('Failed to decrypt QuickBooks tokens');
    }

    const { access_token } = await decryptResponse.json();
    accessToken = access_token;

    // Get default income account mapping
    const { data: incomeMapping } = await supabase
      .from('quickbooks_account_mappings')
      .select('qbo_account_id')
      .eq('mapping_type', 'income')
      .eq('is_default', true)
      .maybeSingle();

    if (!incomeMapping) {
      throw new Error('No default income account mapping found. Please configure QuickBooks account mappings first.');
    }

    // Get customer or create one
    let qboCustomerId = invoice.customers?.qbo_customer_id;

    if (!qboCustomerId && invoice.customers) {
      // Create customer in QuickBooks
      const customerData: any = {
        DisplayName: invoice.customers.customer_type === 'business'
          ? invoice.customers.business_name
          : `${invoice.customers.first_name} ${invoice.customers.last_name}`,
        PrimaryEmailAddr: invoice.customers.email ? { Address: invoice.customers.email } : undefined,
        PrimaryPhone: invoice.customers.phone ? { FreeFormNumber: invoice.customers.phone } : undefined,
      };

      if (invoice.customers.address_line1) {
        customerData.BillAddr = {
          Line1: invoice.customers.address_line1,
          Line2: invoice.customers.address_line2 || undefined,
          City: invoice.customers.city || undefined,
          CountrySubDivisionCode: invoice.customers.state || undefined,
          PostalCode: invoice.customers.zip_code || undefined,
        };
      }

      const createCustomerResult = await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/customer`,
        method: 'POST',
        accessToken,
        body: customerData,
        requestType: 'create_customer',
        companyId: profile.company_id,
        connectionId: connection.id,
        referenceType: 'customer',
        referenceId: invoice.customer_id,
        supabaseUrl,
        serviceRoleKey,
      });

      if (!createCustomerResult.success) {
        const errorText = createCustomerResult.data;

        if (createCustomerResult.response.status === 401 || createCustomerResult.response.status === 403) {
          await supabase
            .from('quickbooks_connection')
            .update({
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          await supabase
            .from('admin_notifications')
            .insert({
              company_id: profile.company_id,
              notification_type: 'system_alert',
              title: 'QuickBooks Connection Expired',
              message: 'Your QuickBooks connection has expired and needs to be reconnected. Please go to QuickBooks settings and reconnect your account.',
              is_read: false,
              reference_type: 'quickbooks_connection',
              reference_id: connection.id
            });

          throw new Error('QuickBooks authorization has expired. Please reconnect your QuickBooks account.');
        }

        throw new Error(`Failed to create customer in QuickBooks: ${errorText}`);
      }

      qboCustomerId = createCustomerResult.data.Customer?.Id;

      // Save QBO customer ID back to our database
      await supabase
        .from('customers')
        .update({ qbo_customer_id: qboCustomerId })
        .eq('id', invoice.customer_id);
    }

    if (!qboCustomerId) {
      throw new Error('Unable to determine QuickBooks customer ID');
    }

    // Create invoice in QuickBooks
    const invoiceData: any = {
      CustomerRef: {
        value: qboCustomerId,
      },
      Line: [
        {
          Amount: invoice.amount || 0,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: {
              value: "1", // Default service item - should be configured
            },
          },
          Description: invoice.description || `Payment for ${invoice.yachts?.name || 'service'}`,
        },
      ],
      TxnDate: invoice.payment_date ? new Date(invoice.payment_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      DueDate: invoice.payment_date ? new Date(invoice.payment_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      DocNumber: invoice.invoice_number || undefined,
      PrivateNote: `Yacht Time Invoice ID: ${invoice.id}`,
    };

    const createInvoiceResult = await makeQuickBooksAPICall({
      url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/invoice`,
      method: 'POST',
      accessToken,
      body: invoiceData,
      requestType: 'create_invoice',
      companyId: profile.company_id,
      connectionId: connection.id,
      referenceType: 'invoice',
      referenceId: invoiceId,
      supabaseUrl,
      serviceRoleKey,
    });

    if (!createInvoiceResult.success) {
      const errorText = createInvoiceResult.data;

      if (createInvoiceResult.response.status === 401 || createInvoiceResult.response.status === 403) {
        await supabase
          .from('quickbooks_connection')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        await supabase
          .from('admin_notifications')
          .insert({
            company_id: profile.company_id,
            notification_type: 'system_alert',
            title: 'QuickBooks Connection Expired',
            message: 'Your QuickBooks connection has expired and needs to be reconnected. Please go to QuickBooks settings and reconnect your account.',
            is_read: false,
            reference_type: 'quickbooks_connection',
            reference_id: connection.id
          });

        throw new Error('QuickBooks authorization has expired. Please reconnect your QuickBooks account.');
      }

      throw new Error(`Failed to create invoice in QuickBooks: ${errorText}`);
    }

    const qboInvoiceId = createInvoiceResult.data.Invoice?.Id;

    // Mark invoice as paid in QuickBooks (create payment)
    const paymentData = {
      CustomerRef: {
        value: qboCustomerId,
      },
      TotalAmt: invoice.amount || 0,
      Line: [
        {
          Amount: invoice.amount || 0,
          LinkedTxn: [
            {
              TxnId: qboInvoiceId,
              TxnType: "Invoice",
            },
          ],
        },
      ],
      TxnDate: invoice.payment_date ? new Date(invoice.payment_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      PaymentMethodRef: invoice.payment_method_type === 'card' ? { value: "1" } : undefined,
    };

    const createPaymentResult = await makeQuickBooksAPICall({
      url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/payment`,
      method: 'POST',
      accessToken,
      body: paymentData,
      requestType: 'create_payment',
      companyId: profile.company_id,
      connectionId: connection.id,
      referenceType: 'invoice',
      referenceId: invoiceId,
      supabaseUrl,
      serviceRoleKey,
    });

    if (!createPaymentResult.success) {
      console.error('Failed to create payment in QuickBooks, but invoice was created');
    }

    // Update our invoice with QuickBooks ID
    await supabase
      .from('yacht_invoices')
      .update({
        qbo_invoice_id: qboInvoiceId,
        qbo_synced_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice pushed to QuickBooks successfully',
        qboInvoiceId,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('QuickBooks push invoice error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred while pushing invoice to QuickBooks'
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
