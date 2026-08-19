import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Key",
};

interface TelemetryPayload {
  device_serial: string;
  firmware_version?: string;
  timestamp?: string;
  ports: {
    port: string;
    sensors: {
      sensor_type: string;
      sensor_name: string;
      value: string;
      numeric_value?: number;
      unit_of_measure?: string;
      status?: "normal" | "warning" | "critical" | "offline";
    }[];
  }[];
}

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
      return new Response(JSON.stringify({ error: "Missing X-Device-Key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the device by api_key, join yacht to get WiFi credentials
    const { data: device, error: deviceError } = await supabase
      .from("vessel_monitor_devices")
      .select("id, yacht_id, company_id, device_serial, api_key, yachts(wifi_name, wifi_password)")
      .eq("api_key", deviceKey)
      .maybeSingle();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: "Invalid device key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: TelemetryPayload = await req.json();

    if (body.device_serial !== device.device_serial) {
      return new Response(JSON.stringify({ error: "Device serial mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = body.timestamp || new Date().toISOString();

    // Update device online status and last check-in
    await supabase
      .from("vessel_monitor_devices")
      .update({
        is_online: true,
        last_check_in: now,
        firmware_version: body.firmware_version || undefined,
        updated_at: now,
      })
      .eq("id", device.id);

    // Process each port's sensors
    const readingsToInsert: any[] = [];
    const alertsToInsert: any[] = [];

    for (const portData of body.ports || []) {
      for (const sensorData of portData.sensors || []) {
        // Find existing sensor by device_id + sensor_name
        const { data: existingSensor } = await supabase
          .from("vessel_monitor_sensors")
          .select("id, min_threshold, max_threshold")
          .eq("device_id", device.id)
          .eq("sensor_name", sensorData.sensor_name)
          .maybeSingle();

        let sensorId = existingSensor?.id;
        const sensorStatus = sensorData.status || "normal";

        if (!sensorId) {
          // Auto-create the sensor if it doesn't exist
          // Find or create the port
          let { data: port } = await supabase
            .from("vessel_monitor_ports")
            .select("id")
            .eq("device_id", device.id)
            .eq("port_label", portData.port)
            .maybeSingle();

          if (!port) {
            const portNameMap: Record<string, string> = {
              A: "Pumps",
              B: "Batteries & Engine",
              C: "GPS",
              D: "Anemometer / Wind",
            };
            const portTypeMap: Record<string, string> = {
              A: "digital",
              B: "analog",
              C: "rs485",
              D: "gpio",
            };
            const { data: newPort } = await supabase
              .from("vessel_monitor_ports")
              .insert({
                device_id: device.id,
                port_label: portData.port,
                port_name: portNameMap[portData.port] || `Port ${portData.port}`,
                port_type: portTypeMap[portData.port] || "digital",
              })
              .select()
              .single();
            port = newPort;
          }

          const { data: newSensor } = await supabase
            .from("vessel_monitor_sensors")
            .insert({
              device_id: device.id,
              port_id: port?.id || null,
              yacht_id: device.yacht_id,
              company_id: device.company_id,
              sensor_type: sensorData.sensor_type,
              sensor_name: sensorData.sensor_name,
              current_value: sensorData.value,
              unit_of_measure: sensorData.unit_of_measure || null,
              status: sensorStatus,
              last_reading_at: now,
            })
            .select()
            .single();
          sensorId = newSensor?.id;
        } else {
          // Update existing sensor
          await supabase
            .from("vessel_monitor_sensors")
            .update({
              current_value: sensorData.value,
              unit_of_measure: sensorData.unit_of_measure || undefined,
              status: sensorStatus,
              last_reading_at: now,
              updated_at: now,
            })
            .eq("id", sensorId);
        }

        if (sensorId) {
          readingsToInsert.push({
            sensor_id: sensorId,
            yacht_id: device.yacht_id,
            company_id: device.company_id,
            reading_value: sensorData.value,
            numeric_value: sensorData.numeric_value || null,
            unit_of_measure: sensorData.unit_of_measure || null,
            recorded_at: now,
          });

          // Check thresholds for alerts
          if (existingSensor && sensorData.numeric_value !== undefined) {
            const min = existingSensor.min_threshold;
            const max = existingSensor.max_threshold;
            if (max !== null && sensorData.numeric_value > max) {
              alertsToInsert.push({
                sensor_id: sensorId,
                device_id: device.id,
                yacht_id: device.yacht_id,
                company_id: device.company_id,
                alert_type: "threshold_exceeded",
                severity: "critical",
                message: `${sensorData.sensor_name} reading ${sensorData.numeric_value} ${sensorData.unit_of_measure || ""} exceeded max threshold ${max}`,
              });
            } else if (min !== null && sensorData.numeric_value < min) {
              alertsToInsert.push({
                sensor_id: sensorId,
                device_id: device.id,
                yacht_id: device.yacht_id,
                company_id: device.company_id,
                alert_type: "threshold_below",
                severity: "warning",
                message: `${sensorData.sensor_name} reading ${sensorData.numeric_value} ${sensorData.unit_of_measure || ""} below min threshold ${min}`,
              });
            }
          }

          // Auto-alert on critical/offline sensor status
          if (sensorStatus === "critical") {
            alertsToInsert.push({
              sensor_id: sensorId,
              device_id: device.id,
              yacht_id: device.yacht_id,
              company_id: device.company_id,
              alert_type: "sensor_critical",
              severity: "critical",
              message: `${sensorData.sensor_name} reported critical status: ${sensorData.value}`,
            });
          } else if (sensorStatus === "offline") {
            alertsToInsert.push({
              sensor_id: sensorId,
              device_id: device.id,
              yacht_id: device.yacht_id,
              company_id: device.company_id,
              alert_type: "sensor_offline",
              severity: "warning",
              message: `${sensorData.sensor_name} went offline`,
            });
          }
        }
      }
    }

    // Batch insert readings
    if (readingsToInsert.length > 0) {
      await supabase.from("vessel_monitor_readings").insert(readingsToInsert);
    }

    // Insert alerts (check for existing active alert to avoid duplicates)
    if (alertsToInsert.length > 0) {
      for (const alert of alertsToInsert) {
        // Only insert if there isn't already an active alert for this sensor+type
        const { data: existing } = await supabase
          .from("vessel_monitor_alerts")
          .select("id")
          .eq("sensor_id", alert.sensor_id)
          .eq("alert_type", alert.alert_type)
          .eq("is_active", true)
          .maybeSingle();

        if (!existing) {
          await supabase.from("vessel_monitor_alerts").insert(alert);
        }
      }
    }

    // Include the yacht's current WiFi credentials so the firmware can
    // auto-update its SD-stored config when the dashboard changes them.
    // The firmware compares these against what it has on SD and rewrites
    // the config file + reconnects WiFi when they differ.
    const yachtWifi = (device as any)?.yachts;

    return new Response(
      JSON.stringify({
        success: true,
        readings: readingsToInsert.length,
        alerts: alertsToInsert.length,
        wifi: yachtWifi ? {
          ssid: yachtWifi.wifi_name || null,
          password: yachtWifi.wifi_password || null,
        } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
