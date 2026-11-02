/*
# Merge duplicate wind direction sensor rows

1. Problem
- A bug in the vessel monitor telemetry lookup created a new sensor row for every reading
  whenever a duplicate already existed, so one wind direction sensor was stored hundreds of times.

2. Changes
- For each device and sensor name, the oldest sensor row is kept.
- Readings and alerts that point at the duplicate rows are moved to the kept row.
- The duplicate sensor rows are then deleted.

3. Security
- No policy or grant changes.

4. Notes
- No readings or alerts are deleted; only their sensor link is changed.
*/

CREATE TEMP TABLE sensor_keepers ON COMMIT DROP AS
SELECT DISTINCT ON (device_id, sensor_name) id AS keeper_id, device_id, sensor_name
FROM vessel_monitor_sensors
WHERE sensor_name IN ('Wind Direction', 'Wind Vane Direction')
ORDER BY device_id, sensor_name, created_at ASC, id ASC;

CREATE TEMP TABLE sensor_dupes ON COMMIT DROP AS
SELECT s.id AS dupe_id, k.keeper_id
FROM vessel_monitor_sensors s
JOIN sensor_keepers k ON k.device_id = s.device_id AND k.sensor_name = s.sensor_name
WHERE s.id <> k.keeper_id;

UPDATE vessel_monitor_readings r
SET sensor_id = d.keeper_id
FROM sensor_dupes d
WHERE r.sensor_id = d.dupe_id;

UPDATE vessel_monitor_alerts a
SET sensor_id = d.keeper_id
FROM sensor_dupes d
WHERE a.sensor_id = d.dupe_id;

DELETE FROM vessel_monitor_sensors s
USING sensor_dupes d
WHERE s.id = d.dupe_id;
