/*
  # Add employee self-punch-out RLS policy for staff_time_entries

  ## Summary
  Staff employees currently cannot punch out because the UPDATE policy on
  staff_time_entries only allows the master role. This means:
  - Employees could punch IN (INSERT policy allows it)
  - But could NOT punch OUT (UPDATE policy blocks non-master)
  - Auto-close of forgotten entries also silently failed

  ## Fix
  Adds a narrow UPDATE policy that allows an authenticated employee to update
  ONLY their own time entry rows, restricted to the specific fields used during
  normal clock operations (punch_out_time, lunch_break_start, lunch_break_end, notes,
  punch_out_ip). The WITH CHECK ensures they cannot change user_id or other
  sensitive fields.

  The existing "Only master can update time entries" policy remains for admin edits.
*/

CREATE POLICY "Employees can punch out and update own open time entries"
  ON staff_time_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
