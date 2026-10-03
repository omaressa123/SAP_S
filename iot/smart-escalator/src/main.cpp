// ============================================================
// Smart Airport - Smart Transportation: ESCALATOR (ESC-01)
// - Energy saving: STOPPED -> STANDBY (slow) -> RUNNING (full) when a passenger is detected
// - Motor overload / jam protection, emergency stop
// - FIRE: stops when FIRE-01 reports a confirmed fire / evacuation
// ============================================================
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>
#include "esp_arduino_version.h"

#include "../common/constants.h"
#include "../common/Device_config.h"
#include "../common/Mqtt_topics.h"

using namespace AirportIoT;

static const char* DEVICE_ID = "ESC-01";
// Not defined in the shared Mqtt_topics.h yet -> local constant
static const char* MODULE_ESCALATOR = "escalator";

// ---------------- PINS ----------------
#define PIR_PIN      27   // passenger sensor at the entry
#define DIR_PIN      26   // slide switch: LOW = UP, HIGH = DOWN
#define ESTOP_PIN    25   // emergency stop button
#define CURRENT_PIN  34   // potentiometer = motor current
#define LED_RUN      16   // green
#define LED_SLOW     17   // yellow
#define LED_STOP     18   // red
#define BUZZER_PIN   23
#define BUZZ_CH      0    // Arduino core 2.x only
#define BUZZ_DUTY    20   // 0-255 (smaller = quieter)

// ---------------- SETTINGS ----------------
const unsigned long RUN_HOLD_MS        = 8000;    // stay at full speed after last passenger
const unsigned long STANDBY_TIMEOUT_MS = 30000;   // then stop completely if nobody comes
const unsigned long PIR_COOLDOWN_MS    = 1500;
const int JAM_PCT   = 85;                         // motor current >= this -> fault
const int CLEAR_PCT = 70;                         // must drop below this to reset the fault
const unsigned long STATUS_EVERY_MS = 5000;
const unsigned long PRINT_EVERY_MS  = 3000;

enum Mode { M_STOPPED, M_STANDBY, M_RUNNING, M_FAULT, M_EMERGENCY, M_FIRE_STOP };
const char* modeName(Mode m) {
  switch (m) {
    case M_STOPPED:   return "stopped";
    case M_STANDBY:   return "standby";
    case M_RUNNING:   return "running";
    case M_FAULT:     return "fault";
    case M_EMERGENCY: return "emergency_stop";
    default:          return "fire_stop";
  }
}
int speedPercent(Mode m) { return m == M_RUNNING ? 100 : (m == M_STANDBY ? 30 : 0); }

WiFiClient net;
PubSubClient mqtt(net);
LiquidCrystal_I2C lcd(0x27, 16, 2);

String tStatus, tEvent, tCmd, tHb, tFirePrefix, tFireStatusSub, tFireEventSub;

Mode mode = M_STANDBY;
bool dirUp = true, fireStop = false, emergency = false, fault = false, muted = false, dirty = true;
bool everSeen = false, pirLast = false;
int currentPct = 0;
unsigned long passengers = 0;
unsigned long lastPassenger = 0, lastActivity = 0, pirAt = 0;
unsigned long lastStatus = 0, lastHb = 0, lastLcd = 0, lastPrint = 0;
bool estopLast = HIGH, estopStable = HIGH; unsigned long estopChanged = 0;

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

// ---------------- MESSAGES ----------------
const char* msgEn() {
  switch (mode) {
    case M_RUNNING:   return "Escalator running at full speed.";
    case M_STANDBY:   return "Escalator in energy-saving slow mode.";
    case M_STOPPED:   return "Escalator stopped (no passengers). Step near to start it.";
    case M_FAULT:     return "Escalator stopped: motor overload detected.";
    case M_EMERGENCY: return "Emergency stop pressed. Escalator stopped.";
    default:          return "Fire alert: escalator stopped. Use the lit exit.";
  }
}
const char* msgAr() {
  switch (mode) {
    case M_RUNNING:   return "السلم المتحرك شغال بالسرعة العادية.";
    case M_STANDBY:   return "السلم المتحرك في وضع توفير الطاقة (سرعة بطيئة).";
    case M_STOPPED:   return "السلم المتحرك واقف لعدم وجود ركاب، اقترب لتشغيله.";
    case M_FAULT:     return "السلم المتحرك واقف: تم رصد حمل زائد على الموتور.";
    case M_EMERGENCY: return "تم الضغط على زر الطوارئ والسلم المتحرك واقف.";
    default:          return "إنذار حريق: السلم المتحرك واقف، استخدموا المخرج المضيء.";
  }
}
const char* deviceStatus() {
  if (mode == M_FAULT || mode == M_EMERGENCY) return Status::ERROR;
  if (mode == M_FIRE_STOP) return Status::LOCKED;
  return Status::ONLINE;
}

// ---------------- MQTT PUBLISH ----------------
void publishDoc(const String& topic, JsonDocument& d, bool retain) {
  if (!mqtt.connected()) return;
  char buf[640];
  size_t n = serializeJson(d, buf, sizeof(buf));
  mqtt.publish(topic.c_str(), (const uint8_t*)buf, n, retain);
}
void publishStatus() {
  JsonDocument d;
  d["device_id"] = DEVICE_ID; d["zone"] = AIRPORT_ZONE; d["status"] = deviceStatus();
  d["mode"] = modeName(mode); d["direction"] = dirUp ? "up" : "down";
  d["speed_percent"] = speedPercent(mode); d["passengers"] = passengers;
  d["motor_current_percent"] = currentPct; d["fire_stop"] = fireStop;
  d["message"] = msgEn(); d["message_ar"] = msgAr();
  publishDoc(tStatus, d, true);
  lastStatus = millis(); dirty = false;
}
void publishEvent(const char* type, const char* detail = "") {
  JsonDocument d;
  d["device_id"] = DEVICE_ID; d["zone"] = AIRPORT_ZONE; d["event"] = type;
  d["detail"] = detail; d["mode"] = modeName(mode); d["uptime_ms"] = millis();
  publishDoc(tEvent, d, false);
  Serial.printf("[EVENT] %s %s\n", type, detail);
}
void publishHeartbeat() {
  JsonDocument d;
  d["device_id"] = DEVICE_ID; d["status"] = Status::ONLINE;
  d["zone"] = AIRPORT_ZONE; d["uptime_ms"] = millis();
  publishDoc(tHb, d, false);
  lastHb = millis();
}

// ---------------- LOGIC ----------------
void setMode(Mode m) {
  if (m == mode) return;
  Mode old = mode; mode = m; dirty = true;
  Serial.printf("\n=== MODE: %s -> %s (speed %d%%) ===\n", modeName(old), modeName(mode), speedPercent(mode));
  publishEvent("mode_changed", modeName(mode));
}
Mode computeMode(unsigned long now) {
  if (fireStop)  return M_FIRE_STOP;
  if (emergency) return M_EMERGENCY;
  if (fault)     return M_FAULT;
  if (everSeen && now - lastPassenger < RUN_HOLD_MS) return M_RUNNING;
  if (now - lastActivity < STANDBY_TIMEOUT_MS) return M_STANDBY;
  return M_STOPPED;
}

void passengerDetected(const char* src) {
  unsigned long now = millis();
  everSeen = true; lastPassenger = now; lastActivity = now;
  passengers++; dirty = true;
  publishEvent("passenger_detected", src);
}

void enterFireStop() {
  if (fireStop) return;
  fireStop = true; dirty = true;
  Serial.println("\n*** FIRE: escalator stopping ***");
  publishEvent("fire_stop", "fire confirmed");
}
void exitFireStop() {
  if (!fireStop) return;
  fireStop = false; dirty = true; lastActivity = millis();
  Serial.println("\n*** FIRE CLEARED: escalator back in service ***");
  publishEvent("fire_cleared");
}
void toggleEmergency(const char* src) {
  emergency = !emergency; dirty = true;
  publishEvent(emergency ? "emergency_stop" : "emergency_reset", src);
  if (!emergency) lastActivity = millis();
}
void resetFault() {
  if (!fault) return;
  if (currentPct >= CLEAR_PCT) { Serial.println("[FAULT] Motor current still too high, cannot reset"); return; }
  fault = false; dirty = true; lastActivity = millis();
  publishEvent("fault_cleared");
}

void updateEscalator() {
  unsigned long now = millis();
  currentPct = map(analogRead(CURRENT_PIN), 0, 4095, 0, 100);

  // passenger sensor (rising edge + cooldown)
  bool pir = digitalRead(PIR_PIN) == HIGH;
  if (pir && !pirLast && now - pirAt >= PIR_COOLDOWN_MS) { pirAt = now; passengerDetected("pir"); }
  pirLast = pir;

  // direction switch
  bool up = digitalRead(DIR_PIN) == LOW;
  if (up != dirUp) { dirUp = up; dirty = true; publishEvent("direction_changed", dirUp ? "up" : "down"); }

  // emergency button (debounced)
  bool r = digitalRead(ESTOP_PIN);
  if (r != estopLast) { estopLast = r; estopChanged = now; }
  if ((now - estopChanged) >= Gate::BUTTON_DEBOUNCE_MS && r != estopStable) {
    estopStable = r;
    if (r == LOW) toggleEmergency("button");
  }

  // motor overload / jam
  if (!fault && currentPct >= JAM_PCT && (mode == M_RUNNING || mode == M_STANDBY)) {
    fault = true; dirty = true;
    publishEvent("jam_detected", "motor overload");
  }

  setMode(computeMode(now));
}

// ---------------- OUTPUTS ----------------
void updateOutputs() {
  unsigned long t = millis();
  bool fastBlink = (t / 250) % 2;
  digitalWrite(LED_RUN,  mode == M_RUNNING);
  digitalWrite(LED_SLOW, mode == M_STANDBY);
  bool alarm = (mode == M_FAULT || mode == M_EMERGENCY || mode == M_FIRE_STOP);
  digitalWrite(LED_STOP, alarm ? fastBlink : (mode == M_STOPPED));

  int want = 0;
  if (!muted) {
    if (mode == M_FIRE_STOP) want = (t % 1000 < 200) ? 1500 : 0;
    else if (mode == M_FAULT || mode == M_EMERGENCY) want = (t % 400 < 150) ? 1200 : 0;
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
  const char* sh = mode == M_RUNNING ? "RUN" : mode == M_STANDBY ? "SLOW" : mode == M_STOPPED ? "STOP"
                   : mode == M_FAULT ? "FAULT" : mode == M_EMERGENCY ? "E-STOP" : "FIRE";
  char l1[24], l2[24];
  snprintf(l1, sizeof l1, "ESC %s %s %d%%", dirUp ? "UP" : "DN", sh, speedPercent(mode));
  if (mode == M_FIRE_STOP) snprintf(l2, sizeof l2, "FIRE - STOPPED");
  else snprintf(l2, sizeof l2, "Pax:%lu Cur:%d%%", passengers, currentPct);
  lcdLine(0, l1); lcdLine(1, l2);
}

// ---------------- INPUTS ----------------
void readSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'p') passengerDetected("serial");
    else if (c == 'e') toggleEmergency("serial");
    else if (c == 'f') enterFireStop();
    else if (c == 'c') exitFireStop();
    else if (c == 'r') resetFault();
    else if (c == 'm') { muted = !muted; Serial.printf("[BUZZER] muted=%d\n", muted); }
  }
}

// ---------------- NETWORK ----------------
void onMessage(char* topic, byte* payload, unsigned int len) {
  JsonDocument d;
  if (deserializeJson(d, payload, len)) return;

  // messages from the fire module
  if (String(topic).startsWith(tFirePrefix)) {
    const char* st = d["state"] | "";
    const char* ev = d["event"] | "";
    if (!strcmp(st, "FIRE_CONFIRMED") || !strcmp(st, "EVACUATION") || !strcmp(ev, "EVACUATION_STARTED")) enterFireStop();
    else if (!strcmp(st, "NORMAL")) exitFireStop();
    return;
  }

  const char* cmd = d["cmd"] | "";
  if (!strcmp(cmd, "passenger")) passengerDetected("mqtt");
  else if (!strcmp(cmd, "emergency")) { if (!emergency) toggleEmergency("mqtt"); }
  else if (!strcmp(cmd, "reset")) { if (emergency) toggleEmergency("mqtt"); resetFault(); }
  else if (!strcmp(cmd, "fire_stop")) enterFireStop();
  else if (!strcmp(cmd, "fire_clear")) exitFireStop();
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
  Serial.println("   SMART AIRPORT - SMART ESCALATOR");
  Serial.println("   DEVICE: ESC-01");
  Serial.println("========================================");

  pinMode(PIR_PIN, INPUT);
  pinMode(DIR_PIN, INPUT_PULLUP);
  pinMode(ESTOP_PIN, INPUT_PULLUP);
  pinMode(LED_RUN, OUTPUT); pinMode(LED_SLOW, OUTPUT); pinMode(LED_STOP, OUTPUT);
  buzzerInit();
  lcd.init(); lcd.backlight(); lcdLine(0, "Smart Escalator"); lcdLine(1, "Starting...");

  dirUp = digitalRead(DIR_PIN) == LOW;
  lastActivity = millis();

  tStatus = Topics::buildTopic(MODULE_ESCALATOR, DEVICE_ID, Topics::SUFFIX_STATUS);
  tEvent  = Topics::buildTopic(MODULE_ESCALATOR, DEVICE_ID, Topics::SUFFIX_EVENT);
  tCmd    = Topics::buildCommandTopic(MODULE_ESCALATOR, DEVICE_ID);
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
  Serial.println("Serial keys: p=passenger e=emergency f=fire stop c=clear fire r=reset fault m=mute");

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setCallback(onMessage);
}

void loop() {
  ensureWifi(); ensureMqtt(); mqtt.loop();
  readSerial();
  updateEscalator(); updateOutputs(); updateLcd();

  unsigned long now = millis();
  if (now - lastPrint >= PRINT_EVERY_MS) {
    lastPrint = now;
    Serial.printf("[ESC] mode=%s dir=%s speed=%d%% pax=%lu current=%d%%\n",
                  modeName(mode), dirUp ? "up" : "down", speedPercent(mode), passengers, currentPct);
  }
  if (dirty || now - lastStatus >= STATUS_EVERY_MS) publishStatus();
  if (now - lastHb >= HEARTBEAT_INTERVAL_MS) publishHeartbeat();
  delay(5);
}
