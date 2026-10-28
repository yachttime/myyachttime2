import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const generatePassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Not signed in' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: caller } = await admin
      .from('user_profiles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!caller || caller.role !== 'master') return json({ error: 'Only a master can create a tablet login' }, 403);

    const { yacht_id } = await req.json().catch(() => ({}));
    if (typeof yacht_id !== 'string' || !yacht_id) return json({ error: 'yacht_id is required' }, 400);

    const { data: yacht } = await admin
      .from('yachts')
      .select('id, name, company_id')
      .eq('id', yacht_id)
      .maybeSingle();
    if (!yacht || yacht.company_id !== caller.company_id) return json({ error: 'Yacht not found' }, 404);

    const { data: existing } = await admin
      .from('user_profiles')
      .select('user_id')
      .eq('yacht_id', yacht_id)
      .eq('role', 'tablet')
      .maybeSingle();
    if (existing) return json({ error: 'This yacht already has a tablet login' }, 409);

    const email = `tablet-${yacht_id}@tablet.yachttime.app`;
    const password = generatePassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) return json({ error: createError?.message ?? 'Could not create login' }, 500);

    const { error: profileError } = await admin.from('user_profiles').insert({
      user_id: created.user.id,
      email,
      first_name: yacht.name,
      last_name: 'Helm Tablet',
      role: 'tablet',
      company_id: yacht.company_id,
      yacht_id: yacht.id,
      is_active: true,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: 'Could not set up the tablet profile' }, 500);
    }

    return json({ email, password, yacht_name: yacht.name });
  } catch (err) {
    console.error('create-tablet-login failed', err);
    return json({ error: 'Something went wrong creating the tablet login' }, 500);
  }
});
