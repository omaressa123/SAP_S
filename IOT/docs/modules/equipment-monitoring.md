# Airport Equipment Monitoring (`EQUIPMENT-001`)

## Purpose

Threshold-based condition monitoring for airport equipment. The representative
machine in this simulation is a **CONVEYOR MOTOR**; the controller is generic
(temperature / vibration / current / runtime) so additional equipment types can
reuse the same architecture later.

> This is IoT telemetry + threshold logic ONLY. No predictive maintenance or
> machine-learning claims are made. `health_score` is a documented rule-based
> indicator (100 minus temperature/vibration/current penalties, clamped 0..100).

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Potentiometer × 3 | `wokwi-potentiometer` | Temperature (20..110 °C), vibration (0..10 mm/s), current (0..20 A) |
| Green / Yellow / Red LEDs | `wokwi-led` | Running / warning / critical |
| Buzzer | `wokwi-buzzer` | Critical alarm |
| Push buttons × 3 | `wokwi-pushbutton` | Run start/stop, maintenance, reset |

## Inputs / Outputs

* **Inputs:** temperature (ADC 34), vibration (ADC 35), current (ADC 32), buttons (19/21/23), MQTT commands.
* **Outputs:** LEDs (2/4/5), buzzer (18), MQTT status / telemetry / event.

## Thresholds (`common/constants.h`, `AirportIoT::Equipment`)

| Channel | Warning | Critical |
|---|---|---|
| Temperature | ≥ 70 °C | ≥ 85 °C |
| Vibration | ≥ 4.5 mm/s | ≥ 7.1 mm/s |
| Current | ≥ 12 A | ≥ 15 A |

Critical also triggers on high-temperature **plus** high-vibration combined.
Warning events are edge-triggered (one per excursion). Runtime accumulates in
seconds only while operating (RUNNING/WARNING).

## State Machine

```
OFFLINE / IDLE → START → RUNNING ⇄ WARNING → CRITICAL → MAINTENANCE_REQUIRED → (2nd MAINTENANCE) → IDLE
STOP returns RUNNING/WARNING to IDLE. RESET clears faults + runtime.
```

Condition mapping: `HEALTHY` (idle/running), `WARNING`, `CRITICAL` (critical/maintenance), `OFFLINE`.

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/equipment/EQUIPMENT-001/status` |
| Telemetry (~3 s) | `airport/equipment/EQUIPMENT-001/telemetry` |
| Events | `airport/equipment/EQUIPMENT-001/event` |
| Commands | `airport/equipment/EQUIPMENT-001/command` |
| Heartbeat | `airport/device/EQUIPMENT-001/heartbeat` |

Commands: `START`, `STOP`, `RESET`, `MAINTENANCE`, `GET_STATUS`.
Events: `equipment_started`, `equipment_stopped`, `temperature_warning`,
`vibration_warning`, `overcurrent`, `critical_condition`, `maintenance_required`.

## Test Scenarios (Wokwi)

1. Press Run → `RUNNING` (green LED), runtime counts.
2. Raise vibration pot past mid → `WARNING` (yellow) + `vibration_warning`.
3. Raise temperature pot high too → `CRITICAL` (red + buzzer) + `critical_condition`.
4. Send `MAINTENANCE` → `MAINTENANCE_REQUIRED`; send again → back to `IDLE`.
5. Send `RESET` → faults cleared, runtime zeroed.
6. Max the current pot while running → `overcurrent` → `CRITICAL`.
