# Airport IoT Integration Guide (For Software, AI & Backend Teams)

This guide provides everything the Software, AI, Database, and Web Dashboard engineering teams need to interact with the IoT layer without needing to know internal ESP32 C++ firmware details.

---

## 1. Integration Model Overview

The IoT layer communicates exclusively over **MQTT** with **JSON payloads**.

```
+-------------------+           +-----------------------+           +-------------------+
|                   |  Publishes|                       |  Delivers |                   |
|    IoT Device     | =========>| Mosquitto MQTT Broker | =========>|  Software / AI /  |
| (ESP32 Firmware)  | <=========|     (Port 1883)       | <=========|     Database      |
|                   | Subscribes|                       |  Commands |                   |
+-------------------+           +-----------------------+           +-------------------+
```

---

## 2. Topic Wildcards for Backend Ingestion

To consume all airport IoT streams, subscribe to:
* **All Airport Data:** `airport/#`
* **All Smart Gates:** `airport/gate/#`
* **All Passenger Counters:** `airport/passenger-counter/#`
* **All Aircraft Parking Stands:** `airport/aircraft-parking/#`
* **All Charging Stations:** `airport/charging/#`
* **All Equipment Monitors:** `airport/equipment/#`
* **All Security Areas:** `airport/security/#`
* **All System Heartbeats:** `airport/device/+/heartbeat`

---

## 3. Python Integration Example

Below is a complete Python script using `paho-mqtt` demonstrating how the Backend/AI service consumes events, stores telemetry, and sends commands:

```python
import json
import paho.mqtt.client as mqtt

BROKER_HOST = "localhost" # or your Mosquitto broker IP
BROKER_PORT = 1883

def on_connect(client, userdata, flags, rc):
    print(f"[Connected] MQTT Connected with result code {rc}")
    # Subscribe to all airport topics
    client.subscribe("airport/#")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = json.loads(msg.payload.decode("utf-8"))
    print(f"\n[RECEIVED] Topic: {topic}")
    print(f"           Payload: {json.dumps(payload, indent=2)}")

    # 1. Handle Passenger Authorization Request
    if "gate" in topic and payload.get("event") == "passenger_detected":
        gate_id = payload.get("device_id")
        print(f"[AI-ENGINE] Passenger detected at {gate_id}. Triggering face/pass check...")
        
        # Example: Backend verifies passenger and commands gate to open
        # client.publish(f"airport/gate/{gate_id}/command", json.dumps({"command": "OPEN"}))

    # 2. Handle Passenger Flow / Occupancy Updates
    elif "passenger-counter" in topic and "occupancy" in topic:
        counter_id = payload.get("device_id")
        occupancy = payload.get("occupancy")
        zone = payload.get("zone")
        print(f"[DATABASE] Updating zone {zone} live occupancy to {occupancy}")

# Initialize client
client = mqtt.Client(client_id="Backend-AI-Service")
client.on_connect = on_connect
client.on_message = on_message

client.connect(BROKER_HOST, BROKER_PORT, 60)
client.loop_forever()
```

---

## 4. Sending Remote Commands from Backend

To send commands to any gate or counter:

### Unlock / Open Gate:
```python
client.publish("airport/gate/GATE-001/command", json.dumps({
    "command": "OPEN"
}))
```

### Security Emergency Lockdown:
```python
client.publish("airport/gate/GATE-001/command", json.dumps({
    "command": "LOCK"
}))
```

### Reset Passenger Counter:
```python
client.publish("airport/passenger-counter/COUNTER-001/command", json.dumps({
    "command": "RESET"
}))
```

### Aircraft Parking — scripted approach demo:
```python
client.publish("airport/aircraft-parking/AIRCRAFT-PARK-001/command", json.dumps({
    "command": "START_SIMULATION"
}))
```

### Charging — connect vehicle and start charging:
```python
client.publish("airport/charging/CHARGER-001/command", json.dumps({"command": "CONNECT_VEHICLE"}))
client.publish("airport/charging/CHARGER-001/command", json.dumps({"command": "START_CHARGING"}))
# Telemetry arrives on airport/charging/CHARGER-001/telemetry with
# voltage, current, power (= V x I), temperature, charge_percent.
```

### Equipment — start conveyor and listen for warnings:
```python
client.publish("airport/equipment/EQUIPMENT-001/command", json.dumps({"command": "START"}))
# Events: temperature_warning / vibration_warning / overcurrent /
# critical_condition / maintenance_required on airport/equipment/EQUIPMENT-001/event
```

### Security — authorize a waiting person (backend/AI verdict):
```python
# 1. Device publishes authorization_requested on airport/security/SECURITY-001/event
# 2. Backend decides, then:
client.publish("airport/security/SECURITY-001/command", json.dumps({
    "command": "AUTHORIZE",
    "card_uid": "SEC-CARD-77",
    "authorized": True
}))
# 3. Device actuates the gate and reports access_granted / gate_opened.
```

---

## 5. Heartbeat & Liveness Monitoring

The backend should maintain an active device registry:
* Every device posts a heartbeat every 15 seconds to `airport/device/{device_id}/heartbeat`.
* The LWT (Last Will and Testament) topic `airport/{module}/{device_id}/status` will automatically publish `{"status": "offline"}` if an ESP32 drops off unexpectedly.
* If no heartbeat or status message is received within 45 seconds, flag device as `UNREACHABLE` on dashboard.
