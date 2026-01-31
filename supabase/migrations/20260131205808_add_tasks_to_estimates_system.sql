/*
  # Add Tasks to Estimates System

  1. New Tables
    - `estimate_tasks`
      - `id` (uuid, primary key)
      - `estimate_id` (uuid, foreign key) - Reference to parent estimate
      - `task_name` (text) - Name of the task
      - `task_overview` (text) - Description/overview of what this task involves
      - `task_order` (integer) - Order of tasks for display
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `task_id` to `estimate_line_items`
      - Line items will now belong to tasks instead of directly to estimates
      - Each line item must be associated with a task

  3. Security
    - Enable RLS on estimate_tasks table
    - Add policies for master users to manage tasks
*/

-- Create estimate_tasks table
CREATE TABLE IF NOT EXISTS estimate_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid REFERENCES estimates(id) ON DELETE CASCADE NOT NULL,
  task_name text NOT NULL,
  task_overview text,
  task_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add task_id to estimate_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_line_items' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE estimate_line_items ADD COLUMN task_id uuid REFERENCES estimate_tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_estimate_tasks_estimate_id ON estimate_tasks(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_task_id ON estimate_line_items(task_id);

-- Enable RLS
ALTER TABLE estimate_tasks ENABLE ROW LEVEL SECURITY;

-- Master users can manage estimate tasks
CREATE POLICY "Master users can view estimate tasks"
  ON estimate_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can insert estimate tasks"
  ON estimate_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can update estimate tasks"
  ON estimate_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Master users can delete estimate tasks"
  ON estimate_tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.is_active = true
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_estimate_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_tasks_updated_at
  BEFORE UPDATE ON estimate_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_tasks_updated_at();
