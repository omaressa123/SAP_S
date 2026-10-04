#pragma once

#include <Arduino.h>

namespace AirportIoT {

// Network & Connection Timeouts
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 5000;
constexpr unsigned long MQTT_RETRY_INTERVAL_MS = 3000;
constexpr unsigned long HEARTBEAT_INTERVAL_MS  = 15000; // 15 seconds default

// Smart Gate Constants
namespace Gate {
    constexpr unsigned long PASSENGER_AUTH_TIMEOUT_MS = 8000;  // Time to present RFID after detection
    constexpr unsigned long GATE_OPEN_DURATION_MS     = 4000;  // How long the gate stays open
    constexpr unsigned long GATE_MOTION_DURATION_MS   = 1500;  // Time taken to physically open/close
    constexpr unsigned long ALARM_DURATION_MS         = 3000;  // How long alarm stays active on denied access
    constexpr unsigned long BUTTON_DEBOUNCE_MS        = 50;    // Hardware debounce
    
    // Servo Positions (in degrees)
    constexpr int SERVO_CLOSED_POS = 0;
    constexpr int SERVO_OPEN_POS   = 90;
}

// Passenger Counter Constants
namespace Counter {
    constexpr unsigned long DIRECTION_TIMEOUT_MS = 4000; // Max time between Sensor A and B triggers
    constexpr unsigned long SENSOR_COOLDOWN_MS   = 1000; // Cooldown after a valid transit to prevent double-count
    constexpr unsigned long SENSOR_DEBOUNCE_MS   = 50;   // Debounce for IR/beam sensors
}

// Aircraft Parking / Ground IoT Constants
namespace Parking {
    // Distance thresholds in centimeters (HC-SR04 simulation range)
    constexpr float DETECTION_THRESHOLD_CM   = 300.0f; // > this: stand empty
    constexpr float APPROACH_THRESHOLD_CM    = 150.0f; // <= this: aircraft approaching
    constexpr float ALIGNMENT_THRESHOLD_CM   = 80.0f;  // <= this: alignment required
    constexpr float PARKED_THRESHOLD_CM      = 40.0f;  // <= this: parked zone
    constexpr float UNSAFE_THRESHOLD_CM      = 15.0f;  // <= this: unsafe / stop
    constexpr float SENSOR_MAX_RANGE_CM      = 400.0f; // HC-SR04 max reliable range
    constexpr unsigned long STATE_SETTLE_MS  = 800;    // settle time before PARKED confirm
    constexpr unsigned long UNSAFE_ALARM_MS  = 2000;   // unsafe dwell before latched WARNING event
    constexpr unsigned long BUTTON_DEBOUNCE_MS = 50;
}

// Smart Charging Station Constants (LOW-VOLTAGE SIMULATION ONLY)
namespace Charging {
    constexpr float VOLTAGE_MIN_V        = 380.0f; // simulated DC bus range
    constexpr float VOLTAGE_MAX_V        = 420.0f;
    constexpr float CURRENT_MAX_A        = 125.0f;
    constexpr float TEMP_WARNING_C       = 55.0f;  // warning threshold
    constexpr float TEMP_CRITICAL_C      = 65.0f;  // stop threshold
    constexpr float TEMP_HYSTERESIS_C    = 3.0f;
    constexpr float CHARGE_RATE_PCT_S    = 1.0f;   // % per second while charging (simulated)
    constexpr unsigned long TELEMETRY_INTERVAL_MS = 2000;
    constexpr unsigned long BUTTON_DEBOUNCE_MS    = 50;
}

// Airport Equipment Monitoring Constants (threshold-based, NOT ML prediction)
namespace Equipment {
    constexpr float TEMP_WARNING_C       = 70.0f;
    constexpr float TEMP_CRITICAL_C      = 85.0f;
    constexpr float VIBRATION_WARNING_G  = 4.5f;   // mm/s RMS simulated
    constexpr float VIBRATION_CRITICAL_G = 7.1f;
    constexpr float CURRENT_RATED_A      = 10.0f;
    constexpr float CURRENT_WARNING_A    = 12.0f;
    constexpr float CURRENT_CRITICAL_A   = 15.0f;
    constexpr unsigned long TELEMETRY_INTERVAL_MS = 3000;
    constexpr unsigned long BUTTON_DEBOUNCE_MS    = 50;
}

// Security Area IoT Constants
namespace Security {
    constexpr unsigned long AUTH_TIMEOUT_MS       = 10000; // wait for authorization
    constexpr unsigned long GATE_MOTION_DURATION_MS = 1500;
    constexpr unsigned long GATE_OPEN_DWELL_MS      = 4000;
    constexpr unsigned long ALARM_DURATION_MS       = 5000;
    constexpr unsigned long BUTTON_DEBOUNCE_MS      = 50;
}

// Smart Baggage Constants
namespace Baggage {
    constexpr unsigned long SORT_TIMEOUT_MS    = 8000;  // wait for backend sort decision
    constexpr unsigned long SORT_MOTION_MS     = 1200;  // diverter motion time
    constexpr unsigned long ALARM_DURATION_MS  = 3000;
    constexpr unsigned long BUTTON_DEBOUNCE_MS = 50;
}

// Emergency Detection Constants
namespace Emergency {
    constexpr unsigned long AUTO_EVACUATE_MS   = 30000; // ALERT auto-escalates to EVACUATION
    constexpr unsigned long BUTTON_DEBOUNCE_MS = 50;
}

// Fire / Smoke Monitoring Constants (threshold-based, NOT suppression)
namespace FireSmoke {
    constexpr float SMOKE_WARNING_PPM  = 300.0f;
    constexpr float SMOKE_CRITICAL_PPM = 600.0f;
    constexpr float TEMP_WARNING_C     = 50.0f;
    constexpr float TEMP_CRITICAL_C    = 70.0f;
    constexpr unsigned long TELEMETRY_INTERVAL_MS = 3000;
    constexpr unsigned long BUTTON_DEBOUNCE_MS    = 50;
}

// Smart Environment Constants
namespace Environment {
    constexpr float TEMP_HIGH_C       = 28.0f;
    constexpr float TEMP_LOW_C        = 16.0f;
    constexpr float HUMIDITY_HIGH_RH  = 70.0f;
    constexpr float CO2_WARNING_PPM   = 1000.0f;
    constexpr float CO2_POOR_PPM      = 1500.0f;
    constexpr unsigned long TELEMETRY_INTERVAL_MS = 3000;
    constexpr unsigned long BUTTON_DEBOUNCE_MS    = 50;
}

// Smart Elevator Constants (simulation only, NOT a real lift controller)
namespace Elevator {
    constexpr unsigned long TRAVEL_MS      = 3000; // simulated floor travel
    constexpr unsigned long DOOR_DWELL_MS  = 4000; // door open dwell
    constexpr unsigned long BUTTON_DEBOUNCE_MS = 50;
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
