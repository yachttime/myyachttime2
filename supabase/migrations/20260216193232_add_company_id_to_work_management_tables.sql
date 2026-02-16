/*
  # Add company_id to Work Management Tables - Part 2

  1. Tables Updated
    - repair_requests - Add company_id, index
    - repair_request_approval_tokens - Add company_id, index
    - maintenance_requests - Add company_id, index
    - work_orders - Add company_id, index
    - work_order_tasks - Add company_id, index
    - work_order_task_assignments - Add company_id, index
    - work_order_line_items - Add company_id, index
    - work_order_time_entries - Add company_id, index
    - estimates - Add company_id, index
    - estimate_line_items - Add company_id, index
    - estimate_tasks - Add company_id, index
    - estimating_invoices - Add company_id, index

  2. Notes
    - All work orders, repairs, estimates must be company-isolated
    - Each company manages their own work independently
*/

-- Repair requests table
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_repair_requests_company_id ON repair_requests(company_id);

-- Repair request approval tokens table
ALTER TABLE repair_request_approval_tokens ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_repair_request_approval_tokens_company_id ON repair_request_approval_tokens(company_id);

-- Maintenance requests table
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_company_id ON maintenance_requests(company_id);

-- Work orders table
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders(company_id);

-- Work order tasks table
ALTER TABLE work_order_tasks ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_work_order_tasks_company_id ON work_order_tasks(company_id);

-- Work order task assignments table
ALTER TABLE work_order_task_assignments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_work_order_task_assignments_company_id ON work_order_task_assignments(company_id);

-- Work order line items table
ALTER TABLE work_order_line_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_company_id ON work_order_line_items(company_id);

-- Work order time entries table
ALTER TABLE work_order_time_entries ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_work_order_time_entries_company_id ON work_order_time_entries(company_id);

-- Estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON estimates(company_id);

-- Estimate line items table
ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_company_id ON estimate_line_items(company_id);

-- Estimate tasks table
ALTER TABLE estimate_tasks ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimate_tasks_company_id ON estimate_tasks(company_id);

-- Estimating invoices table
ALTER TABLE estimating_invoices ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_estimating_invoices_company_id ON estimating_invoices(company_id);
