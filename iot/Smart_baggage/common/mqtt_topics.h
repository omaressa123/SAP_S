#pragma once

#include <Arduino.h>

namespace AirportIoT {
namespace Topics {

// Standard Airport MQTT Prefix
constexpr const char* PREFIX = "airport";

// Module Names
constexpr const char* MODULE_GATE              = "gate";
constexpr const char* MODULE_PASSENGER_COUNTER = "passenger-counter";
constexpr const char* MODULE_BAGGAGE           = "baggage";
constexpr const char* MODULE_EMERGENCY         = "emergency";
constexpr const char* MODULE_FIRE_SMOKE        = "fire-smoke";
constexpr const char* MODULE_ENVIRONMENT       = "environment";
constexpr const char* MODULE_ELEVATOR          = "elevator";
constexpr const char* MODULE_GROUND_IOT        = "ground-iot";
constexpr const char* MODULE_CHARGING          = "charging";
constexpr const char* MODULE_EQUIPMENT         = "equipment";
constexpr const char* MODULE_SECURITY          = "security";

// Event / Sub-topic Suffixes
constexpr const char* SUFFIX_STATUS    = "status";
constexpr const char* SUFFIX_COMMAND   = "command";
constexpr const char* SUFFIX_EVENT     = "event";
constexpr const char* SUFFIX_PASSENGER = "passenger";
constexpr const char* SUFFIX_ACCESS    = "access";
constexpr const char* SUFFIX_OCCUPANCY = "occupancy";
constexpr const char* SUFFIX_HEARTBEAT = "heartbeat";

/**
 * Builds topic: airport/{module}/{deviceId}/{suffix}
 */
inline String buildTopic(const char* module, const char* deviceId, const char* suffix) {
    String topic = String(PREFIX) + "/" + module + "/" + deviceId + "/" + suffix;
    return topic;
}

/**
 * Builds standard device heartbeat topic: airport/device/{deviceId}/heartbeat
 */
inline String buildHeartbeatTopic(const char* deviceId) {
    String topic = String(PREFIX) + "/device/" + deviceId + "/" + SUFFIX_HEARTBEAT;
    return topic;
}

/**
 * Builds command subscription wildcard topic: airport/{module}/{deviceId}/command
 */
inline String buildCommandTopic(const char* module, const char* deviceId) {
    return buildTopic(module, deviceId, SUFFIX_COMMAND);
}

} // namespace Topics
} // namespace AirportIoT
