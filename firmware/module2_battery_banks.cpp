/*
  Houseboat Monitoring System — Module 2: Battery Bank Monitoring
  ------------------------------------------------------------------
  Reads 6x INA226 units (voltage + current per bank) sitting behind a
  cascaded PaHub (TCA9548A-based I2C multiplexers) on PORT.B, and
  pushes readings to the Vessel Monitoring telemetry endpoint.

  Combine this with Module 1 (bilge/pump) into one sketch once both
  are verified independently — for now this is kept separate so each
  piece can be tested against real hardware on its own.

  API: POST /functions/v1/vessel-monitor-telemetry
  Auth: X-Device-Key header (the api_key generated when the M5 Tough
  device was registered in the Vessel Monitoring dashboard)

  All battery sensors are reported on Port B ("Batteries & Engine")
  to match the hardware wiring plan. The edge function will auto-create
  sensor records on first report and store time-series readings.

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
// CONFIRM these against your actual DIP switch settings before flashing.
// Out of the box both hubs likely default to the same address (0x70) —
// you must change one via its DIP switch so they don't collide.
#define PRIMARY_HUB_ADDR    0x70
#define SECONDARY_HUB_ADDR  0x71   // set via DIP switch, must differ from primary

// Primary hub channel 0 is wired to the secondary hub's Grove input (cascade link)
#define SECONDARY_HUB_UPSTREAM_CH 0

// ---------------- INA226 ----------------
#define INA226_I2C_ADDR      0x40   // default; all 6 units can share this since
                                     // each sits on its own isolated hub channel
#define INA226_REG_CONFIG    0x00
#define INA226_REG_SHUNT_V   0x01
#define INA226_REG_BUS_V     0x02
#define INA226_REG_CURRENT   0x04
#define INA226_REG_CAL       0x05

// Victron 500A/50mV shunt -> Rshunt = 0.0001 ohm
// Current_LSB chosen at 0.02 A/bit (20mA) -> max measurable ~655A, headroom over 500A
const float RSHUNT      = 0.0001f;
const float CURRENT_LSB = 0.02f;
const uint16_t CAL_VALUE = (uint16_t)(0.00512f / (CURRENT_LSB * RSHUNT));  // ~2560

// Voltage thresholds for alert generation (in volts).
// Below 11.8V a lead-acid bank is discharged; below 10.5V is critically low.
const float VOLTAGE_WARNING_MIN  = 11.8f;
const float VOLTAGE_CRITICAL_MIN = 10.5f;
const float VOLTAGE_WARNING_MAX  = 15.0f;   // over-voltage = charging fault

struct BatteryBank {
  const char* name;
  bool onSecondaryHub;   // false = primary hub channel, true = secondary hub channel
  uint8_t hubChannel;    // which channel (0-5) on whichever hub
};

BatteryBank banks[6] = {
  {"Engine 1 Starting Battery",    false, 1},  // primary hub ch1
  {"Engine 2 Starting Battery",    false, 2},  // primary hub ch2
  {"Generator 1 Starting Battery", false, 3},  // primary hub ch3
  {"Generator 2 Starting Battery", false, 4},  // primary hub ch4
  {"Inverter Battery Bank",        false, 5},  // primary hub ch5
  {"House 12V Battery Bank",       true,  0},  // secondary hub ch0
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

// ---------------- Hub channel selection ----------------
bool selectHubChannel(uint8_t hubAddr, uint8_t channel) {
  Wire.beginTransmission(hubAddr);
  Wire.write(1 << channel);
  return Wire.endTransmission() == 0;
}

// Routes the I2C bus to the correct INA226 for a given bank.
// For banks on the secondary hub, must first select the secondary
// hub's upstream channel on the primary hub, THEN select the target
// channel on the secondary hub itself.
bool routeToBank(const BatteryBank& bank) {
  if (bank.onSecondaryHub) {
    if (!selectHubChannel(PRIMARY_HUB_ADDR, SECONDARY_HUB_UPSTREAM_CH)) return false;
    if (!selectHubChannel(SECONDARY_HUB_ADDR, bank.hubChannel)) return false;
  } else {
    if (!selectHubChannel(PRIMARY_HUB_ADDR, bank.hubChannel)) return false;
  }
  return true;
}

// ---------------- INA226 setup/read ----------------
void setupINA226() {
  // Write calibration register — must be done for EVERY INA226, since
  // each is a separate physical chip even though they share an address.
  for (int i = 0; i < 6; i++) {
    if (!routeToBank(banks[i])) {
      Serial.printf("Hub routing failed for %s during setup\n", banks[i].name);
      continue;
    }
    Wire.beginTransmission(INA226_I2C_ADDR);
    Wire.write(INA226_REG_CAL);
    Wire.write((CAL_VALUE >> 8) & 0xFF);
    Wire.write(CAL_VALUE & 0xFF);
    Wire.endTransmission();
  }
}

bool readINA226(float& busVoltage, float& current) {
  // Bus voltage
  Wire.beginTransmission(INA226_I2C_ADDR);
  Wire.write(INA226_REG_BUS_V);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)INA226_I2C_ADDR, 2);
  if (Wire.available() < 2) return false;
  int16_t rawBus = (Wire.read() << 8) | Wire.read();
  busVoltage = rawBus * 0.00125f;  // 1.25mV/bit, fixed per datasheet

  // Current
  Wire.beginTransmission(INA226_I2C_ADDR);
  Wire.write(INA226_REG_CURRENT);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)INA226_I2C_ADDR, 2);
  if (Wire.available() < 2) return false;
  int16_t rawCurrent = (Wire.read() << 8) | Wire.read();
  current = rawCurrent * CURRENT_LSB;

  return true;
}

// ---------------- Telemetry push ----------------
// Sends all 6 battery bank readings in a single batch to the
// vessel-monitor-telemetry edge function. The edge function will:
//   1. Validate the device API key
//   2. Create or update each sensor record
//   3. Store readings in vessel_monitor_readings
//   4. Generate alerts if voltage crosses threshold limits
//   5. Mark the device as online with a fresh last_check_in timestamp
void pushAllBatteryReadings() {
  if (WiFi.status() != WL_CONNECTED) {
    // TODO (Module: SD buffering) — write to microSD, replay on reconnect
    Serial.println("WiFi down — battery readings not sent (buffering not yet implemented)");
    return;
  }

  // Build the JSON payload with all 6 banks as sensors on Port B
  String sensorsJson = "";
  for (int i = 0; i < 6; i++) {
    float voltage = 0, current = 0;
    if (!routeToBank(banks[i])) {
      Serial.printf("Hub routing failed for %s\n", banks[i].name);
      continue;
    }
    if (!readINA226(voltage, current)) {
      Serial.printf("Read failed for %s\n", banks[i].name);
      continue;
    }

    Serial.printf("%s: %.2fV %.2fA\n", banks[i].name, voltage, current);

    // Determine status based on voltage thresholds
    const char* status = "normal";
    if (voltage < VOLTAGE_CRITICAL_MIN || voltage > VOLTAGE_WARNING_MAX) {
      status = "critical";
    } else if (voltage < VOLTAGE_WARNING_MIN) {
      status = "warning";
    }

    // Build sensor object — voltage is the primary value for threshold alerts.
    // Current is included in the value string so it's visible on the dashboard.
    char sensorJson[256];
    snprintf(sensorJson, sizeof(sensorJson),
             "{\"sensor_type\":\"battery_bank\","
             "\"sensor_name\":\"%s\","
             "\"value\":\"%.2fV %.2fA\","
             "\"numeric_value\":%.2f,"
             "\"unit_of_measure\":\"V\","
             "\"status\":\"%s\"}",
             banks[i].name, voltage, current, voltage, status);

    if (i > 0) sensorsJson += ",";
    sensorsJson += sensorJson;
  }

  if (sensorsJson.length() == 0) {
    Serial.println("No valid battery readings to send");
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
      Serial.printf("Pushed 6 battery bank readings (HTTP %d)\n", httpCode);
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
  setupINA226();

  Serial.println("Module 2 online: battery bank monitoring.");
  Serial.printf("Device serial: %s\n", DEVICE_SERIAL);
  Serial.printf("Telemetry endpoint: %s\n", TELEMETRY_ENDPOINT);
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  pushAllBatteryReadings();

  delay(30000);  // battery readings don't need second-by-second polling —
                 // every 30s is reasonable; tighten if you want faster alerts
}
