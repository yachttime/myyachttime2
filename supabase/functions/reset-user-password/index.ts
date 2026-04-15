import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: requestingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .maybeSingle();

    if (!requestingProfile || requestingProfile.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Only master users can reset passwords' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { target_user_id, new_password } = await req.json();

    if (!target_user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'target_user_id and new_password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabaseAdmin.rpc('update_user_password', {
      p_user_id: target_user_id,
      p_new_password: new_password,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ must_change_password: true })
      .eq('user_id', target_user_id);

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('first_name, last_name, email')
      .eq('user_id', target_user_id)
      .maybeSingle();

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers?.users?.find(u => u.id === target_user_id);
    const userEmail = targetProfile?.email || authUser?.email;

    if (userEmail) {
      const firstName = targetProfile?.first_name ?? '';
      const lastName = targetProfile?.last_name ?? '';
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || userEmail;

      const siteUrl = Deno.env.get('SITE_URL') ?? 'https://myyachttime.com';
      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
      const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@myyachttime.com';

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; font-size: 24px; margin: 0;">My Yacht Time</h1>
          </div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 30px;">
            <h2 style="color: #1e293b; margin-top: 0;">Your Password Has Been Reset</h2>
            <p style="color: #475569;">Hi ${displayName},</p>
            <p style="color: #475569;">Your password has been reset by an administrator. Your temporary password is:</p>
            <div style="text-align: center; margin: 24px 0;">
              <div style="display: inline-block; background: #1e293b; color: #f1f5f9; font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px; padding: 14px 28px; border-radius: 8px;">
                ${new_password}
              </div>
            </div>
            <p style="color: #475569;">Please log in using this temporary password. You will be required to set a new password immediately after logging in.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${siteUrl}"
                 style="background: #f59e0b; color: #1e293b; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                Log In Now
              </a>
            </div>
            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">If you did not request this change or have any concerns, please contact your marina manager immediately.</p>
          </div>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [userEmail],
          subject: 'Your My Yacht Time Password Has Been Reset',
          html: emailHtml,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Password reset successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
