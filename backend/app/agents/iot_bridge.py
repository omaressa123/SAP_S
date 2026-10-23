"""Bidirectional IoT MQTT bridge (M2.6).

Connects the agent system to field hardware (ESP32 modules) over the existing
Mosquitto broker (:1883) using the standardized topic hierarchy
``airport/{module}/{device_id}/{channel}`` (see IOT/docs/mqtt-topics.md).

Responsibilities:
  - Subscribe to device telemetry / status / event / heartbeat topics.
  - Publish validated commands to ``airport/{module}/{device_id}/command``.
  - Track every command (command_id, originating agent, timestamps, ack
    status, timeouts, retries, failures) in ``iotcommandlog``.
  - Route telemetry to SafetyAgent, MaintenanceAgent, the EventSystem and the
    Digital Twin (TwinPublisher).
  - Reconnection handling, bounded retries, duplicate-message protection, and
    health reporting.
  - Never claim a physical action succeeded without a valid acknowledgement.

Lifecycle: :meth:`start` connects and subscribes; :meth:`stop` disconnects.
The bridge runs a paho client on a background thread and reconciles pending
commands (timeouts / retries) on a tick. It can run standalone (worker) or be
embedded; the MQTT client is injectable for testing.
"""
from __future__ import annotations

import json
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.iot import IotCommandLog, IotTelemetryLog
from ..models.agents import AirportEvent as MAirportEvent
from .base import AgentInterface, AgentResult
from .registry import AgentRegistry
from .events import EventSystem, AirportEvent, EventSource, EventSeverity
from .twin_publisher import TwinPublisher
from ..config import settings


KNOWN_MODULES = {
    "gate", "passenger-counter", "baggage", "emergency", "fire-smoke",
    "environment", "elevator", "ground-iot", "aircraft-parking", "charging",
    "equipment", "security",
}

TELEMETRY_SUFFIXES = ("telemetry", "status", "event", "access", "heartbeat")

# module -> (agent capability, event type) for telemetry routing
TELEMETRY_ROUTE: Dict[str, tuple] = {
    "equipment": ("process_telemetry", "equipment_telemetry"),
    "fire-smoke": ("assess_safety", "smoke_detected"),
    "emergency": ("assess_safety", "fire_detected"),
    "security": ("assess_safety", "restricted_area"),
    "gate": ("assess_safety", "iot_telemetry"),
    "baggage": ("track_baggage", "baggage_tracking"),
    "environment": ("optimize_energy", "occupancy_update"),
    "passenger-counter": ("optimize_energy", "occupancy_update"),
    "charging": ("process_telemetry", "equipment_telemetry"),
}

DEFAULT_TIMEOUT_SECONDS = 30
MAX_RETRIES = 3
DEDUP_WINDOW = 1000  # number of recent message ids remembered
RECONNECT_DELAY = 5.0
RECONCILE_INTERVAL = 2.0


@dataclass
class BridgeHealth:
    connected: bool
    broker: str
    port: int
    pending_commands: int
    acknowledged_commands: int
    timed_out_commands: int
    last_telemetry_at: Optional[str]
    error: Optional[str] = None


class IoTMqttBridge:
    """Bidirectional MQTT bridge between agents and field IoT devices."""

    def __init__(
        self,
        registry: AgentRegistry,
        event_system: EventSystem,
        twin_publisher: Optional[TwinPublisher] = None,
        session_factory: Callable[[], Session] = SessionLocal,
        mqtt_client: Optional[Any] = None,
    ):
        self.registry = registry
        self.event_system = event_system
        self.twin_publisher = twin_publisher
        self._session_factory = session_factory
        # Real paho client is created lazily in start(); tests inject a fake.
        self._client = mqtt_client
        self._created_client = False

        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

        self._connected = False
        self._connect_error: Optional[str] = None
        self._pending: Dict[str, Dict[str, Any]] = {}  # command_id -> command state
        self._recent_messages: deque = deque(maxlen=DEDUP_WINDOW)
        self._last_telemetry_at: Optional[datetime] = None

        # Counters (DB-backed on health check)
        self._stats = {
            "published": 0,
            "acked": 0,
            "timeouts": 0,
            "failed": 0,
            "duplicates": 0,
            "malformed": 0,
        }

    # ------------------------------------------------------------------ lifecycle

    def start(self) -> None:
        """Connect to the broker, subscribe to telemetry, start the loop."""
        try:
            import paho.mqtt.client as mqtt  # type: ignore
        except ImportError as exc:  # pragma: no cover - optional dependency
            self._connected = False
            self._connect_error = "paho-mqtt not installed"
            return

        if self._client is None:
            client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
            self._client = client
            self._created_client = True

        # Always wire callbacks (works for injected/fake clients too).
        client = self._client
        client.on_connect = self._on_connect  # type: ignore[assignment]
        client.on_message = self._on_message  # type: ignore[assignment]
        client.on_disconnect = self._on_disconnect  # type: ignore[assignment]
        if settings.MQTT_USERNAME:
            client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

        try:
            self._client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
            self._client.loop_start()
            # Wait briefly for connection to surface in _on_connect.
            deadline = time.time() + 10
            while not self._connected and time.time() < deadline:
                time.sleep(0.05)
        except Exception as exc:  # noqa: BLE001
            self._connected = False
            self._connect_error = str(exc)
            return

        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop the background loop and disconnect."""
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        try:
            if self._client is not None:
                self._client.loop_stop()
                self._client.disconnect()
        except Exception:  # noqa: BLE001
            pass
        self._connected = False

    def _run(self) -> None:
        """Background tick: publish DB-pending commands and reconcile timeouts."""
        while not self._stop.wait(RECONCILE_INTERVAL):
            try:
                self._publish_db_pending()
                self._reconcile_pending()
            except Exception:  # noqa: BLE001
                pass

    def _publish_db_pending(self) -> None:
        """Publish commands persisted as pending (e.g. from the API) but not
        yet sent over MQTT. Idempotent: already-dispatched rows are skipped."""
        db = self._session_factory()
        try:
            rows = (
                db.query(IotCommandLog)
                .filter(IotCommandLog.status == "pending")
                .filter(IotCommandLog.dispatched_at == None)  # noqa: E711
                .all()
            )
            for row in rows:
                payload = json.loads(row.payload or "{}")
                published = self._mqtt_publish(row.topic, payload, qos=1)
                now = _utc_now()
                row.status = "dispatched" if published else "pending"
                row.dispatched_at = now
                row.updated_at = now
                if published:
                    self._stats["published"] += 1
                with self._lock:
                    self._pending[row.command_id] = {
                        "command_id": row.command_id,
                        "correlation_id": row.correlation_id,
                        "device_id": row.device_id,
                        "module": row.module,
                        "topic": row.topic,
                        "command": row.command,
                        "payload": payload,
                        "dispatched_by_agent": row.dispatched_by_agent,
                        "status": row.status,
                        "timeout_seconds": row.timeout_seconds,
                        "retry_count": row.retry_count,
                        "max_retries": row.max_retries,
                        "expires_at": (row.expires_at.isoformat() if row.expires_at else None),
                        "dispatched_at": now.isoformat(),
                    }
            db.commit()
        finally:
            db.close()

    # ------------------------------------------------------------------ callbacks

    def _on_connect(self, client, userdata, flags, reason_code, properties=None) -> None:
        if reason_code == 0:
            self._connected = True
            self._connect_error = None
            topics = [
                f"airport/{module}/+/{suffix}"
                for module in KNOWN_MODULES
                for suffix in TELEMETRY_SUFFIXES
            ]
            topics.append("airport/device/+/heartbeat")
            try:
                self._client.subscribe([(t, 1) for t in topics])
            except Exception:  # noqa: BLE001
                pass
        else:
            self._connected = False
            self._connect_error = f"connect refused code={reason_code}"

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None) -> None:
        self._connected = False

    def _on_message(self, client, userdata, message) -> None:
        try:
            payload_raw = message.payload or b"{}"
            try:
                payload = json.loads(payload_raw.decode("utf-8"))
            except Exception:
                payload = {"raw": payload_raw.decode(errors="ignore")[:500]}

            topic = message.topic or ""
            parts = topic.split("/")
            # airport/{module}/{device_id}/{suffix}
            module = parts[1] if len(parts) > 1 else "unknown"
            device_id = parts[2] if len(parts) > 2 else "unknown"
            suffix = "/".join(parts[3:]) if len(parts) > 3 else "event"

            self._handle_incoming(module, device_id, suffix, payload)
        except Exception:  # noqa: BLE001
            self._stats["failed"] += 1

    # ------------------------------------------------------------------ command dispatch

    def publish_command(
        self,
        *,
        device_id: str,
        module: str,
        command: str,
        payload: Optional[Dict[str, Any]] = None,
        agent_id: str,
        correlation_id: Optional[str] = None,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    ) -> str:
        """Publish a validated command and track it awaiting acknowledgement.

        Returns the command id. The command is persisted as pending before it
        is published so a restart cannot lose it; it is marked dispatched once
        the MQTT publish succeeds and acknowledged only on a valid device ack.
        """
        if module not in KNOWN_MODULES:
            raise ValueError(f"Unknown module '{module}'")
        command_id = f"cmd_{uuid.uuid4().hex[:12]}"
        full_payload = {"command_id": command_id, "command": command, "timestamp": _utc_now().isoformat()}
        if payload:
            full_payload.update(payload)
        topic = f"airport/{module}/{device_id}/command"

        now = _utc_now()
        state = {
            "command_id": command_id,
            "correlation_id": correlation_id,
            "device_id": device_id,
            "module": module,
            "topic": topic,
            "command": command,
            "payload": full_payload,
            "dispatched_by_agent": agent_id,
            "status": "pending",
            "timeout_seconds": timeout_seconds,
            "retry_count": 0,
            "max_retries": MAX_RETRIES,
            "expires_at": now + timedelta(seconds=timeout_seconds),
            "dispatched_at": None,
            "acknowledged_at": None,
        }
        self._persist_command(state)
        with self._lock:
            self._pending[command_id] = dict(state)

        # Publish to MQTT (best-effort; a restart will re-publish pending).
        published = self._mqtt_publish(topic, full_payload, qos=1)
        with self._lock:
            st = self._pending.get(command_id, {})
            st["dispatched_at"] = _utc_now().isoformat()
            st["status"] = "dispatched" if published else "pending"
            self._pending[command_id] = st
            self._persist_command(st)
        if published:
            self._stats["published"] += 1
        else:
            self._stats["failed"] += 1
        return command_id

    def _mqtt_publish(self, topic: str, payload: Dict[str, Any], qos: int = 1) -> bool:
        try:
            if self._client is None:
                return False
            result = self._client.publish(topic, json.dumps(payload), qos=qos, retain=False)
            # paho v2 returns (mid, reason_code); v1 returns (mid, rc)
            rc = result[1] if isinstance(result, tuple) else getattr(result, "rc", 1)
            return rc == 0
        except Exception:  # noqa: BLE001
            return False

    # ------------------------------------------------------------------ incoming telemetry / acks

    def _handle_incoming(self, module: str, device_id: str, suffix: str, payload: Dict[str, Any]) -> None:
        message_id = payload.get("message_id") or payload.get("command_id") or f"{device_id}:{suffix}:{payload.get('timestamp')}"

        with self._lock:
            if message_id in self._recent_messages:
                self._stats["duplicates"] += 1
                return
            self._recent_messages.append(message_id)

        # Validate module / device.
        if module not in KNOWN_MODULES and not module.startswith("device"):
            self._stats["malformed"] += 1
            return

        self._persist_telemetry(device_id, module, suffix, payload, message_id)
        self._last_telemetry_at = _utc_now()

        # If this is a command acknowledgement, resolve the tracked command.
        command_id = payload.get("command_id") or payload.get("ack_id")
        if command_id:
            self._resolve_ack(command_id, payload, suffix)
            return

        # Otherwise it is telemetry: route to agents + event + twin.
        self._route_telemetry(module, device_id, suffix, payload)

    def _resolve_ack(self, command_id: str, payload: Dict[str, Any], suffix: str) -> None:
        ack_ok = str(payload.get("ack", "")).lower() in ("true", "1", "yes") or payload.get("status") in (
            "acknowledged", "completed", "opened", "closed", "locked", "unlocked",
        )
        with self._lock:
            state = self._pending.get(command_id)
        if state is None:
            # Ack for an unknown/already-resolved command: ignore (idempotent).
            return
        db = self._session_factory()
        try:
            row = db.query(IotCommandLog).filter(IotCommandLog.command_id == command_id).first()
            if row is None:
                return
            if row.ack_received:
                # Duplicate ack for an already-acknowledged command: ignore.
                return
            row.ack_received = bool(ack_ok)
            row.ack_payload = json.dumps(payload)
            row.acknowledged_at = _utc_now()
            if row.dispatched_at:
                try:
                    start = datetime.fromisoformat(row.dispatched_at)
                    row.ack_latency_ms = int((_utc_now() - start).total_seconds() * 1000)
                except Exception:
                    pass
            row.status = "acknowledged" if ack_ok else "failed"
            row.error_message = None if ack_ok else "negative acknowledgement"
            row.updated_at = _utc_now()
            db.commit()
        finally:
            db.close()
        with self._lock:
            self._pending.pop(command_id, None)
            self._stats["acked" if ack_ok else "failed"] += 1
        # Publish an event so the ack is observable.
        try:
            event = AirportEvent.create(
                event_type=f"iot.command.{'acked' if ack_ok else 'nacked'}",
                source="iot_bridge",
                source_id=state["device_id"],
                correlation_id=state.get("correlation_id"),
                payload={
                    "command_id": command_id,
                    "device_id": state["device_id"],
                    "module": state["module"],
                    "command": state["command"],
                    "acked": ack_ok,
                    "ack_payload": payload,
                },
                severity=EventSeverity.INFO.value if ack_ok else EventSeverity.HIGH.value,
            )
            self.event_system.publish(event)
        except Exception:  # noqa: BLE001
            pass

    def _reconcile_pending(self) -> None:
        """Mark timed-out commands and retry bounded retries."""
        now = _utc_now()
        with self._lock:
            pending = list(self._pending.values())
        for state in pending:
            try:
                expires_at = state.get("expires_at")
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
            except Exception:
                expires_at = now
            if expires_at and now > expires_at:
                command_id = state["command_id"]
                retry_count = state.get("retry_count", 0)
                max_retries = state.get("max_retries", MAX_RETRIES)
                db = self._session_factory()
                try:
                    row = db.query(IotCommandLog).filter(IotCommandLog.command_id == command_id).first()
                    if row is None:
                        continue
                    if row.ack_received:
                        continue
                    if retry_count < max_retries:
                        # Republish once (bounded retry), same command id.
                        row.retry_count = retry_count + 1
                        row.error_message = "command timeout, retrying"
                        row.updated_at = _utc_now()
                        db.commit()
                        with self._lock:
                            st = self._pending.get(command_id, {})
                            st["retry_count"] = retry_count + 1
                            st["expires_at"] = _utc_now() + timedelta(seconds=row.timeout_seconds)
                            self._pending[command_id] = st
                        self._mqtt_publish(state["topic"], state["payload"], qos=1)
                        with self._lock:
                            st2 = self._pending.get(command_id, {})
                            st2["dispatched_at"] = _utc_now().isoformat()
                            self._pending[command_id] = st2
                        self._stats["published"] += 1
                        continue
                    # Exhausted retries -> terminal timeout, never claim success.
                    row.status = "timeout"
                    row.error_message = "command timed out waiting for acknowledgement"
                    row.updated_at = _utc_now()
                    db.commit()
                    with self._lock:
                        self._pending.pop(command_id, None)
                        self._stats["timeouts"] += 1
                finally:
                    db.close()

    # ------------------------------------------------------------------ telemetry routing

    def _route_telemetry(self, module: str, device_id: str, suffix: str, payload: Dict[str, Any]) -> None:
        routed: List[str] = []

        # Persist to event system (observability; agents subscribe there).
        event_type = f"iot.{suffix}"
        event = AirportEvent.create(
            event_type=event_type,
            source="iot_device",
            source_id=device_id,
            payload={
                "module": module,
                "device_id": device_id,
                "suffix": suffix,
                "data": payload,
            },
            severity=EventSeverity.INFO.value,
        )
        try:
            self.event_system.publish(event)
        except Exception:  # noqa: BLE001
            pass
        routed.append("event_system")

        # Route to domain agents where the module maps to a capability.
        route = TELEMETRY_ROUTE.get(module)
        agent_result = None
        if route:
            capability, _event_type = route
            agent = self._agent_for_module(module)
            if agent is not None:
                try:
                    agent_result = _run_sync(agent.execute_with_guard(
                        event_type=_event_type,
                        payload={"device_id": device_id, "module": module, "telemetry": payload},
                    ))
                    routed.append(agent.agent_id)
                except Exception:  # noqa: BLE001
                    pass

        # Mirror to the digital twin.
        try:
            if self.twin_publisher is not None:
                _run_sync(self.twin_publisher.publish_agent_event(
                    asset_code=f"device-{device_id}",
                    event_type=f"iot.telemetry.{module}",
                    payload={"module": module, "device_id": device_id, "data": payload},
                ))
        except Exception:  # noqa: BLE001
            pass
        routed.append("twin")

        db = self._session_factory()
        try:
            row = db.query(IotTelemetryLog).filter(IotTelemetryLog.telemetry_id == (
                payload.get("telemetry_id") or f"tel_{uuid.uuid4().hex[:12]}")).first()
            if row is None:
                tel = IotTelemetryLog(
                    telemetry_id=payload.get("telemetry_id") or f"tel_{uuid.uuid4().hex[:12]}",
                    device_id=device_id, module=module,
                    topic=f"airport/{module}/{device_id}/{suffix}",
                    payload=json.dumps(payload),
                    message_id=payload.get("message_id"),
                    processed=True,
                    routed_to=",".join(routed),
                )
                db.add(tel)
                db.commit()
        finally:
            db.close()

    def _agent_for_module(self, module: str) -> Optional[AgentInterface]:
        capability = TELEMETRY_ROUTE.get(module, (None, None))[0]
        if not capability:
            return None
        if module in ("equipment", "charging"):
            return self.registry.get("maintenance_agent")
        if module in ("fire-smoke", "emergency", "security", "gate"):
            return self.registry.get("safety_agent")
        if module == "baggage":
            return self.registry.get("baggage_agent")
        if module in ("environment", "passenger-counter"):
            return self.registry.get("sustainability_agent")
        return None

    # ------------------------------------------------------------------ queries / health

    def get_command(self, command_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            state = self._pending.get(command_id)
        if state is not None:
            return state
        db = self._session_factory()
        try:
            row = db.query(IotCommandLog).filter(IotCommandLog.command_id == command_id).first()
            return self._serialize_command(row) if row else None
        finally:
            db.close()

    def list_commands(self, limit: int = 50, device_id: Optional[str] = None,
                      status: Optional[str] = None) -> List[Dict[str, Any]]:
        db = self._session_factory()
        try:
            q = db.query(IotCommandLog).order_by(IotCommandLog.created_at.desc())
            if device_id:
                q = q.filter(IotCommandLog.device_id == device_id)
            if status:
                q = q.filter(IotCommandLog.status == status)
            rows = q.limit(limit).all()
            return [self._serialize_command(r) for r in rows]
        finally:
            db.close()

    def get_health(self) -> BridgeHealth:
        pending = acked = timed_out = 0
        db = self._session_factory()
        try:
            rows = db.query(IotCommandLog).all()
            for r in rows:
                if r.status == "pending" or r.status == "dispatched":
                    pending += 1
                elif r.status == "acknowledged":
                    acked += 1
                elif r.status == "timeout":
                    timed_out += 1
        finally:
            db.close()
        return BridgeHealth(
            connected=self._connected,
            broker=settings.MQTT_BROKER,
            port=settings.MQTT_PORT,
            pending_commands=pending,
            acknowledged_commands=acked,
            timed_out_commands=timed_out,
            last_telemetry_at=self._last_telemetry_at.isoformat() if self._last_telemetry_at else None,
            error=self._connect_error,
        )

    # ------------------------------------------------------------------ persistence helpers

    def _persist_command(self, state: Dict[str, Any]) -> None:
        db = self._session_factory()
        try:
            row = db.query(IotCommandLog).filter(IotCommandLog.command_id == state["command_id"]).first()
            payload_json = json.dumps(state.get("payload", {}))
            if row is None:
                row = IotCommandLog(
                    command_id=state["command_id"],
                    correlation_id=state.get("correlation_id"),
                    device_id=state["device_id"],
                    module=state["module"],
                    topic=state["topic"],
                    command=state["command"],
                    payload=payload_json,
                    dispatched_by_agent=state["dispatched_by_agent"],
                    status=state["status"],
                    timeout_seconds=state.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS),
                    retry_count=state.get("retry_count", 0),
                    max_retries=state.get("max_retries", MAX_RETRIES),
                    expires_at=state.get("expires_at"),
                )
                db.add(row)
            else:
                row.status = state["status"]
                row.payload = payload_json
                row.retry_count = state.get("retry_count", row.retry_count)
                if state.get("dispatched_at"):
                    row.dispatched_at = datetime.fromisoformat(state["dispatched_at"])
                row.expires_at = state.get("expires_at", row.expires_at)
                row.updated_at = _utc_now()
            db.commit()
        finally:
            db.close()

    def _persist_telemetry(self, device_id, module, suffix, payload, message_id) -> None:
        db = self._session_factory()
        try:
            tel = IotTelemetryLog(
                telemetry_id=f"tel_{uuid.uuid4().hex[:12]}",
                device_id=device_id, module=module,
                topic=f"airport/{module}/{device_id}/{suffix}",
                payload=json.dumps(payload),
                message_id=message_id,
                processed=False,
            )
            db.add(tel)
            db.commit()
        finally:
            db.close()

    @staticmethod
    def _serialize_command(row: IotCommandLog) -> Dict[str, Any]:
        return {
            "command_id": row.command_id,
            "correlation_id": row.correlation_id,
            "device_id": row.device_id,
            "module": row.module,
            "topic": row.topic,
            "command": row.command,
            "payload": json.loads(row.payload or "{}"),
            "dispatched_by_agent": row.dispatched_by_agent,
            "status": row.status,
            "ack_received": row.ack_received,
            "ack_payload": json.loads(row.ack_payload or "{}") if row.ack_payload else None,
            "ack_latency_ms": row.ack_latency_ms,
            "timeout_seconds": row.timeout_seconds,
            "retry_count": row.retry_count,
            "max_retries": row.max_retries,
            "error_message": row.error_message,
            "dispatched_at": row.dispatched_at.isoformat() if row.dispatched_at else None,
            "acknowledged_at": row.acknowledged_at.isoformat() if row.acknowledged_at else None,
            "expires_at": row.expires_at.isoformat() if row.expires_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _run_sync(coro):
    """Run an async coroutine on a fresh event loop (bridge runs sync threads)."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()
