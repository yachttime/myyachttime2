/*
# Add device_type and GPS columns to vessel_monitor_devices

## Overview
Extends the vessel monitoring device table to distinguish ORION Tough units
from weather stations, store the latest GPS position on the device record for
fast dashboard display, and add a wifi_synced_at timestamp to track when the
device last received updated WiFi credentials.

## Modified Tables
1. `vessel_monitor_devices`
   - `device_type` (text: 'orion_tough' or 'weather_station', default 'orion_tough')
     — Identifies which firmware/hardware type this device is
   - `gps_lat` (double precision, nullable) — Latest GPS latitude from the device
   - `gps_lng` (double precision, nullable) — Latest GPS longitude from the device
   - `gps_updated_at` (timestamptz, nullable) — When the GPS position was last updated
   - `wifi_synced_at` (timestamptz, nullable) — When the device last received WiFi config
   - `key_replaced_at` (timestamptz, nullable) — When the API key was last replaced

## Important Notes
- One yacht gets exactly one orion_tough and one weather_station device
- The device_type is used by the dashboard to generate the correct firmware file
- GPS columns are updated by the telemetry edge function when GPS readings arrive
- The unique constraint on device_serial remains — each physical unit has one record
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_monitor_devices' AND column_name = 'device_type'
  ) THEN
    ALTER TABLE vessel_monitor_devices ADD COLUMN device_type text NOT NULL DEFAULT 'orion_tough'
      CHECK (device_type IN ('orion_tough', 'weather_station'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_monitor_devices' AND column_name = 'gps_lat'
  ) THEN
    ALTER TABLE vessel_monitor_devices ADD COLUMN gps_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_monitor_devices' AND column_name = 'gps_lng'
  ) THEN
    ALTER TABLE vessel_monitor_devices ADD COLUMN gps_lng double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_monitor_devices' AND column_name = 'gps_updated_at'
  ) THEN
    ALTER TABLE vessel_monitor_devices ADD COLUMN gps_updated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_monitor_devices' AND column_name = 'wifi_synced_at'
  ) THEN
    ALTER TABLE vessel_monitor_devices ADD COLUMN wifi_synced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessel_monitor_devices' AND column_name = 'key_replaced_at'
  ) THEN
    ALTER TABLE vessel_monitor_devices ADD COLUMN key_replaced_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monitor_devices_type ON vessel_monitor_devices(device_type);
