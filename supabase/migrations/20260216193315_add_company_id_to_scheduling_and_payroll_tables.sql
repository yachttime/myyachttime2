/*
  # Add company_id to Scheduling and Payroll Tables

  1. Tables Updated
    - staff_time_entries - Add company_id, index
    - time_entry_audit_log - Add company_id, index
    - staff_schedules - Add company_id, index
    - staff_schedule_overrides - Add company_id, index
    - staff_time_off_requests - Add company_id, index
    - appointments - Add company_id, index
    - payroll_periods - Add company_id, index
    - pay_periods - Add company_id, index
    - time_clock_reminders - Add company_id, index

  2. Notes
    - Each company manages their own staff schedules
    - Payroll is completely isolated per company
*/

-- Staff time entries
ALTER TABLE staff_time_entries ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_staff_time_entries_company_id ON staff_time_entries(company_id);

-- Time entry audit log
ALTER TABLE time_entry_audit_log ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_time_entry_audit_log_company_id ON time_entry_audit_log(company_id);

-- Staff schedules
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_company_id ON staff_schedules(company_id);

-- Staff schedule overrides
ALTER TABLE staff_schedule_overrides ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_staff_schedule_overrides_company_id ON staff_schedule_overrides(company_id);

-- Staff time off requests
ALTER TABLE staff_time_off_requests ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_requests_company_id ON staff_time_off_requests(company_id);

-- Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON appointments(company_id);

-- Payroll periods
ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_company_id ON payroll_periods(company_id);

-- Pay periods
ALTER TABLE pay_periods ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_pay_periods_company_id ON pay_periods(company_id);

-- Time clock reminders
ALTER TABLE time_clock_reminders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_time_clock_reminders_company_id ON time_clock_reminders(company_id);
