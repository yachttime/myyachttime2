-- Jarvis staff table
create table if not exists public.jarvis_staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'staff' check (role in ('staff','manager','admin')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.jarvis_staff enable row level security;