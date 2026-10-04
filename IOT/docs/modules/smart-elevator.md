# Smart Elevator IoT (`ELEV-001`)

## Purpose

Cabin call / door / overload / emergency-stop infrastructure for an airport
elevator shaft simulator: call dispatch, door servo, overload hold, latched
E-STOP. Simulation only — NOT a real lift controller.

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Servo | `wokwi-servo` | Cabin door (0° closed, 90° open) |
| Green / Red LEDs | `wokwi-led` | Door open / moving-alarm |
| Buzzer | `wokwi-buzzer` | Overload / emergency alarm |
| Push buttons × 5 | `wokwi-pushbutton` | Call up, call down, overload toggle, E-STOP, reset |

## Inputs / Outputs

* **Inputs:** call up (19), call down (21), overload (22), E-STOP (25), reset (23), MQTT commands.
* **Outputs:** door servo (18), LEDs (2/4), buzzer (5), MQTT status / event.

## State Machine

```
IDLE → CALL_UP → MOVING_UP (3 s) → DOOR_OPEN (4 s auto-close) → IDLE
IDLE → CALL_DOWN → MOVING_DOWN (3 s) → DOOR_OPEN → IDLE
OVERLOAD toggle → OVERLOAD (door held open + alarm) → toggle → DOOR_OPEN
ANY STATE → EMERGENCY (E-STOP latched, door forced closed) → RESET → IDLE
```

Floor counter increments on up travel, decrements on down travel (floor 0 min).

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/elevator/ELEV-001/status` |
| Events | `airport/elevator/ELEV-001/event` |
| Commands | `airport/elevator/ELEV-001/command` |
| Heartbeat | `airport/device/ELEV-001/heartbeat` |

Commands: `CALL_UP`, `CALL_DOWN`, `OPEN_DOOR`, `CLOSE_DOOR`, `OVERLOAD_ON`,
`OVERLOAD_OFF`, `EMERGENCY_STOP`, `RESET`, `GET_STATUS`.
Events: `call_up`, `call_down`, `floor_reached`, `door_opened`, `door_closed`,
`overload_detected`, `overload_cleared`, `emergency_triggered`, `system_reset`.

## Test Scenarios (Wokwi)

1. Press Call Up → `MOVING_UP` (red) → `DOOR_OPEN` (servo 90°, green 4 s) → `IDLE`.
2. Press Overload → `OVERLOAD` (door held open + alarm); press again → `DOOR_OPEN`.
3. Press E-STOP any time → `EMERGENCY` latched; only Reset recovers.
4. Publish `CALL_UP` / `OPEN_DOOR` → backend-driven flow.
