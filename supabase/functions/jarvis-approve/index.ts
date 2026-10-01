import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Only master users can approve or reject actions.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { actionId, decision } = body as { actionId: string; decision: 'approve' | 'reject' };

    if (!actionId || !decision) {
      return new Response(JSON.stringify({ error: 'actionId and decision are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: pendingAction, error: fetchError } = await serviceClient
      .from('jarvis_pending_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (fetchError || !pendingAction) {
      return new Response(JSON.stringify({ error: 'Pending action not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (pendingAction.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Action is already ${pendingAction.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (decision === 'reject') {
      const { error: updateError } = await serviceClient
        .from('jarvis_pending_actions')
        .update({
          status: 'rejected',
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, status: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Approve: execute the change
    // Verify the table is still in the allow-list
    const { data: allowed } = await serviceClient
      .from('jarvis_allowed_writes')
      .select('*')
      .eq('table_name', pendingAction.table_name)
      .single();

    if (!allowed) {
      await serviceClient
        .from('jarvis_pending_actions')
        .update({
          status: 'failed',
          error: 'Table is no longer in the allowed writes list',
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      return new Response(JSON.stringify({ error: 'Table is no longer in the allowed writes list' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate columns
    const requestedCols = Object.keys(pendingAction.changes);
    const allowedCols = allowed.allowed_columns || [];
    const allColsAllowed = requestedCols.every(c => allowedCols.includes(c));

    if (!allColsAllowed) {
      await serviceClient
        .from('jarvis_pending_actions')
        .update({
          status: 'failed',
          error: `Columns not allowed: ${requestedCols.filter(c => !allowedCols.includes(c)).join(', ')}`,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      return new Response(JSON.stringify({ error: 'Columns not allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mark as approving
    await serviceClient
      .from('jarvis_pending_actions')
      .update({ status: 'approving' })
      .eq('id', actionId);

    try {
      if (pendingAction.operation === 'update') {
        const { data: result, error: updateError } = await serviceClient
          .from(pendingAction.table_name)
          .update(pendingAction.changes)
          .eq(allowed.id_column, pendingAction.record_id)
          .select('*')
          .single();

        if (updateError) throw updateError;

        await serviceClient
          .from('jarvis_pending_actions')
          .update({
            status: 'approved',
            result: result,
            decided_by: user.id,
            decided_at: new Date().toISOString(),
          })
          .eq('id', actionId);

        return new Response(JSON.stringify({ success: true, status: 'approved', result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ error: 'Insert operations not yet supported' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (err: any) {
      await serviceClient
        .from('jarvis_pending_actions')
        .update({
          status: 'failed',
          error: err.message,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error: any) {
    console.error('Jarvis approve error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
