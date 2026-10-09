/*
  Weather Station — SparkFun MicroMod Weather Carrier Board
  ============================================================
  This runs on the carrier board's OWN onboard ESP32 (MicroMod processor),
  independent from the main ORION Tough. It reads:
    - Wind speed & direction, rainfall (via the RJ11 Weather Meter Kit,
      using SparkFun's official Weather Meter Kit library)
    - Temperature/humidity/pressure (onboard BME280)
    - Lightning strikes (onboard AS3935)
  ...and pushes readings to the same Supabase telemetry endpoint ORION
  uses, over its own WiFi connection.

  Pin assignments confirmed via SparkFun's official hookup guide for this
  board — do not change unless you've verified otherwise:
    WSPEED = D0, WDIR = A1, RAIN = D1

  IMPORTANT: this device needs its OWN device serial and API key from your
  bolt.new/Supabase device registry — using ORION's device key here would
  make every reading look like it came from the Tough instead. Register
  this as a second device first, then fill in its real credentials below.

  REMOTE WIFI CONFIG (added): fetches its real WiFi credentials from
  Supabase instead of only using a hardcoded bootstrap list, so a change
  made in Bolt takes effect without re-flashing this board. Since this
  board has no SD wiring built yet, credentials are cached in the ESP32's
  built-in flash storage (Preferences/NVS) instead — same idea as the
  Tough's SD-based caching, just using storage that needs no extra
  hardware. How it works:
    1. On boot, try credentials cached in flash from a previous successful
       check-in, if present.
    2. If that fails or nothing is cached yet, fall back to the hardcoded
       knownNetworks[] bootstrap list below.
    3. Once connected, every telemetry POST's response is checked for
       optional "wifi_ssid"/"wifi_password" fields; if present and new,
       they're cached to flash and used on the next reconnect/boot.
  ASSUMPTION, NEEDS BACKEND CONFIRMATION: same as the Tough's firmware —
  this expects the Supabase edge function's response to optionally include
  those two fields. If the backend doesn't return them yet, that's a small
  addition needed on the Supabase side.

  Requires (all via Library Manager):
    SparkFun Weather Meter Kit Arduino Library
    SparkFun BME280
    SparkFun AS3935 Lightning Detector Arduino Library
    ArduinoJson
    WiFi, WiFiClientSecure, HTTPClient, Preferences (standard, included
    with ESP32 core)
*/

#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <SparkFun_Weather_Meter_Kit_Arduino_Library.h>
#include <SparkFunBME280.h>
#include <SparkFun_AS3935.h>

// ---------------- WiFi ----------------
// Hardcoded BOOTSTRAP network only — the "break glass" fallback used when
// no cached credentials exist yet or the cached ones fail. Once this
// board successfully checks in with Supabase, its real credentials get
// cached to flash and used from then on.
struct WifiCredential {
  const char* ssid;
  const char* password;
};
WifiCredential knownNetworks[] = {
  {"AZMarine", "9286376500"},
  // Add bench-test networks here as needed, e.g.:
  // {"YourNetwork", "YourPassword"},
};
const int NUM_KNOWN_NETWORKS = sizeof(knownNetworks) / sizeof(knownNetworks[0]);

Preferences wifiPrefs;
String cachedSsid = "";
String cachedPassword = "";

bool loadCachedWifiConfig() {
  wifiPrefs.begin("wifi-cfg", true);  // read-only
  cachedSsid = wifiPrefs.getString("ssid", "");
  cachedPassword = wifiPrefs.getString("password", "");
  wifiPrefs.end();
  if (cachedSsid.length() == 0) return false;
  Serial.println("Loaded cached WiFi config for network: " + cachedSsid);
  return true;
}

void saveCachedWifiConfig(const String& ssid, const String& password) {
  wifiPrefs.begin("wifi-cfg", false);  // read-write
  wifiPrefs.putString("ssid", ssid);
  wifiPrefs.putString("password", password);
  wifiPrefs.end();
  cachedSsid = ssid;
  cachedPassword = password;
  Serial.println("Cached new WiFi credentials for network: " + ssid);
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

// ---------------- Telemetry endpoint ----------------
// TODO: this weather station needs its OWN device serial + API key,
// separate from ORION's. Register it in your device system and fill
// these in before relying on this in the field.
const char* TELEMETRY_URL  = "https://eqiecntollhgfxmmbize.supabase.co/functions/v1/vessel-monitor-telemetry";
const char* DEVICE_API_KEY = "YOUR_WEATHER_STATION_DEVICE_KEY";
const char* DEVICE_SERIAL  = "YOUR_WEATHER_STATION_DEVICE_SERIAL";

// ---------------- Weather Meter Kit (wind + rain) ----------------
const byte WSPEED = 0;   // D0
const byte RAIN   = 1;   // D1
const byte WDIR   = A1;  // A1
SFEWeatherMeterKit myWeatherMeter(WDIR, WSPEED, RAIN);

// ---------------- Onboard sensors ----------------
BME280 myBME280;
SparkFun_AS3935 myLightning;
#define LIGHTNING_INT_PIN 2  // confirm against board schematic if lightning IRQ doesn't fire

// ---------------- Supabase push ----------------
bool sendToSupabase(const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  // NOTE: this board's SparkFun ESP32 core version doesn't expose
  // setInsecure() the way the Tough's core does. Omitting it: most
  // WiFiClientSecure implementations don't enforce certificate validation
  // unless you explicitly call setCACert() with a certificate — so this
  // should still connect, just without the explicit "skip validation"
  // call. If this fails to connect at all, that's the first thing to
  // revisit (may need setCACert(NULL) or a core update instead).
  client.setTimeout(10000);

  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, TELEMETRY_URL)) return false;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  String body = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                "\",\"data\":" + jsonPayload + "}";

  int httpCode = http.POST(body);
  Serial.printf("POST -> HTTP %d\n", httpCode);
  if (httpCode > 0) {
    String responseBody = http.getString();
    checkForWifiConfigUpdate(responseBody);
  }
  http.end();
  return (httpCode >= 200 && httpCode < 300);
}

void pushReading(const char* sensorName, const String& valueJson) {
  String payload = String("{\"sensor_name\":\"") + sensorName +
                    "\",\"value\":" + valueJson + "}";
  sendToSupabase(payload);
}

// ---------------- Lightning interrupt ----------------
volatile bool lightningInterrupt = false;
unsigned long lastStrikeMs = 0;  // 0 = no strike since boot
bool lightningReady = false;   // true only if the AS3935 started up OK
void IRAM_ATTR onLightningIRQ() {
  lightningInterrupt = true;
}

unsigned long lastReadingPush = 0;
const unsigned long READING_INTERVAL_MS = 15000;

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin();  // onboard sensors are on the board's own I2C bus

  setupWiFi();

  myWeatherMeter.begin();

  if (myBME280.beginI2C() == false) {
    Serial.println("BME280 not detected — check onboard sensor.");
  }

  if (myLightning.begin() == false) {
    // NOTE: this carrier board wires the AS3935 lightning sensor over I2C,
    // not SPI (unlike some other AS3935 breakout boards). If lightning
    // detection doesn't initialize, check whether this specific board
    // revision needs a different I2C address or pin.
    Serial.println("AS3935 (lightning) not detected — check onboard sensor.");
  } else {
    pinMode(LIGHTNING_INT_PIN, INPUT);
    attachInterrupt(digitalPinToInterrupt(LIGHTNING_INT_PIN), onLightningIRQ, RISING);
    lightningReady = true;
  }

  Serial.println("Weather station online.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  if (lightningInterrupt) {
    lightningInterrupt = false;
    lastStrikeMs = millis();
    int distance = myLightning.distanceToStorm();
    String payload = String("{\"status\":\"Strike detected\",\"distance_km\":") + distance + "}";
    pushReading("Lightning Strike", payload);
    Serial.printf("Lightning detected — distance: %d km\n", distance);
  }

  if (millis() - lastReadingPush > READING_INTERVAL_MS) {
    lastReadingPush = millis();

    float windSpeedMph = myWeatherMeter.getWindSpeed();
    float windDirDeg = myWeatherMeter.getWindDirection();
    float rainMm = myWeatherMeter.getTotalRainfall();

    pushReading("Wind Speed", String("{\"mph\":") + windSpeedMph + "}");
    pushReading("Wind Direction", String("{\"deg\":") + windDirDeg + "}");
    pushReading("Rainfall", String("{\"mm\":") + rainMm + "}");

    float tempF = myBME280.readTempF();
    float humidity = myBME280.readFloatHumidity();
    float pressure = myBME280.readFloatPressure();
    pushReading("Atmospheric", String("{\"temp_f\":") + tempF +
                ",\"humidity_pct\":" + humidity +
                ",\"pressure_pa\":" + pressure + "}");

    // Lightning heartbeat: only sent when the sensor started OK, so the
    // dashboard shows "No strikes detected" instead of Offline. If the
    // sensor failed to start, nothing is sent and it correctly stays Offline.
    // (skipped for 30 min after a real strike so the strike stays visible)
    if (lightningReady && (lastStrikeMs == 0 || millis() - lastStrikeMs > 1800000UL)) {
      pushReading("Lightning Strike", String("{\"status\":\"No strikes detected\"}"));
    }

    Serial.printf("Wind: %.1f mph @ %.0f deg | Rain: %.1f mm | Temp: %.1f F | Humidity: %.1f%%\n",
                  windSpeedMph, windDirDeg, rainMm, tempF, humidity);
  }

  delay(50);
}
