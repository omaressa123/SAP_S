// ============================================================
// Smart Airport - Smart Transportation: ELEVATOR (ELEV-01)
// - 3 floors (0=Ground, 1, 2), door servo, load sensor, E-stop
// - FIRE RECALL: listens to FIRE-01 and goes to ground floor, door open, locked
// ============================================================
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <LiquidCrystal_I2C.h>
#include "esp_arduino_version.h"

#include "../common/constants.h"
#include "../common/Device_config.h"
#include "../common/Mqtt_topics.h"

using namespace AirportIoT;

static const char* DEVICE_ID = "ELEV-01";

// ---------------- PINS ----------------
const uint8_t CALL_PINS[3]  = {25, 26, 27};   // Ground, 1, 2
const uint8_t FLOOR_LEDS[3] = {16, 17, 18};
const uint8_t SERVO_PIN = 19, LOAD_PIN = 34, ESTOP_PIN = 32, OBSTRUCT_PIN = 33;
const uint8_t BUZZER_PIN = 23, FAULT_LED = 4;
const uint8_t BUZZ_CH = 4;        // Arduino core 2.x only
const int BUZZ_DUTY = 20;         // 0-255 (smaller = quieter)

// ---------------- SETTINGS ----------------
const int NUM_FLOORS = 3;
const unsigned long FLOOR_TRAVEL_MS = 2000;
const unsigned long DOOR_HOLD_MS    = 4000;
const unsigned long STATUS_EVERY_MS = 5000;
const unsigned long PRINT_EVERY_MS  = 3000;
const int MAX_LOAD_KG = 800;

enum State { S_IDLE, S_MOVING, S_DOOR_OPEN, S_EMERGENCY, S_FIRE_LOCKED };
const char* stateName(State s) {
  switch (s) {
    case S_IDLE:        return "idle";
    case S_MOVING:      return "moving";
    case S_DOOR_OPEN:   return "door_open";
    case S_EMERGENCY:   return "emergency";
    default:            return "fire_locked";
  }
}

WiFiClient net;
PubSubClient mqtt(net);
Servo doorServo;
LiquidCrystal_I2C lcd(0x27, 16, 2);

String tStatus, tEvent, tCmd, tHb, tFirePrefix, tFireStatusSub, tFireEventSub;

State state = S_IDLE;
int currentFloor = 0, targetFloor = 0, direction = 0;
bool requests[NUM_FLOORS] = {false, false, false};
bool doorOpen = false, overload = false, fireMode = false, muted = false, dirty = true;
int loadKg = 0;
unsigned long trips = 0;
unsigned long lastStep = 0, doorOpenedAt = 0, lastStatus = 0, lastHb = 0, lastLcd = 0, lastPrint = 0;

struct Button {
  uint8_t pin; bool stable = HIGH, lastRead = HIGH; unsigned long changedAt = 0;
  Button(uint8_t p) : pin(p) {}
};
Button callBtn[3] = {Button(CALL_PINS[0]), Button(CALL_PINS[1]), Button(CALL_PINS[2])};
Button estopBtn(ESTOP_PIN);

bool buttonFell(Button& b) {
  bool r = digitalRead(b.pin); unsigned long now = millis();
  if (r != b.lastRead) { b.lastRead = r; b.changedAt = now; }
  if ((now - b.changedAt) >= Gate::BUTTON_DEBOUNCE_MS && r != b.stable) {
    b.stable = r; return r == LOW;
  }
  return false;
}

// ---------------- BUZZER ----------------
void buzzerInit() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(BUZZER_PIN, 2000, 8);
#else
  ledcSetup(BUZZ_CH, 2000, 8); ledcAttachPin(BUZZER_PIN, BUZZ_CH);
#endif
}
void buzzerTone(int f) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(BUZZER_PIN, f);
  if (f > 0) ledcWrite(BUZZER_PIN, BUZZ_DUTY);
#else
  ledcWriteTone(BUZZ_CH, f);
  if (f > 0) ledcWrite(BUZZ_CH, BUZZ_DUTY);
#endif
}

// ---------------- MQTT PUBLISH ----------------
const char* deviceStatus() {
  if (state == S_EMERGENCY) return Status::ERROR;
  if (fireMode || overload) return Status::LOCKED;
  return Status::ONLINE;
}
void publishDoc(const String& topic, JsonDocument& d, bool retain) {
  if (!mqtt.connected()) return;
  char buf[512];
  size_t n = serializeJson(d, buf, sizeof(buf));
  mqtt.publish(topic.c_str(), (const uint8_t*)buf, n, retain);
}
void publishStatus() {
  JsonDocument d;
  d["device_id"] = DEVICE_ID; d["zone"] = AIRPORT_ZONE; d["status"] = deviceStatus();
  d["state"] = stateName(state); d["floor"] = currentFloor; d["target"] = targetFloor;
  d["door"] = doorOpen ? "open" : "closed"; d["load_kg"] = loadKg;
  d["overload"] = overload; d["fire_mode"] = fireMode; d["trips"] = trips;
  publishDoc(tStatus, d, true);
  lastStatus = millis(); dirty = false;
}
void publishEvent(const char* type, const char* detail = "") {
  JsonDocument d;
  d["device_id"] = DEVICE_ID; d["zone"] = AIRPORT_ZONE; d["event"] = type;
  d["detail"] = detail; d["floor"] = currentFloor; d["state"] = stateName(state);
  d["uptime_ms"] = millis();
  publishDoc(tEvent, d, false);
  Serial.printf("[EVENT] %s %s (floor %d)\n", type, detail, currentFloor);
}
void publishHeartbeat() {
  JsonDocument d;
  d["device_id"] = DEVICE_ID; d["status"] = Status::ONLINE;
  d["zone"] = AIRPORT_ZONE; d["uptime_ms"] = millis();
  publishDoc(tHb, d, false);
  lastHb = millis();
}

// ---------------- ELEVATOR LOGIC ----------------
void setDoor(bool open) {
  doorServo.write(open ? Gate::SERVO_OPEN_POS : Gate::SERVO_CLOSED_POS);
  doorOpen = open; dirty = true;
}
void openDoor() { setDoor(true); state = S_DOOR_OPEN; doorOpenedAt = millis(); dirty = true; }

void requestFloor(int f, const char* src) {
  if (f < 0 || f >= NUM_FLOORS) return;
  if (state == S_EMERGENCY || fireMode) { Serial.println("[ELEV] Call ignored (emergency / fire mode)"); return; }
  requests[f] = true; dirty = true;
  publishEvent("floor_call", src);
}
int nearestRequest() {
  int best = -1, bestDist = 99;
  for (int i = 0; i < NUM_FLOORS; i++)
    if (requests[i] && abs(i - currentFloor) < bestDist) { best = i; bestDist = abs(i - currentFloor); }
  return best;
}

void enterFireMode(bool announce) {
  fireMode = true; dirty = true;
  for (int i = 0; i < NUM_FLOORS; i++) requests[i] = false;
  if (announce) { Serial.println("\n*** FIRE RECALL: going to ground floor ***"); publishEvent("fire_recall", "going to ground floor"); }
  if (state == S_EMERGENCY) return;
  if (currentFloor == 0) { setDoor(true); state = S_FIRE_LOCKED; }
  else { setDoor(false); targetFloor = 0; direction = -1; state = S_MOVING; lastStep = millis(); }
}
void exitFireMode() {
  if (!fireMode) return;
  fireMode = false; dirty = true;
  Serial.println("\n*** FIRE CLEARED: elevator back in service ***");
  publishEvent("fire_cleared");
  if (state == S_FIRE_LOCKED) { state = S_DOOR_OPEN; doorOpenedAt = millis(); }
}

void triggerEmergency(const char* src) {
  state = S_EMERGENCY;
  for (int i = 0; i < NUM_FLOORS; i++) requests[i] = false;
  dirty = true; publishEvent("emergency_stop", src);
}
void resetEmergency() {
  if (state != S_EMERGENCY) return;
  dirty = true; publishEvent("emergency_reset");
  if (fireMode) { enterFireMode(false); return; }
  if (doorOpen) { state = S_DOOR_OPEN; doorOpenedAt = millis(); } else state = S_IDLE;
}

void updateElevator() {
  unsigned long now = millis();
  loadKg = map(analogRead(LOAD_PIN), 0, 4095, 0, 1000);
  bool wasOver = overload; overload = loadKg > MAX_LOAD_KG;
  if (overload != wasOver) { dirty = true; publishEvent(overload ? "overload" : "overload_cleared"); }

  if (buttonFell(estopBtn)) { if (state == S_EMERGENCY) resetEmergency(); else triggerEmergency("button"); }
  for (int i = 0; i < NUM_FLOORS; i++) if (buttonFell(callBtn[i])) requestFloor(i, "button");
  bool obstructed = digitalRead(OBSTRUCT_PIN) == LOW;

  switch (state) {
    case S_IDLE: {
      int t = nearestRequest();
      if (t >= 0 && !overload) {
        if (t == currentFloor) { requests[t] = false; openDoor(); publishEvent("door_open"); }
        else {
          setDoor(false); targetFloor = t; direction = (t > currentFloor) ? 1 : -1;
          state = S_MOVING; lastStep = now; dirty = true; publishEvent("departing", t > currentFloor ? "up" : "down");
        }
      }
      break;
    }
    case S_MOVING:
      if (now - lastStep >= FLOOR_TRAVEL_MS) {
        currentFloor += direction; lastStep = now; dirty = true;
        Serial.printf("[ELEV] passing floor %d\n", currentFloor);
        if (currentFloor == targetFloor) {
          requests[targetFloor] = false; trips++; direction = 0;
          if (fireMode) { setDoor(true); state = S_FIRE_LOCKED; publishEvent("fire_recall_complete", "ground floor, door open"); }
          else { openDoor(); publishEvent("arrived"); }
        }
      }
      break;
    case S_DOOR_OPEN:
      if (obstructed || overload) doorOpenedAt = now;          // keep door open
      else if (now - doorOpenedAt >= DOOR_HOLD_MS) { setDoor(false); state = S_IDLE; publishEvent("door_closed"); }
      break;
    case S_EMERGENCY:
    case S_FIRE_LOCKED:
      break;
  }
}

// ---------------- OUTPUTS ----------------
void updateOutputs() {
  for (int i = 0; i < NUM_FLOORS; i++) digitalWrite(FLOOR_LEDS[i], currentFloor == i);
  digitalWrite(FAULT_LED, state == S_EMERGENCY || fireMode || overload);

  int want = 0;
  unsigned long t = millis();
  if (!muted) {
    if (state == S_EMERGENCY)  want = (t % 400 < 150) ? 1000 : 0;
    else if (fireMode)         want = (t % 1000 < 200) ? 1500 : 0;
    else if (overload)         want = (t % 400 < 150) ? 2200 : 0;
  }
  static int lastTone = -1;
  if (want != lastTone) { buzzerTone(want); lastTone = want; }
}

void lcdLine(int row, const char* text) {
  lcd.setCursor(0, row);
  int n = strlen(text);
  lcd.print(text);
  for (int i = n; i < 16; i++) lcd.print(' ');
}
void updateLcd() {
  if (millis() - lastLcd < 300) return;
  lastLcd = millis();
  char l1[24], l2[24];
  const char* sh = state == S_IDLE ? "IDLE" : state == S_MOVING ? (direction > 0 ? "UP" : "DOWN")
                   : state == S_DOOR_OPEN ? "DOOR" : state == S_FIRE_LOCKED ? "FIRE" : "EMRG!";
  snprintf(l1, sizeof l1, "Floor %d  %s", currentFloor, sh);
  if (fireMode)       snprintf(l2, sizeof l2, "FIRE RECALL");
  else if (overload)  snprintf(l2, sizeof l2, "OVERLOAD %4dkg", loadKg);
  else                snprintf(l2, sizeof l2, "Load %4dkg %s", loadKg, doorOpen ? "OPEN" : "SHUT");
  lcdLine(0, l1); lcdLine(1, l2);
}

// ---------------- INPUTS ----------------
void readSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c >= '0' && c <= '2') requestFloor(c - '0', "serial");
    else if (c == 'e') { if (state == S_EMERGENCY) resetEmergency(); else triggerEmergency("serial"); }
    else if (c == 'f') enterFireMode(true);
    else if (c == 'c') exitFireMode();
    else if (c == 'm') { muted = !muted; Serial.printf("[BUZZER] muted=%d\n", muted); }
  }
}

// ---------------- NETWORK ----------------
void onMessage(char* topic, byte* payload, unsigned int len) {
  JsonDocument d;
  if (deserializeJson(d, payload, len)) return;

  // messages from the fire module (airport/fire-smoke/+/status|event)
  if (String(topic).startsWith(tFirePrefix)) {
    const char* st = d["state"] | "";
    const char* ev = d["event"] | "";
    if (!strcmp(st, "FIRE_CONFIRMED") || !strcmp(st, "EVACUATION") || !strcmp(ev, "EVACUATION_STARTED")) {
      if (!fireMode) enterFireMode(true);
    } else if (!strcmp(st, "NORMAL")) {
      exitFireMode();
    }
    return;
  }

  // commands for this elevator
  const char* cmd = d["cmd"] | "";
  if (!strcmp(cmd, "call")) requestFloor(d["floor"] | -1, "mqtt");
  else if (!strcmp(cmd, "emergency")) triggerEmergency("mqtt");
  else if (!strcmp(cmd, "reset")) resetEmergency();
  else if (!strcmp(cmd, "fire_recall")) enterFireMode(true);
  else if (!strcmp(cmd, "fire_clear")) exitFireMode();
  else if (!strcmp(cmd, "mute")) muted = true;
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
  String cid = String(DEVICE_ID) + "-" + String((uint32_t)esp_random(), HEX);
  const char* u = strlen(MQTT_USER) ? MQTT_USER : nullptr;
  const char* p = strlen(MQTT_PASS) ? MQTT_PASS : nullptr;
  String will = String("{\"device_id\":\"") + DEVICE_ID + "\",\"status\":\"" + Status::OFFLINE + "\"}";
  if (mqtt.connect(cid.c_str(), u, p, tStatus.c_str(), 1, true, will.c_str())) {
    Serial.println("[MQTT] Connected!");
    mqtt.subscribe(tCmd.c_str());
    mqtt.subscribe(tFireStatusSub.c_str());
    mqtt.subscribe(tFireEventSub.c_str());
    publishStatus(); publishHeartbeat();
  } else {
    Serial.printf("[MQTT] failed, rc=%d\n", mqtt.state());
  }
}

// ---------------- SETUP / LOOP ----------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n========================================");
  Serial.println("   SMART AIRPORT - SMART ELEVATOR");
  Serial.println("   DEVICE: ELEV-01");
  Serial.println("========================================");

  for (int i = 0; i < 3; i++) { pinMode(CALL_PINS[i], INPUT_PULLUP); pinMode(FLOOR_LEDS[i], OUTPUT); }
  pinMode(ESTOP_PIN, INPUT_PULLUP); pinMode(OBSTRUCT_PIN, INPUT_PULLUP);
  pinMode(FAULT_LED, OUTPUT);
  buzzerInit();
  doorServo.setPeriodHertz(50);
  doorServo.attach(SERVO_PIN); setDoor(false);
  lcd.init(); lcd.backlight(); lcdLine(0, "Smart Elevator"); lcdLine(1, "Starting...");

  tStatus = Topics::buildTopic(Topics::MODULE_ELEVATOR, DEVICE_ID, Topics::SUFFIX_STATUS);
  tEvent  = Topics::buildTopic(Topics::MODULE_ELEVATOR, DEVICE_ID, Topics::SUFFIX_EVENT);
  tCmd    = Topics::buildCommandTopic(Topics::MODULE_ELEVATOR, DEVICE_ID);
  tHb     = Topics::buildHeartbeatTopic(DEVICE_ID);
  tFirePrefix    = String(Topics::PREFIX) + "/" + Topics::MODULE_FIRE_SMOKE + "/";
  tFireStatusSub = tFirePrefix + "+/" + Topics::SUFFIX_STATUS;
  tFireEventSub  = tFirePrefix + "+/" + Topics::SUFFIX_EVENT;

  Serial.println("Topics:");
  Serial.println("  " + tStatus);
  Serial.println("  " + tEvent);
  Serial.println("  " + tHb);
  Serial.println("  " + tCmd + " (commands)");
  Serial.println("Listening to fire module: " + tFireEventSub);
  Serial.println("Serial keys: 0/1/2=call floor  e=emergency  f=fire recall  c=clear fire  m=mute");

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setCallback(onMessage);
}

void loop() {
  ensureWifi(); ensureMqtt(); mqtt.loop();
  readSerial();
  updateElevator(); updateOutputs(); updateLcd();

  unsigned long now = millis();
  if (now - lastPrint >= PRINT_EVERY_MS) {
    lastPrint = now;
    Serial.printf("[ELEV] floor=%d state=%s door=%s load=%dkg fire_mode=%d\n",
                  currentFloor, stateName(state), doorOpen ? "open" : "closed", loadKg, fireMode);
  }
  if (dirty || now - lastStatus >= STATUS_EVERY_MS) publishStatus();
  if (now - lastHb >= HEARTBEAT_INTERVAL_MS) publishHeartbeat();
  delay(5);
}
