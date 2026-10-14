/*
# Create Bucket List Yacht for AZ Marine

1. New Data
- Inserts a new yacht named "Bucket List" for AZ Marine (company_id: 519b4394-d35c-46d7-997c-db7e46178ef5).
- Manufacturer: Bravada
- Year: 2014
- Marina: Antelope Point
- Slip: Dock 3
- is_active: true

2. Security
- No schema changes. The yachts table already has RLS and company isolation policies.
- The new row inherits the existing company_id-based RLS scope.

3. Important Notes
- This migration is idempotent: the DO block checks whether a yacht named "Bucket List"
  already exists for this company before inserting, so re-running is safe.
- No owner_id is set initially; owners will be linked via user_profiles.yacht_id
  when their accounts are created.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM yachts
    WHERE name = 'Bucket List'
      AND company_id = '519b4394-d35c-46d7-997c-db7e46178ef5'
  ) THEN
    INSERT INTO yachts (name, manufacturer, year, marina_name, slip_location, is_active, company_id)
    VALUES (
      'Bucket List',
      'Bravada',
      2014,
      'Antelope Point',
      'Dock 3',
      true,
      '519b4394-d35c-46d7-997c-db7e46178ef5'
    );
  END IF;
END $$;