#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "device_config.h"
#include "mqtt_topics.h"
#include "constants.h"
#include "baggage_controller.h"

class MqttManager {
public:
    MqttManager(const char* deviceId, BaggageController& controller);

    void begin();
    void update();

    void publishStatus();
    void publishHeartbeat();
    void publishEvent(const char* eventName, const char* details);
    void publishTag(const char* tagUid, const char* result, const char* reason);

private:
    void setupWifi();
    void reconnectMqtt();
    void handleCommandPayload(char* topic, byte* payload, unsigned int length);

    const char* deviceId_;
    BaggageController& controller_;

    WiFiClient wifiClient_;
    PubSubClient mqttClient_;

    unsigned long lastWifiRetry_;
    unsigned long lastMqttRetry_;
    unsigned long lastHeartbeat_;
    String commandTopic_;
};
