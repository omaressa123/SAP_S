#pragma once

#include <Arduino.h>

namespace SecurityHardware {

// Presence / access simulation inputs.
// NOTE: Physical RFID readers are unreliable in Wokwi, so access cards are
// modeled through a clean simulated access-card abstraction:
//   - BTN_VALID_CARD / BTN_INVALID_CARD present a card UID to the controller
//     exactly as an RFID reader driver would (see simulateCardPresent()).
//   - The backend/AI team authorizes via MQTT AUTHORIZE command.
// Swapping in a real MFRC522 reader only requires replacing the two button
// inputs with reader callbacks; the state machine is unchanged.
constexpr uint8_t PIN_PERSON_SENSOR = 19; // IR/proximity presence sensor (Active LOW)
constexpr uint8_t PIN_VALID_CARD    = 21; // Simulate valid access card (Active LOW)
constexpr uint8_t PIN_INVALID_CARD = 22; // Simulate unknown/denied card (Active LOW)
constexpr uint8_t PIN_ESTOP_BTN     = 25; // Emergency button (Active LOW, highest priority)
constexpr uint8_t PIN_RESET_BTN     = 23; // Manual reset (Active LOW)

// Outputs
constexpr uint8_t PIN_SERVO      = 18; // Security gate actuator (0 = closed/locked, 90 = open)
constexpr uint8_t PIN_LED_GREEN  = 2;  // Access granted / gate open
constexpr uint8_t PIN_LED_RED    = 4;  // Access denied / alarm / locked
constexpr uint8_t PIN_BUZZER     = 5;  // Denied beep / alarm siren

} // namespace SecurityHardware
