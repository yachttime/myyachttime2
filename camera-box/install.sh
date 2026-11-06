#!/usr/bin/env bash
# MyYachtTime camera box installer (Raspberry Pi 5, Raspberry Pi OS Lite 64-bit).
#
# Installs go2rtc, which turns the boat's camera feeds into WebRTC video the
# MyYachtTime tablet screen can play live, and cloudflared, which gives the box
# a secure https address so the tablet page can reach it.
#
# Run on the Pi:  sudo bash install.sh
set -euo pipefail

GO2RTC_VERSION="v1.9.15"
GO2RTC_URL="https://github.com/AlexxIT/go2rtc/releases/download/${GO2RTC_VERSION}/go2rtc_linux_arm64"
CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb"
CONFIG_DIR=/etc/go2rtc
CONFIG_FILE="${CONFIG_DIR}/go2rtc.yaml"

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo: sudo bash install.sh" >&2
  exit 1
fi

echo "== MyYachtTime camera box setup =="
read -rp "Camera login user name [admin]: " CAM_USER
CAM_USER=${CAM_USER:-admin}
read -rsp "Camera login password: " CAM_PASS
echo
read -rp "Camera IP addresses, in slot order, separated by spaces (e.g. 192.168.1.201 192.168.1.202): " -a CAM_IPS
if [[ ${#CAM_IPS[@]} -eq 0 ]]; then
  echo "At least one camera IP is needed." >&2
  exit 1
fi
read -rp "Box web address from Cloudflare (e.g. orion.myyachttime-cams.com): " PUBLIC_HOST
read -rp "Cloudflare tunnel token (long text from the Cloudflare dashboard): " TUNNEL_TOKEN

# Keep the secret path if the box was set up before, so saved live URLs keep working
SECRET=""
if [[ -f "$CONFIG_FILE" ]]; then
  SECRET=$(grep -oP 'base_path:\s*"/\K[A-Za-z0-9]+' "$CONFIG_FILE" || true)
fi
SECRET=${SECRET:-$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)}

# The Pi's own address on the boat network. WebRTC must advertise it or the
# fast live view stays on "loading" (found in the office test).
LAN_IP=$(hostname -I | tr ' ' '\n' | grep -E '^[0-9]+\.' | head -n1)
if [[ -z "$LAN_IP" ]]; then
  echo "Could not find this Pi's network address. Is the ethernet cable plugged in?" >&2
  exit 1
fi

# URL-encode the password for the RTSP address
CAM_PASS_ENC=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$CAM_PASS")

echo "== Installing go2rtc ${GO2RTC_VERSION} =="
curl -fsSL "$GO2RTC_URL" -o /usr/local/bin/go2rtc
chmod 755 /usr/local/bin/go2rtc

mkdir -p "$CONFIG_DIR"
{
  echo "# Written by camera-box/install.sh. Contains the camera password: keep private."
  echo "api:"
  echo "  listen: \"127.0.0.1:1984\"   # only reachable through the Cloudflare tunnel"
  echo "  base_path: \"/${SECRET}\"     # secret path; the live URLs include it"
  echo "  origin: \"*\"                 # allow the MyYachtTime site to connect"
  echo "rtsp:"
  echo "  listen: \"\"                  # not needed"
  echo "webrtc:"
  echo "  listen: \":8555\"             # video goes straight to tablets on the boat WiFi"
  echo "  candidates:"
  echo "    - ${LAN_IP}:8555"
  echo "streams:"
  slot=1
  for ip in "${CAM_IPS[@]}"; do
    # Uniview sub stream (640x360 H.264): low delay and plays in every browser
    echo "  cam${slot}: rtsp://${CAM_USER}:${CAM_PASS_ENC}@${ip}:554/media/video2"
    slot=$((slot + 1))
  done
} > "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

cat > /etc/systemd/system/go2rtc.service <<UNIT
[Unit]
Description=go2rtc camera video for MyYachtTime
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/go2rtc -config ${CONFIG_FILE}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now go2rtc
systemctl restart go2rtc

echo "== Installing Cloudflare tunnel =="
if ! command -v cloudflared >/dev/null; then
  curl -fsSL "$CLOUDFLARED_URL" -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
fi
cloudflared service uninstall >/dev/null 2>&1 || true
cloudflared service install "$TUNNEL_TOKEN"

echo
echo "== Done =="
echo "Paste these into MyYachtTime (vessel_cameras.live_url), one per camera slot:"
slot=1
for ip in "${CAM_IPS[@]}"; do
  echo "  slot ${slot} (${ip}): https://${PUBLIC_HOST}/${SECRET}/api/webrtc?src=cam${slot}"
  slot=$((slot + 1))
done
echo
echo "Check status any time with: systemctl status go2rtc cloudflared"
