#pragma once

#include <Arduino.h>

namespace CounterHardware {

// Sensor and Input Pins
constexpr uint8_t PIN_SENSOR_A        = 19; // Directional Sensor A (Outer/Entrance beam, Active LOW)
constexpr uint8_t PIN_SENSOR_B        = 21; // Directional Sensor B (Inner/Exit beam, Active LOW)
constexpr uint8_t PIN_RESET_BTN       = 22; // Manual Reset / Test Button (Active LOW)

// Status and Feedback Output Pins
constexpr uint8_t PIN_LED_ENTRY       = 2;  // Green LED: Pulses on Confirmed Passenger Entry
constexpr uint8_t PIN_LED_EXIT        = 4;  // Blue/Yellow LED: Pulses on Confirmed Passenger Exit
constexpr uint8_t PIN_LED_STATUS      = 5;  // Red/Status LED: Solid online, flashes on activity
constexpr uint8_t PIN_BUZZER          = 18; // Feedback Buzzer (short click/beep on count)

} // namespace CounterHardware
