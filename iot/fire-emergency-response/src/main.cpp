// ============================================================
// Smart Airport - Fire & Emergency Response | Device: FIRE-01
// NORMAL -> WARNING -> FIRE_ALERT -> DRONE_DISPATCHED -> DRONE_ARRIVED
//        -> FIRE_CONFIRMED -> EVACUATION -> RESET
// ============================================================
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include "esp_arduino_version.h"

#include "../common/constants.h"
#include "../common/Device_config.h"
#include "../common/Mqtt_topics.h"

using namespace AirportIoT;

// ---------------- DEVICE ----------------
const char* DEVICE_ID = "FIRE-01";
const char* FIRE_ZONE = "TERMINAL_A";

// ---------------- PINS ----------------
#define DHT_PIN      4
#define SMOKE_PIN    34
#define FIRE_BUTTON  13
#define BUZZER_PIN   25
#define EXIT_1_LED   16
#define EXIT_2_LED   17
#define EXIT_3_LED   18

#define BUZZ_CH      0     // used only on Arduino core 2.x
#define BUZZ_DUTY    20    // 0-255, smaller = quieter

DHT dht(DHT_PIN, DHT22);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

String statusTopic, eventTopic, commandTopic, heartbeatTopic;

// ---------------- THRESHOLDS ----------------
const int   SMOKE_WARNING = 35;
const int   SMOKE_FIRE    = 60;
const float TEMP_WARNING  = 45.0;
const float TEMP_FIRE     = 60.0;

// ---------------- TIMING (ms) ----------------
const unsigned long WARMUP_TIME         = 5000;   // sensors ignored after boot
const unsigned long FIRE_ALERT_TIME     = 1000;
const unsigned long DRONE_DISPATCH_TIME = 2000;   // drone flying
const unsigned long DRONE_ARRIVAL_TIME  = 4000;   // drone inspecting
const unsigned long CONFIRM_TIME        = 1500;
const unsigned long FIRE_RESET_TIME     = 15000;  // evacuation length
const unsigned long SENSOR_PRINT_TIME   = 2000;
const unsigned long MQTT_STATUS_TIME    = 3000;

// ---------------- STATES ----------------
enum FireState { NORMAL, WARNING, FIRE_ALERT, DRONE_DISPATCHED,
                 DRONE_ARRIVED, FIRE_CONFIRMED, EVACUATION };
FireState currentState = NORMAL;

float temperature = 24.0;
int smokeRaw = 0, smokePercent = 0;
int safeExit = 2;
bool manualFire = false, muted = false, statusDirty = true;
bool warmupDone = false;

unsigned long stateStartTime = 0, lastSensorPrint = 0, lastStatusSend = 0;
unsigned long lastHeartbeat = 0, lastDhtRead = 0;

const char* getStateName(FireState s) {
  switch (s) {
    case NORMAL:           return "NORMAL";
    case WARNING:          return "WARNING";
    case FIRE_ALERT:       return "FIRE_ALERT";
    case DRONE_DISPATCHED: return "DRONE_DISPATCHED";
    case DRONE_ARRIVED:    return "DRONE_ARRIVED";
    case FIRE_CONFIRMED:   return "FIRE_CONFIRMED";
    case EVACUATION:       return "EVACUATION";
    default:               return "UNKNOWN";
  }
}
bool inFire() { return currentState >= FIRE_ALERT; }

const char* droneStatus() {
  if (currentState == DRONE_DISPATCHED) return "DISPATCHED";
  if (currentState >= DRONE_ARRIVED)    return "ARRIVED";
  return "IDLE";
}
const char* messageEn() {
  switch (currentState) {
    case NORMAL:           return "All clear. No smoke detected.";
    case WARNING:          return "Smoke level rising. Monitoring the area.";
    case FIRE_ALERT:       return "Fire detected. Sending a drone to check.";
    case DRONE_DISPATCHED: return "Drone is on its way to the fire zone.";
    case DRONE_ARRIVED:    return "Drone arrived and is inspecting the area.";
    default:               return "Fire confirmed. Evacuate through the lit exit.";
  }
}
const char* messageAr() {
  switch (currentState) {
    case NORMAL:           return "الوضع طبيعي، مفيش دخان.";
    case WARNING:          return "مستوى الدخان بيزيد، جاري مراقبة المنطقة.";
    case FIRE_ALERT:       return "تم رصد حريق، وبنبعت درون للتأكد.";
    case DRONE_DISPATCHED: return "الدرون في الطريق لمنطقة الحريق.";
    case DRONE_ARRIVED:    return "الدرون وصل وبيفحص المنطقة.";
    default:               return "تم تأكيد الحريق. اخرجوا من المخرج المضيء.";
  }
}

// ---------------- BUZZER ----------------
void buzzerInit() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(BUZZER_PIN, 2000, 8);
#else
  ledcSetup(BUZZ_CH, 2000, 8);
  ledcAttachPin(BUZZER_PIN, BUZZ_CH);
#endif
}
void buzzerTone(int freq) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(BUZZER_PIN, freq);
  if (freq > 0) ledcWrite(BUZZER_PIN, BUZZ_DUTY);
#else
  ledcWriteTone(BUZZ_CH, freq);
  if (freq > 0) ledcWrite(BUZZ_CH, BUZZ_DUTY);
#endif
}
void updateBuzzer() {
  int want = 0;
  unsigned long t = millis();
  if (!muted) {
    switch (currentState) {
      case WARNING:          want = (t % 3000 < 150) ? 1200 : 0; break;
      case FIRE_ALERT:
      case DRONE_DISPATCHED:
      case DRONE_ARRIVED:    want = (t % 400 < 100) ? 2000 : 0; break;
      case FIRE_CONFIRMED:
      case EVACUATION:       want = (t % 600 < 150) ? 1800 : 0; break;
      default:               want = 0;
    }
  }
  static int last = -1;
  if (want != last) { buzzerTone(want); last = want; }
}

// ---------------- LEDS ----------------
void setLeds(bool a, bool b, bool c) {
  digitalWrite(EXIT_1_LED, a);
  digitalWrite(EXIT_2_LED, b);
  digitalWrite(EXIT_3_LED, c);
}
void updateLeds() {
  unsigned long t = millis();
  bool slow = (t / 500) % 2;
  bool fast = (t / 200) % 2;
  switch (currentState) {
    case FIRE_ALERT:
    case DRONE_DISPATCHED:
    case DRONE_ARRIVED:  setLeds(slow, slow, slow); break;   // all blink
    case FIRE_CONFIRMED: setLeds(fast, fast, fast); break;
    case EVACUATION:     setLeds(safeExit == 1, safeExit == 2, safeExit == 3); break;
    default:             setLeds(false, false, false);
  }
}

// ---------------- MQTT SEND ----------------
void publishJson(const String& topic, JsonDocument& doc, bool retain) {
  if (!mqtt.connected()) return;
  String out;
  serializeJson(doc, out);
  mqtt.publish(topic.c_str(), out.c_str(), retain);
}
void fillCommon(JsonDocument& doc) {
  doc["device_id"] = DEVICE_ID;
  doc["zone"] = FIRE_ZONE;
  doc["state"] = getStateName(currentState);
  doc["smoke_percent"] = smokePercent;
  doc["temperature"] = temperature;
  doc["safe_exit"] = String("EXIT_") + safeExit;
}
void sendEvent(const char* eventName, const char* detail = "") {
  JsonDocument doc;
  fillCommon(doc);
  doc["event"] = eventName;
  doc["detail"] = detail;
  publishJson(eventTopic, doc, false);
  Serial.printf("[EVENT] %s %s\n", eventName, detail);
}
void sendStatus() {
  JsonDocument doc;
  fillCommon(doc);
  doc["status"] = inFire() ? Status::ERROR : Status::ONLINE;
  doc["drone"] = droneStatus();
  doc["fire_confirmed"] = (currentState >= FIRE_CONFIRMED);
  doc["alarm_muted"] = muted;
  doc["message"] = messageEn();
  doc["message_ar"] = messageAr();
  publishJson(statusTopic, doc, true);
  lastStatusSend = millis();
  statusDirty = false;
}
void sendHeartbeat() {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["status"] = Status::ONLINE;
  doc["zone"] = AIRPORT_ZONE;
  doc["uptime_ms"] = millis();
  publishJson(heartbeatTopic, doc, false);
  lastHeartbeat = millis();
}

// ---------------- STATE CONTROL ----------------
void changeState(FireState newState, const char* detail = "") {
  currentState = newState;
  stateStartTime = millis();
  statusDirty = true;
  Serial.println("\n========================================");
  Serial.printf("STATE CHANGED TO: %s\n", getStateName(currentState));
  Serial.println("========================================");
  sendEvent(getStateName(currentState), detail);
}
void resetToNormal(const char* source) {
  manualFire = false;
  muted = false;
  changeState(NORMAL, source);
}
void startFire(const char* source) {
  manualFire = (strcmp(source, "sensor") != 0);
  Serial.printf("\n*** FIRE START (%s) ***\n", source);
  changeState(FIRE_ALERT, source);
}

// ---------------- SENSORS ----------------
void readSensors() {
  smokeRaw = analogRead(SMOKE_PIN);
  smokePercent = map(smokeRaw, 0, 4095, 0, 100);

  if (millis() - lastDhtRead >= 2000) {      // DHT22 max rate = every 2 s
    lastDhtRead = millis();
    float t = dht.readTemperature();
    if (!isnan(t)) temperature = t;
  }
  if (millis() - lastSensorPrint >= SENSOR_PRINT_TIME) {
    lastSensorPrint = millis();
    Serial.printf("[SENSOR] smoke=%d%% (raw %d) temp=%.1fC state=%s%s\n",
                  smokePercent, smokeRaw, temperature, getStateName(currentState),
                  warmupDone ? "" : " (warming up)");
  }
  if (!warmupDone && millis() >= WARMUP_TIME) {
    warmupDone = true;
    Serial.println("[SYSTEM] Warm-up finished. Fire detection ACTIVE.");
  }
}
bool sensorFire()    { return warmupDone && (smokePercent >= SMOKE_FIRE    || temperature >= TEMP_FIRE); }
bool sensorWarning() { return warmupDone && (smokePercent >= SMOKE_WARNING || temperature >= TEMP_WARNING); }

// ---------------- INPUTS ----------------
void checkFireButton() {
  static bool lastStable = HIGH, lastRead = HIGH;
  static unsigned long changedAt = 0;
  bool r = digitalRead(FIRE_BUTTON);
  if (r != lastRead) { lastRead = r; changedAt = millis(); }
  if (millis() - changedAt >= Gate::BUTTON_DEBOUNCE_MS && r != lastStable) {
    lastStable = r;
    if (r == LOW) {
      Serial.println("\n!!! FIRE BUTTON PRESSED !!!");
      if (inFire()) resetToNormal("button");
      else startFire("button");
    }
  }
}
void readSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'f' && !inFire()) startFire("serial");
    else if (c == 'r') resetToNormal("serial");
    else if (c == 'm') { muted = !muted; statusDirty = true; Serial.printf("[BUZZER] muted=%d\n", muted); }
    else if (c >= '1' && c <= '3') { safeExit = c - '0'; statusDirty = true; Serial.printf("[EXIT] safe exit = %d\n", safeExit); }
  }
}

// ---------------- FIRE FLOW ----------------
void updateFireState() {
  unsigned long elapsed = millis() - stateStartTime;

  switch (currentState) {
    case NORMAL:
      if (sensorFire())         startFire("sensor");
      else if (sensorWarning()) changeState(WARNING, "sensor");
      break;

    case WARNING:
      if (sensorFire())          startFire("sensor");
      else if (!sensorWarning()) changeState(NORMAL, "smoke cleared");
      break;

    case FIRE_ALERT:
      if (elapsed >= FIRE_ALERT_TIME) {
        Serial.println("Dispatching emergency drone...");
        changeState(DRONE_DISPATCHED);
      }
      break;

    case DRONE_DISPATCHED:
      if (elapsed >= DRONE_DISPATCH_TIME) {
        Serial.println("Drone arrived at fire zone, inspecting...");
        changeState(DRONE_ARRIVED);
      }
      break;

    case DRONE_ARRIVED:
      if (elapsed >= DRONE_ARRIVAL_TIME) {
        if (manualFire || sensorWarning()) {
          Serial.println("Fire confirmed by drone.");
          changeState(FIRE_CONFIRMED);
        } else {
          Serial.println("Drone found no fire -> FALSE ALARM");
          sendEvent("FALSE_ALARM");
          resetToNormal("false alarm");
        }
      }
      break;

    case FIRE_CONFIRMED:
      if (elapsed >= CONFIRM_TIME) {
        Serial.printf("Evacuation started. Safe exit: EXIT_%d\n", safeExit);
        changeState(EVACUATION);
      }
      break;

    case EVACUATION:
      if (elapsed >= FIRE_RESET_TIME) {
        if (sensorFire()) {            // fire still real -> keep evacuating
          stateStartTime = millis();
        } else {
          Serial.println("Emergency finished. Back to NORMAL.");
          resetToNormal("auto reset");
        }
      }
      break;
  }
}

// ---------------- NETWORK ----------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();
  Serial.printf("\n[MQTT CMD] %s : %s\n", topic, msg.c_str());

  if (msg.equalsIgnoreCase("RESET")) { resetToNormal("mqtt"); return; }

  JsonDocument doc;
  if (deserializeJson(doc, msg)) return;
  const char* cmd = doc["cmd"] | "";
  if (!strcmp(cmd, "reset")) resetToNormal("mqtt");
  else if (!strcmp(cmd, "fire") && !inFire()) startFire("mqtt");
  else if (!strcmp(cmd, "mute")) { muted = true; statusDirty = true; }
  else if (!strcmp(cmd, "exit")) { int e = doc["value"] | 2; if (e >= 1 && e <= 3) { safeExit = e; statusDirty = true; } }
}

void ensureWifi() {
  static unsigned long last = 0;
  if (WiFi.status() == WL_CONNECTED) return;
  if (last && millis() - last < WIFI_RETRY_INTERVAL_MS) return;
  last = millis();
  Serial.println("[WiFi] Connecting...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
}
void ensureMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  static unsigned long last = 0;
  if (last && millis() - last < MQTT_RETRY_INTERVAL_MS) return;
  last = millis();
  Serial.println("[MQTT] Connecting...");
  String clientId = String(DEVICE_ID) + "-" + String((uint32_t)esp_random(), HEX);
  const char* u = strlen(MQTT_USER) ? MQTT_USER : nullptr;
  const char* p = strlen(MQTT_PASS) ? MQTT_PASS : nullptr;
  String will = String("{\"device_id\":\"") + DEVICE_ID + "\",\"status\":\"" + Status::OFFLINE + "\"}";
  if (mqtt.connect(clientId.c_str(), u, p, statusTopic.c_str(), 1, true, will.c_str())) {
    Serial.println("[MQTT] Connected!");
    mqtt.subscribe(commandTopic.c_str());
    sendStatus();
    sendHeartbeat();
  } else {
    Serial.printf("[MQTT] failed, rc=%d\n", mqtt.state());
  }
}

// ---------------- SETUP / LOOP ----------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n========================================");
  Serial.println("   SMART AIRPORT - FIRE & EMERGENCY");
  Serial.println("   DEVICE: FIRE-01");
  Serial.println("========================================");

  pinMode(SMOKE_PIN, INPUT);
  pinMode(FIRE_BUTTON, INPUT_PULLUP);
  pinMode(EXIT_1_LED, OUTPUT);
  pinMode(EXIT_2_LED, OUTPUT);
  pinMode(EXIT_3_LED, OUTPUT);
  buzzerInit();
  dht.begin();

  statusTopic    = Topics::buildTopic(Topics::MODULE_FIRE_SMOKE, DEVICE_ID, Topics::SUFFIX_STATUS);
  eventTopic     = Topics::buildTopic(Topics::MODULE_FIRE_SMOKE, DEVICE_ID, Topics::SUFFIX_EVENT);
  commandTopic   = Topics::buildCommandTopic(Topics::MODULE_FIRE_SMOKE, DEVICE_ID);
  heartbeatTopic = Topics::buildHeartbeatTopic(DEVICE_ID);

  Serial.println("Topics:");
  Serial.println("  " + statusTopic);
  Serial.println("  " + eventTopic);
  Serial.println("  " + heartbeatTopic);
  Serial.println("  " + commandTopic + " (commands)");
  Serial.println("Serial keys: f=fire  r=reset  m=mute  1/2/3=safe exit");

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setCallback(mqttCallback);

  stateStartTime = millis();
  Serial.println("System initialized. Sensors warming up (5 s)...\n");
}

void loop() {
  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  readSensors();
  checkFireButton();
  readSerial();

  updateFireState();
  updateLeds();
  updateBuzzer();

  if (statusDirty || millis() - lastStatusSend >= MQTT_STATUS_TIME) sendStatus();
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) sendHeartbeat();

  delay(5);
}