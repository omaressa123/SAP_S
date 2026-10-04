#include <Arduino.h>
#include "counter_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "COUNTER-001"
#endif

CounterController counterController;
MqttManager mqttManager(DEVICE_ID, counterController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT PASSENGER COUNTER [%s]\n", DEVICE_ID);
    Serial.println(F("============================================="));

    // Register callbacks
    counterController.setOnUpdateCallback([](uint32_t occupancy, uint32_t totalEntered, uint32_t totalExited, const char* eventType) {
        mqttManager.publishOccupancy();
        mqttManager.publishEvent(eventType, "COUNT_UPDATE");
        mqttManager.publishStatus();
    });

    counterController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
    });

    // Initialize subsystems
    counterController.begin();
    mqttManager.begin();
}

void loop() {
    counterController.update();
    mqttManager.update();
    delay(10); // Small cooperative yield
}
