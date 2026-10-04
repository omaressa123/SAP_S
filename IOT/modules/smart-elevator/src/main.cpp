#include <Arduino.h>
#include "elevator_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "ELEV-001"
#endif

ElevatorController elevatorController;
MqttManager mqttManager(DEVICE_ID, elevatorController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT SMART ELEVATOR IOT [%s]\n", DEVICE_ID);
    Serial.println(F("   Call / door / overload / e-stop"));
    Serial.println(F("============================================="));

    elevatorController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        mqttManager.publishStatus();
    });

    elevatorController.begin();
    mqttManager.begin();
}

void loop() {
    elevatorController.update();
    mqttManager.update();
    delay(10);
}
