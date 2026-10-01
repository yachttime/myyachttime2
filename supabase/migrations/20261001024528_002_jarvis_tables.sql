-- Jarvis knowledge, tasks, allowed_writes, pending_actions, audit_log tables

create table if not exists public.jarvis_knowledge (
  id         uuid primary key default gen_random_uuid(),
  category   text not null default 'general',
  title      text not null,
  content    text not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  details       text,
  status        text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  priority      text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date      date,
  assigned_to   text,
  related_table text,
  related_id    text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create table if not exists public.jarvis_allowed_writes (
  table_name      text primary key,
  id_column       text not null default 'id',
  can_insert      boolean not null default false,
  can_update      boolean not null default false,
  allowed_columns text[] not null default '{}',
  notes           text
);

create table if not exists public.jarvis_pending_actions (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users(id),
  operation    text not null check (operation in ('insert','update')),
  table_name   text not null,
  record_id    text,
  changes      jsonb not null,
  reason       text,
  summary      text,
  status       text not null default 'pending'
               check (status in ('pending','approving','approved','rejected','failed')),
  before       jsonb,
  result       jsonb,
  error        text,
  decided_by   uuid references auth.users(id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.jarvis_audit_log (
  id         bigserial primary key,
  user_id    uuid references auth.users(id),
  question   text,
  reply      text,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

alter table public.jarvis_knowledge       enable row level security;
alter table public.jarvis_tasks           enable row level security;
alter table public.jarvis_allowed_writes  enable row level security;
alter table public.jarvis_pending_actions enable row level security;
alter table public.jarvis_audit_log       enable row level security;