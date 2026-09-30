import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const deviceKey = req.headers.get("X-Device-Key");
    if (!deviceKey) {
      return new Response(JSON.stringify({ error: "Device authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const deviceSerial = typeof body?.device_serial === "string" ? body.device_serial.trim() : "";
    if (!deviceSerial) {
      return new Response(JSON.stringify({ error: "Device serial required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: device, error } = await supabase
      .from("vessel_monitor_devices")
      .select("device_serial, yachts(name, wifi_name, wifi_password)")
      .eq("api_key", deviceKey)
      .eq("device_serial", deviceSerial)
      .maybeSingle();

    if (error || !device) {
      return new Response(JSON.stringify({ error: "Invalid device credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const yacht = Array.isArray(device.yachts) ? device.yachts[0] : device.yachts;
    if (!yacht?.wifi_name) {
      return new Response(JSON.stringify({ wifi_configured: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      wifi_configured: true,
      wifi_ssid: yacht.wifi_name,
      wifi_password: yacht.wifi_password || "",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to retrieve device configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
