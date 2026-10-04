# Security Area IoT (`SECURITY-001`)

## Purpose

IoT infrastructure around an airport security checkpoint: presence detection,
access control, gate status, emergency button, and alarm.

> This module is NOT the AI threat-detection system. AI-based threat
> recognition belongs to the AI/software team. This device only reports
> presence/access events and actuates the gate on local or remote decisions.

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Servo | `wokwi-servo` | Security gate (0° closed/locked, 90° open) |
| Green / Red LEDs | `wokwi-led` | Granted-open / denied-alarm-locked |
| Buzzer | `wokwi-buzzer` | Denied beep / alarm siren |
| Push buttons × 5 | `wokwi-pushbutton` | Person detected, valid card, invalid card, EMERGENCY, reset |

## RFID Abstraction

Physical RFID readers are unreliable in Wokwi, so access cards use a clean
simulated abstraction: the valid/invalid buttons call
`simulateCardPresent(uid, authorized)` exactly as an RFID driver callback
would. Replacing the buttons with a real MFRC522 reader only changes the
input layer — the state machine and MQTT contracts are unchanged. The
backend/AI team renders the authorization verdict via the `AUTHORIZE` command.

## Inputs / Outputs

* **Inputs:** person sensor (19), valid card (21), invalid card (22), emergency (25), reset (23), MQTT commands.
* **Outputs:** servo (18), LEDs (2/4), buzzer (5), MQTT status / event / access.

## State Machine

```
IDLE → PERSON_DETECTED → WAITING_FOR_AUTH (10 s timeout, authorization_requested to backend)
  ├─ card valid / AUTHORIZE(true)  → AUTHORIZED → GATE_OPENING → ACCESS_GRANTED (4 s) → GATE_CLOSING → IDLE
  └─ card invalid / AUTHORIZE(false) → ACCESS_DENIED → ALARM (5 s) → IDLE
Emergency: ANY STATE → EMERGENCY (gate forced locked/closed, latched alarm) → RESET → IDLE
Lock: LOCK → LOCKED (detection + cards rejected) → UNLOCK/RESET → IDLE
```

Emergency has absolute priority over all normal operations.

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/security/SECURITY-001/status` |
| Events | `airport/security/SECURITY-001/event` |
| Access decisions | `airport/security/SECURITY-001/access` |
| Commands | `airport/security/SECURITY-001/command` |
| Heartbeat | `airport/device/SECURITY-001/heartbeat` |

Commands: `OPEN`, `CLOSE`, `LOCK`, `UNLOCK`, `RESET`, `EMERGENCY_STOP`,
`GET_STATUS`, plus `AUTHORIZE` (`{"command":"AUTHORIZE","card_uid":"...","authorized":true}`).
Events: `person_detected`, `authorization_requested`, `access_granted`,
`access_denied`, `gate_opened`, `gate_closed`, `alarm_triggered`, `emergency_triggered`.

## Test Scenarios (Wokwi)

1. Press Person → `PERSON_DETECTED` → `WAITING_FOR_AUTH` (+ `authorization_requested` on MQTT).
2. Press Valid Card → `AUTHORIZED` → gate opens (servo 90°, green LED) → auto closes → `IDLE`.
3. Press Person then Invalid Card → `ACCESS_DENIED` → `ALARM` (red blink + siren 5 s) → `IDLE`.
4. Publish `AUTHORIZE` with `authorized:true` while waiting → gate opens (backend-driven flow).
5. Press EMERGENCY any time → `EMERGENCY`, gate slammed shut, alarm latched; only Reset recovers.
6. Publish `LOCK` → `LOCKED` (person/cards rejected); `UNLOCK` → `IDLE`.
