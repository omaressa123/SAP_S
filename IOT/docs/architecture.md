# Airport IoT System Architecture

This document describes the high-level architecture, design principles, and component interactions of the Airport IoT layer.

---

## 1. High-Level Airport System Context

The overall airport platform consists of three core engineering domains:

```
+-------------------------------------------------------------+
|                     1. Cisco Networking                     |
|           (VLANs, Subnets, Routing, QoS, Firewalls)         |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                         2. IoT Layer                        |
|       (ESP32 Devices, Sensors, Actuators, C++ Firmware)     |
+-------------------------------------------------------------+
                        ^             |
         Telemetry &    |             |  Actuation &
         Sensor Data    |             |  Remote Commands
                        v             v
+-------------------------------------------------------------+
|                    Mosquitto MQTT Broker                    |
|             (Message Routing, Topics, QoS 0/1)              |
+-------------------------------------------------------------+
                        ^             |
                        |             v
+-------------------------------------------------------------+
|              3. AI / Software / Backend / Database          |
|    (Analytics, Computer Vision, Flight DB, Web Dashboard)  |
+-------------------------------------------------------------+
```

---

## 2. Bidirectional IoT Communication Flow

Communication between field edge nodes (ESP32) and the Software/AI cloud backend is strictly bidirectional:

### Upstream (Sensor to Backend)
```
[Sensors / Inputs] ──> [ESP32 Firmware] ──> [Wi-Fi] ──> [Mosquitto Broker] ──> [Backend / AI / DB]
 (RFID, Beam, PIR)      (State Machine)      (WPA2)       (airport/# topics)     (Dashboards/AI)
```

### Downstream (Backend to Actuator)
```
[Backend / AI / DB] ──> [Mosquitto Broker] ──> [Wi-Fi] ──> [ESP32 Firmware] ──> [Actuators / Feedback]
 (Access Validation)      (.../command topics)  (WPA2)     (Command Handler)     (Servo, LEDs, Buzzer)
```

---

## 3. Smart Airport Gate Architecture & State Machine

The Smart Gate controller operates as an explicit finite state machine (FSM) ensuring deterministic transitions and safe operations.

### Gate State Diagram (ASCII)

```
                     +----------------------------------------+
                     |                 LOCKED                 |<============= (LOCK command)
                     +----------------------------------------+
                                         |
                                         | (UNLOCK command / Reset)
                                         v
   +---------------------------------> [CLOSED] <------------------------------------+
   |                                      |                                          |
   |                                      | (Passenger Presence Detected)            |
   |                                      v                                          |
   |                         [PASSENGER_DETECTED]                                    |
   |                                      |                                          |
   |                                      | (Request Authorization)                  |
   |                                      v                                          |
   |                           [WAITING_FOR_AUTH] -------------------+               |
   |                               |               (Auth Timeout)    |               |
   |                               |                                 v               |
   |          (Valid RFID / Allow) |                          [CLOSED]               |
   |                               v                                                 |
   |                        [AUTHORIZED]                                             |
   |                               |                                                 |
   |                               | (Servo -> 90°)                                  |
   |                               v                                                 |
   |                           [OPENING]                                             |
   |                               |                                                 |
   |                               v                                                 |
   |                            [OPEN] (4s Dwell Time)                               |
   |                               |                                                 |
   |                               | (Servo -> 0°)                                   |
   |                               v                                                 |
   |                           [CLOSING] ────────────────────────────────────────────+
   |
   |                          (Invalid RFID / Deny)
   +----------------------- [DENIED]
                               |
                               v
                            [ALARM] (Flashing Red LED + Buzzer for 3s)
                               |
                               +---------------------------------------------------->+
```

---

## 4. Passenger Counter Architecture & State Machine

The passenger counter uses two directional optical beams (Sensor A and Sensor B) to determine transit vector and maintain occupancy without race conditions.

### Directional Transit Logic

```
   [OUTSIDE AREA]                      [INSIDE TERMINAL]
        |                                      |
        v                                      v
    Sensor A ──────────────────────────────> Sensor B     ==> ENTRY (Occupancy + 1)
    
    Sensor A <────────────────────────────── Sensor B     ==> EXIT  (Occupancy - 1)
```

### Counter State Machine (ASCII)

```
                             +--------------------+
                             |        IDLE        |
                             +--------------------+
                                /                \
          (Sensor A tripped)   /                  \  (Sensor B tripped)
                              v                    v
                  [WAITING_FOR_B]                [WAITING_FOR_A]
                     /          \                    /         \
 (Sensor B tripped) /            \ (Timeout)        /           \ (Timeout)
                   v              v                v             v
          [ENTRY_CONFIRMED]    [IDLE]      [EXIT_CONFIRMED]   [IDLE]
                   |                               |
                   | (+1 Entered, Occupancy +1)    | (+1 Exited, Occupancy -1)
                   v                               v
          [    COOLDOWN   ]               [    COOLDOWN   ]
                   \                               /
                    \-----------------------------/
                                   |
                                   v
                                [IDLE]
```

### Invariants:
1. **Non-Negative Occupancy**: `occupancy = max(0, occupancy - 1)`.
2. **Debounce / Cooldown**: Prevents double counts from multi-reflection or luggage trail.
3. **Timeout Recovery**: If a passenger approaches but turns back, the half-tripped state resets to `IDLE` after 4 seconds.

---

## 5. Aircraft Parking Architecture & State Machine

Distance-driven stand supervision. Two proximity channels (front + lateral) feed configurable thresholds (`common/constants.h` → `Parking` namespace). Front distance `d` (cm):

```
                     d > 300 (DETECTION)
    [STAND_EMPTY] <-----------------------------------+
         |                                            |
         | d <= 300                                   | target lost /
         v                                            | departed
    [AIRCRAFT_DETECTED]                               |
         | d <= 150                                   |
         v                                            |
    [APPROACHING] ------ d <= 15 -------------------> [UNSAFE_DISTANCE]
         | d <= 80                                    |  (buzzer + RED LED)
         v                                            |  dwell 2 s
    [ALIGNMENT_REQUIRED] --- d <= 15 (overshoot) --->+--> [WARNING] (latched blink)
         | d <= 40 + settle 0.8 s                         | d recovers
         v                                                v
    [PARKED] ---- d leaves zone / DEPARTURE cmd ----> [DEPARTING] (3 s) --+
         ^                                                                |
         +------------------- scripted sweep via START_SIMULATION --------+
```

* **Safety status mapping:** `CLEAR` (empty), `CAUTION` (approach/alignment), `SECURED` (parked), `UNSAFE` (unsafe/warning).
* **Outputs:** Green LED = PARKED, Yellow = approach/alignment, Red + buzzer = unsafe/warning, servo = stand position indicator.

---

## 6. Smart Charging Station Architecture & State Machine

LOW-VOLTAGE SIMULATION ONLY. Simulated DC bus (voltage/current/temperature pots), relay = contactor, `power = voltage × current`.

```
[AVAILABLE] -- CONNECT_VEHICLE --> [VEHICLE_CONNECTED] -- handshake 1 s --> [READY]
    ^                                  |                                         |
    |                                  | disconnect                              | START_CHARGING
    +-- DISCONNECTED (2 s) <-- DISCONNECT_VEHICLE -- [CHARGING_COMPLETE] <-------+
                                          ^                    | 100% (clamped)
                                          |                    v
                              [CHARGING_STOPPED] <------ [CHARGING] -- temp >= warn --> [TEMPERATURE_HIGH]
                              (thermal cutout /            |  ^                           (charge paused,
                               operator stop)              |  | thermal recovery           relay open)
                                                           +--+
                                     ANY STATE -- EMERGENCY_STOP --> [ALARM] (latched, relay open) -- RESET --> [AVAILABLE]
```

* Charge integration is time-based (`CHARGE_RATE_PCT_S`), clamped at 100%.
* Temperature hysteresis prevents alarm flapping; critical cutout latches until RESET.

---

## 7. Equipment Monitoring Architecture & State Machine

Representative machine: CONVEYOR MOTOR. Threshold-based condition monitoring ONLY — no ML/predictive claims.

```
[OFFLINE] / [IDLE] -- START --> [RUNNING] -- any warning threshold --> [WARNING] -- critical / temp+vib --> [CRITICAL]
    ^                              |               ^                         |                              |
    +------------ RESET ------------+               +-- recovers -------------+                              v
                                                                                                   [MAINTENANCE_REQUIRED]
                                                                                                     (MAINTENANCE cmd ack /
                                                                                                      2nd cmd = return to service)
```

* **Warning thresholds:** temp ≥ 70 °C, vibration ≥ 4.5 mm/s, current ≥ 12 A.
* **Critical:** temp ≥ 85 °C, vibration ≥ 7.1 mm/s, current ≥ 15 A, or high temp + high vibration combined.
* **Condition:** `HEALTHY` / `WARNING` / `CRITICAL`; `health_score` 0..100 is a documented rule-based indicator, NOT an AI prediction.
* **Runtime** accumulates (seconds) only while operating.

---

## 8. Security Area Architecture & State Machine

Presence + access-control infrastructure ONLY. AI threat recognition belongs to the AI/software team.

```
[IDLE] -- person detected --> [PERSON_DETECTED] --> [WAITING_FOR_AUTH] (10 s timeout)
                                      authorization_requested event to backend/AI
                                    /                               \
                    card valid / AUTHORIZE(true)              card invalid / AUTHORIZE(false)
                                  |                                                   |
                                  v                                                   v
                           [AUTHORIZED]                                        [ACCESS_DENIED]
                                  |                                                   |
                                  v                                                   v
                           [GATE_OPENING] (1.5 s)                              [ALARM] (5 s blink)
                                  |
                                  v
                           [ACCESS_GRANTED] (4 s dwell, gate open)
                                  |
                                  v
                           [GATE_CLOSING] (1.5 s) --> [IDLE]

ANY STATE -- EMERGENCY_STOP --> [EMERGENCY] (gate forced locked/closed, alarm latched) -- RESET --> [IDLE]
LOCK cmd --> [LOCKED] (detection + cards rejected) -- UNLOCK/RESET --> [IDLE]
```

* RFID is a simulated access-card abstraction (`simulateCardPresent()`); swapping in a real reader only changes the input layer.
* Emergency has absolute priority over all normal operations and MQTT commands except RESET.

---

## 9. Scalability Model for the Airport IoT Modules

The firmware architecture uses a shared modular foundation:
- `common/mqtt_topics.h`: Centralized topic hierarchy and builder helpers.
- `common/device_config.h`: Decoupled network and broker parameters.
- `common/constants.h`: Airport-wide timing, statuses, and parameters.

All modules adopt the exact same pattern:
1. `modules/<module-name>/`
2. Independent `platformio.ini` inheriting from `../../common`
3. Controller class encapsulating domain FSM
4. MqttManager class handling protocol serialization and network resilience
5. Topic structure: `airport/{module}/{device_id}/{event}`

Current fleet (11 of 11 modules implemented):
| Module directory | Device ID | MQTT module key |
|---|---|---|
| `smart-airport-gate` | `GATE-001` | `gate` |
| `passenger-counter` | `COUNTER-001` | `passenger-counter` |
| `aircraft-parking` | `AIRCRAFT-PARK-001` | `aircraft-parking` |
| `smart-charging` | `CHARGER-001` | `charging` |
| `equipment-monitoring` | `EQUIPMENT-001` | `equipment` |
| `security-area` | `SECURITY-001` | `security` |
| `smart-baggage` | `BAGGAGE-001` | `baggage` |
| `emergency-detection` | `EMERG-001` | `emergency` |
| `fire-smoke` | `FIRE-001` | `fire-smoke` |
| `environment` | `ENV-001` | `environment` |
| `smart-elevator` | `ELEV-001` | `elevator` |
