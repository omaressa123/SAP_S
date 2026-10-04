#pragma once

#include <Arduino.h>

namespace FireSmokeHardware {

// Potentiometers simulate sensor channels:
//   Pot 1 -> smoke density simulator (mapped to 0..1000 ppm)
//   Pot 2 -> temperature simulator (mapped to 20..90 C)
constexpr uint8_t PIN_SMOKE_ADC = 34;
constexpr uint8_t PIN_TEMP_ADC  = 35;

// Interactive buttons (Active LOW with INPUT_PULLUP)
constexpr uint8_t PIN_TEST_BTN    = 19; // Test alarm
constexpr uint8_t PIN_SILENCE_BTN = 21; // Silence siren (keep beacon)
constexpr uint8_t PIN_RESET_BTN   = 23; // Reset latched alarm

// Outputs
constexpr uint8_t PIN_LED_OK       = 2;  // Green: air clear
constexpr uint8_t PIN_LED_WARNING  = 4;  // Yellow: warning
constexpr uint8_t PIN_LED_CRITICAL = 5;  // Red: critical / alarm
constexpr uint8_t PIN_BUZZER       = 18; // Siren

} // namespace FireSmokeHardware
