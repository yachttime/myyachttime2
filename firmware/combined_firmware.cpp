/*
  Houseboat Monitoring System — Combined Firmware
  ==========================================================================
  Merges Modules 1-5 into a single sketch:
    1. Bilge & pump status (PC817 -> EXT.IO2 -> PORT.A)
    2. Battery bank voltage/current (INA226 x6 -> PaHub cascade -> PORT.B)
    3. Alternator voltage + wind vane (Voltmeter Units -> PaHub cascade -> PORT.B)
    4. GPS location (PORT.C, UART) + anemometer wind speed (RS485 pin, GPIO)
    5. SD card buffering for connectivity gaps (applies to all of the above)

  IMPORTANT CORRECTION MADE DURING MERGE:
  PORT.A and PORT.B use DIFFERENT physical I2C pin pairs on the Tough
  (A: G32/G33, B: G26/G36). The ESP32 has two hardware I2C peripherals,
  so this sketch uses Wire (bus A, EXT.IO2) and Wire1 (bus B, PaHub/
  INA226/Voltmeter) as two SEPARATE buses running simultaneously. The
  standalone Module 1 and 2 files each called plain Wire.begin() with
  just a comment noting which pins applied — that only works when       
  testing one module at a time. Merged together, they need distinct
  bus objects, which is what's implemented below.

  STILL NEEDS FIELD CALIBRATION (see relevant sections):
    - PC817 active-high vs active-low polarity (Module 1 origin)
    - VOLTMETER_SCALE_FACTOR (Module 3 origin)
    - Wind vane voltage-to-direction table (Module 3 origin)
    - PaHub addresses / hub channel assignments (Module 2/3 origin)
    - GPS RX/TX pin assignment and baud rate (Module 4 origin)
    - Anemometer pulse edge direction (Module 4 origin)

  Requires: M5Unified, WiFi, HTTPClient, Wire, SPI, SD, TinyGPSPlus.
*/

#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <TinyGPSPlus.h>

// ============================================================
// SHARED: WiFi, Telemetry endpoint, SD buffering
// ============================================================
const char* WIFI_SSID     = "AZ Marine";
const char* WIFI_PASSWORD = "9286376500";

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

void setupWiFi() {
  WiFi.mode(WIFI_STA);  // fixes "cannot set config" error on some boards —
                        // must explicitly set station mode before begin()
  WiFi.disconnect(true);
  delay(100);
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
  int httpCode = http.POST(body);
  if (httpCode > 0) {
    Serial.printf("Telemetry POST -> HTTP %d\n", httpCode);
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
// ============================================================
#define EXTIO2_I2C_ADDR     0x45
#define PCA9554_REG_INPUT   0x00
#define PCA9554_REG_CONFIG  0x03

struct MonitoredChannel {
  uint8_t bit;
  const char* name;
  bool lastState;
};
MonitoredChannel channels[3] = {
  {0, "Forward Bilge",        false},
  {1, "Aft Bilge",              false},
  {2, "Grundfos Pump (CU301)",  false},
};

void setupEXTIO2() {
  Wire.beginTransmission(EXTIO2_I2C_ADDR);
  Wire.write(PCA9554_REG_CONFIG);
  Wire.write(0xFF);
  Wire.endTransmission();
}

uint8_t readEXTIO2() {
  Wire.beginTransmission(EXTIO2_I2C_ADDR);
  Wire.write(PCA9554_REG_INPUT);
  if (Wire.endTransmission(false) != 0) return 0xFF;
  Wire.requestFrom((int)EXTIO2_I2C_ADDR, 1);
  if (Wire.available()) return Wire.read();
  return 0xFF;
}

unsigned long lastBilgeCheck = 0;
const unsigned long BILGE_CHECK_INTERVAL_MS = 1000;

void handleBilgePump() {
  uint8_t portState = readEXTIO2();
  for (int i = 0; i < 3; i++) {
    // Polarity assumed active-low (PC817 open-collector) — VERIFY against
    // real hardware and flip if needed.
    bool active = !((portState >> channels[i].bit) & 0x01);
    if (active != channels[i].lastState) {
      String payload = String("{\"sensor_name\":\"") + channels[i].name +
                        "\",\"value\":{\"active\":" + (active ? "true" : "false") + "}}";
      bufferOrSend(SENSOR_READINGS_EP, payload);
      channels[i].lastState = active;
    }
  }
}

// ============================================================
// MODULE 2: Battery banks — I2C BUS B (Wire1), PORT.B via PaHub
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
  {"Engine 1 Starting Battery",    false, 1},
  {"Engine 2 Starting Battery",    false, 2},
  {"Generator 1 Starting Battery", false, 3},
  {"Generator 2 Starting Battery", false, 4},
  {"Inverter Battery Bank",        false, 5},
  {"House 12V Battery Bank",       true,  0},
};

bool selectHubChannel(uint8_t hubAddr, uint8_t channel) {
  Wire1.beginTransmission(hubAddr);
  Wire1.write(1 << channel);
  return Wire1.endTransmission() == 0;
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
    Wire1.beginTransmission(INA226_I2C_ADDR);
    Wire1.write(INA226_REG_CAL);
    Wire1.write((CAL_VALUE >> 8) & 0xFF);
    Wire1.write(CAL_VALUE & 0xFF);
    Wire1.endTransmission();
  }
}

bool readINA226(float& busVoltage, float& current) {
  Wire1.beginTransmission(INA226_I2C_ADDR);
  Wire1.write(INA226_REG_BUS_V);
  if (Wire1.endTransmission(false) != 0) return false;
  Wire1.requestFrom((int)INA226_I2C_ADDR, 2);
  if (Wire1.available() < 2) return false;
  int16_t rawBus = (Wire1.read() << 8) | Wire1.read();
  busVoltage = rawBus * 0.00125f;

  Wire1.beginTransmission(INA226_I2C_ADDR);
  Wire1.write(INA226_REG_CURRENT);
  if (Wire1.endTransmission(false) != 0) return false;
  Wire1.requestFrom((int)INA226_I2C_ADDR, 2);
  if (Wire1.available() < 2) return false;
  int16_t rawCurrent = (Wire1.read() << 8) | Wire1.read();
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
// MODULE 3: Alternators & wind vane — I2C BUS B (Wire1), PORT.B via PaHub
// ============================================================
#define ADS1115_I2C_ADDR     0x48
#define ADS1115_REG_CONVERT  0x00
#define ADS1115_REG_CONFIG   0x01

const float VOLTMETER_SCALE_FACTOR = 1.0f;  // TODO: calibrate against known voltage

struct VoltagePoint {
  const char* name;
  bool onSecondaryHub;
  uint8_t hubChannel;
  uint8_t adsChannel;
};
VoltagePoint points[5] = {
  {"Engine 1 Alternator",    false, 6, 0},
  {"Engine 2 Alternator",    false, 6, 1},
  {"Generator 1 Alternator", true,  1, 0},
  {"Generator 2 Alternator", true,  1, 1},
  {"Wind Vane Direction",    true,  2, 0},
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

  Wire1.beginTransmission(ADS1115_I2C_ADDR);
  Wire1.write(ADS1115_REG_CONFIG);
  Wire1.write((config >> 8) & 0xFF);
  Wire1.write(config & 0xFF);
  if (Wire1.endTransmission() != 0) return false;

  delay(10);

  Wire1.beginTransmission(ADS1115_I2C_ADDR);
  Wire1.write(ADS1115_REG_CONVERT);
  if (Wire1.endTransmission(false) != 0) return false;
  Wire1.requestFrom((int)ADS1115_I2C_ADDR, 2);
  if (Wire1.available() < 2) return false;

  int16_t raw = (Wire1.read() << 8) | Wire1.read();
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
// MODULE 4: GPS (PORT.C, UART) + Anemometer (RS485 pin, GPIO)
// ============================================================
#define GPS_RX_PIN 14
#define GPS_TX_PIN 13
#define GPS_BAUD   9600

HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
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

void handleGPS() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
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
  Wire1.begin(26, 36);   // PORT.B -> PaHub cascade

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  pinMode(ANEMOMETER_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ANEMOMETER_PIN), onAnemometerPulse, FALLING);

  setupWiFi();
  setupEXTIO2();
  setupINA226();

  Serial.println("Combined firmware online: bilge/pump, battery, alternators/wind vane, GPS, wind speed.");
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  // Bilge/pump: checked every loop pass, internally rate-limited
  if (millis() - lastBilgeCheck > BILGE_CHECK_INTERVAL_MS) {
    handleBilgePump();
    lastBilgeCheck = millis();
  }

  // Battery banks: one bank per interval, cycling through all 6
  if (millis() - lastBatteryCheck > BATTERY_CHECK_INTERVAL_MS) {
    handleBatteryBanks();
    lastBatteryCheck = millis();
  }

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
