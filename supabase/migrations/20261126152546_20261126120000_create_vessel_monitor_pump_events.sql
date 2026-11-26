/*
# Create vessel pump run history

1. Plain-English explanation
- Adds a durable history of each monitored pump run.
- A run begins when telemetry reports a pump turning on and ends when telemetry reports it turning off.
- The existing raw sensor readings remain unchanged and continue to provide the underlying audit trail.

2. New table
- `vessel_monitor_pump_events`
- `id` — unique event identifier.
- `sensor_id` — the pump sensor that produced the event.
- `device_id` — the monitoring device that reported the event.
- `yacht_id` — the yacht where the pump is installed.
- `company_id` — the monitoring company scope.
- `started_at` — time the pump was reported on.
- `ended_at` — time the pump was reported off; null while the run is open.
- `duration_seconds` — calculated runtime for completed events.
- `created_at` — time the event record was created.

3. Security
- Enables row-level security.
- Masters can read all pump events.
- Managers can read pump events only for their assigned yacht.
- Other authenticated monitoring users can read events for their company.
- The telemetry service role can create and close events; browser users receive read access only.
- Adds four separate CRUD policies as required by the monitoring access model.

4. Important notes
- A unique partial index allows only one open event per pump.
- Existing on/off readings are converted into historical events where a complete start or stop pair can be identified.
- Runs with missing start or stop information are not guessed or fabricated.
- The table is added to realtime so the dashboard can refresh when a pump starts or stops.
*/

CREATE TABLE IF NOT EXISTS vessel_monitor_pump_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id uuid NOT NULL REFERENCES vessel_monitor_sensors(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES vessel_monitor_devices(id) ON DELETE CASCADE,
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vessel_monitor_pump_events_duration_check CHECK (
    (ended_at IS NULL AND duration_seconds IS NULL)
    OR (ended_at IS NOT NULL AND duration_seconds IS NOT NULL AND duration_seconds >= 0)
  )
);

ALTER TABLE vessel_monitor_pump_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pump_events_yacht_started
  ON vessel_monitor_pump_events(yacht_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pump_events_sensor_started
  ON vessel_monitor_pump_events(sensor_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pump_events_one_open_per_sensor
  ON vessel_monitor_pump_events(sensor_id)
  WHERE ended_at IS NULL;

GRANT SELECT ON vessel_monitor_pump_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON vessel_monitor_pump_events TO service_role;

DROP POLICY IF EXISTS "select_monitor_pump_events" ON vessel_monitor_pump_events;
CREATE POLICY "select_monitor_pump_events"
  ON vessel_monitor_pump_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'master'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.user_id = auth.uid() AND up.role = 'manager'
      )
      AND yacht_id = public.get_user_manager_yacht_id()
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.user_id = auth.uid() AND up.role = 'manager'
      )
      AND company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "insert_monitor_pump_events" ON vessel_monitor_pump_events;
CREATE POLICY "insert_monitor_pump_events"
  ON vessel_monitor_pump_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'master'
    )
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "update_monitor_pump_events" ON vessel_monitor_pump_events;
CREATE POLICY "update_monitor_pump_events"
  ON vessel_monitor_pump_events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'master'
    )
    OR company_id = public.get_user_company_id()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'master'
    )
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "delete_monitor_pump_events" ON vessel_monitor_pump_events;
CREATE POLICY "delete_monitor_pump_events"
  ON vessel_monitor_pump_events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'master'
    )
    OR company_id = public.get_user_company_id()
  );

WITH pump_readings AS (
  SELECT
    r.sensor_id,
    r.yacht_id,
    r.company_id,
    r.recorded_at,
    lower(trim(r.reading_value)) IN ('active', 'on', 'true', '1') AS is_on,
    lower(trim(r.reading_value)) IN ('inactive', 'off', 'false', '0') AS is_off
  FROM vessel_monitor_readings r
  JOIN vessel_monitor_sensors s ON s.id = r.sensor_id
  WHERE s.sensor_type IN ('bilge_pump', 'water_pump', 'ac_pump')
    AND lower(trim(r.reading_value)) IN ('active', 'on', 'true', '1', 'inactive', 'off', 'false', '0')
), ordered_readings AS (
  SELECT
    pr.*,
    lag(pr.is_on) OVER (PARTITION BY pr.sensor_id ORDER BY pr.recorded_at) AS previous_is_on
  FROM pump_readings pr
), pump_starts AS (
  SELECT sensor_id, yacht_id, company_id, recorded_at AS started_at
  FROM ordered_readings
  WHERE is_on AND coalesce(previous_is_on, false) = false
), paired_events AS (
  SELECT
    ps.sensor_id,
    s.device_id,
    ps.yacht_id,
    ps.company_id,
    ps.started_at,
    stop_event.recorded_at AS ended_at
  FROM pump_starts ps
  JOIN vessel_monitor_sensors s ON s.id = ps.sensor_id
  LEFT JOIN LATERAL (
    SELECT pr.recorded_at
    FROM pump_readings pr
    WHERE pr.sensor_id = ps.sensor_id
      AND pr.is_off
      AND pr.recorded_at > ps.started_at
    ORDER BY pr.recorded_at
    LIMIT 1
  ) stop_event ON true
)
INSERT INTO vessel_monitor_pump_events (
  sensor_id,
  device_id,
  yacht_id,
  company_id,
  started_at,
  ended_at,
  duration_seconds
)
SELECT
  pe.sensor_id,
  pe.device_id,
  pe.yacht_id,
  pe.company_id,
  pe.started_at,
  pe.ended_at,
  CASE
    WHEN pe.ended_at IS NULL THEN NULL
    ELSE greatest(0, extract(epoch FROM (pe.ended_at - pe.started_at))::integer)
  END
FROM paired_events pe
WHERE NOT EXISTS (
  SELECT 1
  FROM vessel_monitor_pump_events existing
  WHERE existing.sensor_id = pe.sensor_id
    AND existing.started_at = pe.started_at
);

ALTER TABLE vessel_monitor_pump_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vessel_monitor_pump_events;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;