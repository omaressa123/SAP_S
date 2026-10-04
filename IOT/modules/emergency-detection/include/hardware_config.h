#pragma once

#include <Arduino.h>

namespace EmergencyHardware {

// Emergency detection simulation inputs (Active LOW with INPUT_PULLUP)
constexpr uint8_t PIN_TRIGGER_BTN  = 19; // Emergency trigger / panic button
constexpr uint8_t PIN_SILENCE_BTN  = 21; // Silence alarm (keep beacon)
constexpr uint8_t PIN_LOCKDOWN_BTN = 22; // Lockdown trigger
constexpr uint8_t PIN_RESET_BTN    = 23; // Manual reset (Active LOW)

// Outputs
constexpr uint8_t PIN_LED_GREEN = 2;  // Normal operation
constexpr uint8_t PIN_LED_RED   = 4;  // Alarm / evacuation / lockdown
constexpr uint8_t PIN_BUZZER    = 5;  // Siren
constexpr uint8_t PIN_BEACON    = 18; // Strobe beacon output

} // namespace EmergencyHardware
