import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { makeQuickBooksAPICall } from '../_shared/quickbooks.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { invoiceId, encrypted_session } = await req.json();

    if (!invoiceId) throw new Error('Invoice ID is required');
    if (!encrypted_session) throw new Error('Encrypted session required for QuickBooks operations');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase credentials not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');

    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || !['master', 'staff', 'manager'].includes(profile.role)) {
      throw new Error('Only master, staff, or manager users can push invoices to QuickBooks');
    }

    // Get invoice and line items in separate queries to avoid PostgREST join duplication
    const { data: invoice, error: invoiceError } = await supabase
      .from('estimating_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) throw new Error('Invoice not found');

    const { data: lineItemsData, error: lineItemsError } = await supabase
      .from('estimating_invoice_line_items')
      .select('id, task_name, line_type, description, quantity, unit_price, total_price, is_taxable, labor_code_id, part_id, line_order')
      .eq('invoice_id', invoiceId)
      .order('line_order');

    if (lineItemsError) throw new Error('Failed to fetch invoice line items');
    invoice.estimating_invoice_line_items = lineItemsData || [];

    if (invoice.company_id !== profile.company_id && profile.role !== 'master') {
      throw new Error('Invoice does not belong to your company');
    }

    // Get active QuickBooks connection
    const { data: connection, error: connError } = await supabase
      .from('quickbooks_connection')
      .select('id, realm_id, token_expires_at')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      throw new Error('No active QuickBooks connection found. Please connect to QuickBooks first.');
    }

    // Handle token refresh if needed
    let currentEncryptedSession = encrypted_session;
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    if (tokenExpiresAt < fiveMinutesFromNow) {
      const refreshResult = await fetch(`${supabaseUrl}/functions/v1/quickbooks-oauth`, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_token', encrypted_session: currentEncryptedSession }),
      });

      if (!refreshResult.ok) {
        await supabase.from('quickbooks_connection')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', connection.id);
        await supabase.from('admin_notifications').insert({
          company_id: profile.company_id,
          notification_type: 'system_alert',
          title: 'QuickBooks Connection Expired',
          message: 'Your QuickBooks connection has expired and needs to be reconnected.',
          is_read: false,
          reference_type: 'quickbooks_connection',
          reference_id: connection.id,
        });
        throw new Error('QuickBooks authorization has expired. Please reconnect your QuickBooks account.');
      }

      const refreshData = await refreshResult.json();
      currentEncryptedSession = refreshData.encrypted_session;
    }

    // Decrypt session
    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/quickbooks-token-manager`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decrypt', data: { encrypted_session: currentEncryptedSession } }),
    });

    if (!decryptResponse.ok) throw new Error('Failed to decrypt QuickBooks tokens');
    const { access_token: accessToken } = await decryptResponse.json();

    // Get account mappings (company-specific first, fall back to null company_id global mappings)
    const { data: mappings } = await supabase
      .from('quickbooks_account_mappings')
      .select('mapping_type, qbo_account_id, internal_code_id, internal_code_type, company_id')
      .or(`company_id.eq.${profile.company_id},company_id.is.null`);

    const defaultIncomeMapping = mappings?.find(m => m.mapping_type === 'income' && m.internal_code_id === null);
    const defaultPartsMapping = mappings?.find(m => m.mapping_type === 'parts' && m.internal_code_id === null);
    const defaultLaborMapping = mappings?.find(m => m.mapping_type === 'labor' && m.internal_code_id === null);

    const surchargeMapping = mappings?.find(m => m.mapping_type === 'surcharge');

    const incomeAccountId = defaultIncomeMapping?.qbo_account_id;
    if (!incomeAccountId) {
      throw new Error('No default income account mapping found. Please configure QuickBooks account mappings first.');
    }

    // Create or find QB customer
    let qboCustomerId: string | null = null;

    // Check if customer exists in QB by looking at existing customers table
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, qbo_customer_id')
      .eq('company_id', profile.company_id)
      .or(`email.eq.${invoice.customer_email},business_name.ilike.${invoice.customer_name}`)
      .maybeSingle();

    if (existingCustomer?.qbo_customer_id) {
      qboCustomerId = existingCustomer.qbo_customer_id;
    }

    if (!qboCustomerId) {
      // Search QB for customer by display name
      const searchResult = await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${invoice.customer_name.replace(/'/g, "\\'")}'`)}`,
        method: 'GET',
        accessToken,
        requestType: 'search_customer',
        companyId: profile.company_id,
        connectionId: connection.id,
        supabaseUrl,
        serviceRoleKey,
      });

      if (searchResult.success && searchResult.data?.QueryResponse?.Customer?.length > 0) {
        qboCustomerId = searchResult.data.QueryResponse.Customer[0].Id;
      }
    }

    if (!qboCustomerId) {
      // Create new QB customer
      const customerData: any = {
        DisplayName: invoice.customer_name,
        PrimaryEmailAddr: invoice.customer_email ? { Address: invoice.customer_email } : undefined,
        PrimaryPhone: invoice.customer_phone ? { FreeFormNumber: invoice.customer_phone } : undefined,
      };

      const createCustomerResult = await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/customer`,
        method: 'POST',
        accessToken,
        body: customerData,
        requestType: 'create_customer',
        companyId: profile.company_id,
        connectionId: connection.id,
        referenceType: 'estimating_invoice',
        referenceId: invoiceId,
        supabaseUrl,
        serviceRoleKey,
      });

      if (!createCustomerResult.success) {
        if (createCustomerResult.response.status === 401 || createCustomerResult.response.status === 403) {
          await supabase.from('quickbooks_connection')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', connection.id);
          throw new Error('QuickBooks authorization has expired. Please reconnect your QuickBooks account.');
        }

        // Handle duplicate customer name (error 6240) — search for the existing QB customer
        let isDuplicateCustomer = false;
        try {
          const rawErr = createCustomerResult.errorText || JSON.stringify(createCustomerResult.data) || '';
          const errData = rawErr ? JSON.parse(rawErr) : null;
          if (errData?.Fault?.Error?.some((e: any) => e.code === '6240')) {
            isDuplicateCustomer = true;
          }
        } catch (_) {}

        if (isDuplicateCustomer) {
          // Try exact match first
          const retrySearch = await makeQuickBooksAPICall({
            url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${invoice.customer_name.trim().replace(/'/g, "\\'")}'`)}`,
            method: 'GET',
            accessToken,
            requestType: 'search_customer',
            companyId: profile.company_id,
            connectionId: connection.id,
            supabaseUrl,
            serviceRoleKey,
          });
          if (retrySearch.success && retrySearch.data?.QueryResponse?.Customer?.length > 0) {
            qboCustomerId = retrySearch.data.QueryResponse.Customer[0].Id;
          }

          // Exact match failed — try LIKE search with wildcards (handles casing/spacing differences)
          if (!qboCustomerId) {
            const likeSearch = await makeQuickBooksAPICall({
              url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName LIKE '%${invoice.customer_name.trim().replace(/'/g, "\\'")}%'`)}`,
              method: 'GET',
              accessToken,
              requestType: 'search_customer',
              companyId: profile.company_id,
              connectionId: connection.id,
              supabaseUrl,
              serviceRoleKey,
            });
            if (likeSearch.success && likeSearch.data?.QueryResponse?.Customer?.length > 0) {
              qboCustomerId = likeSearch.data.QueryResponse.Customer[0].Id;
            }
          }

          // Last resort — search by email
          if (!qboCustomerId && invoice.customer_email) {
            const emailSearch = await makeQuickBooksAPICall({
              url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${invoice.customer_email.replace(/'/g, "\\'")}'`)}`,
              method: 'GET',
              accessToken,
              requestType: 'search_customer',
              companyId: profile.company_id,
              connectionId: connection.id,
              supabaseUrl,
              serviceRoleKey,
            });
            if (emailSearch.success && emailSearch.data?.QueryResponse?.Customer?.length > 0) {
              qboCustomerId = emailSearch.data.QueryResponse.Customer[0].Id;
            }
          }
        }

        if (!qboCustomerId) {
          throw new Error(`Failed to create customer in QuickBooks: ${createCustomerResult.data}`);
        }
      } else {
        qboCustomerId = createCustomerResult.data.Customer?.Id;
      }
    }

    if (!qboCustomerId) throw new Error('Unable to determine QuickBooks customer ID');

    // Fetch or create QB Service Items for parts, labor, and general services.
    // QB invoices require SalesItemLineDetail.ItemRef to reference a valid QB Item (product/service),
    // NOT an account ID. We maintain 3 service items: Parts, Labor, and Services.
    const getOrCreateQBItem = async (
      name: string,
      incomeAccountRef: string,
      itemType: string = 'Service',
    ): Promise<string> => {
      const searchRes = await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Item WHERE Name = '${name}'`)}`,
        method: 'GET',
        accessToken,
        requestType: 'search_item',
        companyId: profile.company_id,
        connectionId: connection.id,
        supabaseUrl,
        serviceRoleKey,
      });
      if (searchRes.success && searchRes.data?.QueryResponse?.Item?.length > 0) {
        return searchRes.data.QueryResponse.Item[0].Id;
      }
      const createRes = await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/item`,
        method: 'POST',
        accessToken,
        body: {
          Name: name,
          Type: itemType,
          IncomeAccountRef: { value: incomeAccountRef },
        },
        requestType: 'create_item',
        companyId: profile.company_id,
        connectionId: connection.id,
        supabaseUrl,
        serviceRoleKey,
      });
      if (!createRes.success) {
        let detail = createRes.errorText || JSON.stringify(createRes.data) || 'Unknown error';
        try {
          const parsed = JSON.parse(detail);
          if (parsed?.Fault?.Error?.[0]?.Detail) detail = parsed.Fault.Error[0].Detail;
        } catch (_) {}
        throw new Error(`Failed to create QB Item "${name}": ${detail}`);
      }
      return createRes.data.Item.Id;
    };

    const partsAccountId = defaultPartsMapping?.qbo_account_id || incomeAccountId;
    const laborAccountId = defaultLaborMapping?.qbo_account_id || incomeAccountId;
    const surchargeAccountId = surchargeMapping?.qbo_account_id || incomeAccountId;


    const itemPromises: Promise<string>[] = [
      getOrCreateQBItem('AZ Marine Parts', partsAccountId),
      getOrCreateQBItem('AZ Marine Labor', laborAccountId),
      getOrCreateQBItem('AZ Marine Services', incomeAccountId),
    ];



    const resolvedItems = await Promise.all(itemPromises);
    const partsItemId = resolvedItems[0];
    const laborItemId = resolvedItems[1];
    const servicesItemId = resolvedItems[2];

    // Build QB invoice line items as gross totals per line type (parts, labor, other)
    // instead of individual line items — keeps QuickBooks clean and fast to reconcile.
    // Full per-line detail remains in the app; QB only gets the summary.
    const lineItems = invoice.estimating_invoice_line_items || [];
    const qbLineItems: any[] = [];

    let partsTotal = 0;
    let laborTotal = 0;
    let otherTotal = 0;
    let partsCount = 0;
    let laborCount = 0;

    for (const item of lineItems) {
      if (!item.quantity || parseFloat(item.quantity) === 0) continue;
      const amount = parseFloat(item.total_price) || 0;

      if (item.line_type === 'parts' || item.line_type === 'part') {
        partsTotal += amount;
        partsCount++;
      } else if (item.line_type === 'labor') {
        laborTotal += amount;
        laborCount++;
      } else {
        otherTotal += amount;
      }
    }

    if (partsTotal > 0) {
      qbLineItems.push({
        Amount: parseFloat(partsTotal.toFixed(2)),
        DetailType: 'SalesItemLineDetail',
        Description: `Parts (${partsCount} line${partsCount !== 1 ? 's' : ''})`,
        SalesItemLineDetail: {
          UnitPrice: parseFloat(partsTotal.toFixed(2)),
          Qty: 1,
          ItemRef: { value: partsItemId },
          TaxCodeRef: { value: 'NON' },
        },
      });
    }

    if (laborTotal > 0) {
      qbLineItems.push({
        Amount: parseFloat(laborTotal.toFixed(2)),
        DetailType: 'SalesItemLineDetail',
        Description: `Labor (${laborCount} line${laborCount !== 1 ? 's' : ''})`,
        SalesItemLineDetail: {
          UnitPrice: parseFloat(laborTotal.toFixed(2)),
          Qty: 1,
          ItemRef: { value: laborItemId },
          TaxCodeRef: { value: 'NON' },
        },
      });
    }

    if (otherTotal > 0) {
      qbLineItems.push({
        Amount: parseFloat(otherTotal.toFixed(2)),
        DetailType: 'SalesItemLineDetail',
        Description: 'Other Services',
        SalesItemLineDetail: {
          UnitPrice: parseFloat(otherTotal.toFixed(2)),
          Qty: 1,
          ItemRef: { value: servicesItemId },
          TaxCodeRef: { value: 'NON' },
        },
      });
    }

    // Add shop supplies line if applicable
    if (invoice.shop_supplies_amount && invoice.shop_supplies_amount > 0) {
      qbLineItems.push({
        Amount: invoice.shop_supplies_amount,
        DetailType: 'SalesItemLineDetail',
        Description: 'Shop Supplies',
        SalesItemLineDetail: {
          UnitPrice: invoice.shop_supplies_amount,
          Qty: 1,
          ItemRef: { value: servicesItemId },
        },
      });
    }

    // Add surcharge line if applicable
    if (invoice.surcharge_amount && invoice.surcharge_amount > 0) {
      qbLineItems.push({
        Amount: invoice.surcharge_amount,
        DetailType: 'SalesItemLineDetail',
        Description: 'Surcharge',
        SalesItemLineDetail: {
          UnitPrice: invoice.surcharge_amount,
          Qty: 1,
          ItemRef: { value: servicesItemId },
        },
      });
    }

    // Add park fees line if applicable
    if (invoice.park_fees_amount && invoice.park_fees_amount > 0) {
      qbLineItems.push({
        Amount: invoice.park_fees_amount,
        DetailType: 'SalesItemLineDetail',
        Description: 'Park Fees',
        SalesItemLineDetail: {
          UnitPrice: invoice.park_fees_amount,
          Qty: 1,
          ItemRef: { value: servicesItemId },
        },
      });
    }

    // If no parts/labor/other lines were produced (e.g. older invoices with no
    // line items stored), send the invoice subtotal as a single Services line so
    // the core amount is not missing from QuickBooks. This fires independently of
    // the shop-supplies / surcharge / park-fees lines below, which only cover extras.
    if (partsTotal === 0 && laborTotal === 0 && otherTotal === 0 && invoice.subtotal && parseFloat(invoice.subtotal) > 0) {
      const subtotalAmount = parseFloat(invoice.subtotal);
      qbLineItems.push({
        Amount: parseFloat(subtotalAmount.toFixed(2)),
        DetailType: 'SalesItemLineDetail',
        Description: `Services (${invoice.invoice_number})`,
        SalesItemLineDetail: {
          UnitPrice: parseFloat(subtotalAmount.toFixed(2)),
          Qty: 1,
          ItemRef: { value: servicesItemId },
          TaxCodeRef: { value: 'NON' },
        },
      });
    }

    if (qbLineItems.length === 0) {
      qbLineItems.push({
        Amount: invoice.total_amount || 0,
        DetailType: 'SalesItemLineDetail',
        Description: `Invoice ${invoice.invoice_number}`,
        SalesItemLineDetail: {
          UnitPrice: invoice.total_amount || 0,
          Qty: 1,
          ItemRef: { value: servicesItemId },
          TaxCodeRef: { value: 'NON' },
        },
      });
    }

    // Add tax as an explicit line item so QB total matches our invoice exactly.
    // Uses the existing Services item — QuickBooks does not allow creating an
    // Item that posts to the system-managed Sales Tax Payable account (error 6430).
    // The line is clearly labelled "Sales Tax" so it is identifiable in QuickBooks.
    if (invoice.tax_amount && parseFloat(invoice.tax_amount) > 0) {
      qbLineItems.push({
        Amount: parseFloat(invoice.tax_amount),
        DetailType: 'SalesItemLineDetail',
        Description: `Sales Tax (${Math.round(parseFloat(invoice.tax_rate) * 1000) / 10}%)`,
        SalesItemLineDetail: {
          UnitPrice: parseFloat(invoice.tax_amount),
          Qty: 1,
          ItemRef: { value: servicesItemId },
          TaxCodeRef: { value: 'NON' },
        },
      });
    }

    const txnDate = invoice.invoice_date
      ? new Date(invoice.invoice_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const dueDate = invoice.due_date
      ? new Date(invoice.due_date).toISOString().split('T')[0]
      : txnDate;

    const invoicePayload: any = {
      CustomerRef: { value: qboCustomerId },
      Line: qbLineItems,
      TxnDate: txnDate,
      DueDate: dueDate,
      DocNumber: invoice.invoice_number,
      PrivateNote: `Estimating Invoice ID: ${invoice.id} | Summary: ${partsCount} parts line${partsCount !== 1 ? 's' : ''}, ${laborCount} labor line${laborCount !== 1 ? 's' : ''} — see app for detail`,
    };

    // Mark as exported pending
    await supabase.from('estimating_invoices').update({
      quickbooks_export_status: 'pending',
      quickbooks_export_error: null,
    }).eq('id', invoiceId);

    const createInvoiceResult = await makeQuickBooksAPICall({
      url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/invoice`,
      method: 'POST',
      accessToken,
      body: invoicePayload,
      requestType: 'create_estimating_invoice',
      companyId: profile.company_id,
      connectionId: connection.id,
      referenceType: 'estimating_invoice',
      referenceId: invoiceId,
      supabaseUrl,
      serviceRoleKey,
    });

    if (!createInvoiceResult.success) {
      if (createInvoiceResult.response.status === 401 || createInvoiceResult.response.status === 403) {
        await supabase.from('quickbooks_connection')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', connection.id);
        await supabase.from('estimating_invoices').update({
          quickbooks_export_status: 'error',
          quickbooks_export_error: 'QuickBooks authorization expired',
        }).eq('id', invoiceId);
        throw new Error('QuickBooks authorization has expired. Please reconnect your QuickBooks account.');
      }

      // Parse QB fault error for a readable message
      let qbErrorMessage = 'Unknown error';
      let isDuplicateDocNumber = false;
      let existingTxnId: string | null = null;
      try {
        const rawErr = createInvoiceResult.errorText || '';
        const errData = rawErr ? JSON.parse(rawErr) : null;
        if (errData?.Fault?.Error?.length > 0) {
          const firstError = errData.Fault.Error[0];
          qbErrorMessage = firstError.Detail || firstError.Message || qbErrorMessage;
          if (firstError.code === '6140') {
            isDuplicateDocNumber = true;
            const match = firstError.Detail?.match(/TxnId=(\d+)/);
            if (match) existingTxnId = match[1];
          }
        } else if (rawErr) {
          qbErrorMessage = rawErr;
        }
      } catch (_) {
        qbErrorMessage = createInvoiceResult.errorText || 'Failed to create invoice in QuickBooks';
      }

      // Handle duplicate doc number: fetch the existing QB invoice and send a full update
      if (isDuplicateDocNumber && existingTxnId) {
        // Fetch the existing invoice from QB to get its SyncToken (required for updates)
        const fetchResult = await makeQuickBooksAPICall({
          url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/invoice/${existingTxnId}`,
          method: 'GET',
          accessToken,
          requestType: 'fetch_estimating_invoice',
          companyId: profile.company_id,
          connectionId: connection.id,
          referenceType: 'estimating_invoice',
          referenceId: invoiceId,
          supabaseUrl,
          serviceRoleKey,
        });

        if (!fetchResult.success || !fetchResult.data?.Invoice) {
          // Existing invoice not found in QB — create new with modified doc number
          const retryPayload = { ...invoicePayload, DocNumber: `${invoice.invoice_number}-R` };
          const retryResult = await makeQuickBooksAPICall({
            url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/invoice`,
            method: 'POST',
            accessToken,
            body: retryPayload,
            requestType: 'create_estimating_invoice',
            companyId: profile.company_id,
            connectionId: connection.id,
            referenceType: 'estimating_invoice',
            referenceId: invoiceId,
            supabaseUrl,
            serviceRoleKey,
          });

          if (!retryResult.success || !retryResult.data?.Invoice?.Id) {
            let retryErr = 'Unknown error';
            try {
              const rawRetry = retryResult.errorText || '';
              const retryData = rawRetry ? JSON.parse(rawRetry) : null;
              if (retryData?.Fault?.Error?.[0]?.Detail) retryErr = retryData.Fault.Error[0].Detail;
              else if (rawRetry) retryErr = rawRetry;
            } catch (_) {}
            await supabase.from('estimating_invoices').update({
              quickbooks_export_status: 'error',
              quickbooks_export_error: `Retry with modified doc number failed: ${retryErr.substring(0, 450)}`,
            }).eq('id', invoiceId);
            throw new Error(`Failed to create invoice in QuickBooks (retry): ${retryErr}`);
          }

          const retryQboId = retryResult.data.Invoice.Id;
          // If invoice is paid, create QB payment linked to the new invoice
          if (invoice.payment_status === 'paid') {
            const paidAt = invoice.paid_at || invoice.final_payment_paid_at || invoice.check_payment_recorded_at;
            const paymentDate = paidAt ? new Date(paidAt).toISOString().split('T')[0] : txnDate;
            const totalPaid = invoice.total_amount || 0;
            await makeQuickBooksAPICall({
              url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/payment`,
              method: 'POST',
              accessToken,
              body: {
                CustomerRef: { value: qboCustomerId },
                TotalAmt: totalPaid,
                Line: [{ Amount: totalPaid, LinkedTxn: [{ TxnId: retryQboId, TxnType: 'Invoice' }] }],
                TxnDate: paymentDate,
              },
              requestType: 'create_payment_for_estimating_invoice',
              companyId: profile.company_id,
              connectionId: connection.id,
              referenceType: 'estimating_invoice',
              referenceId: invoiceId,
              supabaseUrl,
              serviceRoleKey,
            });
          }
          await supabase.from('estimating_invoices').update({
            quickbooks_export_status: 'exported',
            quickbooks_invoice_id: retryQboId,
            quickbooks_export_date: new Date().toISOString(),
            quickbooks_export_error: null,
            quickbooks_invoice_synced_at: new Date().toISOString(),
          }).eq('id', invoiceId);
          return new Response(
            JSON.stringify({
              success: true,
              message: `Invoice exported to QuickBooks with modified doc number ${invoice.invoice_number}-R (original was deleted in QuickBooks).`,
              qboInvoiceId: retryQboId,
              encrypted_session: currentEncryptedSession,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // We have the existing invoice with SyncToken — send a full update
        const syncToken = fetchResult.data.Invoice.SyncToken;
        const updatePayload = {
          ...invoicePayload,
          Id: existingTxnId,
          SyncToken: syncToken,
          sparse: false,
        };

        const updateResult = await makeQuickBooksAPICall({
          url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/invoice`,
          method: 'POST',
          accessToken,
          body: updatePayload,
          requestType: 'update_estimating_invoice',
          companyId: profile.company_id,
          connectionId: connection.id,
          referenceType: 'estimating_invoice',
          referenceId: invoiceId,
          supabaseUrl,
          serviceRoleKey,
        });

        if (!updateResult.success || !updateResult.data?.Invoice?.Id) {
          let updateErr = 'Unknown error';
          try {
            const rawUpdate = updateResult.errorText || '';
            const updateData = rawUpdate ? JSON.parse(rawUpdate) : null;
            if (updateData?.Fault?.Error?.[0]?.Detail) updateErr = updateData.Fault.Error[0].Detail;
            else if (rawUpdate) updateErr = rawUpdate;
          } catch (_) {}
          await supabase.from('estimating_invoices').update({
            quickbooks_export_status: 'error',
            quickbooks_export_error: `Update of existing QB invoice failed: ${updateErr.substring(0, 450)}`,
          }).eq('id', invoiceId);
          throw new Error(`Failed to update existing QuickBooks invoice: ${updateErr}`);
        }

        const updatedQboId = updateResult.data.Invoice.Id;

        // If invoice is paid, create QB payment linked to the updated invoice
        if (invoice.payment_status === 'paid') {
          const paidAt = invoice.paid_at || invoice.final_payment_paid_at || invoice.check_payment_recorded_at;
          const paymentDate = paidAt ? new Date(paidAt).toISOString().split('T')[0] : txnDate;
          const totalPaid = invoice.total_amount || 0;
          await makeQuickBooksAPICall({
            url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/payment`,
            method: 'POST',
            accessToken,
            body: {
              CustomerRef: { value: qboCustomerId },
              TotalAmt: totalPaid,
              Line: [{ Amount: totalPaid, LinkedTxn: [{ TxnId: updatedQboId, TxnType: 'Invoice' }] }],
              TxnDate: paymentDate,
            },
            requestType: 'create_payment_for_estimating_invoice',
            companyId: profile.company_id,
            connectionId: connection.id,
            referenceType: 'estimating_invoice',
            referenceId: invoiceId,
            supabaseUrl,
            serviceRoleKey,
          });
        }

        await supabase.from('estimating_invoices').update({
          quickbooks_export_status: 'exported',
          quickbooks_invoice_id: updatedQboId,
          quickbooks_export_date: new Date().toISOString(),
          quickbooks_export_error: null,
          quickbooks_invoice_synced_at: new Date().toISOString(),
        }).eq('id', invoiceId);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Invoice updated in QuickBooks (existing invoice ID: ${updatedQboId}). Current line items and amounts have been synced.`,
            qboInvoiceId: updatedQboId,
            encrypted_session: currentEncryptedSession,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('estimating_invoices').update({
        quickbooks_export_status: 'error',
        quickbooks_export_error: qbErrorMessage.substring(0, 500),
      }).eq('id', invoiceId);
      throw new Error(`Failed to create invoice in QuickBooks: ${qbErrorMessage}`);
    }

    const qboInvoiceId = createInvoiceResult.data.Invoice?.Id;

    // If invoice is paid, also create a QB payment
    if (invoice.payment_status === 'paid') {
      const paidAt = invoice.paid_at || invoice.final_payment_paid_at || invoice.check_payment_recorded_at;
      const paymentDate = paidAt
        ? new Date(paidAt).toISOString().split('T')[0]
        : txnDate;

      const totalPaid = invoice.total_amount || 0;

      const paymentPayload: any = {
        CustomerRef: { value: qboCustomerId },
        TotalAmt: totalPaid,
        Line: [{
          Amount: totalPaid,
          LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: 'Invoice' }],
        }],
        TxnDate: paymentDate,
      };

      await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/payment`,
        method: 'POST',
        accessToken,
        body: paymentPayload,
        requestType: 'create_payment_for_estimating_invoice',
        companyId: profile.company_id,
        connectionId: connection.id,
        referenceType: 'estimating_invoice',
        referenceId: invoiceId,
        supabaseUrl,
        serviceRoleKey,
      });
    }

    // Update invoice with QB data
    await supabase.from('estimating_invoices').update({
      quickbooks_export_status: 'exported',
      quickbooks_invoice_id: qboInvoiceId,
      quickbooks_export_date: new Date().toISOString(),
      quickbooks_export_error: null,
      quickbooks_invoice_synced_at: new Date().toISOString(),
    }).eq('id', invoiceId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice exported to QuickBooks successfully',
        qboInvoiceId,
        encrypted_session: currentEncryptedSession,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('QuickBooks push estimating invoice error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred while exporting invoice to QuickBooks' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
