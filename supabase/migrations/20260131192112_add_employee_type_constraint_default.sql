/*
  # Add Employee Type Constraint and Default

  1. Changes
    - Add check constraint to ensure employee_type is either 'hourly' or 'salary'
    - Set default value to 'hourly' for new users
    - Backfill any existing NULL values to 'hourly'
  
  2. Notes
    - This allows time clock to properly track hourly vs salary employees
    - Hourly employees track lunch breaks, salary employees auto-deduct 1 hour
*/

-- Backfill any NULL values to 'hourly'
UPDATE user_profiles 
SET employee_type = 'hourly' 
WHERE employee_type IS NULL;

-- Add check constraint to ensure only valid values
ALTER TABLE user_profiles 
ADD CONSTRAINT check_employee_type 
CHECK (employee_type IN ('hourly', 'salary'));

-- Set default value
ALTER TABLE user_profiles 
ALTER COLUMN employee_type SET DEFAULT 'hourly';

-- Set NOT NULL constraint since we've backfilled and have a default
ALTER TABLE user_profiles 
ALTER COLUMN employee_type SET NOT NULL;
