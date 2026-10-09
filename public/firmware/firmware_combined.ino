/*
  Houseboat Monitoring System — Combined Firmware
  ==========================================================================
  Merges Modules 1-5 into a single sketch:
    1. Bilge & pump status (PC817 -> EXT.IO2 -> PORT.A)
    2. Battery bank voltage/current (superseded — see note below)
    3. Alternator voltage + wind vane (Voltmeter Units -> PaHub -> PORT.A)
    4. GPS location (I2C via PaHub channel 5) + anemometer wind speed (RS485 pin, GPIO)
    5. SD card buffering for connectivity gaps (applies to all of the above)

  CORRECTED ARCHITECTURE (superseding an earlier, wrong assumption):
  PORT.B CANNOT do I2C at all — GPIO36 (one of its two signal pins) is a
  hardware input-only pin on this ESP32, confirmed via multiple official
  M5Stack documentation pages, and independently confirmed by the PaHub's
  own printed label, which explicitly reads "PORT.A.I2C". An earlier
  version of this file used a separate Wire1 bus on Port B's pins for the
  PaHub — that never actually worked; it just failed to error clearly
  until tested on real hardware. The PaHub shares PORT.A's bus (Wire,
  pins 32/33) with the EXT.IO2, connected via a Grove/HY2.0 Y-splitter
  cable — both devices coexist fine on one I2C bus since they have
  different addresses (EXT.IO2 = 0x45, PaHub = 0x70).

  BATTERY MONITORING NOTE: the INA226-based battery bank code below
  (Module 2) is superseded by a Victron Cerbo GX + SmartShunt setup,
  which does not connect through the Tough's I2C at all — see the
  project's equipment list for that architecture. This code is left in
  place but will simply report "hub routing failed" harmlessly unless
  something is actually wired to those hub channels.

  CONFIRMED ON REAL HARDWARE:
    - EXT.IO2 requires the official M5Unit-EXTIO2 library (NOT generic
      PCA9554 registers — it's a custom STM32F030-based protocol).
      Confirmed working: SDA/SCL pin order (32, 33), address 0x45.
    - PC817 bilge/pump channels: active-low, 10kΩ pull-up to 5V, verified
      with point-to-point wiring (a consolidated perfboard version failed
      intermittently and was abandoned).
    - Voltmeter Unit (ADS1115) address is 0x49 on this hardware, not the
      generic default of 0x48 — confirmed via I2C scan.

  STILL NEEDS FIELD CALIBRATION (see relevant sections):
    - Wind vane voltage-to-direction table (Module 3 origin)
    - PaHub channel assignments for additional Voltmeter Units as they're
      wired in (Module 3 origin)
    - GPS RX/TX pin assignment and baud rate (Module 4 origin)
    - Anemometer pulse edge direction (Module 4 origin)
    - VOLTMETER_SCALE_FACTOR calibrated as 41.8 from one test point
      (12.46V actual vs 0.298V raw) — worth re-checking at a second
      voltage to confirm this holds linearly
    - CERBO_MQTT_HOST: placeholder IP, needs the Cerbo's real local address
    - CERBO_PORTAL_ID: placeholder, needs the Cerbo's real VRM Portal ID
    - cerboBanks[] instance numbers: placeholders (0-5) — Venus OS assigns
      these per-shunt automatically and they will NOT necessarily match
      this order; confirm with MQTT Explorer against the real Cerbo before
      trusting which bank is which (Module 2B origin)

  REMOTE WIFI CONFIG (added): both this device and the weather station now
  fetch their real WiFi credentials from Supabase instead of only using a
  hardcoded list — matching the original design intent ("both devices
  should always pull WiFi credentials from Supabase, so changes made in
  Bolt take effect without recoding"). How it works:
    1. On boot, try the credentials cached in /wifi_config.txt on the SD
       card (from a previous successful fetch), if present.
    2. If that fails or nothing is cached yet, fall back to the hardcoded
       knownNetworks[] list below — this is the "break glass" bootstrap
       network needed for a brand-new device's very first connection.
    3. Once connected (via either path), every telemetry POST's response
       is checked for optional "wifi_ssid"/"wifi_password" fields. If
       present and different from what's cached, the new credentials are
       saved to SD and used on the next reconnect/boot.
  ASSUMPTION, NEEDS BACKEND CONFIRMATION: this expects the Supabase edge
  function's response body to optionally include those two fields. If the
  backend doesn't already return them, that's a small addition needed on
  the Supabase side — this firmware only reads them if present and quietly
  does nothing differently if they're absent.

  CERBO GX MQTT BRIDGE (added): pulls battery bank data from the Cerbo GX's
  local MQTT broker (Venus OS) instead of the superseded INA226/PaHub code
  above. IMPORTANT, confirmed via Venus OS documentation before writing
  this — two real protocol gotchas that would otherwise look exactly like
  a silent connection failure:
    1. Venus OS ONLY publishes live data to a device that sends it a
       periodic "keepalive" — without one, it publishes its own serial
       number once at connect and then goes completely silent. This
       firmware sends that keepalive automatically every 60s.
    2. Topics are structured as N/<VRM Portal ID>/battery/<instance>/...
       — the Portal ID is specific to your physical Cerbo GX and the
       instance numbers are specific to how your 6 SmartShunts enumerate
       once actually connected. Both are PLACEHOLDERS below and MUST be
       confirmed against the real hardware (an app like MQTT Explorer,
       pointed at the Cerbo's IP, will show you the real topic tree) —
       this is the same kind of "verify on real hardware before trusting
       it" step that mattered for every other module in this project.

  Requires: M5Unified, WiFi, HTTPClient, Wire, SPI, SD, SparkFun u-blox GNSS Arduino Library,
  M5Unit-EXTIO2 (install from GitHub, not Library Manager), ArduinoJson,
  PubSubClient (by Nick O'Leary — standard MQTT client, in Library Manager).
*/

#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <SparkFun_u-blox_GNSS_Arduino_Library.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>

// ============================================================
// SHARED: WiFi, Telemetry endpoint, SD buffering
// ============================================================
// Hardcoded BOOTSTRAP network only — this is the "break glass" fallback
// used only when no cached credentials exist yet (brand-new device) or
// the cached ones fail to connect. Once the device successfully checks in
// with Supabase, its real credentials get cached to SD and used from then
// on — this list should rarely matter after first setup.
struct WifiCredential {
  const char* ssid;
  const char* password;
};
WifiCredential knownNetworks[] = {
  {"AZ Marine", "9286376500"},
  // Add more bootstrap-only networks here if needed, e.g. for bench testing:
  // {"YourHomeNetwork", "YourHomePassword"},
};
const int NUM_KNOWN_NETWORKS = sizeof(knownNetworks) / sizeof(knownNetworks[0]);

const char* WIFI_CONFIG_FILE = "/wifi_config.txt";
String cachedSsid = "";
String cachedPassword = "";

// ORION's actual architecture: a single Supabase edge function endpoint,
// authenticated with a per-device API key (X-Device-Key header) rather
// than the generic multi-table REST + anon key pattern this file used
// before. All readings — sensor and location — post to the same URL.
const char* TELEMETRY_URL   = "https://eqiecntollhgfxmmbize.supabase.co/functions/v1/vessel-monitor-telemetry";
const char* DEVICE_API_KEY  = "e4411330-5c9f-4d81-ab8b-7e4083ab10d6";
const char* DEVICE_SERIAL   = "k034326040100309";

// Kept for now since bufferOrSend() call sites still pass one of these —
// both point at the same telemetry endpoint under this architecture, so
// the specific value no longer changes where the request goes.
const char* SENSOR_READINGS_EP   = "";
const char* LOCATION_READINGS_EP = "";

#define SD_SPI_CS_PIN   4
#define SD_SPI_SCK_PIN  18
#define SD_SPI_MOSI_PIN 23
#define SD_SPI_MISO_PIN 38
const char* BUFFER_FILE = "/buffer.jsonl";
bool sdReady = false;

// Reads /wifi_config.txt (format: two lines — ssid, then password) into
// cachedSsid/cachedPassword. Returns true if a cached network was found.
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

// Saves new credentials to SD, replacing whatever was cached before.
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

// Checks a Supabase telemetry response for updated WiFi credentials and
// caches them if they're new. Safe to call on every response — does
// nothing if the fields aren't present or haven't changed.
void checkForWifiConfigUpdate(const String& responseBody) {
  if (responseBody.length() == 0) return;

  JsonDocument doc;  // ArduinoJson v7 style; use StaticJsonDocument<256> if on v6
  DeserializationError err = deserializeJson(doc, responseBody);
  if (err) return;  // not JSON, or doesn't parse — nothing to do

  if (!doc["wifi_ssid"].is<const char*>()) return;  // field not present

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
  WiFi.mode(WIFI_STA);  // fixes "cannot set config" error on some boards —
                        // must explicitly set station mode before begin()
  WiFi.disconnect(true);
  delay(100);

  // 1. Try cached credentials from a previous successful Supabase check-in
  if (loadCachedWifiConfig()) {
    if (tryConnect(cachedSsid.c_str(), cachedPassword.c_str(), 8000)) return;
    Serial.println("Cached network failed — falling back to bootstrap list.");
  }

  // 2. Fall back to the hardcoded bootstrap list
  for (int i = 0; i < NUM_KNOWN_NETWORKS; i++) {
    if (tryConnect(knownNetworks[i].ssid, knownNetworks[i].password, 8000)) return;
  }

  Serial.println("Could not connect to any known network — will retry in loop()");
}

bool setupSDBuffer() {
  // Uses the plain shared SPI object — matches M5Stack's own official SD
  // example for the Tough, which is confirmed working. An earlier version
  // of this code used a separate dedicated SPIClass(VSPI) instance, which
  // turned out to conflict with the display's use of the same physical
  // VSPI peripheral and caused SD detection to fail. Reverted.
  SPI.begin(SD_SPI_SCK_PIN, SD_SPI_MISO_PIN, SD_SPI_MOSI_PIN, SD_SPI_CS_PIN);
  if (!SD.begin(SD_SPI_CS_PIN, SPI, 25000000)) {
    Serial.println("SD card not detected — buffering disabled");
    return false;
  }
  Serial.println("SD card ready.");
  return true;
}

// NOTE: exact expected field names inside "data" are a best guess (mirrors
// the sensor_name/value or lat/lng shape the rest of this firmware already
// builds). If the edge function rejects this with a schema error, check the
// error response — Supabase edge functions usually return a clear message
// about what field is missing or malformed — and adjust the wrapping below
// to match.
bool sendToSupabase(const char* endpoint, const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) return false;

  // HTTPS requires an explicit secure client — without this, HTTPClient can
  // hang indefinitely trying to negotiate TLS instead of failing cleanly,
  // which is what caused the "stuck" behavior. setInsecure() skips
  // certificate validation (fine for getting this working now; a properly
  // pinned root CA would be the more secure long-term choice).
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);  // don't hang forever if the server's slow/unreachable

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
  Serial.println(jsonPayload);  // shows exactly which sensor + value is being sent
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

// Streams the buffer file line-by-line instead of loading it all into an
// array — the earlier array-based version crashed with a stack overflow
// once enough readings had buffered up (500, then even 20, String objects
// held at once was still fragile), and separately risked silently losing
// any lines beyond whatever batch size was read. This version handles a
// buffer file of any length safely and never drops a reading.
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
      // Already hit a failure this pass — carry every remaining line
      // forward untouched, preserving order for the next attempt.
      out.println(line);
      keptCount++;
      continue;
    }

    int sep = line.indexOf('|');
    if (sep < 0) continue;  // malformed line, drop it

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
// MODULE 1: Bilge & pump status — I2C BUS A (Wire), PORT.A
// ------------------------------------------------------------
// CORRECTED to use the official M5Unit-EXTIO2 library instead of raw
// PCA9554-style register access. The EXT.IO2 is NOT a PCA9554 chip — it's
// M5Stack's own STM32F030-based design with a custom protocol, confirmed
// against official M5Stack documentation and verified working on real
// hardware (10kΩ pull-up to 5V, active-low: reads HIGH at rest, LOW when
// triggered). Requires the M5Unit-EXTIO2 library, installed from GitHub
// (not the Arduino Library Manager): https://github.com/m5stack/M5Unit-EXTIO2
// ============================================================
#include "M5_EXTIO2.h"

M5_EXTIO2 extio;

// Confirmed working pin order on this hardware: (Wire, SDA, SCL, address)
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
  {4, "A/C Water Pump",                   false},  // CU 301 relay
  {5, "Fresh Water Pump",                 false},  // CU 301 relay (separate unit)
};
const int NUM_CHANNELS = 6;

bool extioReady = false;

void setupEXTIO2() {
  int attempts = 0;
  // Bounded now, not infinite — a missing/unplugged EXT.IO2 (e.g. during
  // bench testing without the Y-splitter yet) used to hang the entire
  // program here forever, blocking WiFi/GPS/everything else from ever
  // starting. Now it gives up after 20 tries and lets the rest of the
  // system run; handleBilgePump() checks extioReady before using it.
  while (!extio.begin(&Wire, EXTIO2_SDA, EXTIO2_SCL, EXTIO2_ADDR)) {
    Serial.println("EXT.IO2 connect error, retrying...");
    delay(300);
    attempts++;
    if (attempts >= 20) {
      Serial.println("EXT.IO2 not found after 20 tries — continuing without it. Bilge/pump readings will be unavailable until it's connected and the device is reset.");
      return;
    }
  }
  Serial.println("EXT.IO2 connected. FW version: " + String(extio.getVersion()));
  extio.setAllPinMode(DIGITAL_INPUT_MODE);
  extioReady = true;
}

unsigned long lastBilgeCheck = 0;
const unsigned long BILGE_CHECK_INTERVAL_MS = 1000;
unsigned long lastWifiReconnectAttempt = 0;
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 30000;

void handleBilgePump() {
  if (!extioReady) return;  // skip silently rather than call into a chip that was never found

  for (int i = 0; i < NUM_CHANNELS; i++) {
    // Confirmed on real hardware: reads HIGH (1) at rest, LOW (0) when the
    // float switch / CU 301 relay triggers — hence the inversion below to
    // report "active" in the intuitive sense (true = pump/alarm triggered).
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
// MODULE 2: Battery banks — SUPERSEDED by Cerbo GX/SmartShunt, code kept
// for reference but not actively wired (see header note)
// ============================================================
#define PRIMARY_HUB_ADDR    0x70
#define SECONDARY_HUB_ADDR  0x71
#define SECONDARY_HUB_UPSTREAM_CH 0

#define INA226_I2C_ADDR      0x40
#define INA226_REG_BUS_V     0x02
#define INA226_REG_CURRENT   0x04
#define INA226_REG_CAL       0x05

const float RSHUNT      = 0.0001f;
const float CURRENT_LSB = 0.02f;
const uint16_t CAL_VALUE = (uint16_t)(0.00512f / (CURRENT_LSB * RSHUNT));

struct BatteryBank {
  const char* name;
  bool onSecondaryHub;
  uint8_t hubChannel;
};
BatteryBank banks[6] = {
  {"Port Engine Battery",       false, 1},
  {"Starboard Engine Battery",  false, 2},
  {"Port Generator Battery",    false, 3},
  {"Starboard Generator Battery", false, 4},
  {"Inverter Batteries",        false, 5},
  {"12V System Battery",        true,  0},
};

bool selectHubChannel(uint8_t hubAddr, uint8_t channel) {
  Wire.beginTransmission(hubAddr);
  Wire.write(1 << channel);
  return Wire.endTransmission() == 0;
}

// Explicit forward declaration — works around an Arduino IDE auto-prototype
// quirk where custom struct types used as function parameters aren't yet
// known at the point the IDE inserts its own auto-generated prototypes.
bool routeToBank(const BatteryBank& bank);

bool routeToBank(const BatteryBank& bank) {
  if (bank.onSecondaryHub) {
    if (!selectHubChannel(PRIMARY_HUB_ADDR, SECONDARY_HUB_UPSTREAM_CH)) return false;
    if (!selectHubChannel(SECONDARY_HUB_ADDR, bank.hubChannel)) return false;
  } else {
    if (!selectHubChannel(PRIMARY_HUB_ADDR, bank.hubChannel)) return false;
  }
  return true;
}

void setupINA226() {
  for (int i = 0; i < 6; i++) {
    if (!routeToBank(banks[i])) continue;
    Wire.beginTransmission(INA226_I2C_ADDR);
    Wire.write(INA226_REG_CAL);
    Wire.write((CAL_VALUE >> 8) & 0xFF);
    Wire.write(CAL_VALUE & 0xFF);
    Wire.endTransmission();
  }
}

bool readINA226(float& busVoltage, float& current) {
  Wire.beginTransmission(INA226_I2C_ADDR);
  Wire.write(INA226_REG_BUS_V);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)INA226_I2C_ADDR, 2);
  if (Wire.available() < 2) return false;
  int16_t rawBus = (Wire.read() << 8) | Wire.read();
  busVoltage = rawBus * 0.00125f;

  Wire.beginTransmission(INA226_I2C_ADDR);
  Wire.write(INA226_REG_CURRENT);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)INA226_I2C_ADDR, 2);
  if (Wire.available() < 2) return false;
  int16_t rawCurrent = (Wire.read() << 8) | Wire.read();
  current = rawCurrent * CURRENT_LSB;
  return true;
}

unsigned long lastBatteryCheck = 0;
const unsigned long BATTERY_CHECK_INTERVAL_MS = 30000;
int batteryIndex = 0;  // stagger banks one at a time across loop() calls

void handleBatteryBanks() {
  if (!routeToBank(banks[batteryIndex])) {
    Serial.printf("Hub routing failed for %s\n", banks[batteryIndex].name);
  } else {
    float voltage, current;
    if (readINA226(voltage, current)) {
      String payload = String("{\"sensor_name\":\"") + banks[batteryIndex].name +
                        "\",\"value\":{\"voltage\":" + String(voltage, 2) +
                        ",\"current\":" + String(current, 2) + "}}";
      bufferOrSend(SENSOR_READINGS_EP, payload);
    }
  }
  batteryIndex = (batteryIndex + 1) % 6;
}

// ============================================================
// MODULE 2B: Battery banks — ACTUAL data source: Cerbo GX via MQTT
// ------------------------------------------------------------
// This is what's actually wired in for battery monitoring now (the
// INA226 code above is dead code, kept only for reference). Connects
// over WiFi to the Cerbo's local MQTT broker on the boat's own network
// — not the internet — so this only works when the Tough is on the same
// LAN as the Cerbo GX.
// ============================================================

// PLACEHOLDER — replace with your Cerbo GX's actual local IP address
// (find it in Venus OS's own network settings screen, or your router's
// device list).
const char* CERBO_MQTT_HOST = "192.168.1.100";
const int   CERBO_MQTT_PORT = 1883;  // Venus OS default, unencrypted, LAN-only

// PLACEHOLDER — your Cerbo's VRM Portal ID. Find it on the Cerbo's own
// display (Settings -> VRM Online Portal) or via the VRM Portal website.
// Every MQTT topic is scoped under this ID.
const char* CERBO_PORTAL_ID = "YOUR_VRM_PORTAL_ID";

// PLACEHOLDER — which "battery" service instance number corresponds to
// which physical SmartShunt. Venus OS assigns these automatically as
// each shunt is connected; the actual numbers WILL NOT necessarily be
// 0-5 in this order. Confirm with MQTT Explorer (or similar) pointed at
// the Cerbo before trusting this mapping — this is a placeholder,
// exactly like the PaHub channel assignments were before real hardware
// confirmed them.
struct CerboBattery {
  const char* name;
  int instance;
};
CerboBattery cerboBanks[6] = {
  {"Port Engine Battery",          0},
  {"Starboard Engine Battery",     1},
  {"Port Generator Battery",       2},
  {"Starboard Generator Battery",  3},
  {"Inverter Batteries",           4},
  {"12V System Battery",           5},
};

WiFiClient mqttWifiClient;
PubSubClient mqttClient(mqttWifiClient);

float cerboVoltage[6] = {0, 0, 0, 0, 0, 0};
float cerboCurrent[6] = {0, 0, 0, 0, 0, 0};
bool  cerboHasVoltage[6] = {false, false, false, false, false, false};
bool  cerboHasCurrent[6] = {false, false, false, false, false, false};

// Matches an incoming topic against our 6 known banks and updates the
// cached value. Venus OS payloads are JSON like {"value": 12.65}.
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);
  String payloadStr;
  for (unsigned int i = 0; i < length; i++) payloadStr += (char)payload[i];

  JsonDocument doc;
  if (deserializeJson(doc, payloadStr)) return;
  if (!doc["value"].is<float>()) return;
  float value = doc["value"].as<float>();

  for (int i = 0; i < 6; i++) {
    String prefix = String("N/") + CERBO_PORTAL_ID + "/battery/" + cerboBanks[i].instance + "/Dc/0/";
    if (topicStr == prefix + "Voltage") {
      cerboVoltage[i] = value;
      cerboHasVoltage[i] = true;
    } else if (topicStr == prefix + "Current") {
      cerboCurrent[i] = value;
      cerboHasCurrent[i] = true;
    }
  }

  // Once we have BOTH voltage and current for a bank, push a combined
  // reading and reset the flags so we don't re-send stale pairs.
  for (int i = 0; i < 6; i++) {
    if (cerboHasVoltage[i] && cerboHasCurrent[i]) {
      String reading = String("{\"sensor_name\":\"") + cerboBanks[i].name +
                        "\",\"value\":{\"voltage\":" + String(cerboVoltage[i], 2) +
                        ",\"current\":" + String(cerboCurrent[i], 2) + "}}";
      bufferOrSend(SENSOR_READINGS_EP, reading);
      cerboHasVoltage[i] = false;
      cerboHasCurrent[i] = false;
    }
  }
}

bool cerboMqttReady = false;

void setupCerboMQTT() {
  mqttClient.setServer(CERBO_MQTT_HOST, CERBO_MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void connectCerboMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  Serial.print("Connecting to Cerbo GX MQTT broker...");
  String clientId = String("ORION-Tough-") + String((uint32_t)ESP.getEfuseMac(), HEX);
  if (mqttClient.connect(clientId.c_str())) {
    Serial.println(" connected.");
    cerboMqttReady = true;

    for (int i = 0; i < 6; i++) {
      String base = String("N/") + CERBO_PORTAL_ID + "/battery/" + cerboBanks[i].instance + "/Dc/0/";
      mqttClient.subscribe((base + "Voltage").c_str());
      mqttClient.subscribe((base + "Current").c_str());
    }
  } else {
    Serial.printf(" failed, rc=%d — will retry\n", mqttClient.state());
    cerboMqttReady = false;
  }
}

unsigned long lastCerboKeepalive = 0;
const unsigned long CERBO_KEEPALIVE_INTERVAL_MS = 60000;  // Venus OS goes
// silent without this — confirmed requirement, not optional. The keepalive
// topic convention is a read-request on the system serial; sending it
// periodically keeps Venus OS actively publishing on the N/ topics above.

void handleCerboMQTT() {
  if (!mqttClient.connected()) {
    connectCerboMQTT();
    return;
  }
  mqttClient.loop();

  if (millis() - lastCerboKeepalive > CERBO_KEEPALIVE_INTERVAL_MS) {
    String keepaliveTopic = String("R/") + CERBO_PORTAL_ID + "/system/0/Serial";
    mqttClient.publish(keepaliveTopic.c_str(), "");
    lastCerboKeepalive = millis();
  }
}

// ============================================================
// MODULE 3: Alternators & wind vane — shares PORT.A's I2C bus (Wire) via
// PaHub, connected through a Y-splitter alongside the EXT.IO2
// ============================================================
#define ADS1115_I2C_ADDR     0x49
#define ADS1115_REG_CONVERT  0x00
#define ADS1115_REG_CONFIG   0x01

const float VOLTMETER_SCALE_FACTOR = 41.8f;  // Calibrated on real hardware: 12.46V actual
                                              // (multimeter) / 0.298V raw ADS1115 reading.
                                              // NOTE: leads were reversed during this test
                                              // (raw reading was negative) — physically swap
                                              // +/- on the Voltmeter Unit before relying on
                                              // this in the field, or add a sign-flip in code.

struct VoltagePoint {
  const char* name;
  bool onSecondaryHub;
  uint8_t hubChannel;
  uint8_t adsChannel;
};
VoltagePoint points[5] = {
  {"Port Engine Alternator",       false, 6, 0},
  {"Starboard Engine Alternator",  false, 6, 1},
  {"Port Generator Alternator",    true,  1, 0},
  {"Starboard Generator Alternator", true, 1, 1},
  {"Wind Vane Direction",          true,  2, 0},
};
// NOTE: hubChannel values are placeholders — cross-check against actual wiring.

// Same auto-prototype workaround as routeToBank() above.
bool routeToPoint(const VoltagePoint& pt);

bool routeToPoint(const VoltagePoint& pt) {
  if (pt.onSecondaryHub) {
    if (!selectHubChannel(PRIMARY_HUB_ADDR, SECONDARY_HUB_UPSTREAM_CH)) return false;
    if (!selectHubChannel(SECONDARY_HUB_ADDR, pt.hubChannel)) return false;
  } else {
    if (!selectHubChannel(PRIMARY_HUB_ADDR, pt.hubChannel)) return false;
  }
  return true;
}

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

const char* windVaneVoltageToDirection(float volts) {
  if (volts < 0.5) return "N (uncalibrated)";
  if (volts < 1.0) return "NE (uncalibrated)";
  if (volts < 1.5) return "E (uncalibrated)";
  if (volts < 2.0) return "SE (uncalibrated)";
  if (volts < 2.5) return "S (uncalibrated)";
  if (volts < 3.0) return "SW (uncalibrated)";
  if (volts < 3.5) return "W (uncalibrated)";
  return "NW (uncalibrated)";
}

unsigned long lastVoltageCheck = 0;
const unsigned long VOLTAGE_CHECK_INTERVAL_MS = 15000;
int voltageIndex = 0;

void handleVoltagePoints() {
  if (!routeToPoint(points[voltageIndex])) {
    Serial.printf("Hub routing failed for %s\n", points[voltageIndex].name);
  } else {
    float rawVolts;
    if (readADS1115(points[voltageIndex].adsChannel, rawVolts)) {
      bool isDirection = (voltageIndex == 4);
      String payload;
      if (isDirection) {
        payload = String("{\"sensor_name\":\"") + points[voltageIndex].name +
                  "\",\"value\":{\"direction\":\"" + windVaneVoltageToDirection(rawVolts) +
                  "\",\"raw_volts\":" + String(rawVolts, 3) + "}}";
      } else {
        float scaled = rawVolts * VOLTMETER_SCALE_FACTOR;
        payload = String("{\"sensor_name\":\"") + points[voltageIndex].name +
                  "\",\"value\":{\"voltage\":" + String(scaled, 2) + "}}";
      }
      bufferOrSend(SENSOR_READINGS_EP, payload);
    }
  }
  voltageIndex = (voltageIndex + 1) % 5;
}

// ============================================================
// MODULE 4: GPS (I2C via PaHub channel 5) + Anemometer (RS485 pin, GPIO)
// ============================================================
// SparkFun NEO-M9N, I2C address 0x42, on PaHub channel 5. Powered by its
// own USB-C; only SDA/SCL/GND are wired to the PaHub port. Verified on
// the bench: 3D fix, 8 satellites, through the PaHub.
#define GPS_PAHUB_CHANNEL 5

SFE_UBLOX_GNSS myGNSS;
bool gpsReady = false;
unsigned long lastGpsPush = 0;
const unsigned long GPS_PUSH_INTERVAL_MS = 30000;

#define ANEMOMETER_PIN 27
volatile unsigned long pulseCount = 0;
unsigned long lastWindCalc = 0;
const unsigned long WIND_CALC_INTERVAL_MS = 5000;
const float MPH_PER_PULSE_PER_SEC = 1.492f;  // SparkFun published spec

void IRAM_ATTR onAnemometerPulse() {
  pulseCount++;
}

bool setupGPS() {
  if (!selectHubChannel(PRIMARY_HUB_ADDR, GPS_PAHUB_CHANNEL)) {
    Serial.println("GPS: PaHub not responding");
    return false;
  }
  if (!myGNSS.begin(Wire)) {
    Serial.println("GPS: NEO-M9N not found on PaHub channel 5");
    return false;
  }
  myGNSS.setI2COutput(COM_TYPE_UBX);
  Serial.println("GPS: NEO-M9N ready");
  return true;
}

void handleGPS() {
  if (millis() - lastGpsPush < GPS_PUSH_INTERVAL_MS) return;
  lastGpsPush = millis();

  // Retry init if the GPS wasn't there at boot
  if (!gpsReady) gpsReady = setupGPS();
  if (!gpsReady) return;

  // Other modules leave different PaHub channels open, so always
  // re-select the GPS channel before talking to it.
  selectHubChannel(PRIMARY_HUB_ADDR, GPS_PAHUB_CHANNEL);

  byte fix = myGNSS.getFixType();
  if (fix >= 2) {
    double lat = myGNSS.getLatitude() / 10000000.0;
    double lng = myGNSS.getLongitude() / 10000000.0;
    double speedMph = (myGNSS.getGroundSpeed() / 1000.0) * 2.23694;   // mm/s -> mph
    double heading = myGNSS.getHeading() / 100000.0;                  // deg * 1e-5
    String payload = String("{\"lat\":") + String(lat, 6) +
                      ",\"lng\":" + String(lng, 6) +
                      ",\"speed_mph\":" + String(speedMph, 1) +
                      ",\"heading_deg\":" + String(heading, 1) + "}";
    bufferOrSend(LOCATION_READINGS_EP, payload);
  } else {
    Serial.println("No valid GPS fix yet");
  }
}

void handleWindSpeed() {
  if (millis() - lastWindCalc > WIND_CALC_INTERVAL_MS) {
    noInterrupts();
    unsigned long count = pulseCount;
    pulseCount = 0;
    interrupts();

    float pulsesPerSecond = count / (WIND_CALC_INTERVAL_MS / 1000.0f);
    float windMph = pulsesPerSecond * MPH_PER_PULSE_PER_SEC;

    String payload = String("{\"sensor_name\":\"Wind Speed\",\"value\":{\"mph\":") +
                      String(windMph, 1) + "}}";
    bufferOrSend(SENSOR_READINGS_EP, payload);
    lastWindCalc = millis();
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

  // SD init runs FIRST, immediately after M5.begin() — matches M5Stack's
  // own official example's timing. Some SD cards need their SPI init
  // sequence within a short window after power-up or they silently fall
  // back to native mode and stop responding to SPI. Running this after
  // several other peripherals' setup (as an earlier version of this file
  // did) was likely causing exactly that — confirmed by diagnostic testing
  // where SD detection failed only when checked last, not first.
  sdReady = setupSDBuffer();

  // Two separate I2C buses — see header comment for why this matters
  Wire.begin(32, 33);    // PORT.A -> EXT.IO2
  // Port B cannot do standard I2C (GPIO36 is input-only, confirmed via
  // official M5Stack docs) — the PaHub actually shares Port A's bus with
  // the EXT.IO2, via a Y-splitter cable. No separate Wire.begin() needed
  // here; Wire.begin(32, 33) above already covers both devices.

  pinMode(ANEMOMETER_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ANEMOMETER_PIN), onAnemometerPulse, FALLING);

  setupWiFi();
  setupEXTIO2();
  setupINA226();  // dead code path (INA226 unused), kept only for reference
  setupCerboMQTT();  // ACTUAL battery data source now
  gpsReady = setupGPS();  // GPS on PaHub channel 5 (I2C)

  Serial.println("Combined firmware online: bilge/pump, battery (via Cerbo MQTT), alternators/wind vane, GPS, wind speed.");
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiReconnectAttempt >= WIFI_RECONNECT_INTERVAL_MS) {
    lastWifiReconnectAttempt = millis();
    setupWiFi();
  }

  // Bilge/pump: checked every loop pass, internally rate-limited
  if (millis() - lastBilgeCheck > BILGE_CHECK_INTERVAL_MS) {
    handleBilgePump();
    lastBilgeCheck = millis();
  }

  // Battery banks: now event-driven via Cerbo MQTT rather than polled —
  // handleCerboMQTT() processes incoming messages and sends the keepalive
  // Venus OS requires to keep publishing.
  handleCerboMQTT();

  // Alternators/wind vane: one point per interval, cycling through all 5
  if (millis() - lastVoltageCheck > VOLTAGE_CHECK_INTERVAL_MS) {
    handleVoltagePoints();
    lastVoltageCheck = millis();
  }

  handleGPS();
  handleWindSpeed();

  if (millis() - lastFlush > FLUSH_INTERVAL_MS) {
    flushBuffer();
    lastFlush = millis();
  }

  delay(50);
}
