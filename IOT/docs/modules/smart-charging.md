# Smart Charging Station (`CHARGER-001`)

## Purpose

Simulate an airport electric ground-support-vehicle charging station:
vehicle connection, charging progress, voltage / current / power / temperature,
charge completion, over-temperature protection, and emergency stop.

> **LOW-VOLTAGE SIMULATION ONLY.** Potentiometers simulate sensor channels.
> No real high-voltage hardware is involved.

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Potentiometer × 3 | `wokwi-potentiometer` | Voltage (360..440 V sim), current demand (0..125 A sim), temperature (20..80 °C sim) |
| Green / Yellow / Red LEDs | `wokwi-led` | Available-complete / charging / fault |
| Relay module | `wokwi-relay-module` | Contactor simulator (closed only while CHARGING) |
| Buzzer | `wokwi-buzzer` | Alarm sounder |
| Push buttons × 4 | `wokwi-pushbutton` | Connect/disconnect, start/stop, EMERGENCY STOP, reset |

## Inputs / Outputs

* **Inputs:** voltage (ADC 34), current demand (ADC 35), temperature (ADC 32), buttons (19/21/25/23), MQTT commands.
* **Outputs:** LEDs (2/4/5), relay (18), buzzer (13), MQTT status / telemetry / event.

## Data

* `power = voltage × current`, computed in firmware on every telemetry publish.
* Charge integration is time-based (`CHARGE_RATE_PCT_S` in `common/constants.h`),
  clamped at 100% — it never increases infinitely.
* Temperature hysteresis (`TEMP_HYSTERESIS_C`) prevents warning flapping.

## State Machine

```
AVAILABLE → VEHICLE_CONNECTED → READY → CHARGING → CHARGING_COMPLETE → DISCONNECTED → AVAILABLE
Over-temperature branch: CHARGING → TEMPERATURE_HIGH (paused) → recover, or → CHARGING_STOPPED (latched)
Emergency: ANY STATE → ALARM (relay forced open, latched until RESET)
```

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/charging/CHARGER-001/status` |
| Telemetry (~2 s) | `airport/charging/CHARGER-001/telemetry` |
| Events | `airport/charging/CHARGER-001/event` |
| Commands | `airport/charging/CHARGER-001/command` |
| Heartbeat | `airport/device/CHARGER-001/heartbeat` |

Commands: `CONNECT_VEHICLE`, `DISCONNECT_VEHICLE`, `START_CHARGING`,
`STOP_CHARGING`, `EMERGENCY_STOP`, `RESET`, `GET_STATUS`.
Events: `vehicle_connected`, `charging_started`, `charging_progress`,
`charging_completed`, `temperature_warning`, `charging_stopped`, `emergency_stop`.

## Test Scenarios (Wokwi)

1. Press Connect → `VEHICLE_CONNECTED` → auto `READY` (green LED).
2. Press Start → `CHARGING` (yellow LED, relay clicks, current flows, % climbs).
3. Turn temperature pot high → `TEMPERATURE_HIGH` (charging paused); turn back → resumes.
4. Turn temperature pot to max → `CHARGING_STOPPED` + `temperature_warning`.
5. Press EMERGENCY STOP any time → `ALARM`, relay opens immediately, buzzer on; only Reset clears.
6. Let % reach 100 → `CHARGING_COMPLETE`; press Connect again → `DISCONNECTED` → `AVAILABLE`.
