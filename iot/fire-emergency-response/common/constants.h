#pragma once

#include <Arduino.h>

namespace AirportIoT {

// Network & Connection Timeouts
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 5000;
constexpr unsigned long MQTT_RETRY_INTERVAL_MS = 3000;
constexpr unsigned long HEARTBEAT_INTERVAL_MS  = 15000; // 15 seconds default

// Smart Gate Constants
namespace Gate {
    constexpr unsigned long PASSENGER_AUTH_TIMEOUT_MS = 8000;
    constexpr unsigned long GATE_OPEN_DURATION_MS     = 4000;
    constexpr unsigned long GATE_MOTION_DURATION_MS   = 1500;
    constexpr unsigned long ALARM_DURATION_MS         = 3000;
    constexpr unsigned long BUTTON_DEBOUNCE_MS        = 50;

    // Servo Positions (in degrees)
    constexpr int SERVO_CLOSED_POS = 0;
    constexpr int SERVO_OPEN_POS   = 90;
}

// Passenger Counter Constants
namespace Counter {
    constexpr unsigned long DIRECTION_TIMEOUT_MS = 4000;
    constexpr unsigned long SENSOR_COOLDOWN_MS   = 1000;
    constexpr unsigned long SENSOR_DEBOUNCE_MS   = 50;
}

// Device Status Strings
namespace Status {
    constexpr const char* ONLINE      = "online";
    constexpr const char* OFFLINE     = "offline";
    constexpr const char* MAINTENANCE = "maintenance";
    constexpr const char* ERROR       = "error";
    constexpr const char* LOCKED      = "locked";
}

} // namespace AirportIoT
