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

    // Get encrypted session from request body
    const { encrypted_session } = await req.json();
    if (!encrypted_session) {
      throw new Error('Encrypted session required for QuickBooks operations');
    }

    // Import Supabase client
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user is master
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'master') {
      throw new Error('Only master users can sync QuickBooks data');
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

    // Check if token needs refresh (refresh if expires in less than 5 minutes)
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (tokenExpiresAt < fiveMinutesFromNow) {
      // Refresh token
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
        throw new Error('Failed to refresh QuickBooks token');
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

    // Fetch Chart of Accounts from QuickBooks
    const query = encodeURIComponent('SELECT * FROM Account MAXRESULTS 1000');
    const accountsUrl = `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${query}`;

    console.log('QuickBooks API Request:', {
      url: accountsUrl,
      realm_id: connection.realm_id,
      token_length: accessToken?.length
    });

    const accountsResult = await makeQuickBooksAPICall({
      url: accountsUrl,
      method: 'GET',
      accessToken,
      requestType: 'sync_accounts',
      companyId: profile.company_id,
      connectionId: connection.id,
      supabaseUrl,
      serviceRoleKey,
    });

    console.log('QuickBooks API Response:', {
      status: accountsResult.response.status,
      success: accountsResult.success,
      intuit_tid: accountsResult.intuitTid
    });

    if (!accountsResult.success) {
      const errorText = accountsResult.data;
      console.error('QuickBooks API Error:', errorText);

      if (accountsResult.response.status === 401 || accountsResult.response.status === 403) {
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

      throw new Error(`Failed to fetch accounts from QuickBooks: ${errorText}`);
    }

    const accountsData = accountsResult.data;
    const accounts = accountsData.QueryResponse?.Account || [];

    console.log(`Fetched ${accounts.length} accounts from QuickBooks`);

    // Process and store accounts in database
    let syncedCount = 0;
    let errorCount = 0;

    for (const account of accounts) {
      try {
        const accountData = {
          qbo_account_id: account.Id,
          account_name: account.Name,
          account_type: account.AccountType,
          account_subtype: account.AccountSubType || null,
          fully_qualified_name: account.FullyQualifiedName || account.Name,
          active: account.Active !== false,
          classification: account.Classification || null,
          account_number: account.AcctNum || null,
          description: account.Description || null,
          company_id: profile.company_id,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Upsert account (insert or update if exists)
        const { error: upsertError } = await supabase
          .from('quickbooks_accounts')
          .upsert(accountData, {
            onConflict: 'qbo_account_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`Error upserting account ${account.Id}:`, upsertError);
          errorCount++;
        } else {
          syncedCount++;
        }
      } catch (err) {
        console.error(`Error processing account ${account.Id}:`, err);
        errorCount++;
      }
    }

    // Update connection's last_sync_at
    await supabase
      .from('quickbooks_connection')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${syncedCount} accounts from QuickBooks`,
        syncedCount,
        errorCount,
        totalAccounts: accounts.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('QuickBooks sync error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred during QuickBooks sync'
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
