#pragma once

#include <Arduino.h>

namespace EquipmentHardware {

// Representative machine: CONVEYOR MOTOR.
// Potentiometers simulate sensor channels:
//   Pot 1 -> bearing/motor temperature simulator (mapped to 20..110 C)
//   Pot 2 -> vibration level simulator (mapped to 0..10 mm/s RMS)
//   Pot 3 -> motor current simulator (mapped to 0..20 A)
constexpr uint8_t PIN_TEMP_ADC      = 34;
constexpr uint8_t PIN_VIBRATION_ADC = 35;
constexpr uint8_t PIN_CURRENT_ADC   = 32;

// Interactive buttons (Active LOW with INPUT_PULLUP)
constexpr uint8_t PIN_RUN_BTN   = 19; // Start / stop equipment toggle
constexpr uint8_t PIN_MAINT_BTN = 21; // Maintenance acknowledge / clear
constexpr uint8_t PIN_RESET_BTN = 23; // Reset faults and runtime

// Outputs
constexpr uint8_t PIN_LED_RUN      = 2;  // Green: equipment running
constexpr uint8_t PIN_LED_WARNING  = 4;  // Yellow: warning condition
constexpr uint8_t PIN_LED_CRITICAL = 5;  // Red: critical condition
constexpr uint8_t PIN_BUZZER       = 18; // Critical alarm buzzer

} // namespace EquipmentHardware
