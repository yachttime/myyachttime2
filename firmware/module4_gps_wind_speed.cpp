/*
  Houseboat Monitoring System — Module 4: GPS & Wind Speed
  ------------------------------------------------------------
  Two sensors that don't go through the PaHub or EXT.IO2 at all:
    - GPS SMA Unit (U190) — UART on PORT.C
    - Anemometer — pulse counting on the repurposed RS485 port's G27 pin

  Pushes readings to the Vessel Monitoring telemetry endpoint.

  API: POST /functions/v1/vessel-monitor-telemetry
  Auth: X-Device-Key header (the api_key generated when the M5 Tough
  device was registered in the Vessel Monitoring dashboard)

  GPS and wind speed are reported on Port C ("GPS & Weather") since
  they connect through PORT.C and the RS485 port. GPS pushes every 30s
  (only when a valid fix is available); wind speed pushes every 5s.
  The edge function will auto-create sensor records on first report and
  store time-series readings.

  Requires:
    - M5Unified, WiFi, HTTPClient (as in prior modules)
    - TinyGPSPlus library (install via Library Manager) for NMEA parsing
*/

#include <M5Unified.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPSPlus.h>

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

// ---------------- GPS (PORT.C, UART) ----------------
// PORT.C signal pins: G14, G13 — confirm which is RX/TX against your
// actual wiring; GPS only needs to send data TO the Tough, so only the
// Tough's RX pin strictly matters here.
#define GPS_RX_PIN 14   // Tough RX <- GPS TX
#define GPS_TX_PIN 13   // Tough TX -> GPS RX (not used for basic fix reading)
#define GPS_BAUD   9600 // U190 default; adjust if yours is configured differently

HardwareSerial gpsSerial(2);  // ESP32 UART2
TinyGPSPlus gps;

unsigned long lastGpsPush = 0;
const unsigned long GPS_PUSH_INTERVAL_MS = 30000;  // 30s between location pushes

// ---------------- Anemometer (RS485 port, repurposed as GPIO) ----------------
#define ANEMOMETER_PIN 27   // RS485 port's G27, reconfigured as digital input

volatile unsigned long pulseCount = 0;
unsigned long lastWindCalc = 0;
const unsigned long WIND_CALC_INTERVAL_MS = 5000;  // calculate speed every 5s

// SparkFun Weather Meter Kit's documented spec: one switch closure per
// second = 1.492 MPH. This is the manufacturer-published conversion factor.
const float MPH_PER_PULSE_PER_SEC = 1.492f;

// Wind speed thresholds for alert generation (in MPH).
// 25+ MPH is strong breeze/small craft warning; 38+ is gale force.
const float WIND_WARNING   = 25.0f;
const float WIND_CRITICAL  = 38.0f;

void IRAM_ATTR onAnemometerPulse() {
  pulseCount++;
}

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

// ---------------- Helpers ----------------
String getISOTimestamp() {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  struct tm* tm = gmtime(&tv.tv_sec);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", tm);
  return String(buf);
}

// ---------------- Telemetry push: GPS ----------------
void pushGpsLocation(double lat, double lng, double speedMph, double headingDeg) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi down — GPS reading not sent (buffering not yet implemented)");
    return;
  }

  // Format the value string with lat/lng/speed/heading for the dashboard
  char valueStr[128];
  snprintf(valueStr, sizeof(valueStr),
           "%.6f,%.6f  %.1fmph  %.0fdeg",
           lat, lng, speedMph, headingDeg);

  char sensorJson[256];
  snprintf(sensorJson, sizeof(sensorJson),
           "{\"sensor_type\":\"gps\","
           "\"sensor_name\":\"GPS Location\","
           "\"value\":\"%s\","
           "\"numeric_value\":%.1f,"
           "\"unit_of_measure\":\"mph\","
           "\"status\":\"normal\"}",
           valueStr, speedMph);

  String payload = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                   "\",\"timestamp\":\"" + getISOTimestamp() +
                   "\",\"ports\":[{\"port\":\"C\",\"sensors\":[" +
                   sensorJson + "]}]}";

  HTTPClient http;
  http.begin(TELEMETRY_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    if (httpCode == 200) {
      Serial.printf("Pushed GPS: %.6f, %.6f (HTTP %d)\n", lat, lng, httpCode);
    } else {
      String response = http.getString();
      Serial.printf("GPS push returned HTTP %d: %s\n", httpCode, response.c_str());
    }
  } else {
    Serial.printf("GPS push FAILED: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ---------------- Telemetry push: wind speed ----------------
void pushWindSpeed(float mph) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi down — wind speed reading not sent (buffering not yet implemented)");
    return;
  }

  // Determine status based on wind speed thresholds
  const char* status = "normal";
  if (mph >= WIND_CRITICAL) {
    status = "critical";
  } else if (mph >= WIND_WARNING) {
    status = "warning";
  }

  char sensorJson[256];
  snprintf(sensorJson, sizeof(sensorJson),
           "{\"sensor_type\":\"anemometer\","
           "\"sensor_name\":\"Wind Speed\","
           "\"value\":\"%.1f mph\","
           "\"numeric_value\":%.1f,"
           "\"unit_of_measure\":\"mph\","
           "\"status\":\"%s\"}",
           mph, mph, status);

  String payload = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                   "\",\"timestamp\":\"" + getISOTimestamp() +
                   "\",\"ports\":[{\"port\":\"C\",\"sensors\":[" +
                   sensorJson + "]}]}";

  HTTPClient http;
  http.begin(TELEMETRY_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    if (httpCode == 200) {
      Serial.printf("Pushed wind speed: %.1f mph (HTTP %d)\n", mph, httpCode);
    } else {
      String response = http.getString();
      Serial.printf("Wind speed push returned HTTP %d: %s\n", httpCode, response.c_str());
    }
  } else {
    Serial.printf("Wind speed push FAILED: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ---------------- Main ----------------
void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  delay(200);

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  pinMode(ANEMOMETER_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ANEMOMETER_PIN), onAnemometerPulse, FALLING);

  setupWiFi();

  Serial.println("Module 4 online: GPS & wind speed.");
  Serial.printf("Device serial: %s\n", DEVICE_SERIAL);
  Serial.printf("Telemetry endpoint: %s\n", TELEMETRY_ENDPOINT);
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  // Feed GPS parser continuously
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Push location periodically, only once we have a valid fix
  if (millis() - lastGpsPush > GPS_PUSH_INTERVAL_MS) {
    lastGpsPush = millis();
    if (gps.location.isValid() && gps.location.isUpdated()) {
      pushGpsLocation(
        gps.location.lat(),
        gps.location.lng(),
        gps.speed.isValid() ? gps.speed.mph() : 0.0,
        gps.course.isValid() ? gps.course.deg() : 0.0
      );
    } else {
      Serial.println("No valid GPS fix yet — skipping location push");
    }
  }

  // Calculate and push wind speed periodically
  if (millis() - lastWindCalc > WIND_CALC_INTERVAL_MS) {
    noInterrupts();
    unsigned long count = pulseCount;
    pulseCount = 0;
    interrupts();

    float pulsesPerSecond = count / (WIND_CALC_INTERVAL_MS / 1000.0f);
    float windMph = pulsesPerSecond * MPH_PER_PULSE_PER_SEC;

    pushWindSpeed(windMph);
    lastWindCalc = millis();
  }

  delay(100);  // keep loop tight so GPS UART buffer doesn't overflow
}
