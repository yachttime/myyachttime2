import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Key",
};

// Map sensor_name strings from the firmware to sensor_type in the database.
// Both the Tough and weather station firmware send sensor_name as free text;
// this lookup resolves the correct category for the readings table.
const SENSOR_NAME_TO_TYPE: Record<string, string> = {
  "Engine Room Starboard Bilge Pump": "bilge_pump",
  "Aft Bilge Pump": "bilge_pump",
  "Midship Bilge Pump": "bilge_pump",
  "High Water Alarm": "bilge_pump",
  "A/C Water Pump": "ac_pump",
  "Fresh Water Pump": "water_pump",
  "Port Engine Battery": "battery_bank",
  "Starboard Engine Battery": "battery_bank",
  "Port Generator Battery": "battery_bank",
  "Starboard Generator Battery": "battery_bank",
  "Inverter Batteries": "battery_bank",
  "12V System Battery": "battery_bank",
  "Port Engine Alternator": "engine_alternator",
  "Starboard Engine Alternator": "engine_alternator",
  "Port Generator Alternator": "engine_alternator",
  "Starboard Generator Alternator": "engine_alternator",
  "Wind Vane Direction": "wind_vane",
  "Wind Speed": "anemometer",
  "Wind Direction": "wind_vane",
  "Rainfall": "environment",
  "Atmospheric": "environment",
  "Lightning Strike": "environment",
};

interface PortSensor {
  sensor_type?: string;
  sensor_name: string;
  value: string;
  numeric_value?: number;
  unit_of_measure?: string;
  status?: "normal" | "warning" | "critical" | "offline";
}

interface PortData {
  port: string;
  sensors: PortSensor[];
}

interface TelemetryPayload {
  device_serial: string;
  firmware_version?: string;
  timestamp?: string;
  // New flat format from ORION Tough + weather station firmware
  data?: {
    sensor_name?: string;
    value?: any;
    lat?: number;
    lng?: number;
    speed_mph?: number;
    heading_deg?: number;
    direction?: string;
    raw_volts?: number;
    voltage?: number;
    current?: number;
    active?: boolean;
    mph?: number;
    deg?: number;
    mm?: number;
    temp_f?: number;
    humidity_pct?: number;
    pressure_pa?: number;
    distance_km?: number;
  };
  // Legacy ports format (kept for backward compatibility)
  ports?: PortData[];
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
      .select("id, yacht_id, company_id, device_serial, device_type, api_key, yachts(wifi_name, wifi_password)")
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
    const deviceUpdate: Record<string, any> = {
      is_online: true,
      last_check_in: now,
      updated_at: now,
    };
    if (body.firmware_version) {
      deviceUpdate.firmware_version = body.firmware_version;
    }

    await supabase
      .from("vessel_monitor_devices")
      .update(deviceUpdate)
      .eq("id", device.id);

    const readingsToInsert: any[] = [];
    const alertsToInsert: any[] = [];
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;

    // ---- Process flat "data" format (new firmware) ----
    if (body.data) {
      const d = body.data;

      // GPS reading — store on device record for fast dashboard access
      if (d.lat !== undefined && d.lng !== undefined) {
        gpsLat = d.lat;
        gpsLng = d.lng;
        await supabase
          .from("vessel_monitor_devices")
          .update({
            gps_lat: d.lat,
            gps_lng: d.lng,
            gps_updated_at: now,
          })
          .eq("id", device.id);

        const gpsSensor = await upsertSensor(supabase, device, "gps", "GPS Location", `${d.lat},${d.lng}`, "coords", now);
        if (gpsSensor) {
          readingsToInsert.push({
            sensor_id: gpsSensor,
            yacht_id: device.yacht_id,
            company_id: device.company_id,
            reading_value: `${d.lat},${d.lng}`,
            numeric_value: null,
            unit_of_measure: "coords",
            recorded_at: now,
          });
          if (d.speed_mph !== undefined) {
            readingsToInsert.push({
              sensor_id: gpsSensor,
              yacht_id: device.yacht_id,
              company_id: device.company_id,
              reading_value: String(d.speed_mph),
              numeric_value: d.speed_mph,
              unit_of_measure: "mph",
              recorded_at: now,
            });
          }
        }
      }

      // Sensor reading with sensor_name + value object
      if (d.sensor_name) {
        const sensorName = d.sensor_name;
        const sensorType = SENSOR_NAME_TO_TYPE[sensorName] || inferSensorType(sensorName);
        let valueStr = "";
        let numericVal: number | null = null;
        let unit = "";
        let status: "normal" | "warning" | "critical" | "offline" = "normal";

        const nestedValue = d.value && typeof d.value === "object" && !Array.isArray(d.value)
          ? d.value as Record<string, unknown>
          : null;

        if (sensorName === "Lightning Strike" && typeof nestedValue?.status === "string") {
          valueStr = JSON.stringify(nestedValue);
          unit = "status";
          if (typeof nestedValue.distance_km === "number") numericVal = nestedValue.distance_km;
          status = nestedValue.status === "Strike detected" ? "critical" : "normal";
        } else if (d.active !== undefined) {
          valueStr = d.active ? "active" : "inactive";
          unit = "on/off";
          if (sensorName.includes("Alarm") && d.active) status = "critical";
        } else if (d.voltage !== undefined && d.current !== undefined) {
          valueStr = `${d.voltage}V / ${d.current}A`;
          numericVal = d.voltage;
          unit = "V/A";
          if (d.voltage < 11.5) status = "critical";
          else if (d.voltage < 12.2) status = "warning";
        } else if (d.voltage !== undefined) {
          valueStr = String(d.voltage);
          numericVal = d.voltage;
          unit = "V";
          if (d.voltage < 11.5) status = "critical";
          else if (d.voltage < 12.2) status = "warning";
        } else if (d.current !== undefined) {
          valueStr = String(d.current);
          numericVal = d.current;
          unit = "A";
        } else if (d.direction !== undefined) {
          valueStr = d.direction;
          unit = "degrees";
          if (d.raw_volts !== undefined) numericVal = d.raw_volts;
        } else if (d.mph !== undefined) {
          valueStr = String(d.mph);
          numericVal = d.mph;
          unit = "mph";
          if (d.mph > 30) status = "warning";
        } else if (d.deg !== undefined) {
          valueStr = String(d.deg);
          numericVal = d.deg;
          unit = "degrees";
        } else if (d.mm !== undefined) {
          valueStr = String(d.mm);
          numericVal = d.mm;
          unit = "mm";
        } else if (d.temp_f !== undefined) {
          valueStr = String(d.temp_f);
          numericVal = d.temp_f;
          unit = "F";
        } else if (d.humidity_pct !== undefined) {
          valueStr = String(d.humidity_pct);
          numericVal = d.humidity_pct;
          unit = "%";
        } else if (d.pressure_pa !== undefined) {
          valueStr = String(d.pressure_pa);
          numericVal = d.pressure_pa;
          unit = "Pa";
        } else if (d.status !== undefined && sensorName === "Lightning Strike") {
          valueStr = JSON.stringify({ status: d.status, ...(d.distance_km !== undefined ? { distance_km: d.distance_km } : {}) });
          unit = "status";
          if (d.status === "Strike detected") {
            status = "critical";
            if (d.distance_km !== undefined) numericVal = d.distance_km;
          } else {
            status = "normal";
          }
        } else if (d.distance_km !== undefined) {
          valueStr = String(d.distance_km);
          numericVal = d.distance_km;
          unit = "km";
          status = "critical";
        } else {
          valueStr = JSON.stringify(d.value || d);
        }

        const sensorId = await upsertSensor(supabase, device, sensorType, sensorName, valueStr, unit, now, status);
        if (sensorId) {
          readingsToInsert.push({
            sensor_id: sensorId,
            yacht_id: device.yacht_id,
            company_id: device.company_id,
            reading_value: valueStr,
            numeric_value: numericVal,
            unit_of_measure: unit,
            recorded_at: now,
          });

          if (status === "critical") {
            alertsToInsert.push({
              sensor_id: sensorId,
              device_id: device.id,
              yacht_id: device.yacht_id,
              company_id: device.company_id,
              alert_type: "sensor_critical",
              severity: "critical",
              message: `${sensorName} reported critical: ${valueStr}`,
            });
          }
        }
      }
    }

    // ---- Process legacy "ports" format (backward compatibility) ----
    if (body.ports && body.ports.length > 0) {
      for (const portData of body.ports) {
        for (const sensorData of portData.sensors || []) {
          const sensorType = sensorData.sensor_type || inferSensorType(sensorData.sensor_name);
          const sensorStatus = sensorData.status || "normal";
          const sensorId = await upsertSensor(
            supabase, device, sensorType, sensorData.sensor_name,
            sensorData.value, sensorData.unit_of_measure || "", now, sensorStatus
          );

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
            }
          }
        }
      }
    }

    // Batch insert readings
    if (readingsToInsert.length > 0) {
      await supabase.from("vessel_monitor_readings").insert(readingsToInsert);
    }

    // Insert alerts (deduplicate active alerts for same sensor+type)
    if (alertsToInsert.length > 0) {
      for (const alert of alertsToInsert) {
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

    // Return WiFi credentials in the format both firmware files expect:
    // top-level wifi_ssid / wifi_password fields. The firmware checks for
    // these fields and updates its cached config when they differ.
    const yachtWifi = (device as any)?.yachts;
    const response: Record<string, any> = {
      success: true,
      readings: readingsToInsert.length,
      alerts: alertsToInsert.length,
    };

    if (yachtWifi && yachtWifi.wifi_name) {
      response.wifi_ssid = yachtWifi.wifi_name;
      response.wifi_password = yachtWifi.wifi_password || "";
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: infer sensor_type from sensor_name when no explicit mapping exists
function inferSensorType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("bilge")) return "bilge_pump";
  if (lower.includes("water pump")) return "water_pump";
  if (lower.includes("alarm")) return "bilge_pump";
  if (lower.includes("a/c") || lower.includes("ac water")) return "ac_pump";
  if (lower.includes("battery")) return "battery_bank";
  if (lower.includes("alternator")) return "engine_alternator";
  if (lower.includes("wind vane") || lower.includes("wind direction")) return "wind_vane";
  if (lower.includes("wind speed") || lower.includes("anemometer")) return "anemometer";
  if (lower.includes("gps") || lower.includes("location")) return "gps";
  if (lower.includes("lightning")) return "environment";
  if (lower.includes("rain")) return "environment";
  if (lower.includes("atmospheric") || lower.includes("temp") || lower.includes("humidity") || lower.includes("pressure")) return "environment";
  return "environment";
}

// Helper: find or create a sensor, then update its current value + status
async function upsertSensor(
  supabase: any,
  device: any,
  sensorType: string,
  sensorName: string,
  value: string,
  unit: string,
  now: string,
  status: "normal" | "warning" | "critical" | "offline" = "normal"
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("vessel_monitor_sensors")
    .select("id, min_threshold, max_threshold")
    .eq("device_id", device.id)
    .eq("sensor_name", sensorName)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("vessel_monitor_sensors")
      .update({
        current_value: value,
        unit_of_measure: unit || undefined,
        status,
        last_reading_at: now,
        updated_at: now,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  // Auto-create the sensor if it doesn't exist yet
  const { data: newSensor } = await supabase
    .from("vessel_monitor_sensors")
    .insert({
      device_id: device.id,
      port_id: null,
      yacht_id: device.yacht_id,
      company_id: device.company_id,
      sensor_type: sensorType,
      sensor_name: sensorName,
      current_value: value,
      unit_of_measure: unit || null,
      status,
      last_reading_at: now,
    })
    .select()
    .single();

  return newSensor?.id || null;
}
