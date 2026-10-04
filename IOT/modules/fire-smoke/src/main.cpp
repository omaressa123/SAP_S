#include <Arduino.h>
#include "firesmoke_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "FIRE-001"
#endif

FireSmokeController fireController;
MqttManager mqttManager(DEVICE_ID, fireController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT FIRE/SMOKE MONITOR IOT [%s]\n", DEVICE_ID);
    Serial.println(F("   Threshold monitoring (no suppression claim)"));
    Serial.println(F("============================================="));

    fireController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        mqttManager.publishStatus();
    });

    fireController.setOnTelemetryCallback([]() {
        mqttManager.publishTelemetry();
    });

    fireController.begin();
    mqttManager.begin();
}

void loop() {
    fireController.update();
    mqttManager.update();
    delay(10);
}
