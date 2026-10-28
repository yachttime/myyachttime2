# Vessel Cameras (Helm Tablet Camera Wall)

The camera wall shows the latest snapshot from each camera on a yacht, refreshing every 15 seconds. It is built for the Galaxy Tab Active helm tablets (landscape, kiosk mode) but works in any browser.

## How it works

1. The ORION M5 Tough on the boat fetches a JPEG from each Uniview dome on the boat's network (`http://<camera-ip>/images/snapshot.jpg`).
2. It POSTs the JPEG to the `vessel-camera-snapshot` edge function.
3. The function overwrites `<yacht_id>/<camera_id>.jpg` in the private `vessel-camera-snapshots` bucket and updates `vessel_cameras.last_snapshot_at`.
4. The camera wall (`src/components/CameraWall.tsx`) reads `vessel_cameras` and shows signed URLs for the snapshots.

Only the newest picture per camera is kept. There is no history.

## Setup

1. Apply the migration `20261028210000_create_vessel_cameras.sql` and deploy the `vessel-camera-snapshot` function (`verify_jwt = false`, it authenticates with the device key).
2. Register each camera against the yacht's M5 Tough:

```sql
INSERT INTO vessel_cameras (yacht_id, company_id, device_id, camera_slot, camera_name, camera_ip, sort_order)
SELECT d.yacht_id, d.company_id, d.id, 1, 'Aft Deck', '192.168.1.50', 1
FROM vessel_monitor_devices d
WHERE d.device_serial = '<m5-serial>';
```

3. Create a login for each helm tablet: an owner-role user with `yacht_id` set to the yacht, then set `camera_only = true` on its `user_profiles` row. That login only ever sees the camera wall.
4. On the tablet, sign in at www.myyachttime.com, tap the full screen button, and lock the tablet to the browser with Samsung's app pinning or Knox kiosk mode.

Staff and owners with a normal login can open the same screen at `/cameras`.

## Firmware upload contract

```
POST https://eqiecntollhgfxmmbize.supabase.co/functions/v1/vessel-camera-snapshot
X-Device-Key: <device api_key>
X-Camera-Slot: <1-8, matches vessel_cameras.camera_slot>
Content-Type: image/jpeg

<raw JPEG bytes, under 2 MB>
```

Use the camera's 640x360 substream snapshot if the full 1080p picture is too slow over the boat's connection.
