#include <Arduino.h>
#include "emergency_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "EMERG-001"
#endif

EmergencyController emergencyController;
MqttManager mqttManager(DEVICE_ID, emergencyController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT EMERGENCY DETECTION IOT [%s]\n", DEVICE_ID);
    Serial.println(F("   Trigger / evacuation / lockdown siren"));
    Serial.println(F("============================================="));

    emergencyController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        mqttManager.publishStatus();
    });

    emergencyController.begin();
    mqttManager.begin();
}

void loop() {
    emergencyController.update();
    mqttManager.update();
    delay(10);
}
