/*
  # Add Appointment Type Support

  1. Changes
    - Add `appointment_type` column to appointments table
      - Type: text with check constraint
      - Values: 'customer' or 'staff'
      - Default: 'customer' (for backwards compatibility)
    - Make `problem_description` nullable (already nullable, just documenting)
    
  2. Purpose
    - Support two types of appointments:
      - 'customer': Linked to yachts/customers (existing functionality)
      - 'staff': Simple name/phone/email appointments without yacht linkage
    - Staff appointments use name, phone, email fields directly
    - problem_description field can be used for meeting notes
    
  3. Security
    - No RLS changes needed - existing policies cover both appointment types
*/

-- Add appointment_type column with constraint
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS appointment_type text 
DEFAULT 'customer' 
CHECK (appointment_type IN ('customer', 'staff'));

-- Update existing appointments to be 'customer' type
UPDATE appointments 
SET appointment_type = 'customer' 
WHERE appointment_type IS NULL;