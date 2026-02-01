/*
  # Create Work Order Tasks and Line Items Tables

  1. New Tables
    - `work_order_tasks`
      - Links tasks to work orders
      - Tracks task completion status
      - Mirrors structure from estimate_tasks
    
    - `work_order_line_items`
      - Stores individual line items (labor/parts) for work order tasks
      - Links to labor codes and parts inventory
      - Tracks pricing and taxability
      - Mirrors structure from estimate_line_items

  2. Security
    - Enable RLS on both tables
    - Staff, mechanic, and master roles can manage work orders
    - Yacht owners can view work orders for their yachts
*/

-- Create work_order_tasks table
CREATE TABLE IF NOT EXISTS work_order_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  task_overview text,
  task_order integer NOT NULL DEFAULT 0,
  apply_surcharge boolean NOT NULL DEFAULT false,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES user_profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create work_order_line_items table
CREATE TABLE IF NOT EXISTS work_order_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  task_id uuid REFERENCES work_order_tasks(id) ON DELETE CASCADE,
  line_type text NOT NULL CHECK (line_type IN ('labor', 'part', 'other')),
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  labor_code_id uuid REFERENCES labor_codes(id),
  part_id uuid REFERENCES parts_inventory(id),
  accounting_code_id uuid REFERENCES accounting_codes(id),
  line_order integer NOT NULL DEFAULT 0,
  is_taxable boolean NOT NULL DEFAULT true,
  work_details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_tasks_work_order_id ON work_order_tasks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_tasks_is_completed ON work_order_tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_work_order_id ON work_order_line_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_task_id ON work_order_line_items(task_id);
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_labor_code_id ON work_order_line_items(labor_code_id);
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_part_id ON work_order_line_items(part_id);

-- Enable RLS
ALTER TABLE work_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for work_order_tasks

-- Staff, mechanic, and master can view all work order tasks
CREATE POLICY "Staff can view all work order tasks"
  ON work_order_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Owners can view work order tasks for their yachts
CREATE POLICY "Owners can view work order tasks for their yachts"
  ON work_order_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_orders wo
      JOIN yachts y ON y.id = wo.yacht_id
      WHERE wo.id = work_order_tasks.work_order_id
      AND y.owner_id = auth.uid()
    )
  );

-- Staff, mechanic, and master can insert work order tasks
CREATE POLICY "Staff can insert work order tasks"
  ON work_order_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff, mechanic, and master can update work order tasks
CREATE POLICY "Staff can update work order tasks"
  ON work_order_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff, mechanic, and master can delete work order tasks
CREATE POLICY "Staff can delete work order tasks"
  ON work_order_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for work_order_line_items

-- Staff, mechanic, and master can view all work order line items
CREATE POLICY "Staff can view all work order line items"
  ON work_order_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Owners can view work order line items for their yachts
CREATE POLICY "Owners can view work order line items for their yachts"
  ON work_order_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_orders wo
      JOIN yachts y ON y.id = wo.yacht_id
      WHERE wo.id = work_order_line_items.work_order_id
      AND y.owner_id = auth.uid()
    )
  );

-- Staff, mechanic, and master can insert work order line items
CREATE POLICY "Staff can insert work order line items"
  ON work_order_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff, mechanic, and master can update work order line items
CREATE POLICY "Staff can update work order line items"
  ON work_order_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );

-- Staff, mechanic, and master can delete work order line items
CREATE POLICY "Staff can delete work order line items"
  ON work_order_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
      AND user_profiles.is_active = true
    )
  );
