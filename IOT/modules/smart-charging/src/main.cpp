#include <Arduino.h>
#include "charger_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "CHARGER-001"
#endif

ChargerController chargerController;
MqttManager mqttManager(DEVICE_ID, chargerController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT SMART CHARGING STATION [%s]\n", DEVICE_ID);
    Serial.println(F("   LOW-VOLTAGE SIMULATION ONLY"));
    Serial.println(F("============================================="));

    // Register callbacks from ChargerController to MQTT Manager
    chargerController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        // Keep retained status in sync with state transitions
        mqttManager.publishStatus();
    });

    chargerController.setOnTelemetryCallback([]() {
        mqttManager.publishTelemetry();
    });

    // Initialize subsystems
    chargerController.begin();
    mqttManager.begin();
}

void loop() {
    chargerController.update();
    mqttManager.update();
    delay(10); // Small cooperative yield for ESP32 RTOS / watchdog
}
