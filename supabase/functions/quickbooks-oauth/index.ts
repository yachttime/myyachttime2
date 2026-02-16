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
    const { action, code, realmId, state } = await req.json();

    // Get QuickBooks OAuth credentials from environment
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const redirectUri = Deno.env.get('QUICKBOOKS_REDIRECT_URI');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration missing');
    }

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('QuickBooks credentials not configured. Please set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, and QUICKBOOKS_REDIRECT_URI environment variables in your Supabase project settings.');
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
      throw new Error('Only master users can connect QuickBooks');
    }

    if (action === 'get_auth_url') {
      // Generate authorization URL
      const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', `user_${user.id}_company_${profile.company_id}`);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (action === 'exchange_token') {
      // Exchange authorization code for access token
      const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

      const basicAuth = btoa(`${clientId}:${clientSecret}`);

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to exchange token: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();

      // Get company info from QuickBooks
      const companyInfoUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`;

      const companyInfoResponse = await fetch(companyInfoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      let companyName = 'QuickBooks Company';
      if (companyInfoResponse.ok) {
        const companyInfo = await companyInfoResponse.json();
        companyName = companyInfo.CompanyInfo?.CompanyName || companyName;
      }

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Check if connection with this realm_id already exists
      const { data: existingConnection } = await supabase
        .from('quickbooks_connection')
        .select('id')
        .eq('realm_id', realmId)
        .maybeSingle();

      if (existingConnection) {
        // Update existing connection
        const { error: updateError } = await supabase
          .from('quickbooks_connection')
          .update({
            company_id: profile.company_id,
            company_name: companyName,
            access_token_encrypted: tokenData.access_token,
            refresh_token_encrypted: tokenData.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            is_active: true,
            created_by: user.id,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConnection.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Deactivate any other connections for this company
        await supabase
          .from('quickbooks_connection')
          .update({ is_active: false })
          .eq('company_id', profile.company_id);

        // Insert new connection
        const { error: insertError } = await supabase
          .from('quickbooks_connection')
          .insert({
            company_id: profile.company_id,
            company_name: companyName,
            realm_id: realmId,
            access_token_encrypted: tokenData.access_token,
            refresh_token_encrypted: tokenData.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            is_active: true,
            created_by: user.id,
          });

        if (insertError) {
          throw insertError;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          companyName,
          message: 'QuickBooks connected successfully'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (action === 'refresh_token') {
      // Get existing connection
      const { data: connection, error: connError } = await supabase
        .from('quickbooks_connection')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .single();

      if (connError || !connection) {
        throw new Error('No active QuickBooks connection found');
      }

      // Refresh the access token
      const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
      const basicAuth = btoa(`${clientId}:${clientSecret}`);

      const refreshResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token_encrypted,
        }).toString(),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(`Failed to refresh token: ${errorText}`);
      }

      const tokenData = await refreshResponse.json();
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Update connection with new tokens
      const { error: updateError } = await supabase
        .from('quickbooks_connection')
        .update({
          access_token_encrypted: tokenData.access_token,
          refresh_token_encrypted: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Token refreshed successfully'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (action === 'disconnect') {
      // Deactivate connection
      const { error: disconnectError } = await supabase
        .from('quickbooks_connection')
        .update({ is_active: false })
        .eq('company_id', profile.company_id)
        .eq('is_active', true);

      if (disconnectError) {
        throw disconnectError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'QuickBooks disconnected successfully'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('QuickBooks OAuth error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred during QuickBooks authentication'
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
