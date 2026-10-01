-- =====================================================================
-- JARVIS — staff AI assistant: database setup
-- Run once in Supabase → SQL Editor (or let bolt.new add it as a migration).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where possible.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Who may use Jarvis (staff only for Phase 1)
-- ---------------------------------------------------------------------
create table if not exists public.jarvis_staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'staff' check (role in ('staff','manager','admin')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Helper used by RLS policies below
create or replace function public.is_jarvis_staff(min_role text default 'staff')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jarvis_staff s
    where s.user_id = auth.uid()
      and s.active
      and case min_role
            when 'admin'   then s.role = 'admin'
            when 'manager' then s.role in ('manager','admin')
            else true
          end
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Knowledge base: policies, prices, procedures, FAQs Jarvis should know
-- ---------------------------------------------------------------------
create table if not exists public.jarvis_knowledge (
  id         uuid primary key default gen_random_uuid(),
  category   text not null default 'general',   -- e.g. houseboats, service, billing, rescue, general
  title      text not null,
  content    text not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Tasks Jarvis can create directly (low risk — its own table)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 4. Allow-list: which of YOUR tables Jarvis may propose changes to
--    Nothing is writable until you add a row here.
-- ---------------------------------------------------------------------
create table if not exists public.jarvis_allowed_writes (
  table_name      text primary key,
  id_column       text not null default 'id',
  can_insert      boolean not null default false,
  can_update      boolean not null default false,
  allowed_columns text[] not null default '{}',
  notes           text
);

-- ---------------------------------------------------------------------
-- 5. Proposed changes waiting for a person to click Approve / Reject
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 6. Audit log of every Jarvis conversation turn
-- ---------------------------------------------------------------------
create table if not exists public.jarvis_audit_log (
  id         bigserial primary key,
  user_id    uuid references auth.users(id),
  question   text,
  reply      text,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Row Level Security (the Edge Function uses a server connection;
--    these policies govern what the app's own UI can read/edit)
-- ---------------------------------------------------------------------
alter table public.jarvis_staff           enable row level security;
alter table public.jarvis_knowledge       enable row level security;
alter table public.jarvis_tasks           enable row level security;
alter table public.jarvis_allowed_writes  enable row level security;
alter table public.jarvis_pending_actions enable row level security;
alter table public.jarvis_audit_log       enable row level security;

drop policy if exists "staff read own row"       on public.jarvis_staff;
drop policy if exists "admins manage staff"      on public.jarvis_staff;
create policy "staff read own row"  on public.jarvis_staff for select using (user_id = auth.uid());
create policy "admins manage staff" on public.jarvis_staff for all
  using (public.is_jarvis_staff('admin')) with check (public.is_jarvis_staff('admin'));

drop policy if exists "staff read knowledge"     on public.jarvis_knowledge;
drop policy if exists "managers edit knowledge"  on public.jarvis_knowledge;
create policy "staff read knowledge"    on public.jarvis_knowledge for select using (public.is_jarvis_staff());
create policy "managers edit knowledge" on public.jarvis_knowledge for all
  using (public.is_jarvis_staff('manager')) with check (public.is_jarvis_staff('manager'));

drop policy if exists "staff read tasks"         on public.jarvis_tasks;
drop policy if exists "staff update tasks"       on public.jarvis_tasks;
create policy "staff read tasks"   on public.jarvis_tasks for select using (public.is_jarvis_staff());
create policy "staff update tasks" on public.jarvis_tasks for update
  using (public.is_jarvis_staff()) with check (public.is_jarvis_staff());

drop policy if exists "staff read allow-list"    on public.jarvis_allowed_writes;
drop policy if exists "admins edit allow-list"   on public.jarvis_allowed_writes;
create policy "staff read allow-list"  on public.jarvis_allowed_writes for select using (public.is_jarvis_staff());
create policy "admins edit allow-list" on public.jarvis_allowed_writes for all
  using (public.is_jarvis_staff('admin')) with check (public.is_jarvis_staff('admin'));

drop policy if exists "staff read pending"       on public.jarvis_pending_actions;
create policy "staff read pending" on public.jarvis_pending_actions for select using (public.is_jarvis_staff());

drop policy if exists "admins read audit"        on public.jarvis_audit_log;
create policy "admins read audit" on public.jarvis_audit_log for select using (public.is_jarvis_staff('admin'));

-- ---------------------------------------------------------------------
-- 8. Make yourself the first Jarvis admin
--    (change the email if you log into the app with a different one)
-- ---------------------------------------------------------------------
insert into public.jarvis_staff (user_id, display_name, role)
select id, 'Jeff Stanley', 'admin' from auth.users where email = 'jeff@azmarine.net'
on conflict (user_id) do update set role = 'admin', active = true;

-- ---------------------------------------------------------------------
-- 9. Starter knowledge — EDIT these to match how you actually operate
-- ---------------------------------------------------------------------
insert into public.jarvis_knowledge (category, title, content) values
 ('general',    'About the company',
  'Mercury Marine dealership at Lake Powell. We sell and service Mercury outboards/sterndrives, manage a fleet of timeshare houseboats, and run the Antelope Point Marina Rescue Division (vessel salvage/recovery, called out by NPS dispatch).'),
 ('rescue',     'Rescue Division contact',
  'Antelope Point Marina — Rescue Division. Phone 480-250-6270, email rescue@apmlp.com. Antelope Point is an NPS concessioner; removal plans under the concession agreement are automatically approved.'),
 ('houseboats', 'Timeshare check-in / check-out',
  'TODO: fill in check-in time, check-out time, fuel/pump-out policy, cleaning fees, damage deposit.'),
 ('service',    'Service department basics',
  'TODO: shop hours, labor rate, winterization pricing, typical turnaround, warranty claim process.'),
 ('billing',    'Billing policies',
  'TODO: payment terms, late fees, accepted payment methods, refund/cancellation policy.')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 10. EXAMPLE allow-list rows — uncomment and change to YOUR real
--     table/column names once you've looked at them in Table Editor.
-- ---------------------------------------------------------------------
-- insert into public.jarvis_allowed_writes (table_name, can_insert, can_update, allowed_columns, notes) values
--  ('service_jobs', true,  true,  array['customer_id','boat_id','description','status','notes','scheduled_date'], 'Service tickets'),
--  ('bookings',     false, true,  array['notes','status'],                                                       'Houseboat bookings — notes/status only'),
--  ('customers',    false, true,  array['phone','email','notes'],                                                'Contact info only'),
--  ('rescue_jobs',  true,  true,  array['vessel_name','location','status','notes','callout_at'],                 'Rescue callouts');
