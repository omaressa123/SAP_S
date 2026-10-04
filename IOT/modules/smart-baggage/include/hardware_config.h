#pragma once

#include <Arduino.h>

namespace BaggageHardware {

// Tag/sort simulation inputs (Active LOW with INPUT_PULLUP).
// NOTE: Physical RFID readers are unreliable in Wokwi, so baggage tags are
// modeled through a clean simulated tag abstraction (see
// simulateTagPresent()): tag button presents a tag UID exactly as an RFID
// driver callback would. Backend sorts via MQTT SORT/DIVERT commands.
constexpr uint8_t PIN_TAG_SENSOR  = 19; // Tag detected at induction (Active LOW)
constexpr uint8_t PIN_SORT_OK_BTN = 21; // Simulate valid sort decision (Active LOW)
constexpr uint8_t PIN_DIVERT_BTN  = 22; // Simulate divert / lost-tag (Active LOW)
constexpr uint8_t PIN_RESET_BTN   = 23; // Manual reset (Active LOW)

// Outputs
constexpr uint8_t PIN_DIVERTER_SERVO = 18; // Diverter gate (0 = main line, 90 = divert)
constexpr uint8_t PIN_LED_GREEN      = 2;  // Sorted / line running
constexpr uint8_t PIN_LED_RED        = 4;  // Diverted / alarm / locked
constexpr uint8_t PIN_BUZZER         = 5;  // Divert beep / alarm

} // namespace BaggageHardware
