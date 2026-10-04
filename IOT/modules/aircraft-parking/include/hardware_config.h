#pragma once

#include <Arduino.h>

namespace ParkingHardware {

// Proximity / distance simulation inputs.
// Real deployment: HC-SR04 ultrasonic sensors (front + lateral).
// Wokwi simulation: potentiometers act as distance simulators whose
// wiper voltage is mapped to centimeters (0..400 cm).
constexpr uint8_t PIN_DIST_FRONT_ADC = 34; // Potentiometer 1: front distance simulator (analog)
constexpr uint8_t PIN_DIST_SIDE_ADC  = 35; // Potentiometer 2: lateral distance simulator (analog)

// Interactive simulation buttons (Active LOW with INPUT_PULLUP)
constexpr uint8_t PIN_ARRIVAL_BTN  = 19; // Simulate aircraft arrival
constexpr uint8_t PIN_DEPART_BTN  = 21; // Simulate aircraft departure
constexpr uint8_t PIN_RESET_BTN   = 23; // Manual reset to STAND_EMPTY

// Feedback outputs
constexpr uint8_t PIN_LED_GREEN  = 2;  // PARKED indicator
constexpr uint8_t PIN_LED_YELLOW = 4;  // APPROACHING / ALIGNMENT indicator
constexpr uint8_t PIN_LED_RED    = 5;  // UNSAFE / WARNING indicator
constexpr uint8_t PIN_BUZZER     = 18; // Warning buzzer
constexpr uint8_t PIN_SERVO      = 22; // Stand position indicator (stop-bar / marshaller arm)

} // namespace ParkingHardware
