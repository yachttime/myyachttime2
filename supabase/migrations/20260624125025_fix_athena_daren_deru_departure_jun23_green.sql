-- Athena: Daren Deru departs 06/23/26 (start_date = green on calendar), arrives/returns 07/01/26
UPDATE yacht_bookings
SET start_date = '2026-06-23',
    end_date   = '2026-07-01',
    updated_at = NOW()
WHERE id = '1f9adcc3-6ff2-4f2a-945a-83fde2c81b66';
