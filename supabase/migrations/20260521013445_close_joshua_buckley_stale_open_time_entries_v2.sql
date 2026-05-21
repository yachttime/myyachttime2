/*
  # Close Joshua Buckley's stale open time entries

  ## Problem
  The time clock UI uses a 36-hour cutoff when looking for an open punch-in.
  Joshua punched in on May 14, 15, and 18 but could never punch out because
  each attempt showed "Punch In" instead of "Punch Out" (entry was outside
  the 36-hour window). He kept punching in again, creating more stuck entries.

  ## Fix
  Close the 3 stale open entries (May 14, 15, 18) with 8-hour days.
  The most recent open entry (May 20) is left open so he can punch out normally.
  edited_by set to master user (Jeff Stanley) per system admin action.

  ## Entries closed
  - 7535aa52: May 14 — closed at 8h after punch-in
  - 1c2819f0: May 15 — closed at 8h after punch-in
  - dcfca35d: May 18 — closed at 8h after punch-in
*/

-- May 14
UPDATE staff_time_entries
SET punch_out_time = '2026-05-14 22:32:16+00',
    total_hours = 8.00,
    is_edited = true,
    edited_by = '610f94b4-646f-4f5b-b64a-a47723f6e85e',
    edited_at = now(),
    edit_reason = 'System fix: entry left open due to 36-hour UI cutoff bug. Closed at 8h.'
WHERE id = '7535aa52-ac50-43ad-9a9c-8de3b67afa1a';

-- May 15
UPDATE staff_time_entries
SET punch_out_time = '2026-05-15 22:30:28+00',
    total_hours = 8.00,
    is_edited = true,
    edited_by = '610f94b4-646f-4f5b-b64a-a47723f6e85e',
    edited_at = now(),
    edit_reason = 'System fix: entry left open due to 36-hour UI cutoff bug. Closed at 8h.'
WHERE id = '1c2819f0-fd94-4f20-85ff-7c3633563c56';

-- May 18
UPDATE staff_time_entries
SET punch_out_time = '2026-05-18 22:36:13+00',
    total_hours = 8.00,
    is_edited = true,
    edited_by = '610f94b4-646f-4f5b-b64a-a47723f6e85e',
    edited_at = now(),
    edit_reason = 'System fix: entry left open due to 36-hour UI cutoff bug. Closed at 8h.'
WHERE id = 'dcfca35d-d6f2-42de-aeaf-d5723e84ab9d';
