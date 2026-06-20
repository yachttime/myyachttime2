-- Athena: Daren Deru arrives 06/22 (same day as Stephen Mile departs), not 06/23
UPDATE yacht_bookings
SET start_date = '2026-06-22', updated_at = NOW()
WHERE id = '1f9adcc3-6ff2-4f2a-945a-83fde2c81b66'
  AND owner_name = 'Daren Deru';
