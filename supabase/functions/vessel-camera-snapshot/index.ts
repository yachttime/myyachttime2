import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Receives a JPEG snapshot from the ORION M5 Tough for one camera and stores it as
// the latest picture for that camera. The firmware POSTs the raw JPEG bytes with:
//   X-Device-Key:  the device api_key (same as telemetry)
//   X-Camera-Slot: 1-8, matching vessel_cameras.camera_slot for this device
//   Content-Type:  image/jpeg

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Key, X-Camera-Slot",
};

const BUCKET = "vessel-camera-snapshots";
const MAX_BYTES = 2 * 1024 * 1024;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const deviceKey = req.headers.get("X-Device-Key");
    if (!deviceKey) {
      return json({ error: "Missing X-Device-Key header" }, 401);
    }

    const slot = Number(req.headers.get("X-Camera-Slot"));
    if (!Number.isInteger(slot) || slot < 1 || slot > 8) {
      return json({ error: "X-Camera-Slot must be 1-8" }, 400);
    }

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      return json({ error: "Snapshot must be a JPEG under 2 MB" }, 400);
    }
    // JPEG files start with FF D8
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return json({ error: "Snapshot is not a JPEG" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: device, error: deviceError } = await supabase
      .from("vessel_monitor_devices")
      .select("id, yacht_id")
      .eq("api_key", deviceKey)
      .maybeSingle();

    if (deviceError || !device) {
      return json({ error: "Invalid device key" }, 401);
    }

    const { data: camera, error: cameraError } = await supabase
      .from("vessel_cameras")
      .select("id, yacht_id, is_enabled")
      .eq("device_id", device.id)
      .eq("camera_slot", slot)
      .maybeSingle();

    if (cameraError || !camera) {
      return json({ error: `No camera registered in slot ${slot} for this device` }, 404);
    }
    if (!camera.is_enabled) {
      return json({ ok: true, skipped: "camera disabled" }, 200);
    }

    const path = `${camera.yacht_id}/${camera.id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true, cacheControl: "0" });

    if (uploadError) {
      console.error("[vessel-camera-snapshot] upload failed:", uploadError.message);
      return json({ error: "Unable to store snapshot" }, 500);
    }

    const now = new Date().toISOString();
    await supabase
      .from("vessel_cameras")
      .update({ last_snapshot_path: path, last_snapshot_at: now, updated_at: now })
      .eq("id", camera.id);

    return json({ ok: true, camera_id: camera.id, received_at: now }, 200);
  } catch (err) {
    console.error("[vessel-camera-snapshot] error:", err);
    return json({ error: "Unable to process snapshot" }, 500);
  }
});
