# Fire / Smoke Monitoring IoT (`FIRE-001`)

## Purpose

Threshold-based smoke + heat monitoring for airport zones. Reports
`NORMAL / WARNING / CRITICAL`, latches test alarms, supports silence + reset.
Rule-based only.

> This module does NOT actuate suppression systems. It only senses, alarms
> locally (LEDs + siren), and publishes MQTT status/telemetry/events for the
> backend/AI team.

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Potentiometer × 2 | `wokwi-potentiometer` | Smoke 0..1000 ppm (34), temp 20..90 °C (35) |
| Green / Yellow / Red LEDs | `wokwi-led` | Clear / warning / critical |
| Buzzer | `wokwi-buzzer` | Siren |
| Push buttons × 3 | `wokwi-pushbutton` | Test alarm, silence, reset |

## Inputs / Outputs

* **Inputs:** smoke ADC (34), temp ADC (35), test (19), silence (21), reset (23), MQTT commands.
* **Outputs:** LEDs (2/4/5), buzzer (18), MQTT status / telemetry / event.

## State Machine

```
NORMAL ⇄ WARNING (smoke ≥ 300 ppm or temp ≥ 50 °C)
  → CRITICAL (smoke ≥ 600 ppm or temp ≥ 70 °C, siren ON)
TEST_ALARM → ALARM_LATCHED (latched, blinking siren) → SILENCE → SILENCED → RESET → NORMAL
```

Threshold crossings auto-recover; test alarms latch until reset.

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/fire-smoke/FIRE-001/status` |
| Telemetry (~3 s) | `airport/fire-smoke/FIRE-001/telemetry` |
| Events | `airport/fire-smoke/FIRE-001/event` |
| Commands | `airport/fire-smoke/FIRE-001/command` |
| Heartbeat | `airport/device/FIRE-001/heartbeat` |

Commands: `TEST_ALARM`, `SILENCE`, `RESET`, `GET_STATUS`.
Events: `warning_condition`, `critical_condition`, `condition_normal`,
`test_alarm`, `alarm_silenced`, `system_reset`.

## Test Scenarios (Wokwi)

1. Turn smoke pot up → `WARNING` (yellow) → further → `CRITICAL` (red + siren).
2. Turn pot back down → auto `NORMAL` (+ `condition_normal` on MQTT).
3. Press Test → `ALARM_LATCHED`; Silence → `SILENCED`; Reset → `NORMAL`.
