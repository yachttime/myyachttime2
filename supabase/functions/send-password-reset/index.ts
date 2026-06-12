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
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const normalizedEmail = email.toLowerCase().trim();
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://myyachttime.com';

    // Look up user via user_profiles to get their user_id — avoids paginating
    // the entire auth.users list (which breaks when there are >1000 users).
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, first_name, last_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!profile?.user_id) {
      // Return success to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);

    if (userError || !userData?.user?.email) {
      console.error('Error fetching auth user by id:', userError);
      // Still return success — client falls back to its own reset flow
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authUser = userData.user;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: authUser.email!,
      options: {
        redirectTo: siteUrl,
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Error generating recovery link:', linkError);
      throw new Error('Failed to generate password reset link');
    }

    const resetLink = linkData.properties.action_link;

    const firstName = profile.first_name ?? '';
    const lastName = profile.last_name ?? '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || normalizedEmail;

    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@myyachttime.com';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e293b; font-size: 24px; margin: 0;">My Yacht Time</h1>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #475569;">Hi ${displayName},</p>
          <p style="color: #475569;">We received a request to reset your password. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}"
               style="background: #f59e0b; color: #1e293b; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Reset My Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">If the button above doesn't work, copy and paste this link into your browser:<br>
            <span style="color: #3b82f6; word-break: break-all;">${resetLink}</span>
          </p>
        </div>
      </div>
    `;

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [normalizedEmail],
          subject: 'Reset Your My Yacht Time Password',
          html: emailHtml,
        }),
      });

      if (!resendRes.ok) {
        const resendErr = await resendRes.text();
        console.error('Resend error, falling back to Supabase native reset:', resendErr);
        throw new Error('Resend failed');
      }
    } catch (emailErr) {
      console.error('Email via Resend failed, using Supabase native reset:', emailErr);
      const { error: nativeErr } = await supabaseAdmin.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: siteUrl,
      });
      if (nativeErr) {
        console.error('Supabase native reset also failed:', nativeErr);
        throw new Error('Failed to send password reset email');
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-password-reset:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
