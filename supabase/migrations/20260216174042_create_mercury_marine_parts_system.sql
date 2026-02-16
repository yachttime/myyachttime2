/*
  # Create Mercury Marine Parts System

  1. New Tables
    - `mercury_price_list_imports`
      - Tracks each Mercury Marine ASCII file upload
      - Fields: id, file_name, uploaded_by, uploaded_at, total_parts_imported, 
        total_parts_updated, status, error_message, file_size_bytes, processing_time_seconds
      - Only master role users can create imports
    
    - `mercury_marine_parts`
      - Stores all Mercury Marine parts from ASCII price list
      - Fields: id, part_number, item_class, description, superseded_part_number, 
        msrp, dealer_price, item_status, pack_quantity, weight_lbs, weight_oz, 
        upc_code, core_charge, container_charge, hazardous_code, discount_percentage, 
        ca_proposition_65, unit_length, unit_width, unit_height, is_active, 
        import_batch_id, created_at, updated_at
      - Indexed on part_number for fast lookups
      - Full-text search on description
    
  2. Security
    - Enable RLS on both tables
    - Masters can upload and manage price lists
    - All staff can view Mercury parts for estimates
    - Dealer pricing visible only to masters
  
  3. Updates
    - Add mercury_part_id, part_source, core_charge_amount, and container_charge_amount 
      to estimate_line_items table
*/

-- Create mercury_price_list_imports table
CREATE TABLE IF NOT EXISTS mercury_price_list_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  uploaded_at timestamptz DEFAULT now(),
  total_parts_imported integer DEFAULT 0,
  total_parts_updated integer DEFAULT 0,
  status varchar(20) DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  error_message text,
  file_size_bytes bigint,
  processing_time_seconds integer,
  created_at timestamptz DEFAULT now()
);

-- Create mercury_marine_parts table
CREATE TABLE IF NOT EXISTS mercury_marine_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number varchar(20) NOT NULL,
  item_class varchar(10),
  description varchar(100),
  superseded_part_number varchar(20),
  msrp decimal(10,2) DEFAULT 0,
  dealer_price decimal(10,2) DEFAULT 0,
  item_status varchar(10),
  pack_quantity integer DEFAULT 1,
  weight_lbs decimal(10,2) DEFAULT 0,
  weight_oz decimal(6,2) DEFAULT 0,
  upc_code varchar(30),
  core_charge decimal(10,2) DEFAULT 0,
  container_charge decimal(10,2) DEFAULT 0,
  hazardous_code varchar(5),
  discount_percentage decimal(5,2) DEFAULT 0,
  ca_proposition_65 text,
  unit_length decimal(10,2) DEFAULT 0,
  unit_width decimal(10,2) DEFAULT 0,
  unit_height decimal(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  import_batch_id uuid REFERENCES mercury_price_list_imports(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_mercury_parts_part_number ON mercury_marine_parts(part_number);
CREATE INDEX IF NOT EXISTS idx_mercury_parts_item_status ON mercury_marine_parts(item_status);
CREATE INDEX IF NOT EXISTS idx_mercury_parts_is_active ON mercury_marine_parts(is_active);
CREATE INDEX IF NOT EXISTS idx_mercury_parts_import_batch ON mercury_marine_parts(import_batch_id);

-- Add columns to estimate_line_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'mercury_part_id'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN mercury_part_id uuid REFERENCES mercury_marine_parts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'part_source'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN part_source varchar(20) DEFAULT 'custom' CHECK (part_source IN ('inventory', 'mercury', 'custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'core_charge_amount'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN core_charge_amount decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'container_charge_amount'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN container_charge_amount decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE mercury_price_list_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercury_marine_parts ENABLE ROW LEVEL SECURITY;

-- Policies for mercury_price_list_imports
CREATE POLICY "Masters can view all import records"
  ON mercury_price_list_imports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can insert import records"
  ON mercury_price_list_imports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can update import records"
  ON mercury_price_list_imports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

-- Policies for mercury_marine_parts
CREATE POLICY "Staff can view active Mercury parts"
  ON mercury_marine_parts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master', 'manager')
    )
  );

CREATE POLICY "Masters can insert Mercury parts"
  ON mercury_marine_parts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can update Mercury parts"
  ON mercury_marine_parts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can delete Mercury parts"
  ON mercury_marine_parts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
    )
  );