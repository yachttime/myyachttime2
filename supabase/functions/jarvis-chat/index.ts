// Jarvis AI Assistant edge function - handles chat and data CRUD
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChatRequest {
  mode?: 'chat' | 'data';
  message?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  // Data mode fields
  dataAction?: 'loadPending' | 'loadTasks' | 'loadKnowledge' | 'saveKnowledge' | 'deleteKnowledge' | 'toggleKnowledge' | 'updateTask';
  knowledgeData?: { id?: string; category: string; title: string; content: string };
  taskId?: string;
  taskStatus?: string;
  knowledgeId?: string;
  knowledgeActive?: boolean;
}

interface ProposedAction {
  operation: 'update' | 'insert';
  table_name: string;
  record_id?: string;
  changes: Record<string, any>;
  reason: string;
  summary: string;
}

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

    // Verify user is a master
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('role, first_name, last_name')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Only master users can use Jarvis.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: ChatRequest = await req.json();
    const mode = body.mode || 'chat';

    // === DATA MODE: handle CRUD operations for Jarvis tables ===
    if (mode === 'data') {
      const action = body.dataAction;
      if (!action) {
        return new Response(JSON.stringify({ error: 'dataAction is required for data mode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      switch (action) {
        case 'loadPending': {
          const { data, error } = await serviceClient
            .from('jarvis_pending_actions')
            .select('id, summary, reason, table_name, record_id, changes, before, status, created_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          if (error) throw error;
          return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'loadTasks': {
          const { data, error } = await serviceClient
            .from('jarvis_tasks')
            .select('id, title, details, priority, status, created_at')
            .order('created_at', { ascending: false })
            .limit(20);
          if (error) throw error;
          return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'loadKnowledge': {
          const { data, error } = await serviceClient
            .from('jarvis_knowledge')
            .select('id, category, title, content, active')
            .order('category, title');
          if (error) throw error;
          return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'saveKnowledge': {
          const kd = body.knowledgeData;
          if (!kd || !kd.title.trim() || !kd.content.trim()) {
            return new Response(JSON.stringify({ error: 'title and content are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          if (kd.id) {
            const { data, error } = await serviceClient
              .from('jarvis_knowledge')
              .update({
                category: kd.category,
                title: kd.title,
                content: kd.content,
                updated_at: new Date().toISOString(),
              })
              .eq('id', kd.id)
              .select('id, category, title, content, active')
              .single();
            if (error) throw error;
            return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          } else {
            const { data, error } = await serviceClient
              .from('jarvis_knowledge')
              .insert({
                category: kd.category,
                title: kd.title,
                content: kd.content,
              })
              .select('id, category, title, content, active')
              .single();
            if (error) throw error;
            return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }

        case 'deleteKnowledge': {
          if (!body.knowledgeId) {
            return new Response(JSON.stringify({ error: 'knowledgeId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const { error } = await serviceClient
            .from('jarvis_knowledge')
            .delete()
            .eq('id', body.knowledgeId);
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'toggleKnowledge': {
          if (!body.knowledgeId) {
            return new Response(JSON.stringify({ error: 'knowledgeId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const { data: current } = await serviceClient
            .from('jarvis_knowledge')
            .select('active')
            .eq('id', body.knowledgeId)
            .single();
          if (!current) {
            return new Response(JSON.stringify({ error: 'Entry not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const newActive = body.knowledgeActive !== undefined ? body.knowledgeActive : !current.active;
          const { error } = await serviceClient
            .from('jarvis_knowledge')
            .update({ active: newActive })
            .eq('id', body.knowledgeId);
          if (error) throw error;
          return new Response(JSON.stringify({ success: true, active: newActive }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'updateTask': {
          if (!body.taskId || !body.taskStatus) {
            return new Response(JSON.stringify({ error: 'taskId and taskStatus are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const updateData: Record<string, any> = { status: body.taskStatus };
          if (body.taskStatus === 'done') updateData.completed_at = new Date().toISOString();
          const { error } = await serviceClient
            .from('jarvis_tasks')
            .update(updateData)
            .eq('id', body.taskId);
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        default:
          return new Response(JSON.stringify({ error: `Unknown dataAction: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // === CHAT MODE ===
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY as an edge function secret in the Supabase dashboard.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is in jarvis_staff
    const { data: jarvisStaff } = await serviceClient
      .from('jarvis_staff')
      .select('role, active, display_name')
      .eq('user_id', user.id)
      .single();

    if (!jarvisStaff || !jarvisStaff.active) {
      return new Response(JSON.stringify({ error: 'You are not registered as a Jarvis user. Ask an admin to add you to jarvis_staff.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userMessage = body.message?.trim();
    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Gather knowledge base
    const { data: knowledge } = await serviceClient
      .from('jarvis_knowledge')
      .select('category, title, content')
      .eq('active', true)
      .order('category');

    // Gather live data summaries
    const { data: yachts } = await serviceClient
      .from('yachts')
      .select('name, is_active, manufacturer, size, marina_name, slip_location')
      .order('name');

    const { data: recentRepairs } = await serviceClient
      .from('repair_requests')
      .select('id, title, status, created_at, yachts(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: upcomingBookings } = await serviceClient
      .from('yacht_bookings')
      .select('id, start_date, end_date, owner_name, yachts(name)')
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date')
      .limit(10);

    const { data: recentEstimates } = await serviceClient
      .from('estimates')
      .select('estimate_number, status, total, created_at, work_title')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: allowedWrites } = await serviceClient
      .from('jarvis_allowed_writes')
      .select('*');

    // Build context for Claude
    const knowledgeText = (knowledge as any[] | null)?.map((k: any) => `[${k.category}] ${k.title}: ${k.content}`).join('\n') || 'No knowledge base entries found.';
    const yachtsText = (yachts as any[] | null)?.map((y: any) => `${y.name} (${y.manufacturer || 'Unknown'}, ${y.size || 'Unknown size'}) - ${y.is_active ? 'Active' : 'Inactive'}, Slip: ${y.slip_location || 'N/A'}`).join('\n') || 'No yachts found.';
    const repairsText = (recentRepairs as any[] | null)?.map((r: any) => `${r.title} - Status: ${r.status} - Yacht: ${r.yachts?.name || 'N/A'} - Created: ${new Date(r.created_at).toLocaleDateString()}`).join('\n') || 'No recent repairs.';
    const bookingsText = (upcomingBookings as any[] | null)?.map((b: any) => `${b.yachts?.name || 'Unknown'} - ${b.start_date} to ${b.end_date} - Owner: ${b.owner_name || 'N/A'}`).join('\n') || 'No upcoming bookings.';
    const estimatesText = (recentEstimates as any[] | null)?.map((e: any) => `${e.estimate_number || 'N/A'} - ${e.status} - $${e.total || 'N/A'} - ${e.work_title || 'N/A'}`).join('\n') || 'No recent estimates.';
    const allowedWritesText = (allowedWrites as any[] | null)?.map((a: any) => `${a.table_name}: can_insert=${a.can_insert}, can_update=${a.can_update}, columns=[${(a.allowed_columns || []).join(', ')}]`).join('\n') || 'No allowed writes configured.';

    const systemPrompt = `You are Jarvis, an AI assistant for AZ Marine Services — a Mercury Marine dealership at Lake Powell that manages timeshare houseboats and runs a rescue/salvage division. You are talking to ${jarvisStaff.display_name || profile.first_name || 'a master user'}, who has full admin access.

You have access to the following knowledge base:
${knowledgeText}

Current fleet:
${yachtsText}

Recent repair requests (last 10):
${repairsText}

Upcoming bookings (next 10):
${bookingsText}

Recent estimates (last 5):
${estimatesText}

You CAN propose changes to the following tables (the user must approve before anything happens):
${allowedWritesText}

Rules:
1. Be concise, helpful, and professional. Answer questions about the business, fleet, repairs, bookings, and procedures.
2. When you think a change should be made to real data, include a JSON block at the end of your reply in this exact format:
   <proposed_action>
   {"operation":"update","table_name":"repair_requests","record_id":"<uuid>","changes":{"status":"completed"},"reason":"The repair was finished based on the user's message.","summary":"Mark repair request as completed"}
   </proposed_action>
   You can include multiple <proposed_action> blocks.
3. Only propose changes to tables listed above, and only to the allowed columns. Never propose changes to tables or columns not in the allow-list.
4. If no allow-list is configured, tell the user they need to configure allowed writes first.
5. You can also suggest tasks for the user by including:
   <task>
   {"title":"Follow up on repair","details":"Call the customer about the completed repair","priority":"normal"}
   </task>
6. Do NOT make up data. If you don't know something, say so and suggest the user add it to the knowledge base.
7. Keep responses under 300 words unless the user asks for detail.`;

    // Build conversation messages
    const messages: Array<{ role: string; content: string }> = [];
    if (body.conversationHistory) {
      for (const msg of body.conversationHistory.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: userMessage });

    // Call Anthropic Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('Anthropic API error:', errText);
      return new Response(JSON.stringify({ error: 'AI service error. Please try again.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const claudeData = await claudeResponse.json();
    const replyText = claudeData.content?.[0]?.text || 'I could not generate a response.';

    // Extract proposed actions and tasks
    const proposedActions: any[] = [];
    const taskRegex = /<task>\s*([\s\S]*?)\s*<\/task>/g;
    const actionRegex = /<proposed_action>\s*([\s\S]*?)\s*<\/proposed_action>/g;

    let match: RegExpExecArray | null;
    while ((match = actionRegex.exec(replyText)) !== null) {
      try {
        const action = JSON.parse(match[1].trim()) as ProposedAction;
        // Validate against allow-list
        const allowed = (allowedWrites as any[] | null)?.find((a: any) => a.table_name === action.table_name);
        if (allowed) {
          if (action.operation === 'update' && allowed.can_update) {
            const requestedCols = Object.keys(action.changes);
            const allowedCols = allowed.allowed_columns || [];
            const allColsAllowed = requestedCols.every(c => allowedCols.includes(c));
            if (allColsAllowed) {
              // Fetch before state
              const { data: beforeData } = await serviceClient
                .from(action.table_name)
                .select('*')
                .eq(allowed.id_column, action.record_id)
                .single();

              const { data: pendingAction, error: pendingError } = await serviceClient
                .from('jarvis_pending_actions')
                .insert({
                  requested_by: user.id,
                  operation: action.operation,
                  table_name: action.table_name,
                  record_id: action.record_id,
                  changes: action.changes,
                  reason: action.reason,
                  summary: action.summary,
                  status: 'pending',
                  before: beforeData || null,
                })
                .select('id, summary, reason, table_name, record_id, changes, before, status')
                .single();

              if (!pendingError && pendingAction) {
                proposedActions.push(pendingAction);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse proposed action:', e);
      }
    }

    // Create tasks
    const createdTasks: any[] = [];
    while ((match = taskRegex.exec(replyText)) !== null) {
      try {
        const task = JSON.parse(match[1].trim());
        const { data: createdTask } = await serviceClient
          .from('jarvis_tasks')
          .insert({
            title: task.title,
            details: task.details || null,
            priority: task.priority || 'normal',
            status: 'open',
            created_by: user.id,
          })
          .select('id, title, details, priority, status, created_at')
          .single();
        if (createdTask) createdTasks.push(createdTask);
      } catch (e) {
        console.error('Failed to create task:', e);
      }
    }

    // Clean up tags from the reply for display
    const cleanReply = replyText
      .replace(/<proposed_action>[\s\S]*?<\/proposed_action>/g, '')
      .replace(/<task>[\s\S]*?<\/task>/g, '')
      .trim();

    // Write audit log
    await serviceClient.from('jarvis_audit_log').insert({
      user_id: user.id,
      question: userMessage,
      reply: cleanReply,
      tool_calls: { proposed_actions: proposedActions.length, tasks: createdTasks.length },
    });

    return new Response(JSON.stringify({
      reply: cleanReply,
      proposedActions,
      tasks: createdTasks,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Jarvis chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
