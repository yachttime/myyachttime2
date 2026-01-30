/*
  # Create Yacht Booking Owners Table

  1. New Tables
    - yacht_booking_owners table for multiple owners per booking
      - id (uuid, primary key)
      - booking_id (uuid, foreign key to yacht_bookings)
      - owner_name (text)
      - owner_contact (text)
      - created_at (timestamptz)

  2. Purpose
    - Allows multiple owners to be associated with a single yacht booking/trip
    - Replaces the single owner_name/owner_contact fields on yacht_bookings
    - Enables flexible co-ownership and shared trip management

  3. Security
    - Enable RLS on yacht_booking_owners table
    - Staff can manage all booking owners
    - Yacht owners can view booking owners for their yacht trips

  4. Notes
    - The owner_name and owner_contact fields on yacht_bookings will be deprecated but kept for backward compatibility
    - New owner trips should use this junction table
    - Existing data can remain as-is or be migrated
*/

-- Create yacht_booking_owners table
CREATE TABLE IF NOT EXISTS yacht_booking_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES yacht_bookings(id) ON DELETE CASCADE,
  owner_name text NOT NULL,
  owner_contact text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE yacht_booking_owners ENABLE ROW LEVEL SECURITY;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_yacht_booking_owners_booking_id 
  ON yacht_booking_owners(booking_id);

-- Allow staff to manage all booking owners
CREATE POLICY "Staff can view all booking owners"
  ON yacht_booking_owners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager')
    )
  );

CREATE POLICY "Staff can insert booking owners"
  ON yacht_booking_owners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager')
    )
  );

CREATE POLICY "Staff can update booking owners"
  ON yacht_booking_owners FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager')
    )
  );

CREATE POLICY "Staff can delete booking owners"
  ON yacht_booking_owners FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'manager')
    )
  );

-- Allow yacht owners to view booking owners for their yacht's trips
CREATE POLICY "Owners can view booking owners for their yacht"
  ON yacht_booking_owners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yacht_bookings
      JOIN yachts ON yacht_bookings.yacht_id = yachts.id
      WHERE yacht_bookings.id = yacht_booking_owners.booking_id
      AND yachts.id IN (
        SELECT yacht_id FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
      )
    )
  );