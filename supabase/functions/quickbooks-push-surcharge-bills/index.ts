import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { makeQuickBooksAPICall } from '../_shared/quickbooks.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// QB account number for Marina Surcharge expense (6344.00 Marina Surcharge)
const MARINA_SURCHARGE_ACCOUNT_NAME = 'Marina Surcharge';
const MARINA_VENDOR_NAME = 'Antelope Point Marina';
// Fallback vendor name used when the primary name is taken by a non-Vendor entity (e.g., a Customer)
const MARINA_VENDOR_NAME_FALLBACK = 'Antelope Point Marina (Vendor)';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { invoiceIds, encrypted_session, month } = await req.json();

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      throw new Error('invoiceIds array is required');
    }
    if (!encrypted_session) throw new Error('Encrypted session required for QuickBooks operations');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error('month is required in YYYY-MM format');
    }

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
      .select('role, company_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || !['master', 'staff', 'manager'].includes(profile.role)) {
      throw new Error('Only master, staff, or manager users can push surcharge bills to QuickBooks');
    }

    // Check month lock — prevent double-pushing
    const { data: existingLock } = await supabase
      .from('qb_surcharge_push_log')
      .select('id, pushed_at, invoice_count, total_amount')
      .eq('company_id', profile.company_id)
      .eq('month', month)
      .maybeSingle();

    if (existingLock) {
      const pushedDate = new Date(existingLock.pushed_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
      });
      throw new Error(
        `Surcharge bills for ${month} have already been pushed to QuickBooks on ${pushedDate}. ` +
        `(${existingLock.invoice_count} bills, $${Number(existingLock.total_amount).toFixed(2)} total)`
      );
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

    // Fetch invoices that need surcharge bills pushed
    const { data: invoices, error: invError } = await supabase
      .from('estimating_invoices')
      .select('id, invoice_number, invoice_date, surcharge_amount, qb_surcharge_bill_id, company_id')
      .in('id', invoiceIds)
      .gt('surcharge_amount', 0);

    if (invError) throw new Error('Failed to fetch invoices');
    if (!invoices || invoices.length === 0) {
      throw new Error('No invoices with surcharge amounts found');
    }

    // Validate company ownership
    for (const inv of invoices) {
      if (inv.company_id !== profile.company_id && profile.role !== 'master') {
        throw new Error(`Invoice ${inv.invoice_number} does not belong to your company`);
      }
    }

    // Find or create the Antelope Point Marina vendor in QB
    const vendorSearchResult = await makeQuickBooksAPICall({
      url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${MARINA_VENDOR_NAME}'`)}`,
      method: 'GET',
      accessToken,
      requestType: 'search_vendor_marina',
      companyId: profile.company_id,
      connectionId: connection.id,
      supabaseUrl,
      serviceRoleKey,
    });

    let vendorId: string | null = null;
    if (vendorSearchResult.success && vendorSearchResult.data?.QueryResponse?.Vendor?.length > 0) {
      vendorId = vendorSearchResult.data.QueryResponse.Vendor[0].Id;
    }

    if (!vendorId) {
      // Create the vendor
      const createVendorResult = await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/vendor`,
        method: 'POST',
        accessToken,
        body: { DisplayName: MARINA_VENDOR_NAME },
        requestType: 'create_vendor_marina',
        companyId: profile.company_id,
        connectionId: connection.id,
        supabaseUrl,
        serviceRoleKey,
      });

      if (!createVendorResult.success) {
        if (createVendorResult.response.status === 401 || createVendorResult.response.status === 403) {
          await supabase.from('quickbooks_connection')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', connection.id);
          throw new Error('QuickBooks authorization has expired. Please reconnect your QuickBooks account.');
        }

        // If vendor already exists (duplicate name), the existing entity may be a Customer or Employee —
        // NOT necessarily a Vendor. Do NOT use the Id from the error because it may be the wrong type.
        // Instead, search explicitly for a Vendor with that name; if none found, create with fallback name.
        const errorText = createVendorResult.errorText || '';
        const isDuplicate = errorText.includes('6240') || errorText.toLowerCase().includes('duplicate name');
        if (isDuplicate) {
          // The primary name is taken by a non-Vendor entity; try the fallback vendor name
          console.log(`[SurchargePush] Primary vendor name taken by non-Vendor entity; trying fallback: ${MARINA_VENDOR_NAME_FALLBACK}`);

          // First check if fallback vendor already exists
          const fallbackSearchResult = await makeQuickBooksAPICall({
            url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${MARINA_VENDOR_NAME_FALLBACK}'`)}`,
            method: 'GET',
            accessToken,
            requestType: 'search_vendor_marina_fallback',
            companyId: profile.company_id,
            connectionId: connection.id,
            supabaseUrl,
            serviceRoleKey,
          });

          if (fallbackSearchResult.success && fallbackSearchResult.data?.QueryResponse?.Vendor?.length > 0) {
            vendorId = fallbackSearchResult.data.QueryResponse.Vendor[0].Id;
            console.log(`[SurchargePush] Found existing fallback vendor with Id=${vendorId}`);
          } else {
            // Create vendor with fallback name
            const createFallbackResult = await makeQuickBooksAPICall({
              url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/vendor`,
              method: 'POST',
              accessToken,
              body: { DisplayName: MARINA_VENDOR_NAME_FALLBACK },
              requestType: 'create_vendor_marina_fallback',
              companyId: profile.company_id,
              connectionId: connection.id,
              supabaseUrl,
              serviceRoleKey,
            });

            if (createFallbackResult.success) {
              vendorId = createFallbackResult.data.Vendor?.Id;
              console.log(`[SurchargePush] Created fallback vendor with Id=${vendorId}`);
            } else {
              throw new Error(`Failed to create vendor in QuickBooks: ${createFallbackResult.errorText}`);
            }
          }
        }

        if (!vendorId) {
          throw new Error(`Failed to create vendor "${MARINA_VENDOR_NAME}" in QuickBooks: ${errorText}`);
        }
      } else {
        vendorId = createVendorResult.data.Vendor?.Id;
      }
    }

    if (!vendorId) throw new Error('Unable to determine QuickBooks vendor ID for Antelope Point Marina');

    // Find the QB expense account for marina surcharge (6344.00 Marina Surcharge)
    // First check account mappings, then search QB by name
    const { data: mappings } = await supabase
      .from('quickbooks_account_mappings')
      .select('mapping_type, qbo_account_id')
      .eq('mapping_type', 'marina_surcharge')
      .or(`company_id.eq.${profile.company_id},company_id.is.null`);

    let surchargeExpenseAccountId: string | null = mappings?.[0]?.qbo_account_id || null;

    if (!surchargeExpenseAccountId) {
      // Search QB accounts for "6344" or "Marina Surcharge"
      const accountSearchResult = await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Account WHERE Name LIKE '%${MARINA_SURCHARGE_ACCOUNT_NAME}%'`)}`,
        method: 'GET',
        accessToken,
        requestType: 'search_account_marina_surcharge',
        companyId: profile.company_id,
        connectionId: connection.id,
        supabaseUrl,
        serviceRoleKey,
      });

      if (accountSearchResult.success && accountSearchResult.data?.QueryResponse?.Account?.length > 0) {
        surchargeExpenseAccountId = accountSearchResult.data.QueryResponse.Account[0].Id;
      }
    }

    if (!surchargeExpenseAccountId) {
      throw new Error(
        `Could not find the "6344.00 Marina Surcharge" expense account in QuickBooks. ` +
        `Please ensure this account exists in your QuickBooks chart of accounts.`
      );
    }

    // Push each invoice as an individual Bill
    const results: { invoiceId: string; invoiceNumber: string; success: boolean; billId?: string; error?: string }[] = [];
    let successCount = 0;
    let totalAmount = 0;

    for (const inv of invoices) {
      // Skip already-pushed invoices
      if (inv.qb_surcharge_bill_id) {
        results.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          success: true,
          billId: inv.qb_surcharge_bill_id,
        });
        successCount++;
        totalAmount += Number(inv.surcharge_amount);
        continue;
      }

      const txnDate = inv.invoice_date
        ? new Date(inv.invoice_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const surchargeAmount = Number(inv.surcharge_amount);

      const billPayload = {
        VendorRef: { value: vendorId },
        TxnDate: txnDate,
        DocNumber: inv.invoice_number,
        PrivateNote: `Surcharge from Invoice ${inv.invoice_number} (ID: ${inv.id})`,
        Line: [
          {
            Amount: surchargeAmount,
            DetailType: 'AccountBasedExpenseLineDetail',
            Description: `Marina Surcharge - Invoice ${inv.invoice_number}`,
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: surchargeExpenseAccountId },
              BillableStatus: 'NotBillable',
            },
          },
        ],
      };

      const createBillResult = await makeQuickBooksAPICall({
        url: `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/bill`,
        method: 'POST',
        accessToken,
        body: billPayload,
        requestType: 'create_surcharge_bill',
        companyId: profile.company_id,
        connectionId: connection.id,
        referenceType: 'estimating_invoice',
        referenceId: inv.id,
        supabaseUrl,
        serviceRoleKey,
      });

      if (!createBillResult.success) {
        if (createBillResult.response.status === 401 || createBillResult.response.status === 403) {
          await supabase.from('quickbooks_connection')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', connection.id);
          throw new Error('QuickBooks authorization has expired. Please reconnect your QuickBooks account.');
        }

        let errorMsg = 'Failed to create bill';
        try {
          const rawErr = createBillResult.errorText || '';
          const errData = rawErr ? JSON.parse(rawErr) : null;
          if (errData?.Fault?.Error?.[0]) {
            errorMsg = errData.Fault.Error[0].Detail || errData.Fault.Error[0].Message || errorMsg;
          } else if (rawErr) {
            errorMsg = rawErr;
          }
        } catch (_) {
          errorMsg = createBillResult.errorText || errorMsg;
        }

        results.push({ invoiceId: inv.id, invoiceNumber: inv.invoice_number, success: false, error: errorMsg });
        continue;
      }

      const qbBillId = createBillResult.data?.Bill?.Id;

      // Mark the invoice as pushed
      await supabase.from('estimating_invoices').update({
        qb_surcharge_bill_id: qbBillId,
        qb_surcharge_bill_date: new Date().toISOString(),
      }).eq('id', inv.id);

      results.push({ invoiceId: inv.id, invoiceNumber: inv.invoice_number, success: true, billId: qbBillId });
      successCount++;
      totalAmount += surchargeAmount;
    }

    // Only record the month lock if at least one bill was successfully pushed
    if (successCount > 0) {
      await supabase.from('qb_surcharge_push_log').insert({
        company_id: profile.company_id,
        month,
        pushed_by_user_id: profile.user_id,
        invoice_count: successCount,
        total_amount: totalAmount,
      });
    }

    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        message: failCount === 0
          ? `Successfully pushed ${successCount} surcharge bill${successCount !== 1 ? 's' : ''} to QuickBooks ($${totalAmount.toFixed(2)} total)`
          : `Pushed ${successCount} bill${successCount !== 1 ? 's' : ''} successfully, ${failCount} failed`,
        results,
        successCount,
        failCount,
        totalAmount,
        encrypted_session: currentEncryptedSession,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('QuickBooks push surcharge bills error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred while pushing surcharge bills to QuickBooks' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
