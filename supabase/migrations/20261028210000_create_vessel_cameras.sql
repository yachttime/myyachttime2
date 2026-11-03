/*
# Vessel Cameras (helm tablet camera wall)

## Overview
Stores the IP cameras on each yacht (Uniview IPC322LB-AF28WK-G domes) and the latest
JPEG snapshot from each one. The ORION M5 Tough on the boat fetches a snapshot from
each camera on the local network and POSTs it to the `vessel-camera-snapshot` edge
function, which overwrites `<yacht_id>/<camera_id>.jpg` in a private bucket.

## New Tables
1. `vessel_cameras`
   - yacht_id, company_id (provider company, same as vessel_monitor_devices)
   - device_id (the M5 Tough that uploads this camera's snapshots)
   - camera_slot (1-8, the number the firmware sends in X-Camera-Slot)
   - camera_name (e.g. 'Aft Deck'), camera_ip (local IP, for firmware config)
   - sort_order, is_enabled
   - last_snapshot_path, last_snapshot_at

## Modified Tables
- `user_profiles.camera_only` (boolean, default false). When true the app shows only
  the camera wall for that user. Used for the helm tablet logins (an owner-role
  account tied to the yacht).

## Storage
- Private bucket `vessel-camera-snapshots`, JPEG only, 2 MB max per file.
  Only the edge function (service role) writes. Users can read a snapshot when they
  can see a camera row for that yacht.

## Security (RLS)
- Read: master, the provider company, or a user whose profile yacht_id is the yacht.
- Write: master or the provider company.
*/

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS camera_only boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS vessel_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id uuid REFERENCES vessel_monitor_devices(id) ON DELETE SET NULL,
  camera_slot integer NOT NULL CHECK (camera_slot BETWEEN 1 AND 8),
  camera_name text NOT NULL,
  camera_ip text,
  sort_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  last_snapshot_path text,
  last_snapshot_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, camera_slot)
);

ALTER TABLE vessel_cameras ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vessel_cameras_yacht ON vessel_cameras(yacht_id);
CREATE INDEX IF NOT EXISTS idx_vessel_cameras_company ON vessel_cameras(company_id);

DROP POLICY IF EXISTS "select_vessel_cameras" ON vessel_cameras;
CREATE POLICY "select_vessel_cameras"
  ON vessel_cameras FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.yacht_id = vessel_cameras.yacht_id
    )
  );

DROP POLICY IF EXISTS "insert_vessel_cameras" ON vessel_cameras;
CREATE POLICY "insert_vessel_cameras"
  ON vessel_cameras FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "update_vessel_cameras" ON vessel_cameras;
CREATE POLICY "update_vessel_cameras"
  ON vessel_cameras FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "delete_vessel_cameras" ON vessel_cameras;
CREATE POLICY "delete_vessel_cameras"
  ON vessel_cameras FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = auth.uid() AND up.role = 'master')
    OR company_id = public.get_user_company_id()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON vessel_cameras TO authenticated;

-- Snapshot bucket (private; written only by the edge function)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vessel-camera-snapshots', 'vessel-camera-snapshots', false, 2097152, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Readable when the user can see a camera on that yacht (vessel_cameras RLS applies)
DROP POLICY IF EXISTS "View vessel camera snapshots" ON storage.objects;
CREATE POLICY "View vessel camera snapshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vessel-camera-snapshots'
    AND EXISTS (
      SELECT 1 FROM vessel_cameras c
      WHERE c.yacht_id::text = (storage.foldername(name))[1]
    )
  );
