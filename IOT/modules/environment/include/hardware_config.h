#pragma once

#include <Arduino.h>

namespace EnvironmentHardware {

// Potentiometers simulate sensor channels:
//   Pot 1 -> temperature simulator (mapped to 10..45 C)
//   Pot 2 -> humidity simulator (mapped to 0..100 %RH)
//   Pot 3 -> CO2 / air-quality simulator (mapped to 400..2000 ppm)
constexpr uint8_t PIN_TEMP_ADC     = 34;
constexpr uint8_t PIN_HUMIDITY_ADC = 35;
constexpr uint8_t PIN_CO2_ADC      = 32;

// Interactive buttons (Active LOW with INPUT_PULLUP)
constexpr uint8_t PIN_FAN_BTN   = 19; // Fan override toggle
constexpr uint8_t PIN_RESET_BTN = 23; // Reset to AUTO

// Outputs
constexpr uint8_t PIN_LED_OK      = 2;  // Green: comfort OK
constexpr uint8_t PIN_LED_WARNING = 4;  // Yellow: comfort warning
constexpr uint8_t PIN_LED_POOR    = 5;  // Red: poor air quality
constexpr uint8_t PIN_FAN_RELAY   = 18; // Ventilation fan relay

} // namespace EnvironmentHardware
