import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, first_name, last_name, phone, trip_number, street, city, state, zip_code, yacht_id, role, can_approve_repairs, can_approve_billing } = await req.json();

    if (!email) {
      throw new Error('Email is required');
    }

    // Get the auth user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;

    const authUser = users.find((u) => u.email === email);
    
    if (!authUser) {
      throw new Error('No auth user found with this email');
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (existingProfile) {
      // Profile exists, update it
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          first_name,
          last_name,
          email,
          phone,
          trip_number: trip_number || null,
          street,
          city,
          state,
          zip_code,
          yacht_id: yacht_id || null,
          role,
          can_approve_repairs: can_approve_repairs ?? false,
          can_approve_billing: can_approve_billing ?? false,
          must_change_password: true
        })
        .eq('user_id', authUser.id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User profile updated successfully',
          user_id: authUser.id
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      // Profile doesn't exist, create it
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: authUser.id,
          first_name,
          last_name,
          email,
          phone,
          trip_number: trip_number || null,
          street,
          city,
          state,
          zip_code,
          yacht_id: yacht_id || null,
          role,
          can_approve_repairs: can_approve_repairs ?? false,
          can_approve_billing: can_approve_billing ?? false,
          must_change_password: true
        });

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User profile created successfully',
          user_id: authUser.id
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error: any) {
    console.error('Error in restore-user-profile:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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