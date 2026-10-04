#include <Arduino.h>
#include "gate_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "GATE-001"
#endif

GateController gateController;
MqttManager mqttManager(DEVICE_ID, gateController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT SMART GATE CONTROLLER [%s]\n", DEVICE_ID);
    Serial.println(F("============================================="));

    // Register callbacks from GateController to MQTT Manager
    gateController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        if (strcmp(eventName, "passenger_detected") == 0) {
            mqttManager.publishPassengerEvent("passenger_detected");
        }
        // Also update retained status on key state changes
        mqttManager.publishStatus();
    });

    gateController.setOnAccessCallback([](const char* cardUid, bool authorized, const char* reason) {
        mqttManager.publishAccess(cardUid, authorized, reason);
    });

    // Initialize subsystems
    gateController.begin();
    mqttManager.begin();
}

void loop() {
    gateController.update();
    mqttManager.update();
    delay(10); // Small cooperative yield for ESP32 RTOS / watchdog
}
