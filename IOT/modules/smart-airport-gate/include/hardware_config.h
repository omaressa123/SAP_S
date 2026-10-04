#pragma once

#include <Arduino.h>

namespace GateHardware {

// Pin Definitions for Smart Airport Gate
constexpr uint8_t PIN_SERVO             = 18; // Servo motor (Gate Barrier)
constexpr uint8_t PIN_LED_GREEN         = 2;  // Green LED (Authorized / Gate Open)
constexpr uint8_t PIN_LED_RED           = 4;  // Red LED (Denied / Gate Closed / Alarm)
constexpr uint8_t PIN_BUZZER            = 5;  // Buzzer (Feedback / Alarm)

// Interactive Buttons / Sensors for Wokwi Simulation & Hardware
constexpr uint8_t PIN_PASSENGER_SENSOR  = 19; // IR Proximity / PIR / Presence Sensor (Active LOW with pullup)
constexpr uint8_t PIN_RFID_VALID_BTN    = 21; // Simulate Valid Passenger Boarding Pass / RFID (Active LOW)
constexpr uint8_t PIN_RFID_INVALID_BTN  = 22; // Simulate Invalid / Blacklisted Boarding Pass (Active LOW)
constexpr uint8_t PIN_MANUAL_RESET_BTN  = 23; // Manual Gate Reset / Test button (Active LOW)

} // namespace GateHardware
