#include <Arduino.h>
#include "security_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "SECURITY-001"
#endif

SecurityController securityController;
MqttManager mqttManager(DEVICE_ID, securityController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT SECURITY AREA IOT [%s]\n", DEVICE_ID);
    Serial.println(F("   Presence + access control (no AI threat logic)"));
    Serial.println(F("============================================="));

    // Register callbacks from SecurityController to MQTT Manager
    securityController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        // Keep retained status in sync with state transitions
        mqttManager.publishStatus();
    });

    securityController.setOnAccessCallback([](const char* cardUid, bool authorized, const char* reason) {
        mqttManager.publishAccess(cardUid, authorized, reason);
    });

    // Initialize subsystems
    securityController.begin();
    mqttManager.begin();
}

void loop() {
    securityController.update();
    mqttManager.update();
    delay(10); // Small cooperative yield for ESP32 RTOS / watchdog
}
