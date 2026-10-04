# Emergency Detection IoT (`EMERG-001`)

## Purpose

Airport emergency trigger / evacuation / lockdown siren infrastructure:
panic button, silence, lockdown, strobe beacon, and latched alarm.
Rule-based only — no AI claims.

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Green / Red LEDs | `wokwi-led` | Normal / alarm |
| Beacon LED | `wokwi-led` (red) | Strobe beacon (GPIO 18) |
| Buzzer | `wokwi-buzzer` | Siren |
| Push buttons × 4 | `wokwi-pushbutton` | Trigger, silence, lockdown, reset |

## Inputs / Outputs

* **Inputs:** trigger (19), silence (21), lockdown (22), reset (23), MQTT commands.
* **Outputs:** LEDs (2/4), beacon (18), buzzer (5), MQTT status / event.

## State Machine

```
NORMAL → TRIGGER → ALERT (siren + beacon, auto-escalates to EVACUATION after 30 s)
  ├─ EVACUATE command → EVACUATION (latched)
  ├─ LOCKDOWN command → LOCKDOWN (latched)
  ├─ SILENCE → SILENCED (siren muted, beacon stays ON)
  └─ RESET → NORMAL
```

Alarm is latched until RESET. Silence only mutes the siren.

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/emergency/EMERG-001/status` |
| Events | `airport/emergency/EMERG-001/event` |
| Commands | `airport/emergency/EMERG-001/command` |
| Heartbeat | `airport/device/EMERG-001/heartbeat` |

Commands: `TRIGGER`, `EVACUATE`, `LOCKDOWN`, `SILENCE`, `RESET`, `GET_STATUS`.
Events: `emergency_triggered`, `evacuation_ordered`, `lockdown_ordered`,
`alarm_silenced`, `auto_evacuation`, `system_reset`.

## Test Scenarios (Wokwi)

1. Press TRIGGER → `ALERT` (siren + beacon blink) → auto `EVACUATION` after 30 s.
2. Press Silence during alarm → `SILENCED` (beacon ON, siren OFF).
3. Press Lockdown → `LOCKDOWN` latched; only Reset recovers.
4. Publish `EVACUATE` / `LOCKDOWN` → backend-driven flow.
