#include <Arduino.h>
#include "parking_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "AIRCRAFT-PARK-001"
#endif

ParkingController parkingController;
MqttManager mqttManager(DEVICE_ID, parkingController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT AIRCRAFT PARKING IOT [%s]\n", DEVICE_ID);
    Serial.println(F("============================================="));

    // Register callbacks from ParkingController to MQTT Manager
    parkingController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        // Keep retained status in sync with state transitions
        mqttManager.publishStatus();
    });

    parkingController.setOnTelemetryCallback([]() {
        mqttManager.publishTelemetry();
    });

    // Initialize subsystems
    parkingController.begin();
    mqttManager.begin();
}

void loop() {
    parkingController.update();
    mqttManager.update();
    delay(10); // Small cooperative yield for ESP32 RTOS / watchdog
}
