#pragma once

#include <Arduino.h>

namespace ElevatorHardware {

// Call / safety simulation inputs (Active LOW with INPUT_PULLUP)
constexpr uint8_t PIN_CALL_UP_BTN  = 19; // Call / send cabin up
constexpr uint8_t PIN_CALL_DOWN_BTN = 21; // Call / send cabin down
constexpr uint8_t PIN_OVERLOAD_BTN = 22; // Simulate overload sensor
constexpr uint8_t PIN_ESTOP_BTN    = 25; // Emergency stop (latching, highest priority)
constexpr uint8_t PIN_RESET_BTN    = 23; // Manual reset

// Outputs
constexpr uint8_t PIN_DOOR_SERVO = 18; // Cabin door (0 = closed, 90 = open)
constexpr uint8_t PIN_LED_GREEN  = 2;  // Door open / ready
constexpr uint8_t PIN_LED_RED    = 4;  // Moving / overload / emergency
constexpr uint8_t PIN_BUZZER     = 5;  // Overload / emergency alarm

} // namespace ElevatorHardware
