#include <Arduino.h>
#include "environment_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "ENV-001"
#endif

EnvironmentController envController;
MqttManager mqttManager(DEVICE_ID, envController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT ENVIRONMENT MONITOR IOT [%s]\n", DEVICE_ID);
    Serial.println(F("   Temp / humidity / CO2 + fan control"));
    Serial.println(F("============================================="));

    envController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        mqttManager.publishStatus();
    });

    envController.setOnTelemetryCallback([]() {
        mqttManager.publishTelemetry();
    });

    envController.begin();
    mqttManager.begin();
}

void loop() {
    envController.update();
    mqttManager.update();
    delay(10);
}
