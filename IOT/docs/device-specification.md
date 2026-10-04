# Airport IoT Device Hardware & Simulation Specifications

## 1. Smart Airport Gate (`modules/smart-airport-gate`)

### 1.1 Microcontroller & Core Specifications
* **MCU:** ESP32 (Espressif ESP32-WROOM-32 / DevKit v1 / DevKit C v4)
* **Core Frequency:** 240 MHz (Dual Core Xtensa LX6)
* **Flash:** 4MB
* **Connectivity:** 2.4 GHz 802.11 b/g/n Wi-Fi

### 1.2 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Electrical Specification / Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 18` | Servo Motor | PWM Output | `wokwi-servo` (50 Hz, 500-2400 μs) | Gate Barrier Actuator (0° Closed, 90° Open) |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` (with 220Ω resistor) | Access Granted / Gate Open indicator |
| `GPIO 4` | Red LED | Digital Output | `wokwi-led` (with 220Ω resistor) | Access Denied / Locked / Closed indicator |
| `GPIO 5` | Buzzer | Digital Output | `wokwi-buzzer` | Audio feedback & security alarm siren |
| `GPIO 19` | Passenger Sensor | Digital Input (Pullup) | `wokwi-pushbutton` / PIR | Simulates passenger presence at gate |
| `GPIO 21` | Valid Card Trigger | Digital Input (Pullup) | `wokwi-pushbutton` | Simulates scanning a valid boarding pass |
| `GPIO 22` | Denied Card Trigger| Digital Input (Pullup) | `wokwi-pushbutton` | Simulates scanning an invalid / blacklisted card |
| `GPIO 23` | Manual Reset | Digital Input (Pullup) | `wokwi-pushbutton` | Hardware emergency reset / recovery button |

---

## 2. Smart Passenger Counter (`modules/passenger-counter`)

### 2.1 Microcontroller & Core Specifications
* **MCU:** ESP32 (Espressif ESP32-WROOM-32)
* **Connectivity:** Wi-Fi (MQTT Telemetry Client)

### 2.2 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Electrical Specification / Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 19` | Sensor A (Outer) | Digital Input (Pullup) | `wokwi-pushbutton` / IR Beam | Outer boundary tripwire |
| `GPIO 21` | Sensor B (Inner) | Digital Input (Pullup) | `wokwi-pushbutton` / IR Beam | Inner boundary tripwire |
| `GPIO 22` | Reset Button | Digital Input (Pullup) | `wokwi-pushbutton` | Clears tallies to 0 |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` (with 220Ω resistor) | Pulses on confirmed passenger Entry |
| `GPIO 4` | Yellow LED | Digital Output | `wokwi-led` (with 220Ω resistor) | Pulses on confirmed passenger Exit |
| `GPIO 5` | Red / Status LED | Digital Output | `wokwi-led` (with 220Ω resistor) | System Online / Normal operation indicator |
| `GPIO 18` | Buzzer | Digital Output | `wokwi-buzzer` | Short acoustic click on count update |

---

## 3. Aircraft Parking / Ground IoT (`modules/aircraft-parking`, `AIRCRAFT-PARK-001`)

### 3.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 34` | Front proximity sim | Analog Input | `wokwi-potentiometer` | Front distance 0..400 cm (stands in for HC-SR04 front) |
| `GPIO 35` | Side proximity sim | Analog Input | `wokwi-potentiometer` | Lateral distance 0..400 cm (stands in for HC-SR04 side) |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | PARKED indicator |
| `GPIO 4` | Yellow LED | Digital Output | `wokwi-led` + 220Ω | Approaching / alignment indicator |
| `GPIO 5` | Red LED | Digital Output | `wokwi-led` + 220Ω | Unsafe / warning indicator |
| `GPIO 18` | Buzzer | Digital Output | `wokwi-buzzer` | Unsafe-distance warning |
| `GPIO 22` | Servo | PWM Output | `wokwi-servo` | Stand position indicator |
| `GPIO 19` | Arrival button | Digital Input (Pullup) | `wokwi-pushbutton` | Simulate aircraft arrival |
| `GPIO 21` | Departure button | Digital Input (Pullup) | `wokwi-pushbutton` | Simulate aircraft departure |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Reset stand to empty |

---

## 4. Smart Charging Station (`modules/smart-charging`, `CHARGER-001`)

> LOW-VOLTAGE SIMULATION ONLY.

### 4.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 34` | Voltage sim | Analog Input | `wokwi-potentiometer` | Simulated DC bus 360..440 V |
| `GPIO 35` | Current demand sim | Analog Input | `wokwi-potentiometer` | Simulated demand 0..125 A |
| `GPIO 32` | Temperature sim | Analog Input | `wokwi-potentiometer` | Simulated connector temp 20..80 °C |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | Available / charge complete |
| `GPIO 4` | Yellow LED | Digital Output | `wokwi-led` + 220Ω | Charging in progress |
| `GPIO 5` | Red LED | Digital Output | `wokwi-led` + 220Ω | Fault / alarm |
| `GPIO 18` | Relay module | Digital Output | `wokwi-relay-module` | Contactor simulator |
| `GPIO 13` | Buzzer | Digital Output | `wokwi-buzzer` | Alarm buzzer |
| `GPIO 19` | Connect button | Digital Input (Pullup) | `wokwi-pushbutton` | Connect/disconnect vehicle |
| `GPIO 21` | Start button | Digital Input (Pullup) | `wokwi-pushbutton` | Start/stop charging |
| `GPIO 25` | E-STOP button | Digital Input (Pullup) | `wokwi-pushbutton` | Emergency stop (latching) |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Reset station |

---

## 5. Airport Equipment Monitoring (`modules/equipment-monitoring`, `EQUIPMENT-001`)

Representative machine: CONVEYOR MOTOR.

### 5.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 34` | Temperature sim | Analog Input | `wokwi-potentiometer` | Simulated temp 20..110 °C |
| `GPIO 35` | Vibration sim | Analog Input | `wokwi-potentiometer` | Simulated vibration 0..10 mm/s |
| `GPIO 32` | Current sim | Analog Input | `wokwi-potentiometer` | Simulated current 0..20 A |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | Equipment running |
| `GPIO 4` | Yellow LED | Digital Output | `wokwi-led` + 220Ω | Warning condition |
| `GPIO 5` | Red LED | Digital Output | `wokwi-led` + 220Ω | Critical condition |
| `GPIO 18` | Buzzer | Digital Output | `wokwi-buzzer` | Critical alarm |
| `GPIO 19` | Run button | Digital Input (Pullup) | `wokwi-pushbutton` | Start/stop equipment |
| `GPIO 21` | Maintenance button | Digital Input (Pullup) | `wokwi-pushbutton` | Maintenance ack/clear |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Reset faults + runtime |

---

## 6. Security Area IoT (`modules/security-area`, `SECURITY-001`)

### 6.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 18` | Servo | PWM Output | `wokwi-servo` | Security gate (0° closed, 90° open) |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | Access granted / gate open |
| `GPIO 4` | Red LED | Digital Output | `wokwi-led` + 220Ω | Denied / alarm / locked |
| `GPIO 5` | Buzzer | Digital Output | `wokwi-buzzer` | Denied beep / alarm siren |
| `GPIO 19` | Person sensor | Digital Input (Pullup) | `wokwi-pushbutton` | Presence detection |
| `GPIO 21` | Valid card | Digital Input (Pullup) | `wokwi-pushbutton` | Simulated valid access card |
| `GPIO 22` | Invalid card | Digital Input (Pullup) | `wokwi-pushbutton` | Simulated denied card |
| `GPIO 25` | Emergency button | Digital Input (Pullup) | `wokwi-pushbutton` | Emergency lockdown |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Manual reset |

---

## 7. Smart Baggage (`modules/smart-baggage`, `BAGGAGE-001`)

### 7.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 18` | Diverter servo | PWM Output | `wokwi-servo` | Diverter gate (0° main line, 90° divert) |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | Sorted indicator |
| `GPIO 4` | Red LED | Digital Output | `wokwi-led` + 220Ω | Diverted / alarm / locked |
| `GPIO 5` | Buzzer | Digital Output | `wokwi-buzzer` | Divert beep |
| `GPIO 19` | Tag sensor | Digital Input (Pullup) | `wokwi-pushbutton` | Simulated tag induction |
| `GPIO 21` | Sort OK | Digital Input (Pullup) | `wokwi-pushbutton` | Simulated valid sort decision |
| `GPIO 22` | Divert | Digital Input (Pullup) | `wokwi-pushbutton` | Simulated divert / lost tag |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Manual reset |

---

## 8. Emergency Detection (`modules/emergency-detection`, `EMERG-001`)

### 8.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | Normal operation |
| `GPIO 4` | Red LED | Digital Output | `wokwi-led` + 220Ω | Alarm / evacuation / lockdown |
| `GPIO 18` | Beacon LED | Digital Output | `wokwi-led` + 220Ω | Strobe beacon |
| `GPIO 5` | Buzzer | Digital Output | `wokwi-buzzer` | Siren |
| `GPIO 19` | Trigger button | Digital Input (Pullup) | `wokwi-pushbutton` | Emergency trigger |
| `GPIO 21` | Silence button | Digital Input (Pullup) | `wokwi-pushbutton` | Silence siren (beacon stays on) |
| `GPIO 22` | Lockdown button | Digital Input (Pullup) | `wokwi-pushbutton` | Lockdown trigger |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Manual reset |

---

## 9. Fire / Smoke Monitoring (`modules/fire-smoke`, `FIRE-001`)

### 9.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 34` | Smoke sim | Analog Input | `wokwi-potentiometer` | Simulated smoke 0..1000 ppm |
| `GPIO 35` | Temperature sim | Analog Input | `wokwi-potentiometer` | Simulated temp 20..90 °C |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | Air clear |
| `GPIO 4` | Yellow LED | Digital Output | `wokwi-led` + 220Ω | Warning |
| `GPIO 5` | Red LED | Digital Output | `wokwi-led` + 220Ω | Critical / alarm |
| `GPIO 18` | Buzzer | Digital Output | `wokwi-buzzer` | Siren |
| `GPIO 19` | Test button | Digital Input (Pullup) | `wokwi-pushbutton` | Test alarm |
| `GPIO 21` | Silence button | Digital Input (Pullup) | `wokwi-pushbutton` | Silence siren |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Reset latched alarm |

---

## 10. Smart Environment (`modules/environment`, `ENV-001`)

### 10.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 34` | Temperature sim | Analog Input | `wokwi-potentiometer` | Simulated temp 10..45 °C |
| `GPIO 35` | Humidity sim | Analog Input | `wokwi-potentiometer` | Simulated humidity 0..100 %RH |
| `GPIO 32` | CO2 sim | Analog Input | `wokwi-potentiometer` | Simulated CO2 400..2000 ppm |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | Comfort OK |
| `GPIO 4` | Yellow LED | Digital Output | `wokwi-led` + 220Ω | Comfort warning |
| `GPIO 5` | Red LED | Digital Output | `wokwi-led` + 220Ω | Poor air quality |
| `GPIO 18` | Fan relay | Digital Output | `wokwi-relay-module` | Ventilation fan |
| `GPIO 19` | Fan button | Digital Input (Pullup) | `wokwi-pushbutton` | Fan override cycle |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Reset to AUTO |

---

## 11. Smart Elevator (`modules/smart-elevator`, `ELEV-001`)

> Simulation only — NOT a real lift controller.

### 11.1 Pinout & Component Allocation
| Pin / GPIO | Component | Type | Wokwi Part | Function |
|---|---|---|---|---|
| `GPIO 18` | Door servo | PWM Output | `wokwi-servo` | Cabin door (0° closed, 90° open) |
| `GPIO 2` | Green LED | Digital Output | `wokwi-led` + 220Ω | Door open / ready |
| `GPIO 4` | Red LED | Digital Output | `wokwi-led` + 220Ω | Moving / overload / emergency |
| `GPIO 5` | Buzzer | Digital Output | `wokwi-buzzer` | Overload / emergency alarm |
| `GPIO 19` | Call up | Digital Input (Pullup) | `wokwi-pushbutton` | Call / send cabin up |
| `GPIO 21` | Call down | Digital Input (Pullup) | `wokwi-pushbutton` | Call / send cabin down |
| `GPIO 22` | Overload | Digital Input (Pullup) | `wokwi-pushbutton` | Overload sensor toggle |
| `GPIO 25` | E-STOP | Digital Input (Pullup) | `wokwi-pushbutton` | Emergency stop (latching) |
| `GPIO 23` | Reset button | Digital Input (Pullup) | `wokwi-pushbutton` | Manual reset |

---

## 12. Electrical Schematics & Simulation Files

All modules include ready-to-run Wokwi simulation definitions:
* Gate: `modules/smart-airport-gate/diagram.json` and `wokwi.toml`
* Counter: `modules/passenger-counter/diagram.json` and `wokwi.toml`
* Aircraft Parking: `modules/aircraft-parking/diagram.json` and `wokwi.toml`
* Smart Charging: `modules/smart-charging/diagram.json` and `wokwi.toml`
* Equipment Monitoring: `modules/equipment-monitoring/diagram.json` and `wokwi.toml`
* Security Area: `modules/security-area/diagram.json` and `wokwi.toml`
* Smart Baggage: `modules/smart-baggage/diagram.json` and `wokwi.toml`
* Emergency Detection: `modules/emergency-detection/diagram.json` and `wokwi.toml`
* Fire/Smoke: `modules/fire-smoke/diagram.json` and `wokwi.toml`
* Environment: `modules/environment/diagram.json` and `wokwi.toml`
* Smart Elevator: `modules/smart-elevator/diagram.json` and `wokwi.toml`
