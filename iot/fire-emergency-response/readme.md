# Smart Airport - Fire & Emergency Response

IoT module for a Smart Airport system using ESP32 and Wokwi simulation.

## Features

- Smoke and gas detection
- Temperature monitoring
- Fire detection
- Emergency button
- Emergency buzzer
- Safe exit selection
- Emergency evacuation indication
- Drone dispatch simulation
- MQTT communication
- Real-time system status

## Hardware

- ESP32
- MQ-2 Gas Sensor
- DHT22 Temperature Sensor
- Emergency Push Button
- Buzzer
- 3 LEDs for Emergency Exits

## Pin Configuration

| Component | ESP32 Pin |
|---|---:|
| DHT22 | GPIO 4 |
| MQ-2 | GPIO 34 |
| Emergency Button | GPIO 13 |
| Buzzer | GPIO 25 |
| Exit 1 LED | GPIO 16 |
| Exit 2 LED | GPIO 17 |
| Exit 3 LED | GPIO 18 |

## System Flow

Smoke / High Temperature
→ Fire Detection
→ Emergency Alert
→ Drone Dispatched
→ Drone Arrived
→ Fire Confirmed
→ Safe Exit Selected
→ Evacuation

## MQTT

The module communicates with the Smart Airport backend using MQTT.

### Status

`airport/fire-smoke/FIRE-01/status`

### Events

`airport/fire-smoke/FIRE-01/event`

### Heartbeat

`airport/device/FIRE-01/heartbeat`

## Simulation

The system is designed to run on ESP32 using Wokwi simulation and can later be transferred to real hardware.

## Technologies

- C++
- ESP32
- PlatformIO
- Wokwi
- MQTT
- ArduinoJson
- DHT22
- MQ-2