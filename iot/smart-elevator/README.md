# Smart Elevator (ELEV-01)

Part of **Smart Airport IoT – Smart Transportation**. An ESP32-based smart elevator simulated on Wokwi that reports to an MQTT broker and reacts to fire alerts.

## Features
- 3 floors (Ground, 1, 2) with call buttons and floor indicator LEDs
- Door control (servo) with obstruction detection
- Load monitoring with overload protection (limit: 800 kg)
- Emergency stop button
- LCD display (floor, state, load)
- **Fire recall:** listens to the fire module (FIRE-01). On a confirmed fire the elevator goes to the ground floor, opens the door and locks until the fire is cleared
- Status, events and heartbeat published over MQTT

## MQTT Topics
Broker: `broker.hivemq.com:1883` (configured in `common/Device_config.h`)

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/elevator/ELEV-01/status` |
| Events | `airport/elevator/ELEV-01/event` |
| Commands (subscribe) | `airport/elevator/ELEV-01/command` |
| Heartbeat | `airport/device/ELEV-01/heartbeat` |
| Fire module (subscribe) | `airport/fire-smoke/+/status` and `airport/fire-smoke/+/event` |

## Commands
Publish JSON to the command topic:

| Payload | Action |
|---|---|
| `{"cmd":"call","floor":2}` | Call the elevator to floor 0, 1 or 2 |
| `{"cmd":"emergency"}` | Emergency stop |
| `{"cmd":"reset"}` | Reset emergency stop |
| `{"cmd":"fire_recall"}` | Manual fire recall (testing) |
| `{"cmd":"fire_clear"}` | Clear fire mode |
| `{"cmd":"mute"}` | Mute the buzzer |

## Status example
`{"device_id":"ELEV-01","zone":"TERMINAL-1","status":"online","state":"idle","floor":0,"target":0,"door":"closed","load_kg":500,"overload":false,"fire_mode":false,"trips":0}`

## Elevator states
`idle`, `moving`, `door_open`, `emergency`, `fire_locked`

## Wiring (ESP32)
| Part | Pin |
|---|---|
| Call buttons Ground / 1 / 2 | 25 / 26 / 27 |
| Floor LEDs | 16 / 17 / 18 |
| Door servo | 19 |
| Load sensor (potentiometer) | 34 |
| Emergency stop button | 32 |
| Door obstruction button | 33 |
| Buzzer | 23 |
| Fault LED | 4 |
| LCD I2C (SDA / SCL) | 21 / 22 |

## Serial keys (for testing)
`0` `1` `2` call floor, `e` emergency, `f` fire recall, `c` clear fire, `m` mute

## Project structure
- `src/main.cpp` – firmware
- `common/` – shared constants, device config and MQTT topics
- `diagram.json` – Wokwi circuit
- `platformio.ini`, `wokwi.toml` – build and simulator configuration

## How to run
1. Open the `smart-elevator` folder in VS Code (PlatformIO + Wokwi extensions installed)
2. Build the project (PlatformIO check icon) and wait for `SUCCESS`
3. Press `F1` and run **Wokwi: Start Simulator**
4. Open an MQTT client (e.g. HiveMQ Web Client), subscribe to `airport/elevator/ELEV-01/#`

## Fire integration test
1. Run `fire-emergency-response` (FIRE-01) and this elevator together
2. Press the FIRE button in the fire simulation
3. After the drone confirms the fire, the elevator goes to the ground floor, opens the door and locks
4. When FIRE-01 returns to `NORMAL`, the elevator resumes service