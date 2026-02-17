import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DISCOVERY_DOCUMENT_URL = 'https://developer.api.intuit.com/.well-known/openid_configuration/';

let cachedEndpoints: {
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string;
  issuer: string;
  userinfo_endpoint: string;
} | null = null;

async function getOAuthEndpoints() {
  if (cachedEndpoints) {
    return cachedEndpoints;
  }

  try {
    const response = await fetch(DISCOVERY_DOCUMENT_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch discovery document: ${response.statusText}`);
    }

    const discoveryDoc = await response.json();
    cachedEndpoints = {
      authorization_endpoint: discoveryDoc.authorization_endpoint,
      token_endpoint: discoveryDoc.token_endpoint,
      revocation_endpoint: discoveryDoc.revocation_endpoint,
      issuer: discoveryDoc.issuer,
      userinfo_endpoint: discoveryDoc.userinfo_endpoint,
    };

    console.log('OAuth endpoints loaded from discovery document:', cachedEndpoints);
    return cachedEndpoints;
  } catch (error) {
    console.error('Failed to fetch discovery document, using fallback endpoints:', error);
    cachedEndpoints = {
      authorization_endpoint: 'https://appcenter.intuit.com/connect/oauth2',
      token_endpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      revocation_endpoint: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
      issuer: 'https://oauth.platform.intuit.com/op/v1',
      userinfo_endpoint: 'https://accounts.platform.intuit.com/v1/openid_connect/userinfo',
    };
    return cachedEndpoints;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const { action, code, realmId, state, encrypted_session } = body;

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
      // Get the origin from the request body if provided (dynamic redirect)
      const { origin } = body;
      const dynamicRedirectUri = origin ? `${origin}/quickbooks-callback.html` : redirectUri;

      // Get OAuth endpoints from discovery document
      const endpoints = await getOAuthEndpoints();

      // Generate authorization URL
      const authUrl = new URL(endpoints.authorization_endpoint);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
      authUrl.searchParams.set('redirect_uri', dynamicRedirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', `user_${user.id}_company_${profile.company_id}`);
      // Force QuickBooks to show company selection screen even if previously authorized
      authUrl.searchParams.set('prompt', 'consent');

      console.log('Using redirect URI:', dynamicRedirectUri);

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
      // Validate state parameter for CSRF protection
      if (!state || !state.startsWith(`user_${user.id}_company_${profile.company_id}`)) {
        throw new Error('Invalid state parameter. Possible CSRF attack detected.');
      }

      // Get the origin from the request body if provided (dynamic redirect)
      const { origin } = body;
      const dynamicRedirectUri = origin ? `${origin}/quickbooks-callback.html` : redirectUri;

      console.log('Exchanging token with redirect URI:', dynamicRedirectUri);

      // Get OAuth endpoints from discovery document
      const endpoints = await getOAuthEndpoints();

      // Exchange authorization code for access token
      const basicAuth = btoa(`${clientId}:${clientSecret}`);

      const tokenResponse = await fetch(endpoints.token_endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: dynamicRedirectUri,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();

        // Handle invalid grant errors
        if (errorText.includes('invalid_grant') || errorText.includes('Invalid grant')) {
          throw new Error('Invalid authorization code. The code may have expired or already been used. Please try connecting again.');
        }

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

      // Encrypt tokens for storage in volatile memory only (compliance requirement)
      const tokenManagerUrl = `${supabaseUrl}/functions/v1/quickbooks-token-manager`;
      const encryptResponse = await fetch(tokenManagerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'encrypt',
          data: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
          }
        })
      });

      if (!encryptResponse.ok) {
        throw new Error('Failed to encrypt tokens');
      }

      const { encrypted_session } = await encryptResponse.json();

      // Check if connection with this realm_id already exists
      const { data: existingConnection } = await supabase
        .from('quickbooks_connection')
        .select('id')
        .eq('realm_id', realmId)
        .maybeSingle();

      if (existingConnection) {
        // Update existing connection (metadata only - no tokens)
        const { error: updateError } = await supabase
          .from('quickbooks_connection')
          .update({
            company_id: profile.company_id,
            company_name: companyName,
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

        // Insert new connection (metadata only - no tokens)
        const { error: insertError } = await supabase
          .from('quickbooks_connection')
          .insert({
            company_id: profile.company_id,
            company_name: companyName,
            realm_id: realmId,
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
          encrypted_session,
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
      // Refresh token requires the encrypted session from client
      if (!encrypted_session) {
        throw new Error('Encrypted session required for token refresh');
      }

      // Decrypt tokens from volatile memory
      const tokenManagerUrl = `${supabaseUrl}/functions/v1/quickbooks-token-manager`;
      const decryptResponse = await fetch(tokenManagerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'decrypt',
          data: { encrypted_session }
        })
      });

      if (!decryptResponse.ok) {
        throw new Error('Failed to decrypt tokens');
      }

      const { refresh_token } = await decryptResponse.json();

      // Get existing connection for metadata
      const { data: connection, error: connError } = await supabase
        .from('quickbooks_connection')
        .select('id, realm_id')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .single();

      if (connError || !connection) {
        throw new Error('No active QuickBooks connection found');
      }

      // Get OAuth endpoints from discovery document
      const endpoints = await getOAuthEndpoints();

      // Refresh the access token
      const basicAuth = btoa(`${clientId}:${clientSecret}`);

      const refreshResponse = await fetch(endpoints.token_endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refresh_token,
        }).toString(),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();

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

        throw new Error(`QuickBooks authorization has expired. Please reconnect your QuickBooks account.`);
      }

      const tokenData = await refreshResponse.json();
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Encrypt new tokens for volatile storage
      const encryptResponse = await fetch(tokenManagerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'encrypt',
          data: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
          }
        })
      });

      if (!encryptResponse.ok) {
        throw new Error('Failed to encrypt refreshed tokens');
      }

      const { encrypted_session: new_encrypted_session } = await encryptResponse.json();

      // Update connection metadata only (no tokens)
      const { error: updateError } = await supabase
        .from('quickbooks_connection')
        .update({
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
          encrypted_session: new_encrypted_session,
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
