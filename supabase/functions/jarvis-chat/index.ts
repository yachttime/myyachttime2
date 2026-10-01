// Jarvis AI Assistant edge function - chat (with live read-only database lookups) + data CRUD
// v2: Claude tool-use loop. Request/response shape unchanged from the Bolt version:
//   chat:  { mode?: 'chat', message, conversationHistory? } -> { reply, proposedActions, tasks }
//   data:  { mode: 'data', dataAction, ... }                -> same as before
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import postgres from 'npm:postgres@3.4.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MODEL = Deno.env.get('JARVIS_MODEL') ?? 'claude-sonnet-4-5';
const MAX_TOOL_ROUNDS = 10;
const MAX_ROWS = 200;
const MAX_TOOL_OUTPUT_CHARS = 40_000;

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2, idle_timeout: 20 });

interface ChatRequest {
  mode?: 'chat' | 'data';
  message?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  dataAction?: 'loadPending' | 'loadTasks' | 'loadKnowledge' | 'saveKnowledge' | 'deleteKnowledge' | 'toggleKnowledge' | 'updateTask';
  knowledgeData?: { id?: string; category: string; title: string; content: string };
  taskId?: string;
  taskStatus?: string;
  knowledgeId?: string;
  knowledgeActive?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResp({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, supabaseServiceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResp({ error: 'Unauthorized' }, 401);

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await serviceClient
      .from('user_profiles').select('role, first_name, last_name').eq('user_id', user.id).single();
    if (!profile || profile.role !== 'master') return jsonResp({ error: 'Only master users can use Jarvis.' }, 403);

    const body: ChatRequest = await req.json();
    const mode = body.mode || 'chat';

    // === DATA MODE (unchanged) ===
    if (mode === 'data') return await handleData(body, serviceClient);

    // === CHAT MODE ===
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return jsonResp({ error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY as an edge function secret in the Supabase dashboard.' }, 500);
    }

    const { data: jarvisStaff } = await serviceClient
      .from('jarvis_staff').select('role, active, display_name').eq('user_id', user.id).single();
    if (!jarvisStaff || !jarvisStaff.active) {
      return jsonResp({ error: 'You are not registered as a Jarvis user. Ask an admin to add you to jarvis_staff.' }, 403);
    }

    const userMessage = body.message?.trim();
    if (!userMessage) return jsonResp({ error: 'Message is required' }, 400);

    const name = jarvisStaff.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'a staff member';
    const system = [{ type: 'text', text: buildSystemPrompt(name, await getContext()), cache_control: { type: 'ephemeral' } }];

    // Conversation: text only, alternating, starts with user
    const messages: any[] = [];
    for (const m of [...(body.conversationHistory ?? []).slice(-12), { role: 'user', content: userMessage }]) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const content = String(m.content ?? '').trim();
      if (!content) continue;
      if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content += '\n\n' + content;
      else messages.push({ role, content });
    }
    while (messages.length && messages[0].role !== 'user') messages.shift();

    const proposedActions: any[] = [];
    const createdTasks: any[] = [];
    const toolLog: any[] = [];
    let reply = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const callClaude = (model: string) => fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicApiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 8000, system, tools: TOOLS, messages }),
      });
      let res = await callClaude(activeModel ?? MODEL);
      if (res.status === 404) {
        // Configured model isn't available on this account: pick the newest available Sonnet (or newest model).
        activeModel = await pickModel(anthropicApiKey);
        console.log('Jarvis switched model to', activeModel);
        res = await callClaude(activeModel);
      }
      if (!res.ok) {
        const errText = await res.text();
        console.error('Anthropic API error:', res.status, errText);
        return jsonResp({ error: `AI service error (${res.status}). ${res.status === 401 ? 'Check the ANTHROPIC_API_KEY secret.' : 'Please try again.'}` }, 500);
      }
      const data = await res.json();
      messages.push({ role: 'assistant', content: data.content });
      const text = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
      if (data.stop_reason !== 'tool_use') {
        reply = data.stop_reason === 'max_tokens' ? text + '\n\n(Answer cut off — ask me to continue or narrow the question.)' : text;
        break;
      }

      const results: any[] = [];
      for (const block of data.content.filter((b: any) => b.type === 'tool_use')) {
        let output: unknown; let isError = false;
        try {
          output = await runTool(block.name, block.input, { userId: user.id, serviceClient, proposedActions, createdTasks });
        } catch (e: any) {
          output = { error: e?.message ?? String(e) }; isError = true;
        }
        toolLog.push({ tool: block.name, input: block.input, error: isError ? output : undefined });
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(output).slice(0, MAX_TOOL_OUTPUT_CHARS), is_error: isError });
      }
      messages.push({ role: 'user', content: results });
      if (round === MAX_TOOL_ROUNDS - 1) reply = text || 'I ran out of steps on that one — try a narrower question.';
    }

    await serviceClient.from('jarvis_audit_log').insert({
      user_id: user.id, question: userMessage, reply, tool_calls: toolLog,
    });

    return jsonResp({ reply: reply || 'I could not generate a response.', proposedActions, tasks: createdTasks });
  } catch (error: any) {
    console.error('Jarvis chat error:', error);
    return jsonResp({ error: error.message || 'Internal server error' }, 500);
  }
});

// ---------------------------------------------------------------------
// Model selection fallback
// ---------------------------------------------------------------------
let activeModel: string | null = null;

async function pickModel(apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) throw new Error(`Could not list Claude models (${res.status}).`);
  const ids: string[] = ((await res.json()).data ?? []).map((m: any) => m.id); // newest first
  const pick = ids.find((id) => id.includes('sonnet')) ?? ids[0];
  if (!pick) throw new Error('No Claude models available on this API key.');
  return pick;
}

// ---------------------------------------------------------------------
// Context: schema Jarvis can read + allow-list + knowledge (cached 5 min)
// ---------------------------------------------------------------------
let ctxCache: { text: string; at: number } | null = null;

async function getContext(): Promise<string> {
  if (ctxCache && Date.now() - ctxCache.at < 5 * 60_000) return ctxCache.text;

  // Skip email-tracking / payment-processor plumbing columns to keep the prompt small.
  const tables = await sql<{ t: string; n: number; cols: string }[]>`
    select c.relname as t, greatest(c.reltuples, 0)::bigint as n,
           string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', ' order by a.attnum) as cols
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where c.relkind in ('r', 'v', 'm', 'p')
      and has_table_privilege('jarvis_reader', c.oid, 'SELECT')
      and a.attname !~ '(resend|stripe_|engagement|_open_count|_click_count|_bounce_count|_email_(delivered|opened|clicked|bounced|suppressed)_at|_link_clicked_at|_recipients?$|qbo_|quickbooks_|cc_emails)'
    group by c.relname, c.reltuples order by c.relname`;

  const fks = await sql<{ fk: string }[]>`
    select format('%s.%s -> %s.%s', tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name) as fk
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' and ccu.table_schema = 'public'
      and ccu.table_name <> 'companies'
    order by 1`;

  const writes = await sql`select * from public.jarvis_allowed_writes order by table_name`;
  const knowledge = await sql<{ category: string; title: string; content: string }[]>`
    select category, title, content from public.jarvis_knowledge where active order by category, title`;

  const text = [
    '## DATABASE SCHEMA (Postgres, schema public) — table (~rows): columns',
    ...tables.map((t) => `- ${t.t} (~${t.n}): ${t.cols}`),
    '',
    '## FOREIGN KEYS',
    fks.map((f) => f.fk).join('; '),
    '',
    '## TABLES YOU MAY PROPOSE UPDATES TO (everything else is read-only; inserts not supported yet)',
    writes.length
      ? writes.filter((w: any) => w.can_update).map((w: any) =>
          `- ${w.table_name} [id: ${w.id_column}] columns: ${(w.allowed_columns ?? []).join(', ')}${w.notes ? ` — ${w.notes}` : ''}`).join('\n') || '- (none)'
      : '- (none configured yet — tell the user an admin must add rows to jarvis_allowed_writes)',
    '',
    '## COMPANY KNOWLEDGE BASE',
    ...(knowledge.length ? knowledge.map((k) => `### [${k.category}] ${k.title}\n${k.content}`) : ['(empty)']),
  ].join('\n');

  ctxCache = { text, at: Date.now() };
  return text;
}

function buildSystemPrompt(name: string, context: string) {
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Phoenix', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return `You are Jarvis, the internal AI assistant for AZ Marine — a Mercury Marine dealership and service shop at Lake Powell that also manages a fleet of timeshare houseboats/yachts and runs the Antelope Point Marina Rescue Division (vessel salvage and recovery).

You are talking with ${name} (master/admin user). Current time: ${now} (Arizona time, America/Phoenix, no daylight saving). Today's date in SQL: (now() at time zone 'America/Phoenix')::date.

HOW TO WORK
- Answer questions about yachts, owner bookings/trips, repair requests, estimates, work orders, invoices & payments, parts, purchase orders, staff time, daily tasks, customers and salvage reports by querying the live database with run_query. Never guess or invent records, numbers, names or dates — if it isn't in the data, say so.
- Use the schema below. If a query errors, read the error, fix the SQL and retry. Prefer a few focused queries over one huge one.
- Write efficient SELECTs: only needed columns, WHERE filters, ORDER BY, LIMIT. Join to yachts/customers/user_profiles to show names instead of UUIDs. Exclude archived rows (archived = true) unless asked.
- mercury_marine_parts is a ~300k-row Mercury price list: always filter it (e.g. part number or ILIKE on description) and LIMIT.
- Money: estimates/work_orders/estimating_invoices use total_amount; estimating_invoices has amount_paid, balance_due, payment_status. yacht_invoices uses invoice_amount_numeric and payment_status.
- People: user_profiles (role, first_name, last_name, email, yacht_id) links to auth users via user_profiles.user_id. Owners are user_profiles tied to a yacht.
- Use create_task for follow-ups. Use propose_change to suggest an update to an allowed table — it does NOT change anything; it creates an approval card the user must approve. Say it's waiting for approval.
- Don't reveal pay rates, wifi passwords or personal contact details unless the user specifically asks for them.
- Be concise and practical: short bullets or small markdown tables. Money as $1,234.56; dates like "Tue Oct 6". Keep answers under ~300 words unless asked for detail.

${context}`;
}

// ---------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------
const TOOLS = [
  {
    name: 'run_query',
    description: 'Run ONE read-only SQL SELECT (or WITH ... SELECT) against the business database. No semicolons. Returns up to 200 rows as JSON.',
    input_schema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'A single SELECT statement.' },
        purpose: { type: 'string', description: 'One line: what you are trying to find out.' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a follow-up task / to-do in jarvis_tasks.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        details: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        assigned_to: { type: 'string', description: 'Person or department' },
        related_table: { type: 'string' },
        related_id: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'propose_change',
    description: 'Propose UPDATING one record in an allowed table. Nothing changes until the user approves it in the app.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        record_id: { type: 'string', description: "Value of the table's id column for the record to update." },
        values: { type: 'object', description: 'Column -> new value. Allowed columns only.' },
        summary: { type: 'string', description: 'Plain-English one-liner for the approval card.' },
        reason: { type: 'string' },
      },
      required: ['table', 'record_id', 'values', 'summary'],
    },
  },
];

type ToolCtx = { userId: string; serviceClient: any; proposedActions: any[]; createdTasks: any[] };

async function runTool(name: string, input: any, ctx: ToolCtx) {
  if (name === 'run_query') return await runQuery(input.sql);

  if (name === 'create_task') {
    const { data, error } = await ctx.serviceClient.from('jarvis_tasks').insert({
      title: input.title, details: input.details ?? null, priority: input.priority ?? 'normal', status: 'open',
      due_date: input.due_date ?? null, assigned_to: input.assigned_to ?? null,
      related_table: input.related_table ?? null, related_id: input.related_id ?? null, created_by: ctx.userId,
    }).select('id, title, details, priority, status, created_at').single();
    if (error) throw new Error(error.message);
    ctx.createdTasks.push(data);
    return { created: data };
  }

  if (name === 'propose_change') {
    const values = input.values ?? {};
    const { data: rule } = await ctx.serviceClient.from('jarvis_allowed_writes').select('*').eq('table_name', input.table).maybeSingle();
    if (!rule) throw new Error(`Table "${input.table}" is not on the Jarvis allow-list.`);
    if (!rule.can_update) throw new Error(`Updates to ${input.table} are not allowed.`);
    const bad = Object.keys(values).filter((k) => !(rule.allowed_columns ?? []).includes(k));
    if (bad.length) throw new Error(`Columns not allowed on ${input.table}: ${bad.join(', ')}`);
    if (!Object.keys(values).length) throw new Error('No values given.');

    const { data: before, error: bErr } = await ctx.serviceClient.from(input.table).select('*').eq(rule.id_column, input.record_id).maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!before) throw new Error(`No ${input.table} record with ${rule.id_column} = ${input.record_id}`);

    const { data, error } = await ctx.serviceClient.from('jarvis_pending_actions').insert({
      requested_by: ctx.userId, operation: 'update', table_name: input.table, record_id: String(input.record_id),
      changes: values, reason: input.reason ?? null, summary: input.summary, status: 'pending', before,
    }).select('id, summary, reason, table_name, record_id, changes, before, status').single();
    if (error) throw new Error(error.message);
    ctx.proposedActions.push(data);
    return { proposed: { id: data.id, summary: data.summary }, note: 'Waiting for user approval. Nothing has changed yet.' };
  }

  throw new Error(`Unknown tool ${name}`);
}

// Read-only, single statement, restricted role (jarvis_reader), timeout, row cap.
async function runQuery(raw: string) {
  const q = String(raw ?? '').trim().replace(/;\s*$/, '');
  if (!/^(select|with)\s/i.test(q)) throw new Error('Only SELECT / WITH queries are allowed.');
  if (q.includes(';')) throw new Error('Only one statement allowed (no semicolons).');
  if (/\b(pg_sleep|pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|dblink|set_config|pg_terminate_backend|pg_cancel_backend)\b/i.test(q)) {
    throw new Error('That function is not allowed.');
  }
  const rows = await sql.begin('read only', async (tx: any) => {
    await tx.unsafe("set local statement_timeout = '8s'");
    await tx.unsafe('set local role jarvis_reader');
    return await tx.unsafe(`select * from (${q}) as jarvis_q limit ${MAX_ROWS + 1}`);
  });
  return { row_count: Math.min(rows.length, MAX_ROWS), truncated: rows.length > MAX_ROWS, rows: rows.slice(0, MAX_ROWS) };
}

// ---------------------------------------------------------------------
// DATA MODE — same behavior as the Bolt version
// ---------------------------------------------------------------------
async function handleData(body: ChatRequest, serviceClient: any) {
  const action = body.dataAction;
  if (!action) return jsonResp({ error: 'dataAction is required for data mode' }, 400);

  switch (action) {
    case 'loadPending': {
      const { data, error } = await serviceClient.from('jarvis_pending_actions')
        .select('id, summary, reason, table_name, record_id, changes, before, status, created_at')
        .eq('status', 'pending').order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResp({ data: data || [] });
    }
    case 'loadTasks': {
      const { data, error } = await serviceClient.from('jarvis_tasks')
        .select('id, title, details, priority, status, created_at').order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return jsonResp({ data: data || [] });
    }
    case 'loadKnowledge': {
      const { data, error } = await serviceClient.from('jarvis_knowledge')
        .select('id, category, title, content, active').order('category, title');
      if (error) throw error;
      return jsonResp({ data: data || [] });
    }
    case 'saveKnowledge': {
      const kd = body.knowledgeData;
      if (!kd || !kd.title.trim() || !kd.content.trim()) return jsonResp({ error: 'title and content are required' }, 400);
      ctxCache = null;
      if (kd.id) {
        const { data, error } = await serviceClient.from('jarvis_knowledge')
          .update({ category: kd.category, title: kd.title, content: kd.content, updated_at: new Date().toISOString() })
          .eq('id', kd.id).select('id, category, title, content, active').single();
        if (error) throw error;
        return jsonResp({ data });
      }
      const { data, error } = await serviceClient.from('jarvis_knowledge')
        .insert({ category: kd.category, title: kd.title, content: kd.content })
        .select('id, category, title, content, active').single();
      if (error) throw error;
      return jsonResp({ data });
    }
    case 'deleteKnowledge': {
      if (!body.knowledgeId) return jsonResp({ error: 'knowledgeId is required' }, 400);
      const { error } = await serviceClient.from('jarvis_knowledge').delete().eq('id', body.knowledgeId);
      if (error) throw error;
      ctxCache = null;
      return jsonResp({ success: true });
    }
    case 'toggleKnowledge': {
      if (!body.knowledgeId) return jsonResp({ error: 'knowledgeId is required' }, 400);
      const { data: current } = await serviceClient.from('jarvis_knowledge').select('active').eq('id', body.knowledgeId).single();
      if (!current) return jsonResp({ error: 'Entry not found' }, 404);
      const newActive = body.knowledgeActive !== undefined ? body.knowledgeActive : !current.active;
      const { error } = await serviceClient.from('jarvis_knowledge').update({ active: newActive }).eq('id', body.knowledgeId);
      if (error) throw error;
      ctxCache = null;
      return jsonResp({ success: true, active: newActive });
    }
    case 'updateTask': {
      if (!body.taskId || !body.taskStatus) return jsonResp({ error: 'taskId and taskStatus are required' }, 400);
      const updateData: Record<string, any> = { status: body.taskStatus };
      if (body.taskStatus === 'done') updateData.completed_at = new Date().toISOString();
      const { error } = await serviceClient.from('jarvis_tasks').update(updateData).eq('id', body.taskId);
      if (error) throw error;
      return jsonResp({ success: true });
    }
    default:
      return jsonResp({ error: `Unknown dataAction: ${action}` }, 400);
  }
}
