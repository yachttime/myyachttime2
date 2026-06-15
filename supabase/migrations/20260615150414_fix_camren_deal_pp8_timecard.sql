
-- Fix 1: Correct the bad May 29 entry (punch_out was June 1 instead of May 29)
UPDATE staff_time_entries
SET 
  punch_out_time = '2026-05-29 17:00:00-07',
  total_hours = 9.00,
  standard_hours = 8.00,
  overtime_hours = 1.00,
  edit_reason = 'Corrected punch_out date - was incorrectly recorded as June 1 (should be May 29)',
  is_edited = true,
  updated_at = NOW()
WHERE id = '6739a05d-bab0-4f35-9f83-60c3eb94dcc7';

-- Fix 2: Link all unlinked PP8 entries to pay_period_id
UPDATE staff_time_entries
SET 
  pay_period_id = 'c1ad8de5-ec65-4e1e-8adf-3f6875388ec8',
  updated_at = NOW()
WHERE id IN (
  '7d835f4d-c39b-4111-b05d-a47a61826ae8',  -- May 28
  '6739a05d-bab0-4f35-9f83-60c3eb94dcc7',  -- May 29 (corrected)
  '0ff0acf8-b675-431c-b1da-fee2da2abe26',  -- Jun 1
  '0a0b0961-290e-46d0-96f4-a1976b230811',  -- Jun 2
  'ad0467ec-199f-443b-84a6-395e190cea93',  -- Jun 3
  'b2c76cdb-917c-43e9-8fe2-b8466aba7875',  -- Jun 4
  '7b6415f0-9cc3-4042-b185-bce592e9d474',  -- Jun 5
  'd319031e-67f4-4766-b05d-44b3c01747d6',  -- Jun 8
  '3f8974f7-62c2-4af7-958f-cfc1c8ebea2d'   -- Jun 9
);
