"""
Unified real-time person monitoring and fall detection pipeline.

Coordinates:
  1. SharedDetector (YOLOv8n person + baggage detection with tracking)
     from AI/Baggage_And_Person_Detector/Detector.py
  2. FallDetector (MediaPipe Pose + Random Forest fall detection)
     from AI/fulldetection/src/Realtime_infer.py

Emits structured events to the backend agent event bus via
POST /api/v1/agents/events.

Design principles:
  - Reuses existing model weights and inference code (no retraining, no mocks).
  - Heavy model imports (ultralytics, mediapipe, joblib) are lazy: the module
    imports cleanly even when those packages are absent; the /health endpoint
    then reports degraded status.
  - One loaded model instance per service process (SharedDetector + FallDetector
    per camera are reused across frames).
  - Bounded frame processing: one frame at a time per camera (asyncio Lock),
    no unbounded queues.
  - Per-camera, per-tracked-person FallDetector instances; stale detectors
    cleaned up after a configurable idle timeout.
  - Cooldown/dedup per camera + event-type + tracking-id to prevent duplicate
    fall alerts.
  - All model detections are candidate events requiring human review; the
    pipeline never invents certainty.
"""

from __future__ import annotations

import asyncio
import sys
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

# Lightweight imports (always available).
import cv2  # noqa: E402
import httpx  # noqa: E402
import numpy as np  # noqa: E402
import yaml  # noqa: E402

# Reuse existing implementations from the repository rather than reimplementing.
# These directories are added to sys.path so `Detector` and `Realtime_infer`
# can be imported lazily inside __init__ (heavy deps: ultralytics, mediapipe).
AI_BAGGAGE_DIR = Path(__file__).resolve().parent.parent / "Baggage_And_Person_Detector"
AI_FULL_DIR = Path(__file__).resolve().parent.parent / "fulldetection" / "src"
for _d in (str(AI_BAGGAGE_DIR), str(AI_FULL_DIR)):
    if _d not in sys.path:
        sys.path.insert(0, _d)


@dataclass
class PipelineEvent:
    """A structured event emitted by the pipeline."""

    event_id: str
    event_type: str  # person_detected, baggage_detected, fall_suspected, fall_confirmed, inference_error
    source: str = "unified_detection"
    source_id: Optional[str] = None
    camera_id: Optional[int] = None
    tracking_id: Optional[int] = None
    confidence: Optional[float] = None
    timestamp: float = field(default_factory=time.time)
    payload: Dict[str, Any] = field(default_factory=dict)

    def to_ingest_payload(self) -> Dict[str, Any]:
        """Payload for POST /api/v1/agents/events on the backend."""
        return {
            "event_type": self.event_type,
            "source": self.source,
            "source_id": self.source_id,
            "camera_id": self.camera_id,
            "payload": {
                **self.payload,
                "tracking_id": self.tracking_id,
                "confidence": self.confidence,
                "timestamp": self.timestamp,
                "event_id": self.event_id,
            },
        }


class CooldownTracker:
    """Prevents duplicate fall alerts via per-camera + event-type + tracking-id cooldowns."""

    def __init__(self, cooldown_seconds: float = 30.0):
        self.cooldown_seconds = cooldown_seconds
        self._last: Dict[str, float] = {}

    def _key(self, camera_id: Optional[int], event_type: str, tracking_id: Optional[int]) -> str:
        return f"{camera_id}:{event_type}:{tracking_id}"

    def allowed(
        self,
        camera_id: Optional[int],
        event_type: str,
        tracking_id: Optional[int],
        now: float,
    ) -> bool:
        key = self._key(camera_id, event_type, tracking_id)
        last = self._last.get(key, 0.0)
        if now - last >= self.cooldown_seconds:
            self._last[key] = now
            return True
        return False


class CameraState:
    """Per-camera processing state: fall detectors per tracked person, cooldowns."""

    def __init__(self, camera_id: int, config: dict, cooldown: CooldownTracker):
        self.camera_id = camera_id
        self.config = config
        self.cooldown = cooldown
        self.fall_detectors: Dict[int, Any] = {}  # tracking_id -> FallDetector
        self.last_person_seen: Dict[int, float] = {}
        self.frame_count = 0

    def get_or_create_fall_detector(
        self, tracking_id: int, model_path: str, cfg: dict
    ) -> Optional[Any]:
        # Fast path: detector already cached for this tracked person.
        if tracking_id in self.fall_detectors:
            self.last_person_seen[tracking_id] = time.time()
            return self.fall_detectors[tracking_id]

        # Lazy import of FallDetector (heavy: mediapipe + joblib).
        try:
            from Realtime_infer import FallDetector  # noqa: E402
        except ImportError:
            return None

        try:
            self.fall_detectors[tracking_id] = FallDetector(model_path, cfg)
        except Exception:  # noqa: BLE001
            return None
        self.last_person_seen[tracking_id] = time.time()
        return self.fall_detectors[tracking_id]

    def cleanup_stale(
        self, active_ids: set, max_idle_seconds: float = 60.0, now: Optional[float] = None
    ) -> None:
        """Remove fall detectors for persons no longer in the frame."""
        now = now or time.time()
        stale = [
            tid
            for tid, last in self.last_person_seen.items()
            if now - last > max_idle_seconds
        ]
        for tid in stale:
            det = self.fall_detectors.pop(tid, None)
            if det is not None:
                try:
                    det.mp_pose.close()
                except Exception:
                    pass
            self.last_person_seen.pop(tid, None)


class UnifiedPipeline:
    """
    Coordinated person + fall detection pipeline.

    Runs SharedDetector (person/baggage with tracking) on each frame,
    then runs FallDetector (MediaPipe Pose + RF) on person crops for
    each tracked person. Associates fall events with tracking IDs and
    emits structured events.
    """

    def __init__(
        self,
        config_path: str = "config.yaml",
        backend_url: Optional[str] = None,
    ):
        self.config = self._load_config(config_path)
        self.backend_url = backend_url
        self._http_client: Optional[httpx.AsyncClient] = None

        det_cfg = self.config.get("detection", {})
        self.conf_threshold = det_cfg.get("confidence_threshold", 0.35)
        self.target_fps = self.config.get("capture", {}).get("target_fps", 15)
        self.frame_interval = 1.0 / self.target_fps

        # Lazy import of SharedDetector (heavy: ultralytics). Deferred to first
        # use so the module imports cleanly without model dependencies installed.
        self.shared_detector: Optional[Any] = None
        self._shared_detector_model_path = det_cfg.get("person_model", "yolov8n.pt")
        self._shared_detector_conf = self.conf_threshold
        self._shared_detector_loaded = False

        # Fall detector: MediaPipe Pose + Random Forest.
        fall_cfg = self.config.get("fall_detection", {})
        fall_model = fall_cfg.get("model_path", "AI/fulldetection/models/rf_fall_model.joblib")
        p = Path(fall_model)
        if not p.exists():
            root_candidate = Path(__file__).resolve().parent.parent / "fulldetection" / "models" / "rf_fall_model.joblib"
            if root_candidate.exists():
                p = root_candidate
        self.fall_model_path = str(p)
        self.fall_cfg = self.config

        # Per-camera state.
        self.camera_states: Dict[int, CameraState] = {}
        self.cooldown = CooldownTracker(
            cooldown_seconds=self.config.get("cooldown", {}).get("fall_cooldown_seconds", 30.0)
        )
        self._locks: Dict[int, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._models_ok = False  # set to True after successful lazy load

    # ------------------------------------------------------------------
    # Configuration / lifecycle
    # ------------------------------------------------------------------
    def _load_config(self, config_path: str) -> dict:
        try:
            with open(config_path, "r") as f:
                return yaml.safe_load(f) or {}
        except FileNotFoundError:
            return {}

    @property
    def http_client(self) -> httpx.AsyncClient:
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=10.0)
        return self._http_client

    async def close(self) -> None:
        if self._http_client is not None:
            await self._http_client.aclose()
            self._http_client = None
        for state in self.camera_states.values():
            for det in state.fall_detectors.values():
                try:
                    det.mp_pose.close()
                except Exception:
                    pass

    def _get_camera_state(self, camera_id: int) -> CameraState:
        if camera_id not in self.camera_states:
            self.camera_states[camera_id] = CameraState(
                camera_id, self.config, self.cooldown
            )
        return self.camera_states[camera_id]

    # ------------------------------------------------------------------
    # Frame processing
    # ------------------------------------------------------------------
    async def process_frame(
        self,
        frame: np.ndarray,
        camera_id: int = 0,
        source_id: Optional[str] = None,
        timestamp: Optional[float] = None,
    ) -> List[PipelineEvent]:
        """Process a single frame and return emitted events.

        Bounded: one frame at a time per camera via asyncio Lock.
        """
        now = timestamp or time.time()
        events: List[PipelineEvent] = []

        async with self._locks[camera_id]:
            cam_state = self._get_camera_state(camera_id)
            cam_state.frame_count += 1

            try:
                # --- Lazy-load SharedDetector on first frame (heavy: ultralytics) ---
                if self.shared_detector is None:
                    from Detector import SharedDetector  # noqa: E402

                    self.shared_detector = SharedDetector(
                        model_path=self._shared_detector_model_path,
                        conf=self._shared_detector_conf,
                    )
                    self._shared_detector_loaded = True

                # --- Step 1: Shared person + baggage detection with tracking ---
                shared_dets = self.shared_detector.detect(frame)

                persons = [d for d in shared_dets if d.cls == 0]  # PERSON_CLS == 0
                bags = [d for d in shared_dets if d.cls in (24, 26, 28)]  # BAG_CLS

                # --- Step 2: Person detection events + per-person fall detection ---
                active_person_ids: set = set()
                for p in persons:
                    active_person_ids.add(p.track_id)
                    conf = float(p.conf) if p.conf and p.conf > 0 else None
                    events.append(
                        PipelineEvent(
                            event_id=f"evt_{uuid.uuid4().hex[:8]}",
                            event_type="person_detected",
                            source="unified_detection",
                            source_id=source_id,
                            camera_id=camera_id,
                            tracking_id=p.track_id if p.track_id != -1 else None,
                            confidence=conf,
                            timestamp=now,
                            payload={
                                "class": "person",
                                "box": list(p.box),
                                "tracking_id": p.track_id if p.track_id != -1 else None,
                            },
                        )
                    )

                    # Run fall detection on the person crop for tracked persons.
                    if p.track_id != -1:
                        fd = cam_state.get_or_create_fall_detector(
                            p.track_id, self.fall_model_path, self.fall_cfg
                        )
                        if fd is None:
                            # Fall detector unavailable (mediapipe/joblib missing).
                            continue
                        x1, y1, x2, y2 = [int(v) for v in p.box]
                        fh, fw = frame.shape[:2]
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(fw, x2), min(fh, y2)
                        if x2 > x1 and y2 > y1:
                            person_crop = frame[y1:y2, x1:x2]
                            fall_status = fd.process_frame(person_crop)
                            if fall_status == "confirmed_fall":
                                if self.cooldown.allowed(
                                    camera_id, "fall_confirmed", p.track_id, now
                                ):
                                    events.append(
                                        PipelineEvent(
                                            event_id=f"evt_{uuid.uuid4().hex[:8]}",
                                            event_type="fall_confirmed",
                                            source="unified_detection",
                                            source_id=source_id,
                                            camera_id=camera_id,
                                            tracking_id=p.track_id,
                                            confidence=None,  # RF model: no per-event confidence
                                            timestamp=now,
                                            payload={
                                                "class": "person",
                                                "fall_status": "confirmed",
                                                "tracking_id": p.track_id,
                                                "box": list(p.box),
                                            },
                                        )
                                    )
                            elif fall_status == "flagged":
                                if self.cooldown.allowed(
                                    camera_id, "fall_suspected", p.track_id, now
                                ):
                                    events.append(
                                        PipelineEvent(
                                            event_id=f"evt_{uuid.uuid4().hex[:8]}",
                                            event_type="fall_suspected",
                                            source="unified_detection",
                                            source_id=source_id,
                                            camera_id=camera_id,
                                            tracking_id=p.track_id,
                                            confidence=None,
                                            timestamp=now,
                                            payload={
                                                "class": "person",
                                                "fall_status": "suspected",
                                                "tracking_id": p.track_id,
                                                "box": list(p.box),
                                            },
                                        )
                                    )
                            # "false_alarm" -> person recovered; log but do not alert.

                # --- Step 3: Clean up fall detectors for persons no longer present ---
                active_track_ids = {
                    p.track_id for p in persons if p.track_id != -1
                }
                cam_state.cleanup_stale(active_track_ids)

                # --- Step 4: Baggage detection events ---
                bag_class_names = {24: "backpack", 26: "handbag", 28: "suitcase"}
                for b in bags:
                    events.append(
                        PipelineEvent(
                            event_id=f"evt_{uuid.uuid4().hex[:8]}",
                            event_type="baggage_detected",
                            source="unified_detection",
                            source_id=source_id,
                            camera_id=camera_id,
                            tracking_id=b.track_id if b.track_id != -1 else None,
                            confidence=float(b.conf) if b.conf and b.conf > 0 else None,
                            timestamp=now,
                            payload={
                                "class": bag_class_names.get(b.cls, f"class_{b.cls}"),
                                "box": list(b.box),
                                "tracking_id": b.track_id if b.track_id != -1 else None,
                            },
                        )
                    )

            except Exception as exc:  # noqa: BLE001
                events.append(
                    PipelineEvent(
                        event_id=f"evt_{uuid.uuid4().hex[:8]}",
                        event_type="inference_error",
                        source="unified_detection",
                        source_id=source_id,
                        camera_id=camera_id,
                        confidence=None,
                        timestamp=now,
                        payload={
                            "error": str(exc),
                            "error_type": type(exc).__name__,
                        },
                    )
                )

        return events

    # ------------------------------------------------------------------
    # Event delivery to backend
    # ------------------------------------------------------------------
    async def emit_events(self, events: List[PipelineEvent]) -> None:
        """Push events to the backend agent event bus.

        Non-fatal: delivery failure must not break frame processing.
        """
        if not self.backend_url or not events:
            return
        for ev in events:
            try:
                await self.http_client.post(
                    f"{self.backend_url.rstrip('/')}/api/v1/agents/events",
                    json=ev.to_ingest_payload(),
                    headers={"X-API-KEY": "MOCK_API_KEY_123"},
                )
            except Exception:  # noqa: BLE001
                # Backend unreachable — event is lost but pipeline continues.
                pass
