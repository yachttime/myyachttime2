ALTER TABLE trip_inspections
  ADD COLUMN IF NOT EXISTS owner_name text;
