"""MQTT bridge worker entrypoint.

Runs the IoTMqttBridge as a dedicated long-running process (used by the
``mqtt-bridge`` compose service). The backend API itself does not open an
MQTT socket; commands and acks are coordinated through the shared database
(iotcommandlog / iottelemetrylog) so there is no duplicate service
initialization between the API and the bridge.
"""
from __future__ import annotations

import time

from app.agents.service import agent_service
from app.agents.iot_bridge import IoTMqttBridge
from app.config import settings


def main() -> None:
    agent_service.init(
        face_service_url=settings.FACE_RECO_URL,
        baggage_backend_url="http://localhost:8000/api/v1/ai/baggage/analyze",
        btd_inference_url=settings.BTD_INFERENCE_URL,
        smoke_fire_url=settings.SMOKE_FIRE_URL,
        fall_detection_url=settings.FULL_DETECTION_URL,
        twin_base_url=settings.TWIN_BASE_URL,
        twin_auth_token=settings.TWIN_AUTH_TOKEN,
    )

    bridge = IoTMqttBridge(
        registry=agent_service.get_registry(),
        event_system=agent_service.get_event_system(),
        twin_publisher=agent_service.get_twin_publisher(),
    )
    bridge.start()
    print(
        f"MQTT bridge running (broker={settings.MQTT_BROKER}:{settings.MQTT_PORT}, "
        f"filter={settings.MQTT_TOPIC_FILTER}). Ctrl+C to stop."
    )
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:  # noqa: BLE001
        pass
    finally:
        bridge.stop()


if __name__ == "__main__":
    main()
