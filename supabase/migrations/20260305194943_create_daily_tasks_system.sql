/*
  # Create Daily Tasks System

  ## Overview
  Creates a daily task management system integrated with the Time Clock section.
  Tasks can be assigned by master/manager roles to staff members, optionally linked
  to a yacht or customer. Tasks persist (roll over) until marked complete.

  ## New Tables

  ### `daily_tasks`
  - Core task record with assignment info, notes, and completion tracking
  - `id` - UUID primary key
  - `title` - Short task description/title
  - `assigned_to` - FK to user_profiles (staff member receiving the task)
  - `assigned_by` - FK to user_profiles (master/manager who created it)
  - `yacht_id` - Optional FK to yachts
  - `customer_id` - Optional FK to customers
  - `admin_notes` - Instructions written by the assigner
  - `staff_notes` - Notes added by the assigned employee
  - `time_spent_minutes` - Time logged by the staff member (in minutes)
  - `is_completed` - Whether the task is done
  - `completed_at` - When it was marked complete
  - `task_date` - The date the task was originally created/assigned
  - `company_id` - Multi-tenant company isolation
  - `created_at`, `updated_at` timestamps

  ### `daily_task_parts`
  - Parts/materials the staff member needs or has listed for the task
  - `id` - UUID primary key
  - `task_id` - FK to daily_tasks
  - `part_name` - Free-text part description
  - `quantity` - Optional quantity
  - `notes` - Optional additional notes
  - `added_by` - FK to user_profiles
  - `company_id` - Multi-tenant isolation
  - `created_at` timestamp

  ## Security
  - RLS enabled on both tables
  - Master/manager can create, view all, and update tasks for their company
  - Staff/mechanic can view tasks assigned to them and update their own notes/parts
  - Separate policies for each CRUD operation
*/

-- Daily Tasks table
CREATE TABLE IF NOT EXISTS daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  assigned_to uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  yacht_id uuid REFERENCES yachts(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  admin_notes text DEFAULT '',
  staff_notes text DEFAULT '',
  time_spent_minutes integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  task_date date NOT NULL DEFAULT CURRENT_DATE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Daily Task Parts table
CREATE TABLE IF NOT EXISTS daily_task_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  part_name text NOT NULL,
  quantity text DEFAULT '',
  notes text DEFAULT '',
  added_by uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_tasks_assigned_to ON daily_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_company_id ON daily_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_is_completed ON daily_tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_task_date ON daily_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_daily_task_parts_task_id ON daily_task_parts(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_parts_company_id ON daily_task_parts(company_id);

-- Updated_at trigger for daily_tasks
CREATE OR REPLACE FUNCTION update_daily_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_daily_tasks_updated_at ON daily_tasks;
CREATE TRIGGER set_daily_tasks_updated_at
  BEFORE UPDATE ON daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_tasks_updated_at();

-- Enable RLS
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_task_parts ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role and company_id
-- We reuse the existing get_my_company_id() and get_my_role() patterns

-- ============================================================
-- DAILY TASKS POLICIES
-- ============================================================

-- SELECT: master/manager see all tasks in their company; staff/mechanic see only their own
CREATE POLICY "Master and manager can view all company daily tasks"
  ON daily_tasks FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('master', 'manager')
  );

CREATE POLICY "Staff can view their own assigned daily tasks"
  ON daily_tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    AND company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- INSERT: only master/manager can create tasks
CREATE POLICY "Master and manager can create daily tasks"
  ON daily_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('master', 'manager')
  );

-- UPDATE: master/manager can update any task; assigned staff can update staff_notes, time_spent_minutes, is_completed
CREATE POLICY "Master and manager can update any daily task"
  ON daily_tasks FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('master', 'manager')
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('master', 'manager')
  );

CREATE POLICY "Assigned staff can update their own daily task fields"
  ON daily_tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    AND company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- DELETE: only master can delete tasks
CREATE POLICY "Master can delete daily tasks"
  ON daily_tasks FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) = 'master'
  );

-- ============================================================
-- DAILY TASK PARTS POLICIES
-- ============================================================

-- SELECT: master/manager see all; assigned staff see parts for their own tasks
CREATE POLICY "Master and manager can view all task parts"
  ON daily_task_parts FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('master', 'manager')
  );

CREATE POLICY "Staff can view parts for their own tasks"
  ON daily_task_parts FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND task_id IN (
      SELECT id FROM daily_tasks WHERE assigned_to = auth.uid()
    )
  );

-- INSERT: master/manager or the assigned staff member can add parts
CREATE POLICY "Master and manager can add task parts"
  ON daily_task_parts FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('master', 'manager')
  );

CREATE POLICY "Assigned staff can add parts to their own tasks"
  ON daily_task_parts FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND task_id IN (
      SELECT id FROM daily_tasks WHERE assigned_to = auth.uid()
    )
  );

-- DELETE: master/manager or the person who added the part
CREATE POLICY "Master and manager can delete task parts"
  ON daily_task_parts FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('master', 'manager')
  );

CREATE POLICY "Staff can delete their own added parts"
  ON daily_task_parts FOR DELETE
  TO authenticated
  USING (
    added_by = auth.uid()
    AND company_id = (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  );
