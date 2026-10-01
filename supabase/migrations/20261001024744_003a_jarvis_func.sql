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