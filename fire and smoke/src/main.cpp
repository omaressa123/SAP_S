#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "DHTesp.h"

// --- Hardware Pin Definitions ---
#define PIN_DHT 4
#define PIN_SMOKE 34
#define PIN_BUZZER 18
#define PIN_LED_RED 2
#define PIN_LED_GREEN 15

// --- Network & MQTT Broker Credentials ---
const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* mqtt_server = "broker.hivemq.com";
const char* mqtt_topic = "smart_airport/safety/terminal2";

WiFiClient espClient;
PubSubClient client(espClient);
DHTesp dhtSensor;

// --- Finite State Machine (FSM) States ---
enum SystemState { SAFE, WARNING, CRITICAL };
SystemState currentState = SAFE;

unsigned long lastMsgTime = 0;

void setup_wifi() {
  Serial.print("Connecting to Airport Wi-Fi Network...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" CONNECTED!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to Airport Central MQTT Broker...");
    String clientId = "Airport-Safety-Node-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println(" CONNECTED!");
    } else {
      Serial.print("Connection failed, rc=");
      Serial.print(client.state());
      Serial.println(" Retrying in 2 seconds...");
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize GPIO modes
  pinMode(PIN_SMOKE, INPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  // Initialize DHT22 environment sensor
  dhtSensor.setup(PIN_DHT, DHTesp::DHT22);

  // Configure Wi-Fi & MQTT transport layer
  setup_wifi();
  client.setServer(mqtt_server, 1883);

  Serial.println("System Initialized: Smart Airport Fire & Smoke Monitoring Node");
}

void loop() {
  // Ensure network reliability
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Non-blocking telemetry loop (runs every 2000 ms)
  unsigned long now = millis();
  if (now - lastMsgTime > 2000) {
    lastMsgTime = now;

    // 1. Data Acquisition
    TempAndHumidity data = dhtSensor.getTempAndHumidity();
    int smokeRaw = analogRead(PIN_SMOKE); // ADC dynamic range: 0 - 4095
    float temperature = data.temperature;

    // 2. Risk Evaluation & FSM Transition Logic
    if (smokeRaw > 2500 || temperature > 55.0) {
      currentState = CRITICAL;
    } else if (smokeRaw > 1200 || temperature > 40.0) {
      currentState = WARNING;
    } else {
      currentState = SAFE;
    }

    // 3. Actuator Control (Visual & Audible Alarms)
    String statusStr = "SAFE";
    if (currentState == CRITICAL) {
      statusStr = "CRITICAL";
      digitalWrite(PIN_LED_RED, HIGH);
      digitalWrite(PIN_LED_GREEN, LOW);
      tone(PIN_BUZZER, 1000); // Trigger acoustic evacuation alert
    } else if (currentState == WARNING) {
      statusStr = "WARNING";
      digitalWrite(PIN_LED_RED, HIGH);
      digitalWrite(PIN_LED_GREEN, LOW);
      noTone(PIN_BUZZER);
    } else {
      statusStr = "SAFE";
      digitalWrite(PIN_LED_RED, LOW);
      digitalWrite(PIN_LED_GREEN, HIGH);
      noTone(PIN_BUZZER);
    }

    // 4. Construct Telemetry JSON Payload
    String payload = "{";
    payload += "\"zone\":\"Terminal 2 - Arrivals\",";
    payload += "\"status\":\"" + statusStr + "\",";
    payload += "\"temperature\":" + String(temperature, 1) + ",";
    payload += "\"smoke_level\":" + String(smokeRaw);
    payload += "}";

    // 5. Publish Telemetry to Central Airport Gateway
    client.publish(mqtt_topic, payload.c_str());

    // 6. Local Logging to Serial Monitor
    Serial.println("\n[AIRPORT SAFETY TELEMETRY BROADCAST]");
    Serial.println(payload);
  }
}