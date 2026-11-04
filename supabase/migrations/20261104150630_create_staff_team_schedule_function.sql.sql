/*
# Team schedule for the staff page

1. New Function
- `get_team_schedule(p_start date, p_end date)` returns the company's team schedule for a date range as JSON.
- Contains four lists: `people` (first and last name only), `shifts` (weekly working hours), `overrides` (approved days off, sick leave, and one-off working days), and `time_off` (approved time-off requests).

2. What is excluded
- Pending and denied time-off requests.
- Denied weekly shifts.
- Notes, reasons, review notes, and any pay or rate fields.

3. Security
- Runs with definer rights so staff can see the team schedule without being granted direct access to other people's pending requests.
- Results are limited to the caller's own company via `get_user_company_id()`.
- Only signed-in users can execute it; PUBLIC and anon are revoked.
- Search path is pinned to public.

4. Notes
- Idempotent: safe to re-run. Uses CREATE OR REPLACE and re-applies grants.
*/

CREATE OR REPLACE FUNCTION public.get_team_schedule(p_start date, p_end date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
BEGIN
  IF auth.uid() IS NULL OR v_company IS NULL OR p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN jsonb_build_object('people', '[]'::jsonb, 'shifts', '[]'::jsonb, 'overrides', '[]'::jsonb, 'time_off', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'people', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', up.user_id,
        'first_name', up.first_name,
        'last_name', up.last_name
      ) ORDER BY up.first_name, up.last_name)
      FROM user_profiles up
      WHERE up.company_id = v_company
        AND up.is_active IS NOT FALSE
        AND up.role <> 'tablet'
    ), '[]'::jsonb),
    'shifts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', s.user_id,
        'day_of_week', s.day_of_week,
        'start_time', s.start_time,
        'end_time', s.end_time
      ))
      FROM staff_schedules s
      WHERE s.company_id = v_company
        AND s.is_working_day = true
        AND COALESCE(s.approval_status, '') <> 'denied'
    ), '[]'::jsonb),
    'overrides', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', o.user_id,
        'override_date', o.override_date,
        'status', o.status,
        'start_time', o.start_time,
        'end_time', o.end_time
      ))
      FROM staff_schedule_overrides o
      WHERE o.company_id = v_company
        AND o.override_date BETWEEN p_start AND p_end
        AND o.status IN ('approved_day_off', 'sick_leave', 'working')
    ), '[]'::jsonb),
    'time_off', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', t.user_id,
        'start_date', t.start_date,
        'end_date', t.end_date,
        'time_off_type', t.time_off_type,
        'is_partial_day', t.is_partial_day,
        'start_time', t.start_time,
        'end_time', t.end_time
      ))
      FROM staff_time_off_requests t
      WHERE t.company_id = v_company
        AND t.status = 'approved'
        AND t.start_date <= p_end
        AND t.end_date >= p_start
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_schedule(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_schedule(date, date) TO authenticated;
