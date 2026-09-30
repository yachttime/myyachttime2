/*
  Houseboat Monitoring System — ORION Tough Combined Firmware
  ==========================================================================
  Architecture (confirmed on real hardware):

  PORT A — I2C bus (Wire, pins 32/33), shared via Y-splitter:
    EXT.IO2 (addr 0x45):
      Ch0  Engine Room Starboard Bilge Pump
      Ch1  Aft Bilge Pump
      Ch2  Midship Bilge Pump
      Ch3  High Water Alarm
      Ch4  A/C Water Pump (CU 301 relay)
      Ch5  Fresh Water Pump (CU 301 relay)
      Ch6-7  Free

    PaHub (addr 0x70):
      Ch1-3  3× Voltmeter Unit (ADS1115, addr 0x49) — 4 alternators
      Ch4    ENV III (temp/humidity/pressure)
      Ch5    GPS (SparkFun NEO-M9N, I2C addr 0x42)
      Ch6    Free (TVOC, future sensors)

  PORT B — unusable for I2C (GPIO36 is input-only per M5Stack docs)
  PORT C — free (GPS moved to I2C via PaHub Ch5)
  RS485/G27 — free (anemometer moved to dedicated weather station)

  Separate from the Tough entirely:
    Battery banks (6) → Victron Cerbo GX + SmartShunts via VE.Direct
    Weather station (wind/rain) → independent ESP32 over WiFi

  CONFIRMED ON REAL HARDWARE:
    - EXT.IO2 requires the official M5Unit-EXTIO2 library (NOT generic
      PCA9554 registers — custom STM32F030-based protocol).
      Working: SDA/SCL pin order (32, 33), address 0x45.
    - PC817 bilge/pump channels: active-low, 10kΩ pull-up to 5V.
    - Voltmeter Unit (ADS1115) address is 0x49 on this hardware, not 0x48.
    - GPS: SparkFun NEO-M9N supports I2C at address 0x42. Reads NMEA
      sentences from I2C register 0xFF (up to 32 bytes per read).

  STILL NEEDS FIELD CALIBRATION:
    - VOLTMETER_SCALE_FACTOR (41.8 from one test point — re-check at 2nd voltage)
    - PaHub channel-to-Voltmeter-Unit physical mapping (Ch1-3 assigned by wire order)

  REMOTE WIFI CONFIG: on boot, tries cached credentials from SD, then falls
  back to the hardcoded bootstrap list. Each telemetry response is checked
  for optional wifi_ssid/wifi_password fields — if present and different,
  new credentials are cached to SD for next boot.

  Requires: M5Unified, WiFi, HTTPClient, Wire, SPI, SD, TinyGPSPlus,
  M5Unit-EXTIO2 (install from GitHub), ArduinoJson.
  ENV III uses the M5Stack M5Unit-ENVIII library (SHT40 + QMP6988).
*/

#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <TinyGPSPlus.h>
#include <ArduinoJson.h>
#include "M5Unit-ENVIII.hpp"

// ============================================================
// SHARED: WiFi, Telemetry endpoint, SD buffering
// ============================================================
struct WifiCredential {
  const char* ssid;
  const char* password;
};
WifiCredential knownNetworks[] = {
  {"AZMarine", "9286376500"},
};
const int NUM_KNOWN_NETWORKS = sizeof(knownNetworks) / sizeof(knownNetworks[0]);

const char* WIFI_CONFIG_FILE = "/wifi_config.txt";
String cachedSsid = "";
String cachedPassword = "";

const char* TELEMETRY_URL   = "https://eqiecntollhgfxmmbize.supabase.co/functions/v1/vessel-monitor-telemetry";
const char* DEVICE_API_KEY  = "e4411330-5c9f-4d81-ab8b-7e4083ab10d6";
const char* DEVICE_SERIAL   = "k034326040100309";

const char* SENSOR_READINGS_EP   = "";
const char* LOCATION_READINGS_EP = "";

#define SD_SPI_CS_PIN   4
#define SD_SPI_SCK_PIN  18
#define SD_SPI_MOSI_PIN 23
#define SD_SPI_MISO_PIN 38
const char* BUFFER_FILE = "/buffer.jsonl";
bool sdReady = false;

bool loadCachedWifiConfig() {
  if (!sdReady || !SD.exists(WIFI_CONFIG_FILE)) return false;
  File f = SD.open(WIFI_CONFIG_FILE, FILE_READ);
  if (!f) return false;
  cachedSsid = f.readStringUntil('\n');
  cachedPassword = f.readStringUntil('\n');
  f.close();
  cachedSsid.trim();
  cachedPassword.trim();
  if (cachedSsid.length() == 0) return false;
  Serial.println("Loaded cached WiFi config for network: " + cachedSsid);
  return true;
}

void saveCachedWifiConfig(const String& ssid, const String& password) {
  if (!sdReady) {
    Serial.println("Can't cache new WiFi credentials — no SD card");
    return;
  }
  SD.remove(WIFI_CONFIG_FILE);
  File f = SD.open(WIFI_CONFIG_FILE, FILE_WRITE);
  if (f) {
    f.println(ssid);
    f.println(password);
    f.close();
    cachedSsid = ssid;
    cachedPassword = password;
    Serial.println("Cached new WiFi credentials for network: " + ssid);
  }
}

void checkForWifiConfigUpdate(const String& responseBody) {
  if (responseBody.length() == 0) return;

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, responseBody);
  if (err) return;

  if (!doc["wifi_ssid"].is<const char*>()) return;

  String newSsid = doc["wifi_ssid"].as<String>();
  String newPassword = doc["wifi_password"].is<const char*>() ? doc["wifi_password"].as<String>() : "";

  if (newSsid.length() > 0 && (newSsid != cachedSsid || newPassword != cachedPassword)) {
    Serial.println("Received updated WiFi config from Supabase.");
    saveCachedWifiConfig(newSsid, newPassword);
  }
}

bool tryConnect(const char* ssid, const char* password, unsigned long timeoutMs) {
  Serial.printf("Trying network: %s", ssid);
  WiFi.begin(ssid, password);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString() + " (network: " + ssid + ")");
    return true;
  }
  Serial.println(" failed.");
  WiFi.disconnect(true);
  delay(200);
  return false;
}

void setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);

  if (loadCachedWifiConfig()) {
    if (tryConnect(cachedSsid.c_str(), cachedPassword.c_str(), 8000)) return;
    Serial.println("Cached network failed — falling back to bootstrap list.");
  }

  for (int i = 0; i < NUM_KNOWN_NETWORKS; i++) {
    if (tryConnect(knownNetworks[i].ssid, knownNetworks[i].password, 8000)) return;
  }

  Serial.println("Could not connect to any known network — will retry in loop()");
}

bool setupSDBuffer() {
  SPI.begin(SD_SPI_SCK_PIN, SD_SPI_MISO_PIN, SD_SPI_MOSI_PIN, SD_SPI_CS_PIN);
  if (!SD.begin(SD_SPI_CS_PIN, SPI, 25000000)) {
    Serial.println("SD card not detected — buffering disabled");
    return false;
  }
  Serial.println("SD card ready.");
  return true;
}

bool sendToSupabase(const char* endpoint, const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);

  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, TELEMETRY_URL)) {
    Serial.println("HTTPClient begin() failed");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  String body = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                "\",\"data\":" + jsonPayload + "}";
  Serial.print("Sending: ");
  Serial.println(jsonPayload);
  int httpCode = http.POST(body);
  if (httpCode > 0) {
    Serial.printf("Telemetry POST -> HTTP %d\n", httpCode);
    String responseBody = http.getString();
    checkForWifiConfigUpdate(responseBody);
  } else {
    Serial.printf("Telemetry POST failed: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
  return (httpCode >= 200 && httpCode < 300);
}

void bufferOrSend(const char* endpoint, const String& jsonPayload) {
  if (sendToSupabase(endpoint, jsonPayload)) return;
  if (!sdReady) {
    Serial.println("Send failed, no SD — reading dropped");
    return;
  }
  File f = SD.open(BUFFER_FILE, FILE_APPEND);
  if (f) {
    f.print(endpoint);
    f.print("|");
    f.println(jsonPayload);
    f.close();
    Serial.println("Buffered reading to SD");
  }
}

const char* BUFFER_TEMP_FILE = "/buffer_tmp.jsonl";

void flushBuffer() {
  if (!sdReady || WiFi.status() != WL_CONNECTED || !SD.exists(BUFFER_FILE)) return;

  File in = SD.open(BUFFER_FILE, FILE_READ);
  if (!in) return;

  SD.remove(BUFFER_TEMP_FILE);
  File out = SD.open(BUFFER_TEMP_FILE, FILE_WRITE);
  if (!out) { in.close(); return; }

  bool hitFailure = false;
  int sentCount = 0;
  int keptCount = 0;

  while (in.available()) {
    String line = in.readStringUntil('\n');
    if (line.length() == 0) continue;

    if (hitFailure) {
      out.println(line);
      keptCount++;
      continue;
    }

    int sep = line.indexOf('|');
    if (sep < 0) continue;

    if (sendToSupabase(line.substring(0, sep).c_str(), line.substring(sep + 1))) {
      sentCount++;
    } else {
      hitFailure = true;
      out.println(line);
      keptCount++;
    }
  }

  in.close();
  out.close();

  SD.remove(BUFFER_FILE);
  if (keptCount > 0) {
    SD.rename(BUFFER_TEMP_FILE, BUFFER_FILE);
    Serial.printf("Flushed %d, %d still pending.\n", sentCount, keptCount);
  } else {
    SD.remove(BUFFER_TEMP_FILE);
    Serial.printf("Buffer fully flushed (%d sent).\n", sentCount);
  }
}

// ============================================================
// PAHUB — shared I2C multiplexer on Port A bus (addr 0x70)
// ============================================================
#define PAHUB_ADDR 0x70

void selectHubChannel(uint8_t channel) {
  Wire.beginTransmission(PAHUB_ADDR);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

// ============================================================
// MODULE 1: Bilge & pump status — EXT.IO2 on Port A I2C bus
// ============================================================
#include "M5_EXTIO2.h"

M5_EXTIO2 extio;

#define EXTIO2_SDA 32
#define EXTIO2_SCL 33
#define EXTIO2_ADDR 0x45

struct MonitoredChannel {
  uint8_t bit;
  const char* name;
  bool lastState;
};
MonitoredChannel channels[6] = {
  {0, "Engine Room Starboard Bilge Pump", false},
  {1, "Aft Bilge Pump",                   false},
  {2, "Midship Bilge Pump",               false},
  {3, "High Water Alarm",                 false},
  {4, "A/C Water Pump",                   false},
  {5, "Fresh Water Pump",                 false},
};
const int NUM_CHANNELS = 6;

bool extioReady = false;

void setupEXTIO2() {
  int attempts = 0;
  while (!extio.begin(&Wire, EXTIO2_SDA, EXTIO2_SCL, EXTIO2_ADDR)) {
    Serial.println("EXT.IO2 connect error, retrying...");
    delay(300);
    attempts++;
    if (attempts >= 20) {
      Serial.println("EXT.IO2 not found after 20 tries — continuing without it.");
      return;
    }
  }
  Serial.println("EXT.IO2 connected. FW version: " + String(extio.getVersion()));
  extio.setAllPinMode(DIGITAL_INPUT_MODE);
  extioReady = true;
}

unsigned long lastBilgeCheck = 0;
const unsigned long BILGE_CHECK_INTERVAL_MS = 1000;

void handleBilgePump() {
  if (!extioReady) return;

  for (int i = 0; i < NUM_CHANNELS; i++) {
    bool active = !extio.getDigitalInput(channels[i].bit);
    if (active != channels[i].lastState) {
      String payload = String("{\"sensor_name\":\"") + channels[i].name +
                        "\",\"value\":{\"active\":" + (active ? "true" : "false") + "}}";
      bufferOrSend(SENSOR_READINGS_EP, payload);
      channels[i].lastState = active;
    }
  }
}

// ============================================================
// MODULE 2: Alternators — 3× Voltmeter Unit (ADS1115) via PaHub Ch1-3
// All 4 alternators read from ADS1115 channels across 3 Voltmeter Units.
// PaHub Ch1 = Voltmeter Unit 1 (Port Engine alt A0, Stbd Engine alt A1)
// PaHub Ch2 = Voltmeter Unit 2 (Port Gen alt A0, Stbd Gen alt A1)
// PaHub Ch3 = spare Voltmeter Unit (future)
// ============================================================
#define ADS1115_I2C_ADDR     0x49
#define ADS1115_REG_CONVERT  0x00
#define ADS1115_REG_CONFIG   0x01

const float VOLTMETER_SCALE_FACTOR = 41.8f;  // Calibrated: 12.46V actual / 0.298V raw.
                                              // Re-check at a second voltage to confirm linearity.

struct VoltagePoint {
  const char* name;
  uint8_t hubChannel;
  uint8_t adsChannel;
};
VoltagePoint points[4] = {
  {"Port Engine Alternator",        1, 0},
  {"Starboard Engine Alternator",   1, 1},
  {"Port Generator Alternator",     2, 0},
  {"Starboard Generator Alternator", 2, 1},
};

bool readADS1115(uint8_t adsChannel, float& volts) {
  uint16_t mux = (adsChannel == 0) ? 0x0000 : 0x3000;
  uint16_t config = 0x8000 | mux | 0x0200 | 0x0100 | 0x0080 | 0x0003;

  Wire.beginTransmission(ADS1115_I2C_ADDR);
  Wire.write(ADS1115_REG_CONFIG);
  Wire.write((config >> 8) & 0xFF);
  Wire.write(config & 0xFF);
  if (Wire.endTransmission() != 0) return false;

  delay(10);

  Wire.beginTransmission(ADS1115_I2C_ADDR);
  Wire.write(ADS1115_REG_CONVERT);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)ADS1115_I2C_ADDR, 2);
  if (Wire.available() < 2) return false;

  int16_t raw = (Wire.read() << 8) | Wire.read();
  volts = raw * (6.144f / 32768.0f);
  return true;
}

unsigned long lastVoltageCheck = 0;
const unsigned long VOLTAGE_CHECK_INTERVAL_MS = 15000;
int voltageIndex = 0;

void handleVoltagePoints() {
  VoltagePoint& vp = points[voltageIndex];
  selectHubChannel(vp.hubChannel);
  delay(5);

  float rawVolts;
  if (readADS1115(vp.adsChannel, rawVolts)) {
    float scaled = rawVolts * VOLTMETER_SCALE_FACTOR;
    String payload = String("{\"sensor_name\":\"") + vp.name +
              "\",\"value\":{\"voltage\":" + String(scaled, 2) + "}}";
    bufferOrSend(SENSOR_READINGS_EP, payload);
  }
  voltageIndex = (voltageIndex + 1) % 4;
}

// ============================================================
// MODULE 3: ENV III (temp/humidity/pressure) — PaHub Ch4
// Uses M5Unit-ENVIII library: SHT40 (temp/humidity) + QMP6988 (pressure)
// ============================================================
SHT40 sht40;
QMP6988 qmp6988;
bool envReady = false;

void setupENVIII() {
  selectHubChannel(4);
  delay(10);

  if (!sht40.begin(&Wire, SHT40_I2C_ADDR, 32, 33)) {
    Serial.println("ENV III: SHT40 not found on PaHub Ch4 — continuing without it.");
    return;
  }
  if (!qmp6988.begin(&Wire, QMP6988_I2C_ADDR, 32, 33)) {
    Serial.println("ENV III: QMP6988 not found on PaHub Ch4 — continuing without it.");
    return;
  }
  Serial.println("ENV III connected on PaHub Ch4.");
  envReady = true;
}

unsigned long lastEnvCheck = 0;
const unsigned long ENV_CHECK_INTERVAL_MS = 30000;

void handleENVIII() {
  if (!envReady) return;
  if (millis() - lastEnvCheck < ENV_CHECK_INTERVAL_MS) return;
  lastEnvCheck = millis();

  selectHubChannel(4);
  delay(5);

  if (sht40.update()) {
    float tempF = sht40.cTemp * 9.0f / 5.0f + 32.0f;
    String tempPayload = String("{\"sensor_name\":\"Temperature\",\"value\":{\"temp_f\":") +
                         String(tempF, 1) + "}}";
    bufferOrSend(SENSOR_READINGS_EP, tempPayload);

    String humidPayload = String("{\"sensor_name\":\"Humidity\",\"value\":{\"percent\":") +
                          String(sht40.humidity, 1) + "}}";
    bufferOrSend(SENSOR_READINGS_EP, humidPayload);
  }

  if (qmp6988.update()) {
    String pressurePayload = String("{\"sensor_name\":\"Barometric Pressure\",\"value\":{\"hpa\":") +
                             String(qmp6988.pressure, 1) + "}}";
    bufferOrSend(SENSOR_READINGS_EP, pressurePayload);
  }
}

// ============================================================
// MODULE 4: GPS — SparkFun NEO-M9N via PaHub Ch5 (I2C addr 0x42)
// Reads NMEA data from I2C register 0xFF, feeds to TinyGPSPlus parser.
// ============================================================
#define GPS_I2C_ADDR 0x42
#define GPS_I2C_REG  0xFF
#define GPS_MAX_BYTES_PER_READ 32

TinyGPSPlus gps;
unsigned long lastGpsPush = 0;
const unsigned long GPS_PUSH_INTERVAL_MS = 30000;

void handleGPS() {
  selectHubChannel(5);
  delay(5);

  Wire.beginTransmission(GPS_I2C_ADDR);
  Wire.write(GPS_I2C_REG);
  if (Wire.endTransmission(false) != 0) return;

  int bytesAvailable = Wire.requestFrom((int)GPS_I2C_ADDR, GPS_MAX_BYTES_PER_READ);
  for (int i = 0; i < bytesAvailable; i++) {
    if (Wire.available()) {
      char c = Wire.read();
      gps.encode(c);
    }
  }

  if (millis() - lastGpsPush > GPS_PUSH_INTERVAL_MS) {
    lastGpsPush = millis();
    if (gps.location.isValid() && gps.location.isUpdated()) {
      String payload = String("{\"lat\":") + String(gps.location.lat(), 6) +
                        ",\"lng\":" + String(gps.location.lng(), 6) +
                        ",\"speed_mph\":" + String(gps.speed.isValid() ? gps.speed.mph() : 0.0, 1) +
                        ",\"heading_deg\":" + String(gps.course.isValid() ? gps.course.deg() : 0.0, 1) + "}";
      bufferOrSend(LOCATION_READINGS_EP, payload);
    } else {
      Serial.println("No valid GPS fix yet");
    }
  }
}

// ============================================================
// SETUP / LOOP
// ============================================================
unsigned long lastFlush = 0;
const unsigned long FLUSH_INTERVAL_MS = 60000;

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  delay(200);

  sdReady = setupSDBuffer();

  Wire.begin(32, 33);    // PORT.A I2C bus — EXT.IO2 + PaHub via Y-splitter

  setupWiFi();
  setupEXTIO2();
  setupENVIII();

  Serial.println("ORION Tough online: bilge/pump, alternators, ENV III, GPS. "
                 "Batteries via Victron, wind/rain via weather station.");
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  if (millis() - lastBilgeCheck > BILGE_CHECK_INTERVAL_MS) {
    handleBilgePump();
    lastBilgeCheck = millis();
  }

  if (millis() - lastVoltageCheck > VOLTAGE_CHECK_INTERVAL_MS) {
    handleVoltagePoints();
    lastVoltageCheck = millis();
  }

  handleENVIII();
  handleGPS();

  if (millis() - lastFlush > FLUSH_INTERVAL_MS) {
    flushBuffer();
    lastFlush = millis();
  }

  delay(50);
}
