/*
  # Add Feature Flags to Companies

  Adds a JSONB column `feature_flags` to the `companies` table.
  This stores per-feature on/off toggles so masters can enable/disable
  program features per company -- the foundation for per-feature billing.

  All features default to true so existing companies keep full access.
*/

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS feature_flags jsonb DEFAULT '{}'::jsonb;

-- Backfill: set all features to true for existing companies with empty/null flags
UPDATE companies
SET feature_flags = jsonb_build_object(
  'owner_trips', true,
  'maintenance', true,
  'education', true,
  'staff_schedule', true,
  'time_clock', true,
  'estimating', true,
  'customers', true,
  'master_calendar', true,
  'messages', true,
  'appointments', true,
  'staff_appointment', true,
  'inspection', true,
  'owner_handoff', true,
  'repair_requests', true,
  'maintenance_requests', true,
  'owner_chat', true,
  'yachts', true,
  'engine_catalog', true,
  'vessel_monitoring', true,
  'smart_devices', true,
  'year_end_overview', true,
  'user_management', true,
  'salvage_reports', true
)
WHERE feature_flags IS NULL
   OR feature_flags = '{}'::jsonb;
