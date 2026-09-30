/*
  Weather Station — SparkFun MicroMod Weather Carrier Board (MicroMod ESP32)
  Runs on the carrier's own MicroMod ESP32, independent from ORION.

  Required libraries:
    ArduinoJson
    SparkFun Weather Meter Kit Arduino Library
    SparkFun BME280
    SparkFun AS3935 Lightning Detector Arduino Library
*/

#include <Wire.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <SparkFun_Weather_Meter_Kit_Arduino_Library.h>
#include <SparkFunBME280.h>
#include <SparkFun_AS3935.h>

#ifndef D0
  #define D0 14
#endif
#ifndef D1
  #define D1 27
#endif
#ifndef A1
  #define A1 35
#endif

struct WifiCredential {
  const char* ssid;
  const char* password;
};

WifiCredential knownNetworks[] = {
  {"AZ Marine", "9286376500"},
  {"kbracing", "Sapper12!@"},
};
const int NUM_KNOWN_NETWORKS = sizeof(knownNetworks) / sizeof(knownNetworks[0]);

const char* TELEMETRY_URL = "https://eqiecntollhgfxmmbize.supabase.co/functions/v1/vessel-monitor-telemetry";
const char* DEVICE_API_KEY = "600c5e77-7f6b-4a82-a182-274c4659faa8";
const char* DEVICE_SERIAL = "WX-ORION-PENDING";
const char* CONFIG_URL = "https://eqiecntollhgfxmmbize.supabase.co/functions/v1/device-config";

Preferences prefs;
String yachtSsid;
String yachtPass;
String prevSsid;
String prevPass;
bool meterStarted = false;
bool bmeOK = false;
bool lightningOK = false;
bool credentialsSet = false;

const byte WSPEED = D0;
const byte RAIN = D1;
const byte WDIR = A1;
SFEWeatherMeterKit myWeatherMeter(WDIR, WSPEED, RAIN);

BME280 myBME280;
SparkFun_AS3935 myLightning;

#ifndef G1
  #define G1 5
#endif
#ifndef G3
  #define G3 2
#endif

const int LIGHTNING_CS_PIN = G1;
const int LIGHTNING_INT_PIN = G3;

unsigned long lastReadingPush = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long lastConfigFetch = 0;
const unsigned long READING_INTERVAL_MS = 15000;
const unsigned long RECONNECT_INTERVAL_MS = 30000;
const unsigned long CONFIG_REFRESH_INTERVAL_MS = 600000;

volatile bool lightningInterrupt = false;

void IRAM_ATTR onLightningIRQ() {
  lightningInterrupt = true;
}

void scanI2C() {
  Serial.print("I2C scan:");
  int found = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf(" 0x%02X", addr);
      found++;
    }
  }
  if (found == 0) {
    Serial.print(" nothing found (check board selection / SDA-SCL pins / power)");
  }
  Serial.print("\r\n");
}

void scanNetworks() {
  int count = WiFi.scanNetworks();
  Serial.printf("WiFi scan: %d networks\r\n", count);
  for (int i = 0; i < count; i++) {
    Serial.printf("  %-24s  %d dBm  ch %d\r\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i), WiFi.channel(i));
  }
  WiFi.scanDelete();
}

bool tryNetwork(const char* ssid, const char* pass, const char* label) {
  if (ssid == nullptr || ssid[0] == '\0') return false;

  WiFi.disconnect();
  delay(100);
  Serial.printf("Trying %s network: %s", label, ssid);
  WiFi.begin(ssid, pass);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\r\nWiFi connected to %s: %s\r\n", ssid, WiFi.localIP().toString().c_str());
    return true;
  }

  Serial.printf(" failed (status %d)\r\n", WiFi.status());
  return false;
}

void loadSavedWifi() {
  prefs.begin("wifi", true);
  yachtSsid = prefs.getString("ssid", "");
  yachtPass = prefs.getString("pass", "");
  prevSsid = prefs.getString("prev_ssid", "");
  prevPass = prefs.getString("prev_pass", "");
  prefs.end();

  if (yachtSsid.length()) {
    Serial.printf("Saved yacht WiFi: %s\r\n", yachtSsid.c_str());
  } else {
    Serial.print("No yacht WiFi saved yet — will get it from Supabase\r\n");
  }
}

bool setupWiFi() {
  if (tryNetwork(yachtSsid.c_str(), yachtPass.c_str(), "yacht")) return true;
  if (prevSsid != yachtSsid && tryNetwork(prevSsid.c_str(), prevPass.c_str(), "previous yacht")) return true;

  for (int i = 0; i < NUM_KNOWN_NETWORKS; i++) {
    if (tryNetwork(knownNetworks[i].ssid, knownNetworks[i].password, "fallback")) return true;
  }

  Serial.print("No network available — will retry in 30 s\r\n");
  return false;
}

void saveWifi(const String& ssid, const String& pass) {
  if (meterStarted) {
    detachInterrupt(digitalPinToInterrupt(WSPEED));
    detachInterrupt(digitalPinToInterrupt(RAIN));
  }
  if (lightningOK) {
    detachInterrupt(digitalPinToInterrupt(LIGHTNING_INT_PIN));
  }

  prefs.begin("wifi", false);
  prefs.putString("prev_ssid", yachtSsid);
  prefs.putString("prev_pass", yachtPass);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();

  if (meterStarted) myWeatherMeter.begin();
  if (lightningOK) {
    attachInterrupt(digitalPinToInterrupt(LIGHTNING_INT_PIN), onLightningIRQ, RISING);
  }

  prevSsid = yachtSsid;
  prevPass = yachtPass;
  yachtSsid = ssid;
  yachtPass = pass;
  Serial.printf("Yacht WiFi updated from Supabase: %s\r\n", ssid.c_str());
}

void applyWifiFromJson(JsonDocument& doc) {
  String ssid = doc["wifi_ssid"] | "";
  String pass = doc["wifi_password"] | "";
  if (ssid.length() == 0) return;

  if (ssid != yachtSsid || pass != yachtPass) {
    saveWifi(ssid, pass);
  }
}

void fetchConfig() {
  if (!credentialsSet || WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);
  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, CONFIG_URL)) return;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  int code = http.POST(String("{\"device_serial\":\"") + DEVICE_SERIAL + "\"}");
  Serial.printf("Config -> HTTP %d\r\n", code);

  if (code != 200) {
    http.end();
    return;
  }

  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, http.getString());
  http.end();
  if (error) {
    Serial.printf("Config JSON error: %s\r\n", error.c_str());
    return;
  }

  applyWifiFromJson(doc);
}

bool sendToSupabase(const String& jsonPayload) {
  if (!credentialsSet || WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);
  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, TELEMETRY_URL)) return false;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  String body = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                "\",\"data\":" + jsonPayload + "}";

  int httpCode = http.POST(body);
  Serial.printf("POST -> HTTP %d\r\n", httpCode);
  if (httpCode > 0) {
    String response = http.getString();
    if (httpCode == 401) Serial.printf("  server says: %s\r\n", response.c_str());
    if (httpCode == 200 && response.indexOf("wifi_ssid") >= 0) {
      DynamicJsonDocument doc(1024);
      if (!deserializeJson(doc, response)) applyWifiFromJson(doc);
    }
  }
  http.end();
  return httpCode >= 200 && httpCode < 300;
}

void pushReading(const char* sensorName, const String& valueJson) {
  String payload = String("{\"sensor_name\":\"") + sensorName +
                   "\",\"value\":" + valueJson + "}";
  sendToSupabase(payload);
}

void setupSensors() {
  meterStarted = myWeatherMeter.begin();
  if (!meterStarted) Serial.print("Weather meter did not start\r\n");

  bmeOK = myBME280.beginI2C();
  if (!bmeOK) Serial.print("BME280 not detected\r\n");

  pinMode(LIGHTNING_CS_PIN, OUTPUT);
  digitalWrite(LIGHTNING_CS_PIN, HIGH);
  lightningOK = myLightning.begin();
  if (!lightningOK) {
    Serial.print("AS3935 lightning sensor not detected\r\n");
  } else {
    pinMode(LIGHTNING_INT_PIN, INPUT);
    attachInterrupt(digitalPinToInterrupt(LIGHTNING_INT_PIN), onLightningIRQ, RISING);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.print("\r\nWeather Station booting\r\n");

  credentialsSet = DEVICE_API_KEY != nullptr && DEVICE_SERIAL != nullptr &&
                   String(DEVICE_API_KEY).length() > 0 &&
                   String(DEVICE_SERIAL).length() > 0 &&
                   String(DEVICE_API_KEY) != "YOUR_WEATHER_STATION_DEVICE_KEY" &&
                   String(DEVICE_SERIAL) != "YOUR_WEATHER_STATION_DEVICE_SERIAL";

  Wire.begin();
  scanI2C();
  loadSavedWifi();

  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  setupWiFi();
  if (credentialsSet && WiFi.status() == WL_CONNECTED) {
    fetchConfig();
    lastConfigFetch = millis();
  }
  setupSensors();

  if (!credentialsSet) {
    Serial.print("Telemetry disabled until a real weather-station device serial is configured\r\n");
  }
  Serial.print("Weather station online\r\n");
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED && now - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {
    lastReconnectAttempt = now;
    setupWiFi();
  }

  if (credentialsSet && WiFi.status() == WL_CONNECTED && now - lastConfigFetch >= CONFIG_REFRESH_INTERVAL_MS) {
    lastConfigFetch = now;
    fetchConfig();
  }

  if (lightningInterrupt) {
    lightningInterrupt = false;
    if (lightningOK) {
      int distance = myLightning.distanceToStorm();
      pushReading("Lightning Strike", String("{\"distance_km\":") + distance + "}");
      Serial.printf("Lightning detected — distance: %d km\r\n", distance);
    }
  }

  if (now - lastReadingPush >= READING_INTERVAL_MS) {
    lastReadingPush = now;

    if (meterStarted) {
      pushReading("Wind Speed", String("{\"mph\":") + myWeatherMeter.getWindSpeed() + "}");
      pushReading("Wind Direction", String("{\"deg\":") + myWeatherMeter.getWindDirection() + "}");
      pushReading("Rainfall", String("{\"mm\":") + myWeatherMeter.getTotalRainfall() + "}");
    }

    if (bmeOK) {
      pushReading("Atmospheric", String("{\"temp_f\":") + myBME280.readTempF() +
                  ",\"humidity_pct\":" + myBME280.readFloatHumidity() +
                  ",\"pressure_pa\":" + myBME280.readFloatPressure() + "}");
    }

    Serial.print("Weather reading cycle complete\r\n");
  }

  delay(50);
}
