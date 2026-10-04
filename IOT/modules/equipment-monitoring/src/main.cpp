#include <Arduino.h>
#include "equipment_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "EQUIPMENT-001"
#endif

EquipmentController equipmentController;
MqttManager mqttManager(DEVICE_ID, equipmentController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT EQUIPMENT MONITORING [%s]\n", DEVICE_ID);
    Serial.println(F("   Conveyor motor - threshold monitoring"));
    Serial.println(F("============================================="));

    // Register callbacks from EquipmentController to MQTT Manager
    equipmentController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        // Keep retained status in sync with state transitions
        mqttManager.publishStatus();
    });

    equipmentController.setOnTelemetryCallback([]() {
        mqttManager.publishTelemetry();
    });

    // Initialize subsystems
    equipmentController.begin();
    mqttManager.begin();
}

void loop() {
    equipmentController.update();
    mqttManager.update();
    delay(10); // Small cooperative yield for ESP32 RTOS / watchdog
}
