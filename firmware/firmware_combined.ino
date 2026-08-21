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

  TELEMETRY FORMAT:
  Each reading is sent as a single-port, single-sensor POST to the
  vessel-monitor-telemetry edge function. The body looks like:
    {"device_serial":"...","ports":[{"port":"A","sensors":[{...}]}]}
  The edge function auto-creates sensors and ports on first sighting,
  then updates current_value / last_reading_at on subsequent posts.

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

const char* TELEMETRY_URL   = "https://eqiecntollhgfxmmbize.supabase.co/functions/v1/vessel-monitor-telemetry";
const char* DEVICE_API_KEY  = "e4411330-5c9f-4d81-ab8b-7e4083ab10d6";
const char* DEVICE_SERIAL   = "k034326040100309";

#define SD_SPI_CS_PIN   4
#define SD_SPI_SCK_PIN  18
#define SD_SPI_MOSI_PIN 23
#define SD_SPI_MISO_PIN 38
const char* BUFFER_FILE = "/buffer.jsonl";
bool sdReady = false;

void setupWiFi() {
  WiFi.mode(WIFI_STA);
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
  SPI.begin(SD_SPI_SCK_PIN, SD_SPI_MISO_PIN, SD_SPI_MOSI_PIN, SD_SPI_CS_PIN);
  if (!SD.begin(SD_SPI_CS_PIN, SPI, 25000000)) {
    Serial.println("SD card not detected — buffering disabled");
    return false;
  }
  Serial.println("SD card ready.");
  return true;
}

// Builds the full edge-function payload for a single sensor reading and
// POSTs it. The edge function expects:
//   {"device_serial":"...","ports":[{"port":"A","sensors":[{"sensor_type":"...","sensor_name":"...","value":"...","numeric_value":1.2,"unit_of_measure":"...","status":"normal"}]}]}
// Each call sends exactly one port with one sensor — the edge function
// handles auto-creation and updates on a per-sensor basis.
bool sendToSupabase(const char* port, const char* sensorType,
                     const char* sensorName, const char* value,
                     float numericValue, const char* unit,
                     const char* status) {
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

  // Build the JSON body manually to avoid ArduinoJson dependency.
  String body = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                "\",\"ports\":[{\"port\":\"" + port + "\"," +
                "\"sensors\":[{\"sensor_type\":\"" + sensorType + "\"," +
                "\"sensor_name\":\"" + sensorName + "\"," +
                "\"value\":\"" + value + "\"," +
                "\"numeric_value\":" + String(numericValue, 4) + "," +
                "\"unit_of_measure\":\"" + unit + "\"," +
                "\"status\":\"" + status + "\"}]}]}";

  int httpCode = http.POST(body);
  if (httpCode > 0) {
    Serial.printf("Telemetry POST [%s/%s] -> HTTP %d\n", port, sensorName, httpCode);
  } else {
    Serial.printf("Telemetry POST failed: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
  return (httpCode >= 200 && httpCode < 300);
}

// Buffered reading stored as a compact pipe-delimited line so flushBuffer
// can reconstruct the full payload. Format:
//   port|sensorType|sensorName|value|numericValue|unit|status
void bufferReading(const char* port, const char* sensorType,
                   const char* sensorName, const char* value,
                   float numericValue, const char* unit,
                   const char* status) {
  if (!sdReady) {
    Serial.println("Send failed, no SD — reading dropped");
    return;
  }
  File f = SD.open(BUFFER_FILE, FILE_APPEND);
  if (f) {
    f.print(port);
    f.print("|");
    f.print(sensorType);
    f.print("|");
    f.print(sensorName);
    f.print("|");
    f.print(value);
    f.print("|");
    f.print(numericValue, 4);
    f.print("|");
    f.print(unit);
    f.print("|");
    f.println(status);
    f.close();
    Serial.println("Buffered reading to SD");
  }
}

// Attempts to send a reading immediately; falls back to SD buffer on failure.
void sendReading(const char* port, const char* sensorType,
                 const char* sensorName, const char* value,
                 float numericValue, const char* unit,
                 const char* status) {
  if (sendToSupabase(port, sensorType, sensorName, value, numericValue, unit, status)) return;
  bufferReading(port, sensorType, sensorName, value, numericValue, unit, status);
}

const char* BUFFER_TEMP_FILE = "/buffer_tmp.jsonl";

// Streams the buffer file line-by-line. Each line is a pipe-delimited
// reading that gets reconstructed into the full ports-format payload.
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

    // Parse: port|sensorType|sensorName|value|numericValue|unit|status
    int sep1 = line.indexOf('|');
    if (sep1 < 0) continue;
    int sep2 = line.indexOf('|', sep1 + 1);
    int sep3 = line.indexOf('|', sep2 + 1);
    int sep4 = line.indexOf('|', sep3 + 1);
    int sep5 = line.indexOf('|', sep4 + 1);
    int sep6 = line.indexOf('|', sep5 + 1);
    if (sep6 < 0) continue;

    String bPort       = line.substring(0, sep1);
    String bSensorType = line.substring(sep1 + 1, sep2);
    String bSensorName = line.substring(sep2 + 1, sep3);
    String bValue      = line.substring(sep3 + 1, sep4);
    String bNumeric    = line.substring(sep4 + 1, sep5);
    String bUnit       = line.substring(sep5 + 1, sep6);
    String bStatus     = line.substring(sep6 + 1);

    if (sendToSupabase(bPort.c_str(), bSensorType.c_str(),
                       bSensorName.c_str(), bValue.c_str(),
                       bNumeric.toFloat(), bUnit.c_str(),
                       bStatus.c_str())) {
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
  const char* sensorType;
  bool lastState;
};
MonitoredChannel channels[3] = {
  {0, "Forward Bilge",        "bilge_pump", false},
  {1, "Aft Bilge",            "bilge_pump", false},
  {2, "Grundfos Pump (CU301)", "water_pump", false},
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
      const char* valStr = active ? "active" : "inactive";
      float numVal = active ? 1.0f : 0.0f;
      const char* status = active ? "warning" : "normal";
      sendReading("A", channels[i].sensorType, channels[i].name,
                  valStr, numVal, "on/off", status);
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
int batteryIndex = 0;

void handleBatteryBanks() {
  if (!routeToBank(banks[batteryIndex])) {
    Serial.printf("Hub routing failed for %s\n", banks[batteryIndex].name);
  } else {
    float voltage, current;
    if (readINA226(voltage, current)) {
      String valStr = String(voltage, 2) + "V / " + String(current, 2) + "A";

      // Determine status: below 11.8V is critical, below 12.2V is warning
      const char* status = "normal";
      if (voltage < 11.8f) status = "critical";
      else if (voltage < 12.2f) status = "warning";

      sendReading("B", "battery_bank", banks[batteryIndex].name,
                  valStr.c_str(), voltage, "V", status);
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
  const char* sensorType;
  bool onSecondaryHub;
  uint8_t hubChannel;
  uint8_t adsChannel;
};
VoltagePoint points[5] = {
  {"Engine 1 Alternator",    "engine_alternator", false, 6, 0},
  {"Engine 2 Alternator",    "engine_alternator", false, 6, 1},
  {"Generator 1 Alternator", "engine_alternator", true,  1, 0},
  {"Generator 2 Alternator", "engine_alternator", true,  1, 1},
  {"Wind Vane Direction",    "wind_vane",         true,  2, 0},
};
// NOTE: hubChannel values are placeholders — cross-check against actual wiring.

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
      if (isDirection) {
        const char* dirStr = windVaneVoltageToDirection(rawVolts);
        sendReading("B", "wind_vane", points[voltageIndex].name,
                    dirStr, rawVolts, "direction", "normal");
      } else {
        float scaled = rawVolts * VOLTMETER_SCALE_FACTOR;
        String valStr = String(scaled, 2) + "V";

        // Alternator should produce 13.8-14.4V when running; below 12.5V is warning
        const char* status = "normal";
        if (scaled < 12.0f) status = "critical";
        else if (scaled < 12.5f) status = "warning";

        sendReading("B", "engine_alternator", points[voltageIndex].name,
                    valStr.c_str(), scaled, "V", status);
      }
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
const float MPH_PER_PULSE_PER_SEC = 1.492f;

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
      float lat = gps.location.lat();
      float lng = gps.location.lng();
      float speed = gps.speed.isValid() ? gps.speed.mph() : 0.0f;
      float heading = gps.course.isValid() ? gps.course.deg() : 0.0f;

      String valStr = String(lat, 6) + ", " + String(lng, 6) +
                      " | " + String(speed, 1) + " mph | " +
                      String(heading, 1) + " deg";

      sendReading("C", "gps", "GPS Location",
                  valStr.c_str(), lat, "lat/lng", "normal");
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

    String valStr = String(windMph, 1) + " mph";

    // High wind thresholds
    const char* status = "normal";
    if (windMph >= 38.0f) status = "critical";
    else if (windMph >= 25.0f) status = "warning";

    sendReading("D", "anemometer", "Wind Speed",
                valStr.c_str(), windMph, "mph", status);
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

  sdReady = setupSDBuffer();

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

  if (millis() - lastBilgeCheck > BILGE_CHECK_INTERVAL_MS) {
    handleBilgePump();
    lastBilgeCheck = millis();
  }

  if (millis() - lastBatteryCheck > BATTERY_CHECK_INTERVAL_MS) {
    handleBatteryBanks();
    lastBatteryCheck = millis();
  }

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
