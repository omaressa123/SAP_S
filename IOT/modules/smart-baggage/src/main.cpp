#include <Arduino.h>
#include "baggage_controller.h"
#include "mqtt_manager.h"

#ifndef DEVICE_ID
#define DEVICE_ID "BAGGAGE-001"
#endif

BaggageController baggageController;
MqttManager mqttManager(DEVICE_ID, baggageController);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println(F("\n============================================="));
    Serial.printf("   AIRPORT SMART BAGGAGE IOT [%s]\n", DEVICE_ID);
    Serial.println(F("   Tag induction + diverter sort line"));
    Serial.println(F("============================================="));

    baggageController.setOnEventCallback([](const char* eventName, const char* details) {
        mqttManager.publishEvent(eventName, details);
        mqttManager.publishStatus();
    });

    baggageController.setOnTagCallback([](const char* tagUid, const char* result, const char* reason) {
        mqttManager.publishTag(tagUid, result, reason);
    });

    baggageController.begin();
    mqttManager.begin();
}

void loop() {
    baggageController.update();
    mqttManager.update();
    delay(10);
}
