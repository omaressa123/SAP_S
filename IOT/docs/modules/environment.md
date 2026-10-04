# Smart Airport Environment IoT (`ENV-001`)

## Purpose

Terminal comfort + air-quality monitoring: temperature, humidity, CO2 with
automatic ventilation fan control plus manual override. Rule-based only.

## Simulated Hardware

| Item | Wokwi part | Role |
|---|---|---|
| ESP32 DevKit C V4 | `board-esp32-devkit-c-v4` | Controller, Wi-Fi + MQTT |
| Potentiometer × 3 | `wokwi-potentiometer` | Temp 10..45 °C (34), humidity 0..100 % (35), CO2 400..2000 ppm (32) |
| Green / Yellow / Red LEDs | `wokwi-led` | Comfort OK / warning / poor air |
| Relay module | `wokwi-relay-module` | Ventilation fan (GPIO 18) |
| Push buttons × 2 | `wokwi-pushbutton` | Fan override cycle, reset/auto |

## Inputs / Outputs

* **Inputs:** temp ADC (34), humidity ADC (35), CO2 ADC (32), fan button (19), reset (23), MQTT commands.
* **Outputs:** LEDs (2/4/5), fan relay (18), MQTT status / telemetry / event.

## State Machine

```
NORMAL ⇄ COMFORT_WARNING (hot/cold, humid, or CO2 ≥ 1000 ppm)
  → POOR_AIR (CO2 ≥ 1500 ppm, fan forced ON in AUTO)
Fan: AUTO (state-driven) ⇄ FORCED_ON ⇄ FORCED_OFF (manual override cycle)
```

Fan button cycles `AUTO → FORCED_ON → FORCED_OFF → AUTO`.

## MQTT Topics

| Purpose | Topic |
|---|---|
| Status (retained) | `airport/environment/ENV-001/status` |
| Telemetry (~3 s) | `airport/environment/ENV-001/telemetry` |
| Events | `airport/environment/ENV-001/event` |
| Commands | `airport/environment/ENV-001/command` |
| Heartbeat | `airport/device/ENV-001/heartbeat` |

Commands: `FAN_ON`, `FAN_OFF`, `FAN_AUTO`, `RESET`, `GET_STATUS`.
Events: `comfort_warning`, `poor_air`, `condition_normal`, `fan_forced_on`,
`fan_forced_off`, `fan_auto`, `system_reset`.

## Test Scenarios (Wokwi)

1. Turn CO2 pot up → `COMFORT_WARNING` (yellow, fan ON) → further → `POOR_AIR` (red).
2. Turn pot back down → auto `NORMAL` (fan OFF in AUTO).
3. Press Fan → override cycle; press Reset → back to `AUTO`.
