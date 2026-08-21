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
  All readings POST to the vessel-monitor-telemetry edge function as a
  JSON body with this structure (one port / one sensor per POST for
  event-driven readings; the edge function handles auto-creating
  sensors and ports as needed):
    {
      "device_serial": "...",
      "ports": [{
        "port": "A",
        "sensors": [{
          "sensor_type": "bilge_pump",
          "sensor_name": "Port Engine Room Bilge Pump",
          "value": "active",
          "numeric_value": 1,
          "unit_of_measure": "on/off",
          "status": "normal"
        }]
      }]
    }

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
const char* FIRMWARE_VERSION = "2.0.0";

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

// Sends a full JSON telemetry body to the edge function. The body must
// already contain device_serial and the ports/sensors structure.
bool sendToSupabase(const String& jsonBody) {
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
  int httpCode = http.POST(jsonBody);
  if (httpCode > 0) {
    Serial.printf("Telemetry POST -> HTTP %d\n", httpCode);
  } else {
    Serial.printf("Telemetry POST failed: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
  return (httpCode >= 200 && httpCode < 300);
}

// Builds a complete telemetry payload for a single sensor reading and
// sends it (or buffers to SD if WiFi is down).
void sendSensorReading(const char* port, const char* sensorType,
                       const char* sensorName, const String& value,
                       float numericValue, const char* unit,
                       const char* status = "normal") {
  String body = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                "\",\"firmware_version\":\"" + FIRMWARE_VERSION +
                "\",\"ports\":[{\"port\":\"" + port +
                "\",\"sensors\":[{\"sensor_type\":\"" + sensorType +
                "\",\"sensor_name\":\"" + sensorName +
                "\",\"value\":\"" + value +
                "\",\"numeric_value\":" + String(numericValue, 2) +
                ",\"unit_of_measure\":\"" + unit +
                "\",\"status\":\"" + status + "\"}]}]}";

  if (sendToSupabase(body)) return;
  if (!sdReady) {
    Serial.println("Send failed, no SD — reading dropped");
    return;
  }
  File f = SD.open(BUFFER_FILE, FILE_APPEND);
  if (f) {
    f.println(body);
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

    if (sendToSupabase(line)) {
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
  const char* sensorType;
  const char* name;
  const char* unit;
  bool lastState;
  bool lastInitialized;
};
MonitoredChannel channels[7] = {
  {0, "bilge_pump", "Port Engine Room Bilge Pump",      "on/off", false, false},
  {1, "bilge_pump", "Starboard Engine Room Bilge Pump",  "on/off", false, false},
  {2, "bilge_pump", "Aft Bilge Pump",                    "on/off", false, false},
  {3, "bilge_pump", "Midship Bilge Pump",                "on/off", false, false},
  {4, "bilge_pump", "High Water Alarm",                  "on/off", false, false},
  {5, "ac_pump",    "A/C Water Pump",                    "on/off", false, false},
  {6, "water_pump", "Fresh Water Pump",                  "on/off", false, false},
};
const int NUM_CHANNELS = 7;

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
  for (int i = 0; i < NUM_CHANNELS; i++) {
    // Polarity assumed active-low (PC817 open-collector) — VERIFY against
    // real hardware and flip if needed.
    bool active = !((portState >> channels[i].bit) & 0x01);
    if (!channels[i].lastInitialized || active != channels[i].lastState) {
      const char* statusStr = active ? "normal" : "offline";
      if (channels[i].bit == 4 && active) statusStr = "critical";

      sendSensorReading(
        "A",
        channels[i].sensorType,
        channels[i].name,
        active ? "active" : "inactive",
        active ? 1.0f : 0.0f,
        channels[i].unit,
        statusStr
      );
      channels[i].lastState = active;
      channels[i].lastInitialized = true;
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
  {"Port Engine Battery",          false, 1},
  {"Starboard Engine Battery",     false, 2},
  {"Port Generator Battery",       false, 3},
  {"Starboard Generator Battery",  false, 4},
  {"Inverter Battery Bank",        false, 5},
  {"12V System Battery",           true,  0},
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
      String valueStr = String(voltage, 2) + "V / " + String(current, 2) + "A";

      const char* status = "normal";
      if (voltage < 11.5f) status = "critical";
      else if (voltage < 12.2f) status = "warning";

      sendSensorReading(
        "B",
        "battery_bank",
        banks[batteryIndex].name,
        valueStr,
        voltage,
        "V",
        status
      );
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
  const char* sensorType;
  const char* name;
  bool onSecondaryHub;
  uint8_t hubChannel;
  uint8_t adsChannel;
};
VoltagePoint points[5] = {
  {"engine_alternator", "Port Engine Alternator",         false, 6, 0},
  {"engine_alternator", "Starboard Engine Alternator",    false, 6, 1},
  {"engine_alternator", "Port Generator Alternator",      true,  1, 0},
  {"engine_alternator", "Starboard Generator Alternator", true,  1, 1},
  {"wind_vane",         "Wind Vane Direction",             true,  2, 0},
};

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
        const char* dir = windVaneVoltageToDirection(rawVolts);
        sendSensorReading(
          "B",
          "wind_vane",
          points[voltageIndex].name,
          dir,
          rawVolts,
          "degrees",
          "normal"
        );
      } else {
        float scaled = rawVolts * VOLTMETER_SCALE_FACTOR;
        String valueStr = String(scaled, 2) + "V";
        sendSensorReading(
          "B",
          points[voltageIndex].sensorType,
          points[voltageIndex].name,
          valueStr,
          scaled,
          "V",
          "normal"
        );
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
      String valueStr = String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6);
      float speedMph = gps.speed.isValid() ? gps.speed.mph() : 0.0f;
      float headingDeg = gps.course.isValid() ? gps.course.deg() : 0.0f;

      String body = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                    "\",\"firmware_version\":\"" + FIRMWARE_VERSION +
                    "\",\"ports\":[{\"port\":\"C\",\"sensors\":[{\"sensor_type\":\"gps\""
                    ",\"sensor_name\":\"GPS Location\""
                    ",\"value\":\"" + valueStr + "\"" +
                    ",\"numeric_value\":" + String(speedMph, 1) +
                    ",\"unit_of_measure\":\"mph\"" +
                    ",\"status\":\"normal\""
                    ",\"heading_deg\":" + String(headingDeg, 1) +
                    "}]}]}";

      if (!sendToSupabase(body) && sdReady) {
        File f = SD.open(BUFFER_FILE, FILE_APPEND);
        if (f) { f.println(body); f.close(); }
      }
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

    sendSensorReading(
      "D",
      "anemometer",
      "Wind Speed",
      String(windMph, 1) + " mph",
      windMph,
      "mph",
      "normal"
    );
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

  Serial.println("Combined firmware v2.0.0 online: bilge/pump, battery, alternators/wind vane, GPS, wind speed.");
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
