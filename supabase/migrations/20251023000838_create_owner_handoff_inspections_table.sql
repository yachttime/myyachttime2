/*
  # Create Owner Handoff Inspections Table

  1. New Tables
    - `owner_handoff_inspections`
      - `id` (uuid, primary key) - Unique identifier for each handoff inspection
      - `yacht_id` (uuid, foreign key) - Reference to the yacht being inspected
      - `inspector_id` (uuid, foreign key) - Reference to the mechanic/staff performing inspection
      - `inspection_date` (timestamptz) - Date and time of inspection
      - Trip Issues fields:
        - `trip_issues` (text) - Any issues during the trip condition
        - `trip_issues_notes` (text) - Details about trip issues
        - `boat_damage` (text) - Damage to boat during trip condition
        - `boat_damage_notes` (text) - Details about boat damage
      - Pre-Handoff Checklist fields:
        - `shore_cords_inverters` (text) - Shore cords plugged in and inverters on condition
        - `shore_cords_inverters_notes` (text) - Shore cords and inverters notes
        - `engine_generator_fuel` (text) - Engine and generators fuel full condition
        - `engine_generator_fuel_notes` (text) - Fuel level notes
        - `toy_tank_fuel` (text) - Toy tank fuel full condition
        - `toy_tank_fuel_notes` (text) - Toy tank fuel notes
        - `propane_tanks` (text) - Propane tanks full and connected condition
        - `propane_tanks_notes` (text) - Propane tanks notes
      - Cleaning and Repairs fields:
        - `boat_cleaned` (text) - Boat has been cleaned condition
        - `boat_cleaned_notes` (text) - Cleaning notes
        - `repairs_completed` (text) - All repairs completed condition
        - `repairs_completed_notes` (text) - Repairs completion notes
        - `owners_called` (text) - Owners called if repairs not completed condition
        - `owners_called_notes` (text) - Owner communication notes
      - General fields:
        - `additional_notes` (text) - Any additional observations
        - `issues_found` (boolean, default false) - Whether issues requiring attention were found
        - `created_at` (timestamptz) - Record creation timestamp
        - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `owner_handoff_inspections` table
    - Add policy for staff/managers/mechanics to insert handoff inspections
    - Add policy for staff/managers/mechanics to view all handoff inspections
    - Add policy for owners to view handoff inspections for their yachts

  3. Indexes
    - Add index on yacht_id for efficient querying
    - Add index on inspector_id for efficient querying
    - Add index on inspection_date for chronological sorting
*/

-- Create the owner_handoff_inspections table
CREATE TABLE IF NOT EXISTS owner_handoff_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  inspector_id uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  inspection_date timestamptz DEFAULT now(),
  
  -- Trip Issues
  trip_issues text,
  trip_issues_notes text,
  boat_damage text,
  boat_damage_notes text,
  
  -- Pre-Handoff Checklist
  shore_cords_inverters text,
  shore_cords_inverters_notes text,
  engine_generator_fuel text,
  engine_generator_fuel_notes text,
  toy_tank_fuel text,
  toy_tank_fuel_notes text,
  propane_tanks text,
  propane_tanks_notes text,
  
  -- Cleaning and Repairs
  boat_cleaned text,
  boat_cleaned_notes text,
  repairs_completed text,
  repairs_completed_notes text,
  owners_called text,
  owners_called_notes text,
  
  -- General
  additional_notes text,
  issues_found boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_owner_handoff_inspections_yacht_id ON owner_handoff_inspections(yacht_id);
CREATE INDEX IF NOT EXISTS idx_owner_handoff_inspections_inspector_id ON owner_handoff_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_owner_handoff_inspections_inspection_date ON owner_handoff_inspections(inspection_date DESC);

-- Enable Row Level Security
ALTER TABLE owner_handoff_inspections ENABLE ROW LEVEL SECURITY;

-- Policy: Staff, managers, and mechanics can insert handoff inspections
CREATE POLICY "Staff can insert owner handoff inspections"
  ON owner_handoff_inspections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

-- Policy: Staff, managers, and mechanics can view all handoff inspections
CREATE POLICY "Staff can view all owner handoff inspections"
  ON owner_handoff_inspections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager', 'mechanic')
    )
  );

-- Policy: Owners can view handoff inspections for their yachts
CREATE POLICY "Owners can view their yacht handoff inspections"
  ON owner_handoff_inspections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'owner'
      AND user_profiles.yacht_id = owner_handoff_inspections.yacht_id
    )
  );

-- Policy: Staff and managers can update handoff inspections
CREATE POLICY "Staff can update owner handoff inspections"
  ON owner_handoff_inspections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'manager')
    )
  );