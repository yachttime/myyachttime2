
-- Fix company_id on ATHENA owner trip bookings to match the ATHENA yacht's company
UPDATE yacht_bookings
SET company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE yacht_id = 'b30555e7-e631-49cd-9542-e82f13a7c716'
  AND company_id = '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93';
