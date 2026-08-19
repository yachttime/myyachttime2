/*
  Houseboat Monitoring System — Module 1: Bilge & Pump Status
  ------------------------------------------------------------
  Reads the EXT.IO2 expander on PORT.A (which carries the PC817-isolated
  signals from the forward bilge, aft bilge, and Grundfos CU 301 relay)
  and pushes state changes to the Vessel Monitoring telemetry endpoint.

  This is the FIRST module — get this working end-to-end before adding
  battery monitoring, GPS, wind, or environmental sensors. Confirms the
  whole pipeline (sensor -> Tough -> WiFi -> Supabase) works before we
  scale it up.

  API: POST /functions/v1/vessel-monitor-telemetry
  Auth: X-Device-Key header (the api_key generated when the M5 Tough
  device was registered in the Vessel Monitoring dashboard)

  Requires: M5Unified library, WiFi, HTTPClient, Wire (all standard
  for ESP32/M5Stack projects).
*/

#include <M5Unified.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>

// ---------------- WiFi ----------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ---------------- Supabase ----------------
// The edge function endpoint (NOT the REST API)
const char* TELEMETRY_ENDPOINT =
    "https://YOUR_PROJECT.supabase.co/functions/v1/vessel-monitor-telemetry";

// The API key generated when this device was registered in the
// Vessel Monitoring dashboard. Each M5 Tough has its own unique key.
const char* DEVICE_API_KEY = "YOUR_DEVICE_API_KEY";

// The serial number you entered when registering this device.
// Must match exactly what's in the vessel_monitor_devices table.
const char* DEVICE_SERIAL   = "YOUR_DEVICE_SERIAL";

// ---------------- EXT.IO2 (PCA9554-based expander on PORT.A) ----------------
#define EXTIO2_I2C_ADDR     0x45   // default address — confirm against your unit
#define PCA9554_REG_INPUT   0x00
#define PCA9554_REG_CONFIG  0x03   // 1 = input, 0 = output, per bit

struct MonitoredChannel {
  uint8_t bit;          // EXT.IO2 bit position (0-7), matches PC817 channel
  const char* name;      // sensor name — must match what the edge function expects
  const char* sensorType; // sensor_type field in the vessel_monitor_sensors table
  bool lastState;         // for edge-detection (only push on change)
};

// PC817 Ch1 -> IO0, Ch2 -> IO1, Ch3 -> IO2 (per equipment/wiring list)
MonitoredChannel channels[3] = {
  {0, "Forward Bilge",        "bilge_pump",  false},
  {1, "Aft Bilge",             "bilge_pump",  false},
  {2, "Grundfos Pump (CU301)", "water_pump",  false},
};

// ---------------- WiFi setup ----------------
void setupWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed — will retry in loop()");
  }
}

// ---------------- EXT.IO2 setup/read ----------------
void setupEXTIO2() {
  Wire.beginTransmission(EXTIO2_I2C_ADDR);
  Wire.write(PCA9554_REG_CONFIG);
  Wire.write(0xFF);              // all 8 pins as inputs
  Wire.endTransmission();
}

// Returns raw 8-bit port state, or 0xFF (all-high) on I2C read failure
uint8_t readEXTIO2() {
  Wire.beginTransmission(EXTIO2_I2C_ADDR);
  Wire.write(PCA9554_REG_INPUT);
  if (Wire.endTransmission(false) != 0) {
    Serial.println("EXT.IO2 I2C write failed");
    return 0xFF;
  }
  Wire.requestFrom((int)EXTIO2_I2C_ADDR, 1);
  if (Wire.available()) {
    return Wire.read();
  }
  Serial.println("EXT.IO2 I2C read failed");
  return 0xFF;
}

// ---------------- Telemetry push ----------------
// Sends a single sensor reading to the vessel-monitor-telemetry edge function.
// The edge function will:
//   1. Validate the device API key
//   2. Create or update the sensor record
//   3. Store the reading in vessel_monitor_readings
//   4. Generate an alert if the sensor goes critical or offline
//   5. Mark the device as online with a fresh last_check_in timestamp
void pushReading(const char* sensorName, const char* sensorType, bool active) {
  if (WiFi.status() != WL_CONNECTED) {
    // TODO (Module: SD buffering) — write this reading to the microSD
    // card instead of dropping it, and replay on reconnect.
    Serial.printf("WiFi down — %s reading not sent (buffering not yet implemented)\n", sensorName);
    return;
  }

  HTTPClient http;
  http.begin(TELEMETRY_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  // Build the telemetry payload in the format the edge function expects.
  // The "ports" array groups sensors by port label — all pump sensors
  // go on Port A per the hardware wiring plan.
  String payload = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                   "\",\"timestamp\":\"" + getISOTimestamp() +
                   "\",\"ports\":[{\"port\":\"A\",\"sensors\":[" +
                   "{\"sensor_type\":\"" + sensorType + "\"," +
                   "\"sensor_name\":\"" + sensorName + "\"," +
                   "\"value\":\"" + (active ? "on" : "off") + "\"," +
                   "\"unit_of_measure\":\"on/off\"," +
                   "\"status\":\"" + (active ? "warning" : "normal") + "\"}" +
                   "]}]}";

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    if (httpCode == 200) {
      Serial.printf("Pushed %s = %s (HTTP %d)\n", sensorName, active ? "ACTIVE" : "clear", httpCode);
    } else {
      String response = http.getString();
      Serial.printf("Push returned HTTP %d: %s\n", httpCode, response.c_str());
    }
  } else {
    Serial.printf("Push FAILED for %s: %s\n", sensorName, http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ---------------- Helpers ----------------
// Returns an ISO 8601 timestamp using the ESP32's internal RTC.
// For production, sync with NTP on WiFi connect for accuracy.
String getISOTimestamp() {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  struct tm* tm = gmtime(&tv.tv_sec);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", tm);
  return String(buf);
}

// ---------------- Main ----------------
void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  delay(200);

  Wire.begin();  // PORT.A default I2C pins (SDA=G32, SCL=G33)

  setupWiFi();
  setupEXTIO2();

  Serial.println("Module 1 online: bilge & pump monitoring.");
  Serial.printf("Device serial: %s\n", DEVICE_SERIAL);
  Serial.printf("Telemetry endpoint: %s\n", TELEMETRY_ENDPOINT);
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();  // basic reconnect attempt; refine with backoff later
  }

  uint8_t portState = readEXTIO2();

  for (int i = 0; i < 3; i++) {
    // NOTE: PC817 outputs are open-collector and typically pull LOW when
    // the LED side is energized (switch/relay active). That means "active"
    // may read as a 0 bit, not a 1 — VERIFY THIS against your actual wiring
    // once hardware is in hand, then adjust the inversion below if needed.
    bool active = !((portState >> channels[i].bit) & 0x01);

    if (active != channels[i].lastState) {
      pushReading(channels[i].name, channels[i].sensorType, active);
      channels[i].lastState = active;
    }
  }

  delay(1000);  // poll interval — 1s is fine for this signal type
}
