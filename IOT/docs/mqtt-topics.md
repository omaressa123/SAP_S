# Airport IoT Unified MQTT Topic Specification

## 1. Topic Hierarchy Standard

All modules in the Airport IoT system adhere to a single standardized hierarchy:

```
airport/{module}/{device_id}/{event_or_channel}
```

And device-level system heartbeat:
```
airport/device/{device_id}/heartbeat
```

---

## 2. Module Identifiers

| Module Code | Description | Device ID Pattern |
|---|---|---|
| `gate` | Smart Airport Gate | `GATE-001`, `GATE-002`, ... |
| `passenger-counter` | Smart Passenger Flow Counter | `COUNTER-001`, `COUNTER-002`, ... |
| `baggage` | Smart Baggage Tracking | `BAGGAGE-001`, ... |
| `emergency` | Emergency Detection System | `EMERG-001`, ... |
| `fire-smoke` | Fire and Smoke Monitoring | `FIRE-001`, ... |
| `environment` | Smart Airport Environment | `ENV-001`, ... |
| `elevator` | Smart Elevator System | `ELEV-001`, ... |
| `ground-iot` | Aircraft Parking / Ground IoT | `GROUND-001`, ... |
| `aircraft-parking` | Aircraft Parking Stand (stand-level) | `AIRCRAFT-PARK-001`, ... |
| `charging` | Smart Charging Station | `CHG-001`, `CHARGER-001`, ... |
| `equipment` | Airport Equipment Monitoring | `EQP-001`, `EQUIPMENT-001`, ... |
| `security` | Security Area IoT | `SEC-001`, `SECURITY-001`, ... |

---

## 3. Smart Gate Topics (`gate`)

### 3.1 Status Topic (Retained)
* **Topic:** `airport/gate/{device_id}/status`
* **Direction:** ESP32 → Broker
* **Description:** Current connectivity, operational state, and zone assignment.
* **Payload Example:**
```json
{
  "device_id": "GATE-001",
  "module": "gate",
  "status": "online",
  "state": "CLOSED",
  "is_locked": false,
  "zone": "TERMINAL-1",
  "timestamp": 124500
}
```

### 3.2 Passenger Detection Topic
* **Topic:** `airport/gate/{device_id}/passenger`
* **Direction:** ESP32 → Broker
* **Description:** Emitted when proximity/optical sensor detects an approaching passenger.
* **Payload Example:**
```json
{
  "device_id": "GATE-001",
  "event": "passenger_detected",
  "timestamp": 124550
}
```

### 3.3 Access Event Topic
* **Topic:** `airport/gate/{device_id}/access`
* **Direction:** ESP32 → Broker
* **Description:** Emitted on boarding pass / RFID card swipe.
* **Payload Example (Access Granted):**
```json
{
  "device_id": "GATE-001",
  "card_uid": "PASS-7788-OK",
  "authorized": true,
  "reason": "VALID_BOARDING_PASS",
  "timestamp": 124600
}
```
* **Payload Example (Access Denied):**
```json
{
  "device_id": "GATE-001",
  "card_uid": "PASS-0000-DENIED",
  "authorized": false,
  "reason": "UNAUTHORIZED_CARD",
  "timestamp": 128900
}
```

### 3.4 Operational Event Topic
* **Topic:** `airport/gate/{device_id}/event`
* **Direction:** ESP32 → Broker
* **Description:** Finite state machine transition notifications (`gate_opened`, `gate_closed`, `alarm_triggered`, `gate_locked`, etc.).
* **Payload Example:**
```json
{
  "device_id": "GATE-001",
  "module": "gate",
  "event": "gate_opened",
  "state": "OPEN",
  "details": "PASSAGE_CLEAR",
  "timestamp": 124750
}
```

### 3.5 Inbound Command Topic
* **Topic:** `airport/gate/{device_id}/command`
* **Direction:** Backend / AI → ESP32
* **Description:** Remote commands to actuate or override the gate.
* **Payloads:**
  * **Open Gate:** `{"command": "OPEN"}`
  * **Close Gate:** `{"command": "CLOSE"}`
  * **Security Lock:** `{"command": "LOCK"}`
  * **Security Unlock:** `{"command": "UNLOCK"}`
  * **Reset:** `{"command": "RESET"}`
  * **Authorize Passenger UID from AI/Cloud:**
    ```json
    {
      "command": "AUTH_PASSENGER",
      "card_uid": "PASS-8899-VIP",
      "authorized": true
    }
    ```

---

## 4. Passenger Counter Topics (`passenger-counter`)

### 4.1 Status Topic (Retained)
* **Topic:** `airport/passenger-counter/{device_id}/status`
* **Direction:** ESP32 → Broker
* **Payload Example:**
```json
{
  "device_id": "COUNTER-001",
  "module": "passenger-counter",
  "status": "online",
  "state": "IDLE",
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 4.2 Occupancy Telemetry Topic (Retained)
* **Topic:** `airport/passenger-counter/{device_id}/occupancy`
* **Direction:** ESP32 → Broker
* **Description:** Live passenger occupancy tally, total entered, and total exited.
* **Payload Example:**
```json
{
  "device_id": "COUNTER-001",
  "zone": "TERMINAL-1",
  "occupancy": 135,
  "entered": 140,
  "exited": 5,
  "timestamp": 125100
}
```

### 4.3 Transit Event Topic
* **Topic:** `airport/passenger-counter/{device_id}/event`
* **Direction:** ESP32 → Broker
* **Description:** Emitted on each confirmed directional transit (`passenger_entered`, `passenger_exited`, `transit_timeout`).
* **Payload Example:**
```json
{
  "device_id": "COUNTER-001",
  "module": "passenger_counter",
  "event": "passenger_entered",
  "occupancy": 136,
  "entered": 141,
  "exited": 5,
  "details": "DIRECTION_A_TO_B",
  "timestamp": 125200
}
```

### 4.4 Inbound Command Topic
* **Topic:** `airport/passenger-counter/{device_id}/command`
* **Direction:** Backend / AI → ESP32
* **Payloads:**
  * **Reset Counters:** `{"command": "RESET"}`
  * **Force Set Occupancy:** `{"command": "SET_OCCUPANCY", "occupancy": 150}`
  * **Request Telemetry:** `{"command": "GET_STATUS"}`
  * **Simulate Entry:** `{"command": "SIMULATE_ENTRY"}`
  * **Simulate Exit:** `{"command": "SIMULATE_EXIT"}`

---

## 6. Aircraft Parking Topics (`aircraft-parking`, `AIRCRAFT-PARK-001`)

### 6.1 Status Topic (Retained)
* **Topic:** `airport/aircraft-parking/AIRCRAFT-PARK-001/status`
* **Direction:** ESP32 → Broker
* **Payload Example:**
```json
{
  "device_id": "AIRCRAFT-PARK-001",
  "module": "aircraft-parking",
  "status": "online",
  "state": "APPROACHING",
  "stand_status": "APPROACHING",
  "safety_status": "CAUTION",
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 6.2 Telemetry Topic
* **Topic:** `airport/aircraft-parking/AIRCRAFT-PARK-001/telemetry`
* **Direction:** ESP32 → Broker (every ~2 s)
* **Payload Example:**
```json
{
  "device_id": "AIRCRAFT-PARK-001",
  "module": "aircraft-parking",
  "distance_cm": 120.5,
  "distance_front_cm": 120.5,
  "distance_side_cm": 210.0,
  "stand_status": "APPROACHING",
  "aircraft_status": "PRESENT",
  "safety_status": "CAUTION",
  "parking_state": "APPROACHING",
  "timestamp": 125100
}
```

### 6.3 Stand Event Topic
* **Topic:** `airport/aircraft-parking/AIRCRAFT-PARK-001/event`
* **Direction:** ESP32 → Broker
* **Events:** `aircraft_detected`, `aircraft_approaching`, `alignment_required`, `aircraft_parked`, `unsafe_distance`, `warning`, `aircraft_departing`, `stand_empty`, `simulation_started`
* **Payload Example:**
```json
{
  "device_id": "AIRCRAFT-PARK-001",
  "module": "aircraft-parking",
  "event": "aircraft_parked",
  "state": "PARKED",
  "details": "ON_BLOCKS",
  "timestamp": 125200
}
```

### 6.4 Inbound Command Topic
* **Topic:** `airport/aircraft-parking/AIRCRAFT-PARK-001/command`
* **Direction:** Backend / AI → ESP32
* **Payloads:**
  * `{"command": "START_SIMULATION"}` — scripted approach sweep demo
  * `{"command": "AIRCRAFT_ARRIVAL"}`
  * `{"command": "AIRCRAFT_DEPARTURE"}`
  * `{"command": "RESET"}`
  * `{"command": "GET_STATUS"}`

---

## 7. Smart Charging Topics (`charging`, `CHARGER-001`)

> LOW-VOLTAGE SIMULATION ONLY. No real high-voltage hardware is involved.

### 7.1 Status Topic (Retained)
* **Topic:** `airport/charging/CHARGER-001/status`
* **Payload Example:**
```json
{
  "device_id": "CHARGER-001",
  "module": "charging",
  "status": "online",
  "state": "CHARGING",
  "charging_state": "CHARGING",
  "vehicle_connected": true,
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 7.2 Telemetry Topic
* **Topic:** `airport/charging/CHARGER-001/telemetry`
* **Direction:** ESP32 → Broker (every ~2 s). `power = voltage × current` (computed in firmware).
* **Payload Example:**
```json
{
  "device_id": "CHARGER-001",
  "module": "charging",
  "voltage": 400.5,
  "current": 80.2,
  "power": 32120.1,
  "temperature": 42.3,
  "charge_percent": 63.5,
  "charging_state": "CHARGING",
  "vehicle_connected": true,
  "timestamp": 125100
}
```

### 7.3 Charging Event Topic
* **Topic:** `airport/charging/CHARGER-001/event`
* **Events:** `vehicle_connected`, `vehicle_ready`, `charging_started`, `charging_progress`, `charging_completed`, `temperature_warning`, `charging_stopped`, `emergency_stop`, `vehicle_disconnected`, `station_reset`

### 7.4 Inbound Command Topic
* **Topic:** `airport/charging/CHARGER-001/command`
* **Payloads:**
  * `{"command": "CONNECT_VEHICLE"}`
  * `{"command": "DISCONNECT_VEHICLE"}`
  * `{"command": "START_CHARGING"}`
  * `{"command": "STOP_CHARGING"}`
  * `{"command": "EMERGENCY_STOP"}` — immediate contactor cut, latched alarm
  * `{"command": "RESET"}`
  * `{"command": "GET_STATUS"}`

---

## 8. Equipment Monitoring Topics (`equipment`, `EQUIPMENT-001`)

> Threshold-based condition monitoring ONLY. No predictive maintenance or ML claims.

### 8.1 Status Topic (Retained)
* **Topic:** `airport/equipment/EQUIPMENT-001/status`
* **Payload Example:**
```json
{
  "device_id": "EQUIPMENT-001",
  "module": "equipment",
  "status": "online",
  "state": "WARNING",
  "operating_state": "WARNING",
  "condition": "WARNING",
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 8.2 Telemetry Topic
* **Topic:** `airport/equipment/EQUIPMENT-001/telemetry`
* **Direction:** ESP32 → Broker (every ~3 s)
* **Payload Example:**
```json
{
  "device_id": "EQUIPMENT-001",
  "module": "equipment",
  "temperature": 72.5,
  "vibration": 5.1,
  "current": 8.2,
  "runtime": 1240,
  "operating_state": "WARNING",
  "condition": "WARNING",
  "health_score": 68,
  "timestamp": 125100
}
```

### 8.3 Equipment Event Topic
* **Topic:** `airport/equipment/EQUIPMENT-001/event`
* **Events:** `equipment_started`, `equipment_stopped`, `temperature_warning`, `vibration_warning`, `overcurrent`, `critical_condition`, `maintenance_required`, `maintenance_completed`, `condition_normal`, `equipment_reset`

### 8.4 Inbound Command Topic
* **Topic:** `airport/equipment/EQUIPMENT-001/command`
* **Payloads:**
  * `{"command": "START"}`
  * `{"command": "STOP"}`
  * `{"command": "RESET"}`
  * `{"command": "MAINTENANCE"}` — acknowledge fault / complete maintenance
  * `{"command": "GET_STATUS"}`

---

## 9. Security Area Topics (`security`, `SECURITY-001`)

> Presence + access-control infrastructure ONLY. AI threat recognition belongs to the AI/software team.

### 9.1 Status Topic (Retained)
* **Topic:** `airport/security/SECURITY-001/status`
* **Payload Example:**
```json
{
  "device_id": "SECURITY-001",
  "module": "security",
  "status": "online",
  "state": "WAITING_FOR_AUTH",
  "is_locked": false,
  "gate_open": false,
  "person_present": true,
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 9.2 Security Event Topic
* **Topic:** `airport/security/SECURITY-001/event`
* **Events:** `person_detected`, `authorization_requested`, `access_granted`, `access_denied`, `gate_opened`, `gate_closed`, `alarm_triggered`, `emergency_triggered`, `auth_timeout`, `gate_locked`, `gate_unlocked`, `remote_open_command`, `system_reset`

### 9.3 Access Event Topic
* **Topic:** `airport/security/SECURITY-001/access`
* **Payload Example:**
```json
{
  "device_id": "SECURITY-001",
  "module": "security",
  "card_uid": "SEC-CARD-VALID-01",
  "authorized": true,
  "reason": "AUTHORIZED",
  "timestamp": 125200
}
```

### 9.4 Inbound Command Topic
* **Topic:** `airport/security/SECURITY-001/command`
* **Payloads:**
  * `{"command": "OPEN"}` / `{"command": "CLOSE"}`
  * `{"command": "LOCK"}` / `{"command": "UNLOCK"}`
  * `{"command": "RESET"}` / `{"command": "EMERGENCY_STOP"}` / `{"command": "GET_STATUS"}`
  * Backend authorization decision:
    ```json
    {"command": "AUTHORIZE", "card_uid": "SEC-CARD-77", "authorized": true}
    ```

---

## 10. Smart Baggage Topics (`baggage`, `BAGGAGE-001`)

### 10.1 Status Topic (Retained)
* **Topic:** `airport/baggage/BAGGAGE-001/status`
* **Payload Example:**
```json
{
  "device_id": "BAGGAGE-001",
  "module": "baggage",
  "status": "online",
  "state": "WAITING_FOR_SORT",
  "is_locked": false,
  "sorted": 12,
  "diverted": 2,
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 10.2 Tag Decision Topic
* **Topic:** `airport/baggage/BAGGAGE-001/telemetry`
* **Payload Example:**
```json
{
  "device_id": "BAGGAGE-001",
  "module": "baggage",
  "tag_uid": "BAG-TAG-001",
  "result": "SORTED",
  "reason": "MAIN_LINE",
  "timestamp": 125100
}
```

### 10.3 Baggage Event Topic
* **Events:** `tag_detected`, `sort_requested`, `baggage_sorted`, `baggage_diverted`, `sort_timeout`, `line_locked`, `line_unlocked`, `system_reset`

### 10.4 Inbound Command Topic
* **Topic:** `airport/baggage/BAGGAGE-001/command`
* **Payloads:**
  * `{"command": "TAG_DETECT", "tag_uid": "BAG-TAG-001"}`
  * `{"command": "SORT", "tag_uid": "BAG-TAG-001"}`
  * `{"command": "DIVERT", "tag_uid": "BAG-TAG-001", "reason": "MISROUTED"}`
  * `{"command": "LOCK"}` / `{"command": "UNLOCK"}`
  * `{"command": "RESET"}` / `{"command": "GET_STATUS"}`

---

## 11. Emergency Detection Topics (`emergency`, `EMERG-001`)

### 11.1 Status Topic (Retained)
* **Topic:** `airport/emergency/EMERG-001/status`
* **Payload Example:**
```json
{
  "device_id": "EMERG-001",
  "module": "emergency",
  "status": "online",
  "state": "ALERT",
  "alarm_active": true,
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 11.2 Emergency Event Topic
* **Events:** `emergency_triggered`, `evacuation_ordered`, `lockdown_ordered`, `alarm_silenced`, `auto_evacuation`, `system_reset`

### 11.3 Inbound Command Topic
* **Topic:** `airport/emergency/EMERG-001/command`
* **Payloads:**
  * `{"command": "TRIGGER", "details": "BACKEND_TRIGGER"}`
  * `{"command": "EVACUATE"}` / `{"command": "LOCKDOWN"}`
  * `{"command": "SILENCE"}` / `{"command": "RESET"}` / `{"command": "GET_STATUS"}`

---

## 12. Fire / Smoke Topics (`fire-smoke`, `FIRE-001`)

> Sensing + alarming ONLY. No suppression actuation.

### 12.1 Status Topic (Retained)
* **Topic:** `airport/fire-smoke/FIRE-001/status`
* **Payload Example:**
```json
{
  "device_id": "FIRE-001",
  "module": "fire-smoke",
  "status": "online",
  "state": "WARNING",
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 12.2 Telemetry Topic
* **Topic:** `airport/fire-smoke/FIRE-001/telemetry`
* **Payload Example:**
```json
{
  "device_id": "FIRE-001",
  "module": "fire-smoke",
  "smoke_ppm": 350.5,
  "temperature": 48.2,
  "state": "WARNING",
  "timestamp": 125100
}
```

### 12.3 Fire Event Topic
* **Events:** `warning_condition`, `critical_condition`, `condition_normal`, `test_alarm`, `alarm_silenced`, `system_reset`

### 12.4 Inbound Command Topic
* **Topic:** `airport/fire-smoke/FIRE-001/command`
* **Payloads:** `TEST_ALARM`, `SILENCE`, `RESET`, `GET_STATUS`

---

## 13. Environment Topics (`environment`, `ENV-001`)

### 13.1 Status Topic (Retained)
* **Topic:** `airport/environment/ENV-001/status`
* **Payload Example:**
```json
{
  "device_id": "ENV-001",
  "module": "environment",
  "status": "online",
  "state": "COMFORT_WARNING",
  "fan_mode": "AUTO",
  "fan_on": true,
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 13.2 Telemetry Topic
* **Topic:** `airport/environment/ENV-001/telemetry`
* **Payload Example:**
```json
{
  "device_id": "ENV-001",
  "module": "environment",
  "temperature": 29.5,
  "humidity": 65.0,
  "co2": 1100.0,
  "fan_on": true,
  "state": "COMFORT_WARNING",
  "timestamp": 125100
}
```

### 13.3 Environment Event Topic
* **Events:** `comfort_warning`, `poor_air`, `condition_normal`, `fan_forced_on`, `fan_forced_off`, `fan_auto`, `system_reset`

### 13.4 Inbound Command Topic
* **Topic:** `airport/environment/ENV-001/command`
* **Payloads:** `FAN_ON`, `FAN_OFF`, `FAN_AUTO`, `RESET`, `GET_STATUS`

---

## 14. Smart Elevator Topics (`elevator`, `ELEV-001`)

> Simulation only — NOT a real lift controller.

### 14.1 Status Topic (Retained)
* **Topic:** `airport/elevator/ELEV-001/status`
* **Payload Example:**
```json
{
  "device_id": "ELEV-001",
  "module": "elevator",
  "status": "online",
  "state": "DOOR_OPEN",
  "floor": 1,
  "door_open": true,
  "zone": "TERMINAL-1",
  "timestamp": 125000
}
```

### 14.2 Elevator Event Topic
* **Events:** `call_up`, `call_down`, `floor_reached`, `door_opened`, `door_closed`, `overload_detected`, `overload_cleared`, `emergency_triggered`, `system_reset`

### 14.3 Inbound Command Topic
* **Topic:** `airport/elevator/ELEV-001/command`
* **Payloads:** `CALL_UP`, `CALL_DOWN`, `OPEN_DOOR`, `CLOSE_DOOR`, `OVERLOAD_ON`, `OVERLOAD_OFF`, `EMERGENCY_STOP`, `RESET`, `GET_STATUS`

---

## 15. System Heartbeat Topic

* **Topic:** `airport/device/{device_id}/heartbeat`
* **Direction:** ESP32 → Broker
* **Cadence:** Configurable default (15 seconds)
* **Payload Example:**
```json
{
  "device_id": "GATE-001",
  "module": "gate",
  "status": "online",
  "state": "CLOSED",
  "uptime": 3600,
  "free_heap": 241500
}
```
