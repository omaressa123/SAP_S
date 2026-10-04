#include "mqtt_manager.h"

MqttManager::MqttManager(const char* deviceId, CounterController& controller)
    : deviceId_(deviceId),
      controller_(controller),
      mqttClient_(wifiClient_),
      lastWifiRetry_(0),
      lastMqttRetry_(0),
      lastHeartbeat_(0) {
    commandTopic_ = AirportIoT::Topics::buildCommandTopic(AirportIoT::Topics::MODULE_PASSENGER_COUNTER, deviceId_);
}

void MqttManager::begin() {
    setupWifi();
    mqttClient_.setServer(MQTT_HOST, MQTT_PORT);
    
    mqttClient_.setCallback([this](char* topic, byte* payload, unsigned int length) {
        this->handleCommandPayload(topic, payload, length);
    });

    Serial.printf("[MQTT] Configured broker %s:%d\n", MQTT_HOST, MQTT_PORT);
}

void MqttManager::setupWifi() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.printf("[WiFi] Connecting to %s...\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void MqttManager::reconnectMqtt() {
    if (WiFi.status() != WL_CONNECTED) {
        unsigned long now = millis();
        if (now - lastWifiRetry_ >= AirportIoT::WIFI_RETRY_INTERVAL_MS) {
            lastWifiRetry_ = now;
            Serial.println(F("[WiFi] Reconnecting to Wi-Fi..."));
            WiFi.reconnect();
        }
        return;
    }

    unsigned long now = millis();
    if (!mqttClient_.connected()) {
        if (now - lastMqttRetry_ >= AirportIoT::MQTT_RETRY_INTERVAL_MS) {
            lastMqttRetry_ = now;
            String clientId = "ESP32-" + String(deviceId_) + "-" + String(random(0xffff), HEX);
            Serial.printf("[MQTT] Attempting connection as %s to %s:%d...\n", clientId.c_str(), MQTT_HOST, MQTT_PORT);

            // LWT (Last Will and Testament)
            String willTopic = AirportIoT::Topics::buildTopic(AirportIoT::Topics::MODULE_PASSENGER_COUNTER, deviceId_, AirportIoT::Topics::SUFFIX_STATUS);
            StaticJsonDocument<128> willDoc;
            willDoc["device_id"] = deviceId_;
            willDoc["status"] = AirportIoT::Status::OFFLINE;
            char willBuffer[128];
            serializeJson(willDoc, willBuffer);

            bool connected = false;
            if (strlen(MQTT_USER) > 0) {
                connected = mqttClient_.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, willTopic.c_str(), 1, true, willBuffer);
            } else {
                connected = mqttClient_.connect(clientId.c_str(), willTopic.c_str(), 1, true, willBuffer);
            }

            if (connected) {
                Serial.println(F("[MQTT] Connected successfully to broker!"));
                mqttClient_.subscribe(commandTopic_.c_str());
                Serial.printf("[MQTT] Subscribed to %s\n", commandTopic_.c_str());
                publishStatus();
                publishOccupancy();
            } else {
                Serial.printf("[MQTT] Connection failed, rc=%d. Will retry.\n", mqttClient_.state());
            }
        }
    }
}

void MqttManager::handleCommandPayload(char* topic, byte* payload, unsigned int length) {
    char message[256];
    if (length >= sizeof(message)) {
        length = sizeof(message) - 1;
    }
    memcpy(message, payload, length);
    message[length] = '\0';

    Serial.printf("[MQTT] Received message on topic [%s]: %s\n", topic, message);

    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error) {
        Serial.printf("[MQTT] JSON parse error: %s\n", error.c_str());
        return;
    }

    if (!doc.containsKey("command")) {
        Serial.println(F("[MQTT] Payload missing 'command' field"));
        return;
    }

    const char* cmd = doc["command"];
    Serial.printf("[MQTT] Processing command: %s\n", cmd);

    if (strcmp(cmd, "RESET") == 0) {
        controller_.resetCounters();
    } else if (strcmp(cmd, "GET_STATUS") == 0) {
        publishStatus();
        publishOccupancy();
    } else if (strcmp(cmd, "SET_OCCUPANCY") == 0) {
        uint32_t count = doc["occupancy"] | 0;
        controller_.setOccupancy(count);
    } else if (strcmp(cmd, "SIMULATE_ENTRY") == 0) {
        controller_.simulateEntry();
    } else if (strcmp(cmd, "SIMULATE_EXIT") == 0) {
        controller_.simulateExit();
    } else {
        Serial.printf("[MQTT] Unknown command: %s\n", cmd);
    }
}

void MqttManager::publishStatus() {
    if (!mqttClient_.connected()) return;

    String topic = AirportIoT::Topics::buildTopic(AirportIoT::Topics::MODULE_PASSENGER_COUNTER, deviceId_, AirportIoT::Topics::SUFFIX_STATUS);
    StaticJsonDocument<256> doc;
    doc["device_id"] = deviceId_;
    doc["module"] = AirportIoT::Topics::MODULE_PASSENGER_COUNTER;
    doc["status"] = AirportIoT::Status::ONLINE;
    doc["state"] = controller_.getStateString();
    doc["zone"] = AIRPORT_ZONE;
    doc["timestamp"] = millis();

    char buffer[256];
    serializeJson(doc, buffer);
    mqttClient_.publish(topic.c_str(), buffer, true);
    Serial.printf("[MQTT] Published status to %s: %s\n", topic.c_str(), buffer);
}

void MqttManager::publishHeartbeat() {
    if (!mqttClient_.connected()) return;

    String topic = AirportIoT::Topics::buildHeartbeatTopic(deviceId_);
    StaticJsonDocument<256> doc;
    doc["device_id"] = deviceId_;
    doc["module"] = AirportIoT::Topics::MODULE_PASSENGER_COUNTER;
    doc["status"] = AirportIoT::Status::ONLINE;
    doc["uptime"] = millis() / 1000;
    doc["free_heap"] = ESP.getFreeHeap();

    char buffer[256];
    serializeJson(doc, buffer);
    mqttClient_.publish(topic.c_str(), buffer);
    Serial.printf("[MQTT] Heartbeat sent: %s\n", buffer);
}

void MqttManager::publishOccupancy() {
    if (!mqttClient_.connected()) return;

    String topic = AirportIoT::Topics::buildTopic(AirportIoT::Topics::MODULE_PASSENGER_COUNTER, deviceId_, AirportIoT::Topics::SUFFIX_OCCUPANCY);
    StaticJsonDocument<256> doc;
    doc["device_id"] = deviceId_;
    doc["zone"] = AIRPORT_ZONE;
    doc["occupancy"] = controller_.getOccupancy();
    doc["entered"] = controller_.getTotalEntered();
    doc["exited"] = controller_.getTotalExited();
    doc["timestamp"] = millis();

    char buffer[256];
    serializeJson(doc, buffer, true); // Retained message for instant state retrieval
    mqttClient_.publish(topic.c_str(), buffer, true);
    Serial.printf("[MQTT] Published occupancy to %s: %s\n", topic.c_str(), buffer);
}

void MqttManager::publishEvent(const char* eventName, const char* details) {
    if (!mqttClient_.connected()) return;

    String topic = AirportIoT::Topics::buildTopic(AirportIoT::Topics::MODULE_PASSENGER_COUNTER, deviceId_, AirportIoT::Topics::SUFFIX_EVENT);
    StaticJsonDocument<256> doc;
    doc["device_id"] = deviceId_;
    doc["module"] = AirportIoT::Topics::MODULE_PASSENGER_COUNTER;
    doc["event"] = eventName;
    doc["occupancy"] = controller_.getOccupancy();
    doc["entered"] = controller_.getTotalEntered();
    doc["exited"] = controller_.getTotalExited();
    doc["details"] = details;
    doc["timestamp"] = millis();

    char buffer[256];
    serializeJson(doc, buffer);
    mqttClient_.publish(topic.c_str(), buffer);
    Serial.printf("[MQTT] Published event to %s: %s\n", topic.c_str(), buffer);
}

void MqttManager::update() {
    reconnectMqtt();
    if (mqttClient_.connected()) {
        mqttClient_.loop();

        unsigned long now = millis();
        if (now - lastHeartbeat_ >= DEVICE_HEARTBEAT_INTERVAL) {
            lastHeartbeat_ = now;
            publishHeartbeat();
        }
    }
}
