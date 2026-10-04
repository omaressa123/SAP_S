#pragma once

#include <Arduino.h>

namespace ChargerHardware {

// LOW-VOLTAGE SIMULATION ONLY. Potentiometers simulate sensor readings;
// no real high-voltage hardware is involved.
//   Pot 1 -> DC bus voltage simulator (mapped to ~360..440 V in firmware)
//   Pot 2 -> charge current demand simulator (mapped to 0..125 A)
//   Pot 3 -> connector temperature simulator (mapped to 20..80 C)
constexpr uint8_t PIN_VOLTAGE_ADC = 34;
constexpr uint8_t PIN_CURRENT_ADC = 35;
constexpr uint8_t PIN_TEMP_ADC    = 32;

// Interactive buttons (Active LOW with INPUT_PULLUP)
constexpr uint8_t PIN_CONNECT_BTN   = 19; // Connect vehicle
constexpr uint8_t PIN_START_BTN     = 21; // Start charging
constexpr uint8_t PIN_ESTOP_BTN     = 25; // Emergency stop (latching alarm)
constexpr uint8_t PIN_RESET_BTN     = 23; // Reset / clear alarm

// Outputs
constexpr uint8_t PIN_LED_AVAILABLE = 2;  // Green: station available / complete
constexpr uint8_t PIN_LED_CHARGING  = 4;  // Yellow: charging in progress
constexpr uint8_t PIN_LED_ALARM     = 5;  // Red: fault / alarm
constexpr uint8_t PIN_RELAY         = 18; // Contactor simulator (charging enabled)
constexpr uint8_t PIN_BUZZER        = 13; // Alarm buzzer

} // namespace ChargerHardware
