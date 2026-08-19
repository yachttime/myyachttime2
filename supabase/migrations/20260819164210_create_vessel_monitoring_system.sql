/*
# Create Vessel Monitoring System

## Overview
Creates the complete database foundation for vessel monitoring using M5 Tough hardware.
My YachtTime acts as the default monitoring provider; any company on the platform can
opt in to offer monitoring as an add-on. Yachts are enrolled under a specific provider
company (either My YachtTime or a partner). Master role sees all monitored yachts;
company users only see yachts enrolled under their company.

## New Tables

1. `vessel_monitoring_enrollments` — Links a yacht to a monitoring provider company
   - yacht_id (uuid FK to yachts)
   - provider_company_id (uuid FK to companies — the company providing monitoring)
   - yacht_company_id (uuid FK to companies — the company that owns the yacht)
   - status (text: active, paused, cancelled)
   - plan_tier (text: basic, standard, premium)
   - enrolled_at, start_date, end_date
   - created_by (uuid)

2. `vessel_monitor_devices` — Registers each physical M5 Tough unit on a yacht
   - yacht_id (uuid FK to yachts)
   - enrollment_id (uuid FK to vessel_monitoring_enrollments)
   - company_id (uuid FK to companies — provider company)
   - device_serial (text, unique — hardware serial number)
   - device_name (text — friendly name)
   - firmware_version (text)
   - api_key (text — authentication token for firmware POST)
   - is_online (boolean, default false)
   - last_check_in (timestamptz)
   - installation_date (timestamptz)
   - metadata (jsonb)

3. `vessel_monitor_ports` — Defines the 4 ports on each M5 Tough
   - device_id (uuid FK to vessel_monitor_devices)
   - port_label (text: 'A', 'B', 'C', 'D')
   - port_name (text: e.g. 'Pumps', 'Batteries & Engine', 'GPS', 'Anemometer')
   - port_type (text: 'digital', 'analog', 'rs485', 'gpio')
   - is_enabled (boolean, default true)

4. `vessel_monitor_sensors` — Individual sensors connected to each port
   - device_id (uuid FK to vessel_monitor_devices)
   - port_id (uuid FK to vessel_monitor_ports)
   - yacht_id (uuid FK to yachts)
   - company_id (uuid FK to companies — provider company)
   - sensor_type (text: bilge_pump, water_pump, ac_pump, battery_bank, engine_alternator,
     wind_vane, environment, gps, anemometer, smart_lock)
   - sensor_name (text — e.g. 'Port Bilge Pump', 'Starboard Battery Bank')
   - current_value (text — latest reading value)
   - unit_of_measure (text — e.g. 'V', 'RPM', 'knots', 'on/off', 'degrees')
   - status (text: normal, warning, critical, offline)
   - last_reading_at (timestamptz)
   - min_threshold (numeric, nullable)
   - max_threshold (numeric, nullable)
   - metadata (jsonb)

5. `vessel_monitor_readings` — Time-series log of sensor readings
   - sensor_id (uuid FK to vessel_monitor_sensors)
   - yacht_id (uuid FK to yachts)
   - company_id (uuid FK to companies)
   - reading_value (text)
   - numeric_value (numeric, nullable — for graphing)
   - unit_of_measure (text)
   - recorded_at (timestamptz)

6. `vessel_monitor_alerts` — Active and historical alerts
   - sensor_id (uuid FK to vessel_monitor_sensors, nullable)
   - device_id (uuid FK to vessel_monitor_devices, nullable)
   - yacht_id (uuid FK to yachts)
   - company_id (uuid FK to companies — provider company)
   - alert_type (text: pump_failure, battery_low, battery_critical, device_offline,
     sensor_offline, high_wind, custom)
   - severity (text: info, warning, critical)
   - message (text)
   - is_active (boolean, default true)
   - acknowledged_by (uuid, nullable)
   - acknowledged_at (timestamptz, nullable)
   - resolved_at (timestamptz, nullable)
   - created_at (timestamptz, default now())

## Modified Tables
- `companies` — adds `offers_monitoring` boolean (default false) so companies can
  flag themselves as monitoring providers

## Security (RLS)
- All tables use company-scoped RLS with master bypass
- Master role sees all rows across all companies
- Company users only see rows where company_id matches their company
- Enrollments: provider company OR yacht company can see them
- Sensor readings and alerts: scoped to the provider company_id
- Smart lock sensors remain in the existing yacht_smart_devices table — the new
  monitoring system reads from it but does not duplicate the data

## Important Notes
1. My YachtTime's own company (AZ Marine) should have offers_monitoring set to true
   so it can serve as the default monitoring provider
2. The api_key on vessel_monitor_devices is used by the M5 Tough firmware to
   authenticate telemetry POST requests to the ingestion edge function
3. Readings table will grow large — a future migration should add partitioning
   or a retention policy (e.g., auto-prune readings older than 90 days)
*/

-- Add offers_monitoring to companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'offers_monitoring'
  ) THEN
    ALTER TABLE companies ADD COLUMN offers_monitoring boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Set AZ Marine as a monitoring provider by default
UPDATE companies SET offers_monitoring = true WHERE company_name = 'AZ Marine';

-- ============================================================
-- 1. vessel_monitoring_enrollments
-- ============================================================
CREATE TABLE IF NOT EXISTS vessel_monitoring_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  provider_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  yacht_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  plan_tier text NOT NULL DEFAULT 'standard' CHECK (plan_tier IN ('basic', 'standard', 'premium')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  start_date date,
  end_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vessel_monitoring_enrollments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_enrollments_yacht ON vessel_monitoring_enrollments(yacht_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_provider ON vessel_monitoring_enrollments(provider_company_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_yacht_company ON vessel_monitoring_enrollments(yacht_company_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON vessel_monitoring_enrollments(status);

-- ============================================================
-- 2. vessel_monitor_devices
-- ============================================================
CREATE TABLE IF NOT EXISTS vessel_monitor_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES vessel_monitoring_enrollments(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_serial text UNIQUE NOT NULL,
  device_name text NOT NULL DEFAULT 'M5 Tough',
  firmware_version text,
  api_key text,
  is_online boolean NOT NULL DEFAULT false,
  last_check_in timestamptz,
  installation_date timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vessel_monitor_devices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_monitor_devices_yacht ON vessel_monitor_devices(yacht_id);
CREATE INDEX IF NOT EXISTS idx_monitor_devices_company ON vessel_monitor_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_monitor_devices_online ON vessel_monitor_devices(is_online);

-- ============================================================
-- 3. vessel_monitor_ports
-- ============================================================
CREATE TABLE IF NOT EXISTS vessel_monitor_ports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES vessel_monitor_devices(id) ON DELETE CASCADE,
  port_label text NOT NULL CHECK (port_label IN ('A', 'B', 'C', 'D')),
  port_name text,
  port_type text NOT NULL DEFAULT 'digital' CHECK (port_type IN ('digital', 'analog', 'rs485', 'gpio')),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(device_id, port_label)
);

ALTER TABLE vessel_monitor_ports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_monitor_ports_device ON vessel_monitor_ports(device_id);

-- ============================================================
-- 4. vessel_monitor_sensors
-- ============================================================
CREATE TABLE IF NOT EXISTS vessel_monitor_sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES vessel_monitor_devices(id) ON DELETE CASCADE,
  port_id uuid REFERENCES vessel_monitor_ports(id) ON DELETE SET NULL,
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sensor_type text NOT NULL,
  sensor_name text NOT NULL,
  current_value text,
  unit_of_measure text,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('normal', 'warning', 'critical', 'offline')),
  last_reading_at timestamptz,
  min_threshold numeric,
  max_threshold numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vessel_monitor_sensors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_monitor_sensors_yacht ON vessel_monitor_sensors(yacht_id);
CREATE INDEX IF NOT EXISTS idx_monitor_sensors_company ON vessel_monitor_sensors(company_id);
CREATE INDEX IF NOT EXISTS idx_monitor_sensors_device ON vessel_monitor_sensors(device_id);
CREATE INDEX IF NOT EXISTS idx_monitor_sensors_status ON vessel_monitor_sensors(status);
CREATE INDEX IF NOT EXISTS idx_monitor_sensors_type ON vessel_monitor_sensors(sensor_type);

-- ============================================================
-- 5. vessel_monitor_readings
-- ============================================================
CREATE TABLE IF NOT EXISTS vessel_monitor_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id uuid NOT NULL REFERENCES vessel_monitor_sensors(id) ON DELETE CASCADE,
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reading_value text,
  numeric_value numeric,
  unit_of_measure text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vessel_monitor_readings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_readings_sensor ON vessel_monitor_readings(sensor_id);
CREATE INDEX IF NOT EXISTS idx_readings_yacht ON vessel_monitor_readings(yacht_id);
CREATE INDEX IF NOT EXISTS idx_readings_company ON vessel_monitor_readings(company_id);
CREATE INDEX IF NOT EXISTS idx_readings_recorded ON vessel_monitor_readings(recorded_at DESC);

-- ============================================================
-- 6. vessel_monitor_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS vessel_monitor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id uuid REFERENCES vessel_monitor_sensors(id) ON DELETE SET NULL,
  device_id uuid REFERENCES vessel_monitor_devices(id) ON DELETE SET NULL,
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vessel_monitor_alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_alerts_yacht ON vessel_monitor_alerts(yacht_id);
CREATE INDEX IF NOT EXISTS idx_alerts_company ON vessel_monitor_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON vessel_monitor_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON vessel_monitor_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON vessel_monitor_alerts(created_at DESC);

-- ============================================================
-- RLS POLICIES
-- Master role bypasses company isolation (existing pattern in this project).
-- Company users see only rows matching their company_id.
-- ============================================================

-- Helper: get current user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Enrollments: visible to provider company OR yacht company
DROP POLICY IF EXISTS "select_enrollments" ON vessel_monitoring_enrollments;
CREATE POLICY "select_enrollments"
  ON vessel_monitoring_enrollments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR provider_company_id = public.get_user_company_id()
    OR yacht_company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "insert_enrollments" ON vessel_monitoring_enrollments;
CREATE POLICY "insert_enrollments"
  ON vessel_monitoring_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR provider_company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "update_enrollments" ON vessel_monitoring_enrollments;
CREATE POLICY "update_enrollments"
  ON vessel_monitoring_enrollments FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR provider_company_id = public.get_user_company_id()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR provider_company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "delete_enrollments" ON vessel_monitoring_enrollments;
CREATE POLICY "delete_enrollments"
  ON vessel_monitoring_enrollments FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR provider_company_id = public.get_user_company_id()
  );

-- Devices: company-scoped with master bypass
DROP POLICY IF EXISTS "select_monitor_devices" ON vessel_monitor_devices;
CREATE POLICY "select_monitor_devices"
  ON vessel_monitor_devices FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "insert_monitor_devices" ON vessel_monitor_devices;
CREATE POLICY "insert_monitor_devices"
  ON vessel_monitor_devices FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "update_monitor_devices" ON vessel_monitor_devices;
CREATE POLICY "update_monitor_devices"
  ON vessel_monitor_devices FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "delete_monitor_devices" ON vessel_monitor_devices;
CREATE POLICY "delete_monitor_devices"
  ON vessel_monitor_devices FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

-- Ports: same company scope via device's company_id
DROP POLICY IF EXISTS "select_monitor_ports" ON vessel_monitor_ports;
CREATE POLICY "select_monitor_ports"
  ON vessel_monitor_ports FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR EXISTS (
      SELECT 1 FROM vessel_monitor_devices d
      WHERE d.id = vessel_monitor_ports.device_id
      AND d.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "insert_monitor_ports" ON vessel_monitor_ports;
CREATE POLICY "insert_monitor_ports"
  ON vessel_monitor_ports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR EXISTS (
      SELECT 1 FROM vessel_monitor_devices d
      WHERE d.id = vessel_monitor_ports.device_id
      AND d.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "update_monitor_ports" ON vessel_monitor_ports;
CREATE POLICY "update_monitor_ports"
  ON vessel_monitor_ports FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR EXISTS (
      SELECT 1 FROM vessel_monitor_devices d
      WHERE d.id = vessel_monitor_ports.device_id
      AND d.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR EXISTS (
      SELECT 1 FROM vessel_monitor_devices d
      WHERE d.id = vessel_monitor_ports.device_id
      AND d.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "delete_monitor_ports" ON vessel_monitor_ports;
CREATE POLICY "delete_monitor_ports"
  ON vessel_monitor_ports FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR EXISTS (
      SELECT 1 FROM vessel_monitor_devices d
      WHERE d.id = vessel_monitor_ports.device_id
      AND d.company_id = public.get_user_company_id()
    )
  );

-- Sensors: company-scoped with master bypass
DROP POLICY IF EXISTS "select_monitor_sensors" ON vessel_monitor_sensors;
CREATE POLICY "select_monitor_sensors"
  ON vessel_monitor_sensors FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "insert_monitor_sensors" ON vessel_monitor_sensors;
CREATE POLICY "insert_monitor_sensors"
  ON vessel_monitor_sensors FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "update_monitor_sensors" ON vessel_monitor_sensors;
CREATE POLICY "update_monitor_sensors"
  ON vessel_monitor_sensors FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "delete_monitor_sensors" ON vessel_monitor_sensors;
CREATE POLICY "delete_monitor_sensors"
  ON vessel_monitor_sensors FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

-- Readings: company-scoped with master bypass
DROP POLICY IF EXISTS "select_monitor_readings" ON vessel_monitor_readings;
CREATE POLICY "select_monitor_readings"
  ON vessel_monitor_readings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "insert_monitor_readings" ON vessel_monitor_readings;
CREATE POLICY "insert_monitor_readings"
  ON vessel_monitor_readings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "delete_monitor_readings" ON vessel_monitor_readings;
CREATE POLICY "delete_monitor_readings"
  ON vessel_monitor_readings FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

-- Alerts: company-scoped with master bypass
DROP POLICY IF EXISTS "select_monitor_alerts" ON vessel_monitor_alerts;
CREATE POLICY "select_monitor_alerts"
  ON vessel_monitor_alerts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "insert_monitor_alerts" ON vessel_monitor_alerts;
CREATE POLICY "insert_monitor_alerts"
  ON vessel_monitor_alerts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "update_monitor_alerts" ON vessel_monitor_alerts;
CREATE POLICY "update_monitor_alerts"
  ON vessel_monitor_alerts FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "delete_monitor_alerts" ON vessel_monitor_alerts;
CREATE POLICY "delete_monitor_alerts"
  ON vessel_monitor_alerts FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

-- Enable realtime for monitoring tables
ALTER TABLE vessel_monitor_devices REPLICA IDENTITY FULL;
ALTER TABLE vessel_monitor_sensors REPLICA IDENTITY FULL;
ALTER TABLE vessel_monitor_alerts REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vessel_monitor_devices;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vessel_monitor_sensors;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vessel_monitor_alerts;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
