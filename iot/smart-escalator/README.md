# Smart Escalator (ESC-01)

Part of **Smart Airport IoT – Smart Transportation**. An ESP32-based smart escalator simulated on Wokwi that saves energy, protects the motor, and stops automatically when a fire is confirmed.

## Features
- **Energy saving:** `stopped` → `standby` (30% speed) → `running` (100%) when a passenger is detected
- Passenger detection with a PIR sensor
- Motor overload / jam protection (current ≥ 85%)
- Emergency stop button
- Direction switch (up / down)
- LCD display (direction, mode, speed, passengers, motor current)
- **Fire stop:** listens to the fire module (FIRE-01) and stops on a confirmed fire; resumes when the fire module returns to `NORMAL`
- Status, events and heartbeat published over MQTT

## Modes
| Mode | Speed | When |
|---|---|---|
| `running` | 100% | Passenger detected (stays 8 s after the last one) |
| `standby` | 30% | No passengers recently (energy saving) |
| `stopped` | 0% | No activity for 30 s (wakes up on a passenger) |
| `fault` | 0% | Motor overload detected |
| `emergency_stop` | 0% | Emergency button pressed |
| `fire_stop` | 0% | Fire confirmed by the fire module |

## MQTT Topics
Broker: `broker.hivemq.com:1883` (configured in `common/Device_config.h`)

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/escalator/ESC-01/status` |
| Events | `airport/escalator/ESC-01/event` |
| Commands (subscribe) | `airport/escalator/ESC-01/command` |
| Heartbeat | `airport/device/ESC-01/heartbeat` |
| Fire module (subscribe) | `airport/fire-smoke/+/status` and `airport/fire-smoke/+/event` |

## Commands
Publish JSON to the command topic:

| Payload | Action |
|---|---|
| `{"cmd":"passenger"}` | Simulate a passenger |
| `{"cmd":"emergency"}` | Emergency stop |
| `{"cmd":"reset"}` | Reset emergency stop and motor fault |
| `{"cmd":"fire_stop"}` | Manual fire stop (testing) |
| `{"cmd":"fire_clear"}` | Clear fire stop |
| `{"cmd":"mute"}` | Mute the buzzer |

## Status example
`{"device_id":"ESC-01","zone":"TERMINAL-1","status":"online","mode":"standby","direction":"up","speed_percent":30,"passengers":0,"motor_current_percent":35,"fire_stop":false}`

## Wiring (ESP32)
| Part | Pin |
|---|---|
| PIR passenger sensor | 27 |
| Direction switch (LOW = up) | 26 |
| Emergency stop button | 25 |
| Motor current (potentiometer) | 34 |
| LEDs run / slow / stop | 16 / 17 / 18 |
| Buzzer | 23 |
| LCD I2C (SDA / SCL) | 21 / 22 |

## Serial keys (for testing)
`p` passenger, `e` emergency, `f` fire stop, `c` clear fire, `r` reset fault, `m` mute

## Project structure
- `src/main.cpp` – firmware
- `common/` – shared constants, device config and MQTT topics
- `diagram.json` – Wokwi circuit
- `platformio.ini`, `wokwi.toml` – build and simulator configuration

## How to run
1. Open the `smart-escalator` folder in VS Code (PlatformIO + Wokwi extensions installed)
2. Build the project (PlatformIO check icon) and wait for `SUCCESS`
3. Press `F1` and run **Wokwi: Start Simulator**
4. Open an MQTT client (e.g. HiveMQ Web Client), subscribe to `airport/escalator/ESC-01/#`

## Fire integration test
1. Run `fire-emergency-response` (FIRE-01) and this escalator together
2. Press the FIRE button in the fire simulation
3. After the drone confirms the fire, the escalator switches to `fire_stop`
4. When FIRE-01 returns to `NORMAL`, the escalator resumes service

## Note
The module name `escalator` is defined locally in `main.cpp`. If the team agrees, add `MODULE_ESCALATOR = "escalator"` to the shared `Mqtt_topics.h`.