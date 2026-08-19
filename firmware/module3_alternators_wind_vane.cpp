/*
  Houseboat Monitoring System — Module 3: Alternators & Wind Vane
  --------------------------------------------------------------------
  Reads 4x alternator voltages (across 2 Voltmeter Units) and the wind
  vane direction (1 channel on a 3rd Voltmeter Unit), all via the
  cascaded PaHub on PORT.B, and pushes readings to the Vessel Monitoring
  telemetry endpoint.

  IMPORTANT — two things need real-hardware calibration before this
  module's numbers can be trusted (see CALIBRATION comments below):
    1. VOLTMETER_SCALE_FACTOR — the Voltmeter Unit divides higher
       voltages down before they reach the ADS1115 chip. The exact
       divider ratio isn't in this code with certainty — calibrate it
       yourself with a known reference voltage once hardware is in hand.
    2. Wind vane voltage-to-direction table — this needs to be built
       from YOUR actual vane by rotating it through each direction and
       recording the resulting voltage. Placeholder values are marked
       clearly and must not be trusted as-is.

  API: POST /functions/v1/vessel-monitor-telemetry
  Auth: X-Device-Key header (the api_key generated when the M5 Tough
  device was registered in the Vessel Monitoring dashboard)

  All sensors are reported on Port B ("Batteries & Engine") to match
  the hardware wiring plan. The edge function will auto-create sensor
  records on first report and store time-series readings.

  Requires: M5Unified, WiFi, HTTPClient, Wire.
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

// ---------------- PaHub (TCA9548A) addresses ----------------
#define PRIMARY_HUB_ADDR    0x70
#define SECONDARY_HUB_ADDR  0x71
#define SECONDARY_HUB_UPSTREAM_CH 0   // primary hub channel wired to secondary hub

// ---------------- Voltmeter Unit (ADS1115) ----------------
#define ADS1115_I2C_ADDR     0x48   // default; each Voltmeter Unit is on its own
                                     // hub channel, so all 4 can share this
#define ADS1115_REG_CONVERT  0x00
#define ADS1115_REG_CONFIG   0x01

// CALIBRATION #1: the Voltmeter Unit scales a higher input voltage down
// before the ADS1115 sees it. This placeholder assumes a 1:1 read at the
// ADS1115's +-6.144V full-scale range with no additional board-level
// division applied — VERIFY against a known voltage source (e.g. a bench
// supply set to 13.0V on an alternator input) and adjust this factor so
// the reported value matches reality.
const float VOLTMETER_SCALE_FACTOR = 1.0f;  // TODO: calibrate

// Alternator voltage thresholds for alert generation.
// Below 12.0V the alternator isn't charging; above 15.5V is over-charging.
const float ALT_WARNING_MIN  = 12.0f;
const float ALT_CRITICAL_MIN = 11.0f;
const float ALT_WARNING_MAX  = 15.5f;

struct VoltagePoint {
  const char* name;
  bool onSecondaryHub;
  uint8_t hubChannel;   // which hub channel this Voltmeter Unit sits on
  uint8_t adsChannel;   // 0 = AIN0-AIN1 differential, 1 = AIN2-AIN3 differential
  bool isDirection;     // true for wind vane, false for alternator voltage
};

VoltagePoint points[5] = {
  {"Engine 1 Alternator",    false, 6, 0, false},  // Voltmeter Unit #1, ch1 -- primary hub ch6
  {"Engine 2 Alternator",    false, 6, 1, false},  // Voltmeter Unit #1, ch2 -- same unit, 2nd ADS channel
  {"Generator 1 Alternator", true,  1, 0, false},  // Voltmeter Unit #2, ch1 -- secondary hub ch1
  {"Generator 2 Alternator", true,  1, 1, false},  // Voltmeter Unit #2, ch2
  {"Wind Vane Direction",    true,  2, 0, true},   // Voltmeter Unit #3, ch1 -- secondary hub ch2
};
// NOTE: hubChannel values above are placeholders reflecting a reasonable
// layout — cross-check against your actual PaHub wiring once hardware is
// physically connected, and correct any mismatches before relying on this.

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

// ---------------- Hub channel selection ----------------
bool selectHubChannel(uint8_t hubAddr, uint8_t channel) {
  Wire.beginTransmission(hubAddr);
  Wire.write(1 << channel);
  return Wire.endTransmission() == 0;
}

bool routeToPoint(const VoltagePoint& pt) {
  if (pt.onSecondaryHub) {
    if (!selectHubChannel(PRIMARY_HUB_ADDR, SECONDARY_HUB_UPSTREAM_CH)) return false;
    if (!selectHubChannel(SECONDARY_HUB_ADDR, pt.hubChannel)) return false;
  } else {
    if (!selectHubChannel(PRIMARY_HUB_ADDR, pt.hubChannel)) return false;
  }
  return true;
}

// ---------------- ADS1115 read ----------------
// Reads a single differential pair, returns volts at the ADS1115 pin
// (before VOLTMETER_SCALE_FACTOR is applied).
bool readADS1115(uint8_t adsChannel, float& volts) {
  // MUX: 000 = AIN0-AIN1 differential, 011 = AIN2-AIN3 differential
  uint16_t mux = (adsChannel == 0) ? 0x0000 : 0x3000;

  // OS=1 (start conversion) | MUX | PGA=010 (+-6.144V) | MODE=1 (single-shot)
  // | DR=100 (128SPS) | default comparator (disabled)
  uint16_t config = 0x8000 | mux | 0x0200 | 0x0100 | 0x0080 | 0x0003;

  Wire.beginTransmission(ADS1115_I2C_ADDR);
  Wire.write(ADS1115_REG_CONFIG);
  Wire.write((config >> 8) & 0xFF);
  Wire.write(config & 0xFF);
  if (Wire.endTransmission() != 0) return false;

  delay(10);  // conversion time at 128SPS (~7.8ms) plus margin

  Wire.beginTransmission(ADS1115_I2C_ADDR);
  Wire.write(ADS1115_REG_CONVERT);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)ADS1115_I2C_ADDR, 2);
  if (Wire.available() < 2) return false;

  int16_t raw = (Wire.read() << 8) | Wire.read();
  volts = raw * (6.144f / 32768.0f);  // PGA +-6.144V, 16-bit signed
  return true;
}

// CALIBRATION #2: placeholder wind direction table. Rotate your actual
// vane through each of the 8 (or 16) positions, record the voltage at
// each, and replace these values before trusting direction readings.
const char* windVaneVoltageToDirection(float volts) {
  if (volts < 0.5)      return "N (uncalibrated)";
  if (volts < 1.0)      return "NE (uncalibrated)";
  if (volts < 1.5)      return "E (uncalibrated)";
  if (volts < 2.0)      return "SE (uncalibrated)";
  if (volts < 2.5)      return "S (uncalibrated)";
  if (volts < 3.0)      return "SW (uncalibrated)";
  if (volts < 3.5)      return "W (uncalibrated)";
  return "NW (uncalibrated)";
}

// ---------------- Telemetry push ----------------
// Sends all 5 sensor readings (4 alternators + wind vane) in a single
// batch to the vessel-monitor-telemetry edge function. The edge function
// will:
//   1. Validate the device API key
//   2. Create or update each sensor record
//   3. Store readings in vessel_monitor_readings
//   4. Generate alerts if alternator voltage crosses threshold limits
//   5. Mark the device as online with a fresh last_check_in timestamp
void pushAllVoltageReadings() {
  if (WiFi.status() != WL_CONNECTED) {
    // TODO (Module: SD buffering) — write to microSD, replay on reconnect
    Serial.println("WiFi down — voltage readings not sent (buffering not yet implemented)");
    return;
  }

  // Build the JSON payload with all sensors on Port B
  String sensorsJson = "";
  int validCount = 0;

  for (int i = 0; i < 5; i++) {
    if (!routeToPoint(points[i])) {
      Serial.printf("Hub routing failed for %s\n", points[i].name);
      continue;
    }

    float rawVolts;
    if (!readADS1115(points[i].adsChannel, rawVolts)) {
      Serial.printf("Read failed for %s\n", points[i].name);
      continue;
    }

    float scaledVolts = points[i].isDirection ? rawVolts : (rawVolts * VOLTMETER_SCALE_FACTOR);

    if (points[i].isDirection) {
      const char* direction = windVaneVoltageToDirection(scaledVolts);
      Serial.printf("%s: %s (%.3fV raw)\n", points[i].name, direction, scaledVolts);

      // Wind vane reports direction as the value string, raw voltage as numeric
      char sensorJson[256];
      snprintf(sensorJson, sizeof(sensorJson),
               "{\"sensor_type\":\"wind_vane\","
               "\"sensor_name\":\"%s\","
               "\"value\":\"%s\","
               "\"numeric_value\":%.3f,"
               "\"unit_of_measure\":\"V\","
               "\"status\":\"normal\"}",
               points[i].name, direction, scaledVolts);

      if (validCount > 0) sensorsJson += ",";
      sensorsJson += sensorJson;
    } else {
      Serial.printf("%s: %.2fV\n", points[i].name, scaledVolts);

      // Determine status based on alternator voltage thresholds
      const char* status = "normal";
      if (scaledVolts < ALT_CRITICAL_MIN || scaledVolts > ALT_WARNING_MAX) {
        status = "critical";
      } else if (scaledVolts < ALT_WARNING_MIN) {
        status = "warning";
      }

      char sensorJson[256];
      snprintf(sensorJson, sizeof(sensorJson),
               "{\"sensor_type\":\"alternator\","
               "\"sensor_name\":\"%s\","
               "\"value\":\"%.2fV\","
               "\"numeric_value\":%.2f,"
               "\"unit_of_measure\":\"V\","
               "\"status\":\"%s\"}",
               points[i].name, scaledVolts, scaledVolts, status);

      if (validCount > 0) sensorsJson += ",";
      sensorsJson += sensorJson;
    }

    validCount++;
  }

  if (validCount == 0) {
    Serial.println("No valid voltage readings to send");
    return;
  }

  String payload = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                   "\",\"timestamp\":\"" + getISOTimestamp() +
                   "\",\"ports\":[{\"port\":\"B\",\"sensors\":[" +
                   sensorsJson + "]}]}";

  HTTPClient http;
  http.begin(TELEMETRY_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    if (httpCode == 200) {
      Serial.printf("Pushed %d voltage/wind readings (HTTP %d)\n", validCount, httpCode);
    } else {
      String response = http.getString();
      Serial.printf("Push returned HTTP %d: %s\n", httpCode, response.c_str());
    }
  } else {
    Serial.printf("Push FAILED: %s\n", http.errorToString(httpCode).c_str());
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

  Wire.begin();  // PORT.B default I2C pins (SDA=G26, SCL=G36)

  setupWiFi();

  Serial.println("Module 3 online: alternators & wind vane.");
  Serial.printf("Device serial: %s\n", DEVICE_SERIAL);
  Serial.printf("Telemetry endpoint: %s\n", TELEMETRY_ENDPOINT);
  Serial.println("REMINDER: VOLTMETER_SCALE_FACTOR and wind vane table are placeholders — calibrate before trusting readings.");
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  pushAllVoltageReadings();

  delay(15000);  // alternator/wind readings — 15s is reasonable, tighten if desired
}
