UPDATE yacht_bookings
SET owner_name = 'JALYNN  LARSEN'
WHERE id = '586fdadf-8f3f-4adc-a6e5-a141273b69e7'
  AND owner_name IS NULL;

INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact, company_id)
SELECT '586fdadf-8f3f-4adc-a6e5-a141273b69e7', 'JALYNN  LARSEN', NULL, '519b4394-d35c-46d7-997c-db7e46178ef5'
WHERE NOT EXISTS (
  SELECT 1 FROM yacht_booking_owners WHERE booking_id = '586fdadf-8f3f-4adc-a6e5-a141273b69e7'
);
