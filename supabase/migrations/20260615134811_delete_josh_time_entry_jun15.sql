
DELETE FROM public.staff_time_entries
WHERE id IN (
  SELECT te.id
  FROM public.staff_time_entries te
  JOIN public.user_profiles up ON up.user_id = te.user_id
  WHERE up.first_name ILIKE 'josh%'
    AND DATE(te.punch_in_time AT TIME ZONE 'America/Phoenix') = '2026-06-15'
);
