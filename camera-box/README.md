# MyYachtTime camera box (live view)

One Raspberry Pi 5 per boat, plugged into the Starlink router. It turns the camera feeds into live video that the **Security Cameras** tab on the helm tablet plays, with well under a second of delay, so the cameras can be used for blind spots.

```
Uniview cameras ──RTSP──► Pi 5 (go2rtc) ──WebRTC video, boat WiFi──► Galaxy tablet
                               │
                               └─ Cloudflare tunnel (https) ◄── tablet page connects here
```

The tablet page connects to the box through a secure https address (Cloudflare tunnel), because a web page served over https can't talk to a plain local address. The video itself then goes straight from the box to the tablet over the boat's WiFi, so it is fast and uses no Starlink data.

**Internet note:** the tablet page and the connection step need the internet. Once a camera is playing it keeps playing over the boat's WiFi through a short Starlink drop, but a reconnect waits for the internet to come back. The minute-by-minute snapshots stay as the fallback.

**Remote note:** live view works on the boat's network. From the office or a phone the tab shows the snapshots. Live view off the boat needs a relay server, which can be added later.

## Parts (office test)

- Raspberry Pi 5, 4 GB (SC1111)
- Raspberry Pi Active Cooler (SC1148)
- Raspberry Pi 27W USB-C power supply (SC1157); on the boat, a 12V to 5V 5A USB-C converter instead
- SanDisk High Endurance 64 GB microSD (SDSQQNR-064G-GN6IA)
- Short ethernet cable to the router

## One-time Cloudflare setup (per boat)

Uses a camera-only domain registered in Cloudflare (for example myyachttime-cams.com), so the main myyachttime.com at GoDaddy is never touched.

1. In the Cloudflare dashboard go to **Zero Trust → Networks → Tunnels → Create a tunnel** (Cloudflared). Name it after the boat, e.g. `orion-cams`.
2. Copy the tunnel **token** shown in the install command.
3. Add a **public hostname**: `orion.myyachttime-cams.com`, **Path** `^/.+/api/webrtc$`, service `HTTP` → `localhost:1984`.
   The path limit matters: it lets only the live video requests through, so the box's settings page and API can't be reached from the internet.

## Setting up the Pi

1. With **Raspberry Pi Imager**, write **Raspberry Pi OS Lite (64-bit)** to the card. In the settings, set the hostname (e.g. `orion-cams`), a user and password, and turn on SSH.
2. Put the card in the Pi, connect ethernet to the router and power it on.
3. Give the Pi a fixed address in the router (DHCP reservation), because the live view uses it; if it changes, run the installer again, then from a computer on the same network: `ssh <user>@orion-cams.local`
4. Copy `install.sh` to the Pi and run `sudo bash install.sh`. It asks for the camera login, the camera IPs in slot order, the box web address and the tunnel token.
5. It prints one live URL per camera. Save each into `vessel_cameras.live_url` for that camera slot:

```sql
UPDATE vessel_cameras SET live_url = 'https://orion.myyachttime-cams.com/<secret>/api/webrtc?src=cam1'
WHERE device_id = (SELECT id FROM vessel_monitor_devices WHERE device_serial = '<m5-serial>') AND camera_slot = 1;
```

The camera tiles then show **LIVE** in green. If live view drops, the tile shows the latest snapshot and reconnects on its own.

## Camera settings

- Live view uses the camera's **sub stream** (`/media/video2`), which must be **H.264**. Browsers can't play H.265.
- Keep the sub stream at 640x360 or 720p, 15 to 20 fps, for the lowest delay.
- For cameras used for steering, prefer the wired (PoE) version of the dome: WiFi in a busy marina can stutter.

## Checking it

- `systemctl status go2rtc cloudflared` on the Pi shows both running.
- On the Pi, `curl -s http://127.0.0.1:1984/<secret>/api/streams` lists the cameras go2rtc can reach.
- The live URLs include the box's secret path. They are only readable by people who can already see that yacht's cameras, but don't post them anywhere.
