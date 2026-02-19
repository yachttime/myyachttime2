/*
  # Create Marine Wholesale Parts System

  1. New Tables
    - `marine_wholesale_imports`
      - Tracks each Marine Wholesale CSV file upload
      - Fields: id, file_name, uploaded_by, uploaded_at, total_parts_imported,
        status, error_message, file_size_bytes, processing_time_seconds
      - Only master role users can create imports

    - `marine_wholesale_parts`
      - Stores all Marine Wholesale parts from CSV price list
      - Columns match the spreadsheet layout:
        - sku (dealer/distributor SKU)
        - mfg_part_number (manufacturer part number)
        - description
        - unit_of_measure (Stk U/M)
        - list_price (List column)
        - cost (Cost column)
        - is_active
        - import_batch_id
      - Indexed on sku and mfg_part_number for fast lookups

  2. Security
    - Enable RLS on both tables
    - Masters can upload and manage price lists
    - All staff, mechanic, master, manager roles can view parts

  3. Updates
    - Update part_source CHECK constraint on estimate_line_items to include 'marine_wholesale'
    - Add marine_wholesale_part_id column to estimate_line_items
*/

-- Create marine_wholesale_imports table
CREATE TABLE IF NOT EXISTS marine_wholesale_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  uploaded_at timestamptz DEFAULT now(),
  total_parts_imported integer DEFAULT 0,
  status varchar(20) DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  error_message text,
  file_size_bytes bigint,
  processing_time_seconds integer,
  created_at timestamptz DEFAULT now()
);

-- Create marine_wholesale_parts table
CREATE TABLE IF NOT EXISTS marine_wholesale_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar(50) NOT NULL,
  mfg_part_number varchar(50),
  description text,
  unit_of_measure varchar(10),
  list_price decimal(10,2) DEFAULT 0,
  cost decimal(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  import_batch_id uuid REFERENCES marine_wholesale_imports(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_marine_wholesale_parts_sku ON marine_wholesale_parts(sku);
CREATE INDEX IF NOT EXISTS idx_marine_wholesale_parts_mfg_part ON marine_wholesale_parts(mfg_part_number);
CREATE INDEX IF NOT EXISTS idx_marine_wholesale_parts_is_active ON marine_wholesale_parts(is_active);
CREATE INDEX IF NOT EXISTS idx_marine_wholesale_parts_import_batch ON marine_wholesale_parts(import_batch_id);

-- Add marine_wholesale_part_id to estimate_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'marine_wholesale_part_id'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN marine_wholesale_part_id uuid REFERENCES marine_wholesale_parts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update part_source CHECK constraint to include marine_wholesale
DO $$
BEGIN
  ALTER TABLE estimate_line_items DROP CONSTRAINT IF EXISTS estimate_line_items_part_source_check;
  ALTER TABLE estimate_line_items ADD CONSTRAINT estimate_line_items_part_source_check
    CHECK (part_source IN ('inventory', 'mercury', 'marine_wholesale', 'custom'));
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- Enable RLS
ALTER TABLE marine_wholesale_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE marine_wholesale_parts ENABLE ROW LEVEL SECURITY;

-- Policies for marine_wholesale_imports
CREATE POLICY "Masters can view all marine wholesale import records"
  ON marine_wholesale_imports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can insert marine wholesale import records"
  ON marine_wholesale_imports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can update marine wholesale import records"
  ON marine_wholesale_imports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Policies for marine_wholesale_parts
CREATE POLICY "Staff can view active marine wholesale parts"
  ON marine_wholesale_parts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Masters can insert marine wholesale parts"
  ON marine_wholesale_parts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can update marine wholesale parts"
  ON marine_wholesale_parts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can delete marine wholesale parts"
  ON marine_wholesale_parts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );
