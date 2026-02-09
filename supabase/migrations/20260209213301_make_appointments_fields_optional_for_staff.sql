/*
  # Make Appointment Fields Optional for Staff Appointments

  1. Changes
    - Make `phone` column nullable (optional for staff appointments)
    - Make `email` column nullable (optional for staff appointments)
    - Make `problem_description` nullable (optional for staff appointments)

  2. Purpose
    - Staff appointments only require name, date, and time
    - Phone and email are optional for staff appointments
    - yacht_name is already nullable (not needed for staff appointments)
    - problem_description can be used for meeting notes (optional)

  3. Security
    - No RLS changes needed - existing policies cover both appointment types
*/

-- Make phone nullable
ALTER TABLE appointments
ALTER COLUMN phone DROP NOT NULL;

-- Make email nullable
ALTER TABLE appointments
ALTER COLUMN email DROP NOT NULL;

-- Make problem_description nullable
ALTER TABLE appointments
ALTER COLUMN problem_description DROP NOT NULL;
