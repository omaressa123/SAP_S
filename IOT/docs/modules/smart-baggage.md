# Smart Baggage IoT (`BAGGAGE-001`)

## Purpose

Baggage induction + diverter sort line: tag detection, backend sort decision,
diverter servo actuation, and divert/alarm handling. Rule-based only.

> Physical RFID readers are unreliable in Wokwi, so baggage tags use a clean
> simulated abstraction: the tag button calls `simulateTagPresent(uid)` exactly
> as an RFID driver callback would. Backend sorts via MQTT `SORT` / `DIVERT`.

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Servo | `wokwi-servo` | Diverter (0° main line, 90° divert) |
| Green / Red LEDs | `wokwi-led` | Sorted / diverted-alarm-locked |
| Buzzer | `wokwi-buzzer` | Divert beep |
| Push buttons × 4 | `wokwi-pushbutton` | Tag detected, sort OK, divert, reset |

## Inputs / Outputs

* **Inputs:** tag sensor (19), sort OK (21), divert (22), reset (23), MQTT commands.
* **Outputs:** diverter servo (18), LEDs (2/4), buzzer (5), MQTT status / event / telemetry(tag).

## State Machine

```
IDLE → TAG_DETECTED → WAITING_FOR_SORT (8 s timeout, sort_requested to backend)
  ├─ SORT  → SORTING → SORTED (2 s) → IDLE
  └─ DIVERT / timeout → DIVERTED (3 s divert beep + servo 90°) → IDLE
Lock: LOCK → LOCKED (tags rejected) → UNLOCK/RESET → IDLE
```

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/baggage/BAGGAGE-001/status` |
| Events | `airport/baggage/BAGGAGE-001/event` |
| Tag decisions | `airport/baggage/BAGGAGE-001/telemetry` |
| Commands | `airport/baggage/BAGGAGE-001/command` |
| Heartbeat | `airport/device/BAGGAGE-001/heartbeat` |

Commands: `TAG_DETECT`, `SORT`, `DIVERT`, `LOCK`, `UNLOCK`, `RESET`, `GET_STATUS`.
Events: `tag_detected`, `sort_requested`, `baggage_sorted`, `baggage_diverted`,
`sort_timeout`, `line_locked`, `line_unlocked`, `system_reset`.

## Test Scenarios (Wokwi)

1. Press Tag → `TAG_DETECTED` → `WAITING_FOR_SORT` (+ `sort_requested` on MQTT).
2. Press Sort OK → `SORTING` → `SORTED` (servo 0°, green LED) → `IDLE`.
3. Press Tag then Divert → `DIVERTED` (servo 90°, red + beep) → `IDLE`.
4. Publish `SORT` / `DIVERT` while waiting → backend-driven flow.
5. Publish `LOCK` → `LOCKED` (tags rejected); `UNLOCK` → `IDLE`.
