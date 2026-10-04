# Airport Smart IoT System (Graduation Project)

Welcome to the **Airport Smart IoT Firmware Repository**. This repository contains the embedded firmware, hardware circuit models, MQTT integration layer, and simulation configurations for the Airport Smart System.

---

## 1. Project Purpose & Architecture

The Airport platform is divided into three core pillars:
1. **Cisco Networking**: Network segmentation, VLANs, routing, and QoS.
2. **IoT Layer**: ESP32 microcontrollers, sensory tripwires, RFID boarding pass authentication, barrier servos, and bidirectional MQTT telemetry.
3. **AI / Software / Database**: Face recognition, flight scheduling, passenger flow analytics, and management web dashboards.

### Current Implementation Status
* **Smart Airport Gate (`GATE-001`)**: Complete state machine (Closed, Passenger Detected, Auth, Opening, Open, Closing, Alarm, Locked), servo barrier control, RFID authentication simulation, acoustic/LED alerts, bidirectional MQTT command and telemetry.
* **Smart Passenger Counter (`COUNTER-001`)**: Directional dual-beam transit tracking (A→B entry, B→A exit), non-negative occupancy tracking, hardware debounce and transit cooldown, bidirectional MQTT telemetry.
* **Aircraft Parking / Ground IoT (`AIRCRAFT-PARK-001`)**: Stand supervision state machine (Empty, Detected, Approaching, Alignment, Parked, Departing, Unsafe/Warning), dual proximity simulation, servo position indicator, bidirectional MQTT. See `docs/modules/aircraft-parking.md`.
* **Smart Charging Station (`CHARGER-001`)**: EV ground-vehicle charge lifecycle (Available, Connected, Ready, Charging, Complete), voltage/current/power/temperature telemetry, over-temperature protection, latching emergency stop. LOW-VOLTAGE SIMULATION ONLY. See `docs/modules/smart-charging.md`.
* **Airport Equipment Monitoring (`EQUIPMENT-001`)**: Conveyor-motor threshold monitoring (temperature, vibration, current, runtime), HEALTHY/WARNING/CRITICAL condition states, maintenance workflow. Rule-based only — no ML claims. See `docs/modules/equipment-monitoring.md`.
* **Security Area IoT (`SECURITY-001`)**: Checkpoint presence + access control (person detection, card authorization, gate servo, emergency lockdown with absolute priority), simulated RFID abstraction. See `docs/modules/security-area.md`.
* **Smart Baggage (`BAGGAGE-001`)**: Tag induction + diverter sort line (tag detect, backend sort/divert decision, diverter servo, sort timeout auto-divert), simulated tag abstraction. See `docs/modules/smart-baggage.md`.
* **Emergency Detection (`EMERG-001`)**: Trigger / evacuation / lockdown siren infrastructure (panic button, silence, lockdown, strobe beacon, latched alarm with auto-evacuation escalation). See `docs/modules/emergency-detection.md`.
* **Fire / Smoke Monitoring (`FIRE-001`)**: Threshold-based smoke + heat monitoring (smoke ppm + temperature telemetry, WARNING/CRITICAL states, latched test alarm). Sensing + alarming ONLY — no suppression actuation. See `docs/modules/fire-smoke.md`.
* **Smart Environment (`ENV-001`)**: Terminal comfort + air quality (temperature / humidity / CO2 telemetry, automatic ventilation fan with manual override). See `docs/modules/environment.md`.
* **Smart Elevator (`ELEV-001`)**: Cabin call / door / overload / E-STOP simulation (call dispatch, door servo, overload hold, latched emergency). SIMULATION ONLY — not a real lift controller. See `docs/modules/smart-elevator.md`.
* **Extensibility**: All 11 planned airport modules are now scaffolded under the unified topic hierarchy (`ground-iot` reserved for future apron-level aggregation).

---

## 2. Directory Structure

```
airport-iot/
├── README.md
├── .gitignore
│
├── docs/
│   ├── architecture.md             # Detailed state machines & architecture diagrams
│   ├── mqtt-topics.md              # Complete MQTT topic dictionary and JSON schemas
│   ├── device-specification.md     # GPIO pin assignments, schematics, parts list
│   ├── integration-guide.md        # Guide for Backend/AI team to consume MQTT data
│   └── modules/                    # Per-module guides (aircraft-parking, smart-charging,
│                                    # equipment-monitoring, security-area, smart-baggage,
│                                    # emergency-detection, fire-smoke, environment, smart-elevator)
│
├── common/                         # Shared header files across all modules
│   ├── mqtt_topics.h               # Standardized topic builder & module identifiers
│   ├── device_config.h             # Safe default Wi-Fi, MQTT broker host, ports
│   └── constants.h                 # Universal timeouts, statuses, and parameters
│
├── modules/
│   ├── smart-airport-gate/         # Smart Gate Firmware & Simulation
│   │   ├── src/
│   │   │   ├── main.cpp
│   │   │   ├── gate_controller.cpp
│   │   │   └── mqtt_manager.cpp
│   │   ├── include/
│   │   │   ├── gate_controller.h
│   │   │   ├── mqtt_manager.h
│   │   │   └── hardware_config.h
│   │   ├── platformio.ini
│   │   ├── diagram.json            # Wokwi circuit diagram
│   │   └── wokwi.toml              # Wokwi simulation configuration
│   │
│   └── passenger-counter/          # Passenger Counter Firmware & Simulation
│       ├── src/
│       │   ├── main.cpp
│       │   ├── counter_controller.cpp
│       │   └── mqtt_manager.cpp
│       ├── include/
│       │   ├── counter_controller.h
│       │   ├── mqtt_manager.h
│       │   └── hardware_config.h
│       ├── platformio.ini
│       ├── diagram.json            # Wokwi circuit diagram
│       └── wokwi.toml              # Wokwi simulation configuration
│   │
│   ├── aircraft-parking/           # Aircraft Parking Stand (AIRCRAFT-PARK-001)
│   │   ├── src/ (main.cpp, parking_controller.cpp, mqtt_manager.cpp)
│   │   ├── include/ (parking_controller.h, mqtt_manager.h, hardware_config.h)
│   │   ├── platformio.ini, diagram.json, wokwi.toml
│   │
│   ├── smart-charging/             # Charging Station (CHARGER-001)
│   │   ├── src/ (main.cpp, charger_controller.cpp, mqtt_manager.cpp)
│   │   ├── include/ (charger_controller.h, mqtt_manager.h, hardware_config.h)
│   │   ├── platformio.ini, diagram.json, wokwi.toml
│   │
│   ├── equipment-monitoring/       # Equipment Monitor (EQUIPMENT-001)
│   │   ├── src/ (main.cpp, equipment_controller.cpp, mqtt_manager.cpp)
│   │   ├── include/ (equipment_controller.h, mqtt_manager.h, hardware_config.h)
│   │   ├── platformio.ini, diagram.json, wokwi.toml
│   │
│   ├── security-area/              # Security Checkpoint (SECURITY-001)
│   │   ├── src/ (main.cpp, security_controller.cpp, mqtt_manager.cpp)
│   │   ├── include/ (security_controller.h, mqtt_manager.h, hardware_config.h)
│   │   ├── platformio.ini, diagram.json, wokwi.toml
│   │
│   ├── smart-baggage/              # Baggage Sort Line (BAGGAGE-001)
│   │   ├── src/ (main.cpp, baggage_controller.cpp, mqtt_manager.cpp)
│   │   ├── include/ (baggage_controller.h, mqtt_manager.h, hardware_config.h)
│   │   ├── platformio.ini, diagram.json, wokwi.toml
│   │
│   ├── emergency-detection/        # Emergency Siren (EMERG-001)
│   │   ├── src/ (main.cpp, emergency_controller.cpp, mqtt_manager.cpp)
│   │   ├── include/ (emergency_controller.h, mqtt_manager.h, hardware_config.h)
│   │   ├── platformio.ini, diagram.json, wokwi.toml
│   │
│   ├── fire-smoke/                 # Fire/Smoke Monitor (FIRE-001)
│   │   ├── src/ (main.cpp, firesmoke_controller.cpp, mqtt_manager.cpp)
│   │   ├── include/ (firesmoke_controller.h, mqtt_manager.h, hardware_config.h)
│   │   ├── platformio.ini, diagram.json, wokwi.toml
│   │
│   ├── environment/                # Environment Monitor (ENV-001)
│   │   ├── src/ (main.cpp, environment_controller.cpp, mqtt_manager.cpp)
│   │   ├── include/ (environment_controller.h, mqtt_manager.h, hardware_config.h)
│   │   ├── platformio.ini, diagram.json, wokwi.toml
│   │
│   └── smart-elevator/             # Elevator Sim (ELEV-001)
│       ├── src/ (main.cpp, elevator_controller.cpp, mqtt_manager.cpp)
│       ├── include/ (elevator_controller.h, mqtt_manager.h, hardware_config.h)
│       ├── platformio.ini, diagram.json, wokwi.toml
│
└── scripts/
    ├── mqtt_test.sh                # Interactive MQTT monitoring & command script
    └── test_devices.sh             # Automated MQTT payload validation suite
```

---

## 3. Technology Stack

* **Firmware Language:** C++ (ESP32 Arduino Framework)
* **Build System:** PlatformIO Core
* **Hardware Simulation:** Wokwi
* **Messaging Protocol:** MQTT (PubSubClient, ArduinoJson v6)
* **Broker:** Eclipse Mosquitto (Local or Cloud Test Broker)

---

## 4. Getting Started & Compilation

### Prerequisites
* [PlatformIO Core](https://platformio.org/install/cli) or VS Code with PlatformIO Extension.
* [Mosquitto Clients](https://mosquitto.org/) (`mosquitto_pub` / `mosquitto_sub`).

### Compile Smart Gate Firmware
```bash
cd modules/smart-airport-gate
pio run
```

### Compile Passenger Counter Firmware
```bash
cd modules/passenger-counter
pio run
```

### Compile New Modules (each independent)
```bash
cd modules/aircraft-parking && pio run
cd ../smart-charging && pio run
cd ../equipment-monitoring && pio run
cd ../security-area && pio run
cd ../smart-baggage && pio run
cd ../emergency-detection && pio run
cd ../fire-smoke && pio run
cd ../environment && pio run
cd ../smart-elevator && pio run
```

---

## 5. Running Wokwi Simulations

Both modules are fully configured for interactive Wokwi simulation.

### Option A: In VS Code with Wokwi Extension
1. Install the **Wokwi Simulator** extension in VS Code.
2. Open either `modules/smart-airport-gate/diagram.json` or `modules/passenger-counter/diagram.json`.
3. Press `F1` and select **Wokwi: Start Simulator**.

### Option B: Interactive Simulation Controls
* **Smart Airport Gate (`smart-airport-gate`)**:
  * **Button 1 (Blue):** Passenger presence detected (`PIN 19`).
  * **Button 2 (Green):** Valid boarding pass RFID scanned (`PIN 21`) -> Gate opens, Green LED ON, buzzer beeps.
  * **Button 3 (Red):** Unauthorized card scanned (`PIN 22`) -> Access denied, Alarm triggers, Red LED flashes, buzzer sounds.
  * **Button 4 (Grey):** Manual reset (`PIN 23`).
  * **Servo (Top Right):** Rotates 90° for OPEN, 0° for CLOSED.

* **Smart Passenger Counter (`passenger-counter`)**:
  * **Button 1 (Green):** Trip Sensor A (`PIN 19`).
  * **Button 2 (Yellow):** Trip Sensor B (`PIN 21`).
  * **Entry Simulation:** Press Button 1, then Button 2 -> `Occupancy + 1`, `Entered + 1`, Green LED flashes.
  * **Exit Simulation:** Press Button 2, then Button 1 -> `Occupancy - 1`, `Exited + 1`, Yellow LED flashes.
  * **Button 3 (Grey):** Reset tallies to 0 (`PIN 22`).

* **Aircraft Parking (`aircraft-parking`, `AIRCRAFT-PARK-001`)**:
  * **Front Potentiometer (GPIO 34):** Front distance 0..400 cm — turn down to fly the stand through EMPTY → DETECTED → APPROACHING → ALIGNMENT → PARKED.
  * **Side Potentiometer (GPIO 35):** Lateral distance simulator.
  * **Button 1 (Blue, 19):** Aircraft arrival. **Button 2 (Yellow, 21):** Departure. **Button 3 (Grey, 23):** Reset.
  * Turn FRONT pot to minimum for UNSAFE/WARNING (red LED + buzzer).

* **Smart Charging (`smart-charging`, `CHARGER-001`)** — LOW-VOLTAGE SIMULATION ONLY:
  * **Button 1 (Blue, 19):** Connect/disconnect vehicle. **Button 2 (Green, 21):** Start/stop charging.
  * **Button 3 (Red, 25):** EMERGENCY STOP (latching). **Button 4 (Grey, 23):** Reset.
  * **Pots (34/35/32):** Voltage / current-demand / temperature simulators. Raise temperature for warning → cutout.

* **Equipment Monitoring (`equipment-monitoring`, `EQUIPMENT-001`)**:
  * **Button 1 (Green, 19):** Start/stop conveyor. **Button 2 (Yellow, 21):** Maintenance. **Button 3 (Grey, 23):** Reset.
  * **Pots (34/35/32):** Temperature / vibration / current simulators. Raise vibration for WARNING, add heat for CRITICAL.

* **Security Area (`security-area`, `SECURITY-001`)**:
  * **Button 1 (Blue, 19):** Person detected. **Button 2 (Green, 21):** Valid card. **Button 3 (Red, 22):** Invalid card.
  * **Button 4 (Red, 25):** EMERGENCY lockdown. **Button 5 (Grey, 23):** Reset.
  * **Servo:** Gate opens 90° on grant, forced 0° on emergency/lock.

* **Smart Baggage (`smart-baggage`, `BAGGAGE-001`)**:
  * **Button 1 (Blue, 19):** Tag detected. **Button 2 (Green, 21):** Sort OK.
  * **Button 3 (Red, 22):** Divert. **Button 4 (Grey, 23):** Reset.
  * **Servo:** Diverter 0° main line, 90° divert.

* **Emergency Detection (`emergency-detection`, `EMERG-001`)**:
  * **Button 1 (Red, 19):** TRIGGER. **Button 2 (Yellow, 21):** Silence siren.
  * **Button 3 (Red, 22):** Lockdown. **Button 4 (Grey, 23):** Reset.

* **Fire / Smoke (`fire-smoke`, `FIRE-001`)**:
  * **Pots (34/35):** Smoke 0..1000 ppm / temperature 20..90 °C simulators.
  * **Button 1 (Yellow, 19):** Test alarm. **Button 2 (Blue, 21):** Silence. **Button 3 (Grey, 23):** Reset.

* **Environment (`environment`, `ENV-001`)**:
  * **Pots (34/35/32):** Temperature / humidity / CO2 simulators.
  * **Button 1 (Blue, 19):** Fan override cycle (AUTO→ON→OFF). **Button 2 (Grey, 23):** Reset to AUTO.

* **Smart Elevator (`smart-elevator`, `ELEV-001`)** — SIMULATION ONLY:
  * **Button 1 (Blue, 19):** Call up. **Button 2 (Blue, 21):** Call down.
  * **Button 3 (Yellow, 22):** Overload toggle. **Button 4 (Red, 25):** E-STOP. **Button 5 (Grey, 23):** Reset.
  * **Servo:** Door 90° open, 0° closed.

---

## 6. MQTT Topics & JSON Payloads

All topics follow the standard pattern: `airport/{module}/{device_id}/{event}`

### Key Gate Topics (`GATE-001`)
* Telemetry: `airport/gate/GATE-001/status`
* Passenger: `airport/gate/GATE-001/passenger`
* Access: `airport/gate/GATE-001/access`
* Events: `airport/gate/GATE-001/event`
* Commands: `airport/gate/GATE-001/command`

### Key Passenger Counter Topics (`COUNTER-001`)
* Status: `airport/passenger-counter/COUNTER-001/status`
* Occupancy: `airport/passenger-counter/COUNTER-001/occupancy`
* Events: `airport/passenger-counter/COUNTER-001/event`
* Commands: `airport/passenger-counter/COUNTER-001/command`

### Key Aircraft Parking Topics (`AIRCRAFT-PARK-001`)
* Status: `airport/aircraft-parking/AIRCRAFT-PARK-001/status`
* Telemetry: `airport/aircraft-parking/AIRCRAFT-PARK-001/telemetry`
* Events: `airport/aircraft-parking/AIRCRAFT-PARK-001/event`
* Commands: `airport/aircraft-parking/AIRCRAFT-PARK-001/command`

### Key Charging Station Topics (`CHARGER-001`)
* Status: `airport/charging/CHARGER-001/status`
* Telemetry: `airport/charging/CHARGER-001/telemetry`
* Events: `airport/charging/CHARGER-001/event`
* Commands: `airport/charging/CHARGER-001/command`

### Key Equipment Topics (`EQUIPMENT-001`)
* Status: `airport/equipment/EQUIPMENT-001/status`
* Telemetry: `airport/equipment/EQUIPMENT-001/telemetry`
* Events: `airport/equipment/EQUIPMENT-001/event`
* Commands: `airport/equipment/EQUIPMENT-001/command`

### Key Security Area Topics (`SECURITY-001`)
* Status: `airport/security/SECURITY-001/status`
* Events: `airport/security/SECURITY-001/event`
* Access: `airport/security/SECURITY-001/access`
* Commands: `airport/security/SECURITY-001/command`

### Key Baggage Topics (`BAGGAGE-001`)
* Status: `airport/baggage/BAGGAGE-001/status`
* Tag decisions: `airport/baggage/BAGGAGE-001/telemetry`
* Events: `airport/baggage/BAGGAGE-001/event`
* Commands: `airport/baggage/BAGGAGE-001/command`

### Key Emergency Topics (`EMERG-001`)
* Status: `airport/emergency/EMERG-001/status`
* Events: `airport/emergency/EMERG-001/event`
* Commands: `airport/emergency/EMERG-001/command`

### Key Fire/Smoke Topics (`FIRE-001`)
* Status: `airport/fire-smoke/FIRE-001/status`
* Telemetry: `airport/fire-smoke/FIRE-001/telemetry`
* Events: `airport/fire-smoke/FIRE-001/event`
* Commands: `airport/fire-smoke/FIRE-001/command`

### Key Environment Topics (`ENV-001`)
* Status: `airport/environment/ENV-001/status`
* Telemetry: `airport/environment/ENV-001/telemetry`
* Events: `airport/environment/ENV-001/event`
* Commands: `airport/environment/ENV-001/command`

### Key Elevator Topics (`ELEV-001`)
* Status: `airport/elevator/ELEV-001/status`
* Events: `airport/elevator/ELEV-001/event`
* Commands: `airport/elevator/ELEV-001/command`

### Device Heartbeats
* `airport/device/{device_id}/heartbeat` (e.g. `airport/device/GATE-001/heartbeat`, `airport/device/COUNTER-001/heartbeat`, `airport/device/AIRCRAFT-PARK-001/heartbeat`, `airport/device/CHARGER-001/heartbeat`, `airport/device/EQUIPMENT-001/heartbeat`, `airport/device/SECURITY-001/heartbeat`, `airport/device/BAGGAGE-001/heartbeat`, `airport/device/EMERG-001/heartbeat`, `airport/device/FIRE-001/heartbeat`, `airport/device/ENV-001/heartbeat`, `airport/device/ELEV-001/heartbeat`)

---

## 7. MQTT Testing & Commands

### 1. Monitor All Topics
```bash
mosquitto_sub -h broker.hivemq.com -t 'airport/#' -v
```

### 2. Send Commands to Smart Gate
```bash
# Remotely open gate
mosquitto_pub -h broker.hivemq.com -t 'airport/gate/GATE-001/command' -m '{"command":"OPEN"}'

# Security lockdown
mosquitto_pub -h broker.hivemq.com -t 'airport/gate/GATE-001/command' -m '{"command":"LOCK"}'

# Security unlock
mosquitto_pub -h broker.hivemq.com -t 'airport/gate/GATE-001/command' -m '{"command":"UNLOCK"}'
```

### 3. Send Commands to Passenger Counter
```bash
# Reset counter to zero
mosquitto_pub -h broker.hivemq.com -t 'airport/passenger-counter/COUNTER-001/command' -m '{"command":"RESET"}'

# Set occupancy count
mosquitto_pub -h broker.hivemq.com -t 'airport/passenger-counter/COUNTER-001/command' -m '{"command":"SET_OCCUPANCY","occupancy":85}'
```

### 3. Send Commands to New Modules
```bash
# Parking: scripted approach demo + arrival/departure
mosquitto_pub -h broker.hivemq.com -t 'airport/aircraft-parking/AIRCRAFT-PARK-001/command' -m '{"command":"START_SIMULATION"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/aircraft-parking/AIRCRAFT-PARK-001/command' -m '{"command":"AIRCRAFT_DEPARTURE"}'

# Charging: connect + start (LOW-VOLTAGE SIMULATION ONLY)
mosquitto_pub -h broker.hivemq.com -t 'airport/charging/CHARGER-001/command' -m '{"command":"CONNECT_VEHICLE"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/charging/CHARGER-001/command' -m '{"command":"START_CHARGING"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/charging/CHARGER-001/command' -m '{"command":"EMERGENCY_STOP"}'

# Equipment: start conveyor, request maintenance flow
mosquitto_pub -h broker.hivemq.com -t 'airport/equipment/EQUIPMENT-001/command' -m '{"command":"START"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/equipment/EQUIPMENT-001/command' -m '{"command":"MAINTENANCE"}'

# Security: backend authorization verdict + lockdown
mosquitto_pub -h broker.hivemq.com -t 'airport/security/SECURITY-001/command' -m '{"command":"AUTHORIZE","card_uid":"SEC-CARD-77","authorized":true}'
mosquitto_pub -h broker.hivemq.com -t 'airport/security/SECURITY-001/command' -m '{"command":"LOCK"}'

# Baggage: backend sort decision
mosquitto_pub -h broker.hivemq.com -t 'airport/baggage/BAGGAGE-001/command' -m '{"command":"TAG_DETECT","tag_uid":"BAG-TAG-001"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/baggage/BAGGAGE-001/command' -m '{"command":"SORT","tag_uid":"BAG-TAG-001"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/baggage/BAGGAGE-001/command' -m '{"command":"DIVERT","tag_uid":"BAG-TAG-001","reason":"MISROUTED"}'

# Emergency: trigger / evacuate / silence
mosquitto_pub -h broker.hivemq.com -t 'airport/emergency/EMERG-001/command' -m '{"command":"TRIGGER","details":"BACKEND_TRIGGER"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/emergency/EMERG-001/command' -m '{"command":"EVACUATE"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/emergency/EMERG-001/command' -m '{"command":"SILENCE"}'

# Fire/smoke: test + silence
mosquitto_pub -h broker.hivemq.com -t 'airport/fire-smoke/FIRE-001/command' -m '{"command":"TEST_ALARM"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/fire-smoke/FIRE-001/command' -m '{"command":"SILENCE"}'

# Environment: fan control
mosquitto_pub -h broker.hivemq.com -t 'airport/environment/ENV-001/command' -m '{"command":"FAN_ON"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/environment/ENV-001/command' -m '{"command":"FAN_AUTO"}'

# Elevator: call + door + e-stop
mosquitto_pub -h broker.hivemq.com -t 'airport/elevator/ELEV-001/command' -m '{"command":"CALL_UP"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/elevator/ELEV-001/command' -m '{"command":"OPEN_DOOR"}'
mosquitto_pub -h broker.hivemq.com -t 'airport/elevator/ELEV-001/command' -m '{"command":"EMERGENCY_STOP"}'
```

### 4. Interactive Test Script
```bash
./scripts/mqtt_test.sh
```

### 5. Automated Validation Script
```bash
./scripts/test_devices.sh
```

---

## 8. Scaling to Future Modules

All 11 planned modules are implemented. To add a 12th module (e.g. apron `ground-iot` aggregation):

1. Create directory `modules/<module-name>/`.
2. Add `platformio.ini` referencing `-I ../../common`.
3. Use module constants from `common/mqtt_topics.h` (`MODULE_GROUND_IOT`, etc.).
4. Inherit network configuration from `common/device_config.h`.
5. Adopt the finite state machine pattern and decoupled `MqttManager` design demonstrated in Gate and Counter modules.
