import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  trip_number?: string;
  street?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  yacht_id?: string;
  role: string;
  employee_type?: string;
  email_notifications_enabled?: boolean;
  sms_notifications_enabled?: boolean;
  notification_email?: string;
  notification_phone?: string;
  secondary_email?: string;
  can_approve_repairs?: boolean;
  can_approve_billing?: boolean;
  sms_consent_given?: boolean;
  sms_consent_method?: string;
  sms_consent_date?: string;
  sms_consent_ip_address?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const requestData: CreateUserRequest = await req.json();

    // Create user using admin API - this does NOT sign in the user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: requestData.email,
      password: requestData.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: requestData.first_name,
        last_name: requestData.last_name,
        phone: requestData.phone,
        street: requestData.street,
        city: requestData.city,
        state: requestData.state,
        zip_code: requestData.zip_code,
        yacht_id: requestData.yacht_id || null,
        role: requestData.role
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        first_name: requestData.first_name,
        last_name: requestData.last_name,
        email: requestData.email,
        phone: requestData.phone,
        trip_number: requestData.trip_number || null,
        street: requestData.street,
        city: requestData.city,
        state: requestData.state,
        zip_code: requestData.zip_code,
        yacht_id: requestData.yacht_id || null,
        role: requestData.role,
        employee_type: requestData.employee_type || 'hourly',
        email_notifications_enabled: requestData.email_notifications_enabled ?? true,
        sms_notifications_enabled: requestData.sms_notifications_enabled ?? false,
        notification_email: requestData.notification_email || null,
        notification_phone: requestData.notification_phone || null,
        secondary_email: requestData.secondary_email || null,
        can_approve_repairs: requestData.can_approve_repairs ?? false,
        can_approve_billing: requestData.can_approve_billing ?? false,
        sms_consent_given: requestData.sms_consent_given ?? false,
        sms_consent_method: requestData.sms_consent_method || null,
        sms_consent_date: requestData.sms_consent_date || null,
        sms_consent_ip_address: requestData.sms_consent_ip_address || null,
        must_change_password: true
      });

    if (profileError) {
      console.error('Error creating user profile:', profileError);

      // Try to delete the auth user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return new Response(
        JSON.stringify({ error: profileError.message }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        message: 'User created successfully'
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error in create-user function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
