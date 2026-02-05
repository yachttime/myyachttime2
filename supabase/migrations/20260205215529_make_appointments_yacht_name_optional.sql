/*
  # Make yacht_name optional in appointments table

  1. Changes
    - Make yacht_name column nullable in appointments table
    - Allow appointments to be created without specifying a yacht

  2. Notes
    - This supports walk-in customers who may not have a specific yacht
*/

ALTER TABLE appointments 
ALTER COLUMN yacht_name DROP NOT NULL;

ALTER TABLE appointments 
ALTER COLUMN yacht_name DROP DEFAULT;
