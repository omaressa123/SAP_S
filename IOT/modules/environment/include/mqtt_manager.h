#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "device_config.h"
#include "mqtt_topics.h"
#include "constants.h"
#include "environment_controller.h"

class MqttManager {
public:
    MqttManager(const char* deviceId, EnvironmentController& controller);

    void begin();
    void update();

    void publishStatus();
    void publishHeartbeat();
    void publishTelemetry();
    void publishEvent(const char* eventName, const char* details);

private:
    void setupWifi();
    void reconnectMqtt();
    void handleCommandPayload(char* topic, byte* payload, unsigned int length);

    const char* deviceId_;
    EnvironmentController& controller_;

    WiFiClient wifiClient_;
    PubSubClient mqttClient_;

    unsigned long lastWifiRetry_;
    unsigned long lastMqttRetry_;
    unsigned long lastHeartbeat_;
    String commandTopic_;
};
