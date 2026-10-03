# 🧳 Smart Baggage

IoT-based baggage monitoring and tracking module for the **Smart Airport** project.

## Features
- RFID baggage identification
- Weight monitoring
- Temperature monitoring
- Motion/impact detection
- Route tracking
- Overweight & misrouting detection
- MQTT communication

## Hardware
| Component | Pin |
|---|---|
| DHT22 | GPIO 4 |
| MPU6050 SDA/SCL | GPIO 21/22 |
| Weight Sensor | GPIO 34 |
| RC522 SS | GPIO 5 |
| RC522 SCK/MOSI/MISO | 18/23/19 |
| RC522 RST | GPIO 27 |

## Route
```
BAG_DROP → SECURITY → SORTING → GATE_A → AIRCRAFT
```

## MQTT Topics
```
airport/baggage/BAGGAGE-01/status
airport/baggage/BAGGAGE-01/event
airport/device/BAGGAGE-01/heartbeat
```

## Status values
| Status | Meaning |
|---|---|
| `WAITING` | Waiting for the bag at the drop-off point |
| `ACCEPTED` | Bag received and moving along its route |
| `MISROUTED` | Bag reached the wrong zone, staff are re-routing it |

## Status example
Published to `airport/baggage/BAGGAGE-01/status`:
```json
{
  "bag_id": "BAG-1024",
  "device_id": "BAGGAGE-01",
  "zone": "SORTING",
  "status": "ACCEPTED",
  "weight": 18.7,
  "temperature": 24.6,
  "moving": false,
  "impact": false,
  "route_step": 3,
  "route_total": 5,
  "misrouted": false,
  "expected_zone": "GATE_A",
  "progress_percent": 50,
  "message": "Your bag is being sorted for your flight.",
  "message_ar": "شنطتك بتتفرز لرحلتك."
}
```

## Events
Published to `airport/baggage/BAGGAGE-01/event`:

| Event | When |
|---|---|
| `BAG_DETECTED` | A bag is detected at the drop-off point |
| `ZONE_CHANGED` | The bag moves to the next zone |
| `MISROUTED_ALERT` | The bag reaches a zone that is not the expected one |

```json
{
  "bag_id": "BAG-1024",
  "device_id": "BAGGAGE-01",
  "zone": "GATE_B",
  "event": "MISROUTED_ALERT",
  "expected_zone": "SORTING",
  "actual_zone": "GATE_B"
}
```

## Heartbeat example
Published every 15 seconds to `airport/device/BAGGAGE-01/heartbeat`:
```json
{
  "device_id": "BAGGAGE-01",
  "status": "online",
  "zone": "TERMINAL-1",
  "uptime_ms": 15007
}
```

## Serial commands (testing)
| Key | Action |
|---|---|
| `n` | Next zone (same as an RFID tap) |
| `m` | Simulate a misroute |
| `r` | Reset the route |

## Technologies
ESP32 • C++ • PlatformIO • Wokwi • MQTT • ArduinoJson • DHT22 • MPU6050 • RC522

**Device ID:** BAGGAGE-01
**Status:** Prototype / Wokwi Simulation