import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    // Get active QuickBooks connection for this company
    const { data: connection, error: connError } = await supabase
      .from('quickbooks_connection')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      throw new Error('No active QuickBooks connection found. Please connect to QuickBooks first.');
    }

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
        body: JSON.stringify({ action: 'refresh_token' }),
      });

      if (!refreshResult.ok) {
        throw new Error('Failed to refresh QuickBooks token');
      }

      // Re-fetch connection with new token
      const { data: refreshedConnection } = await supabase
        .from('quickbooks_connection')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .single();

      if (refreshedConnection) {
        connection.access_token_encrypted = refreshedConnection.access_token_encrypted;
      }
    }

    // Fetch Chart of Accounts from QuickBooks
    const query = encodeURIComponent('SELECT * FROM Account MAXRESULTS 1000');
    const accountsUrl = `https://quickbooks.api.intuit.com/v3/company/${connection.realm_id}/query?query=${query}`;

    console.log('QuickBooks API Request:', {
      url: accountsUrl,
      realm_id: connection.realm_id,
      token_length: connection.access_token_encrypted?.length
    });

    const accountsResponse = await fetch(accountsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${connection.access_token_encrypted}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    console.log('QuickBooks API Response:', {
      status: accountsResponse.status,
      statusText: accountsResponse.statusText
    });

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error('QuickBooks API Error:', errorText);
      throw new Error(`Failed to fetch accounts from QuickBooks: ${errorText}`);
    }

    const accountsData = await accountsResponse.json();
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
