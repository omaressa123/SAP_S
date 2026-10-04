# Aircraft Parking / Ground IoT (`AIRCRAFT-PARK-001`)

## Purpose

Monitor an aircraft approaching and occupying an airport parking/ground stand:
proximity detection, distance to parking position, stand status, ground safety
status, arrival / parked / departure lifecycle, and unsafe-distance warnings.

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Potentiometer × 2 | `wokwi-potentiometer` | Front + lateral distance simulators (0..400 cm). Stand-ins for HC-SR04 ultrasonic sensors: the firmware consumes a distance in cm, so a real sensor driver can replace the ADC mapping without touching the state machine. |
| Green / Yellow / Red LEDs | `wokwi-led` | PARKED / approach-alignment / unsafe-warning |
| Buzzer | `wokwi-buzzer` | Unsafe-distance warning tone |
| Servo | `wokwi-servo` | Stand position indicator (0° empty, 45° approach, 90° parked) |
| Push buttons × 3 | `wokwi-pushbutton` | Aircraft arrival / departure / reset |

## Inputs / Outputs

* **Inputs:** front distance (ADC 34), side distance (ADC 35), arrival (19), departure (21), reset (23), MQTT commands.
* **Outputs:** LEDs (2/4/5), buzzer (18), servo (22), MQTT status / telemetry / event.

## Configuration (no magic numbers)

All thresholds live in `common/constants.h` (`AirportIoT::Parking`):
detection 300 cm, approach 150 cm, alignment 80 cm, parked 40 cm,
unsafe 15 cm, settle 800 ms, unsafe-alarm dwell 2000 ms.

## State Machine

```
STAND_EMPTY → AIRCRAFT_DETECTED → APPROACHING → ALIGNMENT_REQUIRED
→ PARKED → DEPARTING → STAND_EMPTY
Unsafe branch: UNSAFE_DISTANCE (2 s dwell) → WARNING (latched blink) → recover to ALIGNMENT_REQUIRED
```

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/aircraft-parking/AIRCRAFT-PARK-001/status` |
| Telemetry (~2 s) | `airport/aircraft-parking/AIRCRAFT-PARK-001/telemetry` |
| Events | `airport/aircraft-parking/AIRCRAFT-PARK-001/event` |
| Commands | `airport/aircraft-parking/AIRCRAFT-PARK-001/command` |
| Heartbeat | `airport/device/AIRCRAFT-PARK-001/heartbeat` |

Commands: `START_SIMULATION`, `AIRCRAFT_ARRIVAL`, `AIRCRAFT_DEPARTURE`, `RESET`, `GET_STATUS`.
Events: `aircraft_detected`, `aircraft_approaching`, `alignment_required`,
`aircraft_parked`, `unsafe_distance`, `warning`, `aircraft_departing`, `stand_empty`.

## Test Scenarios (Wokwi)

1. Turn the FRONT pot from max down slowly: EMPTY → DETECTED → APPROACHING (yellow) → ALIGNMENT → PARKED (green, servo 90°).
2. Keep turning to minimum: red LED + buzzer (UNSAFE → WARNING).
3. Turn back up slightly: recovers to ALIGNMENT.
4. Press Departure button: DEPARTING → STAND_EMPTY.
5. Send `START_SIMULATION` via MQTT: scripted sweep through all approach states.
6. Send `GET_STATUS`: status + telemetry republish (MANUAL VERIFICATION REQUIRED: observe via `mosquitto_sub`).
