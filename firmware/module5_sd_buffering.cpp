/*
  Houseboat Monitoring System — Module 5: Offline SD Buffering
  ------------------------------------------------------------------
  A reusable buffering layer: any telemetry payload that fails to push
  (WiFi down, edge function unreachable) gets appended to a file on the
  microSD card instead of being dropped. On reconnect, buffered payloads
  are replayed in order and cleared as they succeed.

  This module is written to be DROPPED INTO Modules 1-4 by replacing
  their "WiFi down — reading not sent (buffering not yet implemented)"
  blocks with a call to bufferOrSend(payload) instead. See integration
  notes at the bottom.

  Pin values below (CS=4, SCK=18, MOSI=23, MISO=38) are M5Stack's
  official, confirmed values for the Tough's onboard microSD slot —
  these do not need calibration, unlike some values in earlier modules.

  Requires: M5Unified, WiFi, HTTPClient, SPI, SD (all standard).
*/

#include <M5Unified.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <SD.h>

// ---------------- Tough microSD pins (confirmed, no calibration needed) ----------------
#define SD_SPI_CS_PIN   4
#define SD_SPI_SCK_PIN  18
#define SD_SPI_MOSI_PIN 23
#define SD_SPI_MISO_PIN 38

// ---------------- Supabase ----------------
const char* TELEMETRY_ENDPOINT =
    "https://YOUR_PROJECT.supabase.co/functions/v1/vessel-monitor-telemetry";

// The API key generated when this device was registered in the
// Vessel Monitoring dashboard. Each M5 Tough has its own unique key.
const char* DEVICE_API_KEY = "YOUR_DEVICE_API_KEY";

const char* BUFFER_FILE = "/buffer.jsonl";

bool sdReady = false;

// ---------------- Setup ----------------
bool setupSDBuffer() {
  SPI.begin(SD_SPI_SCK_PIN, SD_SPI_MISO_PIN, SD_SPI_MOSI_PIN, SD_SPI_CS_PIN);
  if (!SD.begin(SD_SPI_CS_PIN, SPI, 25000000)) {
    Serial.println("SD card not detected — buffering disabled, readings will be dropped during outages");
    return false;
  }
  Serial.println("SD card ready for buffering.");
  return true;
}

// ---------------- Core: send now, or buffer if offline/failed ----------------
// Sends a telemetry payload to the vessel-monitor-telemetry edge function.
// If the send fails (WiFi down, HTTP error, etc.), appends the payload to
// the SD buffer file for later replay.
//
// payload: the full JSON body as built by Modules 1-4, e.g.:
//   {"device_serial":"...","timestamp":"...","ports":[...]}
void bufferOrSend(const String& payload) {
  if (sendToTelemetry(payload)) {
    return;  // sent successfully, nothing to buffer
  }

  if (!sdReady) {
    Serial.println("Send failed and SD not available — reading dropped");
    return;
  }

  File f = SD.open(BUFFER_FILE, FILE_APPEND);
  if (f) {
    f.println(payload);
    f.close();
    Serial.println("Buffered telemetry payload to SD (send failed or offline)");
  } else {
    Serial.println("Failed to open buffer file — reading dropped");
  }
}

// ---------------- Send to telemetry endpoint ----------------
// Returns true on any 2xx response, false otherwise.
bool sendToTelemetry(const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(TELEMETRY_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  int httpCode = http.POST(jsonPayload);
  http.end();

  return (httpCode >= 200 && httpCode < 300);
}

// ---------------- Replay buffered payloads ----------------
// Call periodically (e.g. once a minute) and whenever WiFi reconnects.
void flushBuffer() {
  if (!sdReady || WiFi.status() != WL_CONNECTED) return;
  if (!SD.exists(BUFFER_FILE)) return;

  File f = SD.open(BUFFER_FILE, FILE_READ);
  if (!f) return;

  // Read all lines into memory first (buffer file should stay small —
  // this is low-frequency sensor data, not a high-rate stream)
  const int MAX_LINES = 500;
  String lines[MAX_LINES];
  int lineCount = 0;
  while (f.available() && lineCount < MAX_LINES) {
    lines[lineCount++] = f.readStringUntil('\n');
  }
  f.close();

  if (lineCount == 0) {
    SD.remove(BUFFER_FILE);
    return;
  }

  Serial.printf("Replaying %d buffered payload(s)...\n", lineCount);

  int failedIndex = -1;
  for (int i = 0; i < lineCount; i++) {
    lines[i].trim();
    if (lines[i].length() == 0) continue;  // skip blank lines

    if (!sendToTelemetry(lines[i])) {
      failedIndex = i;
      break;  // stop at first failure, keep remaining lines for next attempt
    }
  }

  if (failedIndex == -1) {
    // everything sent successfully
    SD.remove(BUFFER_FILE);
    Serial.println("Buffer fully flushed.");
  } else {
    // rewrite the file with only the lines from the failure point onward
    SD.remove(BUFFER_FILE);
    File out = SD.open(BUFFER_FILE, FILE_WRITE);
    if (out) {
      for (int i = failedIndex; i < lineCount; i++) {
        out.println(lines[i]);
      }
      out.close();
    }
    Serial.printf("Buffer partially flushed — %d payload(s) still pending.\n", lineCount - failedIndex);
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

/*
  ---------------- INTEGRATION NOTES ----------------
  In Modules 1-4, replace blocks like:

      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi down — reading not sent (buffering not yet implemented)");
        return;
      }
      HTTPClient http;
      http.begin(TELEMETRY_ENDPOINT);
      ... build payload, POST, etc ...

  with a single call:

      bufferOrSend(payload);

  The bufferOrSend function handles the live POST attempt and the SD
  fallback automatically. No need to check WiFi status before calling.

  And add flushBuffer() to each module's loop() on a timer, e.g.:

      if (millis() - lastFlush > 60000) {
        flushBuffer();
        lastFlush = millis();
      }

  Also call setupSDBuffer() once in setup() and store the result in
  the sdReady flag before any module tries to push readings.

  IMPORTANT: When merging into Modules 1-4, remove the duplicate
  declarations of TELEMETRY_ENDPOINT, DEVICE_API_KEY, getISOTimestamp(),
  and sendToTelemetry() — keep only the versions from Module 5 to
  avoid compiler redefinition errors.
*/

// ---------------- Standalone test harness ----------------
// This lets you verify buffering works on its own before merging it
// into the other modules. Send a test telemetry payload every 10s —
// try disconnecting WiFi mid-test to confirm payloads get buffered,
// then reconnect to confirm they replay.
const char* DEVICE_SERIAL = "YOUR_DEVICE_SERIAL";

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  delay(200);

  sdReady = setupSDBuffer();

  WiFi.begin("YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD");
  Serial.print("Connecting to WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  Serial.println("Module 5 online: SD buffering test harness.");
  Serial.printf("Telemetry endpoint: %s\n", TELEMETRY_ENDPOINT);
}

unsigned long lastTestPush = 0;
unsigned long lastFlush = 0;

void loop() {
  M5.update();

  // Send a test telemetry payload every 10s
  if (millis() - lastTestPush > 10000) {
    lastTestPush = millis();
    String payload = String("{\"device_serial\":\"") + DEVICE_SERIAL +
                     "\",\"timestamp\":\"" + getISOTimestamp() +
                     "\",\"ports\":[{\"port\":\"A\",\"sensors\":[{\"sensor_type\":\"test\","
                     "\"sensor_name\":\"SD Buffer Test\",\"value\":\"" + String(millis()) +
                     "\",\"numeric_value\":0,\"unit_of_measure\":\"ms\",\"status\":\"normal\"}]}]}";
    bufferOrSend(payload);
  }

  if (millis() - lastFlush > 60000) {
    lastFlush = millis();
    flushBuffer();
  }

  delay(100);
}
