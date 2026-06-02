/*
  # Add auto-close forgotten punch-out function

  ## Summary
  When an employee forgets to punch out, the time clock was silently failing to
  auto-close the stale entry because the UPDATE policy on staff_time_entries
  is restricted to master role only. This meant employees were blocked from
  punching in the next morning.

  ## Fix
  Creates a SECURITY DEFINER function `auto_close_forgotten_punch_out` that:
  - Can only be called by authenticated users
  - Only closes entries belonging to the calling user (auth.uid())
  - Only closes entries that have no punch_out_time (genuinely open)
  - Only closes entries from a previous calendar day OR open 14+ hours
  - Sets punch_out_time to end of the punch-in day (23:59 Phoenix time)
  - Marks the entry as edited with a clear admin-review note
  - Returns success/failure as jsonb

  The employee role cannot use this to edit arbitrary entries — it is locked
  to their own open forgotten entries only.
*/

CREATE OR REPLACE FUNCTION auto_close_forgotten_punch_out(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry staff_time_entries%ROWTYPE;
  v_calling_user_id uuid;
  v_punch_in_phx date;
  v_today_phx date;
  v_hours_open numeric;
  v_auto_close_time timestamptz;
BEGIN
  v_calling_user_id := auth.uid();

  -- Load the entry
  SELECT * INTO v_entry
  FROM staff_time_entries
  WHERE id = p_entry_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry not found');
  END IF;

  -- Only allow closing own entries
  IF v_entry.user_id != v_calling_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Only close entries that are still open
  IF v_entry.punch_out_time IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry already closed');
  END IF;

  -- Verify it is actually a forgotten entry (different day OR open 14+ hours)
  v_punch_in_phx := (v_entry.punch_in_time AT TIME ZONE 'America/Phoenix')::date;
  v_today_phx := (now() AT TIME ZONE 'America/Phoenix')::date;
  v_hours_open := EXTRACT(EPOCH FROM (now() - v_entry.punch_in_time)) / 3600;

  IF v_punch_in_phx = v_today_phx AND v_hours_open < 14 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry is from today and not stale');
  END IF;

  -- Close at 23:59 Phoenix time on the punch-in day
  v_auto_close_time := (v_punch_in_phx::text || ' 23:59:00')::timestamp AT TIME ZONE 'America/Phoenix';

  UPDATE staff_time_entries
  SET
    punch_out_time = v_auto_close_time,
    is_edited = true,
    edited_by = v_calling_user_id,
    edited_at = now(),
    edit_reason = 'Auto-closed: employee forgot to punch out — hours need admin review'
  WHERE id = p_entry_id
    AND punch_out_time IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION auto_close_forgotten_punch_out(uuid) TO authenticated;
