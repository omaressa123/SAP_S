"""MQTT -> FastAPI/PostgreSQL bridge for IoT modules.

Subscribes to ``airport/#`` (topic convention: airport/{module}/{device_id}/{event})
and persists meaningful events:
  - heartbeat/telemetry -> equipment last_health_check + equipment_health_check
  - fire/smoke/emergency   -> emergency_event + monitoring_alert
Run:  python -m app.services.mqtt_consumer
"""
import json
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
except ImportError:  # optional dependency for dev machines
    mqtt = None

# Single configuration source: app/config.py <- .env. No os.getenv defaults here.
from ..config import settings
from ..database import SessionLocal
from ..models import devices as m_devices
from ..models import admin_cameras as m_admin

BROKER = settings.MQTT_BROKER
PORT = settings.MQTT_PORT
FILTER = settings.MQTT_TOPIC_FILTER


def _handle(topic: str, payload: bytes):
    parts = topic.split("/")
    # airport/{module}/{device_id}/{suffix...}
    module = parts[1] if len(parts) > 1 else "unknown"
    device_id = parts[2] if len(parts) > 2 else "unknown"
    suffix = "/".join(parts[3:]) if len(parts) > 3 else "event"
    try:
        data = json.loads(payload.decode() or "{}")
    except Exception:
        data = {"raw": payload.decode(errors="ignore")[:500]}

    db = SessionLocal()
    try:
        equip = db.query(m_devices.Equipment).filter(
            m_devices.Equipment.serial_number == device_id).first()
        if equip is None:
            equip = m_devices.Equipment(
                equipment_type="camera", label=f"{module}/{device_id}",
                serial_number=device_id, status="operational",
                last_health_check=datetime.utcnow(),
            )
            db.add(equip)
            db.commit()
            db.refresh(equip)
        equip.last_health_check = datetime.utcnow()
        db.add(m_devices.EquipmentHealthCheck(
            equipment_id=equip.equipment_id, check_time=datetime.utcnow(),
            metric_type="network_latency", value=0,
            status_result="ok" if "error" not in suffix else "warning",
        ))
        etype = str(data.get("event_type", suffix)).lower()
        if any(k in (etype + suffix).lower() for k in ("fire", "smoke", "emergency", "sos", "fall")):
            ev = m_admin.EmergencyEvent(
                event_type="smoke_fire" if ("fire" in etype or "smoke" in etype) else "fall",
                status="detected", detected_time=datetime.utcnow())
            db.add(ev)
            db.commit()
            db.refresh(ev)
            db.add(m_admin.MonitoringAlert(
                behavior_type="overcrowding", severity="critical",
                status="open", linked_emergency_event_id=ev.event_id,
                timestamp=datetime.utcnow()))
        db.commit()
    finally:
        db.close()


def main():
    if mqtt is None:
        print("paho-mqtt not installed; pip install -r requirements.txt")
        return
    client = mqtt.Client()

    def on_connect(c, u, f, rc):
        print(f"MQTT connected rc={rc}, subscribing {FILTER}")
        c.subscribe(FILTER)

    def on_message(c, u, msg):
        try:
            _handle(msg.topic, msg.payload)
        except Exception as exc:
            print(f"MQTT handle error: {exc}")

    client.on_connect = on_connect
    client.on_message = on_message
    if settings.MQTT_USERNAME:
        client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
    print(f"mqtt_topic_filter = {FILTER}")
    try:
        client.connect(BROKER, PORT, 60)
    except Exception as exc:
        # Broker down (e.g. Mosquitto not running): clear error, no Settings crash.
        print(f"MQTT connection failed: broker={BROKER}:{PORT} error={exc}")
        print("Is Mosquitto running? e.g. `mosquitto -d` then retry.")
        raise SystemExit(1)
    print(f"Bridging MQTT {BROKER}:{PORT} [{FILTER}] -> PostgreSQL. Ctrl+C to stop.")
    client.loop_forever()


if __name__ == "__main__":
    main()
