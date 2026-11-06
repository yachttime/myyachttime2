/*
# Live view for vessel cameras

Adds `vessel_cameras.live_url`: the WHEP (WebRTC) address of this camera on the
boat's go2rtc video box, for example
`https://orion-cams.example.com/<secret>/api/webrtc?src=cam1`.

When set, the camera wall plays live video from the box instead of the minute-by-minute
snapshot. The snapshot stays as the fallback. The URL contains the box's secret path, so
it is only readable by users who can already see the camera (existing RLS).
*/

ALTER TABLE vessel_cameras ADD COLUMN IF NOT EXISTS live_url text;
