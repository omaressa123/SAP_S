"""
Tests for the unified person + fall detection pipeline.

Heavy model dependencies (ultralytics YOLO, mediapipe Pose, joblib RF) are
mocked so the test suite runs without GPU/model files. The pipeline logic
(event typing, tracking association, cooldown dedup, event delivery, error
handling) is verified end-to-end.
"""

import asyncio
import base64
import io
import sys
import time
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import cv2
import numpy as np
import pytest

# Make the unified_detection package importable.
TEST_DIR = Path(__file__).resolve().parent
PKG_DIR = TEST_DIR.parent
sys.path.insert(0, str(PKG_DIR))

from pipeline import (  # noqa: E402
    CameraState,
    CooldownTracker,
    PipelineEvent,
    UnifiedPipeline,
)

# ---------------------------------------------------------------------------
# Fixtures: synthetic frames
# ---------------------------------------------------------------------------

def make_frame(width: int = 640, height: int = 480) -> np.ndarray:
    """Return a blank BGR frame."""
    return np.zeros((height, width, 3), dtype=np.uint8)


# ---------------------------------------------------------------------------
# Mocks for SharedDetector and FallDetector
# ---------------------------------------------------------------------------

class FakeDetection:
    """Mimics SharedDetector.Detection (track_id, cls, conf, box)."""

    def __init__(self, track_id: int, cls: int, conf: float, box):
        self.track_id = track_id
        self.cls = cls
        self.conf = conf
        self.box = box


class FakeSharedDetector:
    """Returns a fixed set of detections per call."""

    def __init__(self, detections=None):
        self.detections = detections or []
        self.call_count = 0

    def detect(self, frame):
        self.call_count += 1
        return list(self.detections)


class FakeFallDetector:
    """Mimics FallDetector.process_frame returning None/'flagged'/'confirmed_fall'/'false_alarm'."""

    def __init__(self, responses=None):
        self.responses = responses or []
        self.call_count = 0
        self.frames_seen = 0

    def process_frame(self, frame):
        self.call_count += 1
        self.frames_seen += 1
        if self.responses:
            return self.responses.pop(0)
        return None

    def mp_pose(self):
        return MagicMock()

    def close(self):
        pass


# ---------------------------------------------------------------------------
# CooldownTracker tests
# ---------------------------------------------------------------------------

class TestCooldownTracker:
    def test_allows_first_event(self):
        cd = CooldownTracker(cooldown_seconds=30.0)
        now = 1000.0
        assert cd.allowed(1, "fall_confirmed", 5, now) is True
        # Same camera+event+tracking within cooldown -> blocked
        assert cd.allowed(1, "fall_confirmed", 5, now + 10.0) is False
        # After cooldown -> allowed again
        assert cd.allowed(1, "fall_confirmed", 5, now + 31.0) is True

    def test_different_tracking_ids_independent(self):
        cd = CooldownTracker(cooldown_seconds=30.0)
        now = 1000.0
        assert cd.allowed(1, "fall_confirmed", 1, now) is True
        assert cd.allowed(1, "fall_confirmed", 2, now) is True  # different track

    def test_different_event_types_independent(self):
        cd = CooldownTracker(cooldown_seconds=30.0)
        now = 1000.0
        assert cd.allowed(1, "fall_confirmed", 1, now) is True
        assert cd.allowed(1, "fall_suspected", 1, now) is True  # different event type

    def test_different_cameras_independent(self):
        cd = CooldownTracker(cooldown_seconds=30.0)
        now = 1000.0
        assert cd.allowed(1, "fall_confirmed", 1, now) is True
        assert cd.allowed(2, "fall_confirmed", 1, now) is True  # different camera


# ---------------------------------------------------------------------------
# PipelineEvent tests
# ---------------------------------------------------------------------------

class TestPipelineEvent:
    def test_to_ingest_payload_structure(self):
        ev = PipelineEvent(
            event_id="evt_abc123",
            event_type="fall_confirmed",
            source="unified_detection",
            source_id="cam-01",
            camera_id=1,
            tracking_id=7,
            confidence=None,
            timestamp=1234567890.0,
            payload={"class": "person", "fall_status": "confirmed", "box": [10, 20, 100, 200]},
        )
        p = ev.to_ingest_payload()
        assert p["event_type"] == "fall_confirmed"
        assert p["source"] == "unified_detection"
        assert p["source_id"] == "cam-01"
        assert p["camera_id"] == 1
        inner = p["payload"]
        assert inner["tracking_id"] == 7
        assert inner["confidence"] is None
        assert inner["timestamp"] == 1234567890.0
        assert inner["event_id"] == "evt_abc123"
        assert inner["class"] == "person"
        assert inner["fall_status"] == "confirmed"


# ---------------------------------------------------------------------------
# UnifiedPipeline tests (mocked detectors)
# ---------------------------------------------------------------------------

class TestUnifiedPipeline:
    @pytest.fixture
    def pipe(self):
        """Pipeline with mocked SharedDetector and FallDetector."""
        # Import pipeline lazily so heavy deps aren't loaded at module import.
        from pipeline import UnifiedPipeline

        p = UnifiedPipeline(config_path="nonexistent.yaml", backend_url=None)
        # Replace the real SharedDetector with a fake (heavy import avoided).
        p.shared_detector = FakeSharedDetector()
        yield p

    def make_detections(self):
        """Two persons (tracked), one bag (untracked)."""
        return [
            FakeDetection(track_id=1, cls=0, conf=0.9, box=(100, 100, 200, 400)),
            FakeDetection(track_id=2, cls=0, conf=0.85, box=(300, 150, 400, 450)),
            FakeDetection(track_id=3, cls=26, conf=0.7, box=(500, 300, 550, 400)),
        ]

    @pytest.mark.asyncio
    async def test_process_frame_emits_person_and_baggage_events(self, pipe):
        pipe.shared_detector.detections = self.make_detections()
        # Fall detector returns None (no fall)
        cam = pipe._get_camera_state(0)
        cam.fall_detectors[1] = FakeFallDetector([None])
        cam.fall_detectors[2] = FakeFallDetector([None])

        events = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01"
        )

        types = {e.event_type for e in events}
        assert "person_detected" in types
        assert "baggage_detected" in types
        assert "fall_confirmed" not in types
        assert "inference_error" not in types

        # Two person events
        person_events = [e for e in events if e.event_type == "person_detected"]
        assert len(person_events) == 2
        assert person_events[0].tracking_id == 1
        assert person_events[1].tracking_id == 2

        # One baggage event
        bag_events = [e for e in events if e.event_type == "baggage_detected"]
        assert len(bag_events) == 1
        assert bag_events[0].payload["class"] == "handbag"

    @pytest.mark.asyncio
    async def test_fall_confirmed_event_with_tracking_id(self, pipe):
        pipe.shared_detector.detections = [
            FakeDetection(track_id=1, cls=0, conf=0.9, box=(100, 100, 200, 400))
        ]
        cam = pipe._get_camera_state(0)
        cam.fall_detectors[1] = FakeFallDetector(["confirmed_fall"])

        events = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01"
        )

        fall_events = [e for e in events if e.event_type == "fall_confirmed"]
        assert len(fall_events) == 1
        assert fall_events[0].tracking_id == 1
        assert fall_events[0].camera_id == 0
        assert fall_events[0].payload["fall_status"] == "confirmed"

    @pytest.mark.asyncio
    async def test_fall_suspected_event(self, pipe):
        pipe.shared_detector.detections = [
            FakeDetection(track_id=1, cls=0, conf=0.9, box=(100, 100, 200, 400))
        ]
        cam = pipe._get_camera_state(0)
        cam.fall_detectors[1] = FakeFallDetector(["flagged"])

        events = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01"
        )

        suspected = [e for e in events if e.event_type == "fall_suspected"]
        assert len(suspected) == 1
        assert suspected[0].tracking_id == 1

    @pytest.mark.asyncio
    async def test_no_fall_when_no_person(self, pipe):
        pipe.shared_detector.detections = [
            FakeDetection(track_id=3, cls=26, conf=0.7, box=(500, 300, 550, 400))
        ]
        events = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01"
        )
        fall_events = [e for e in events if "fall" in e.event_type]
        assert len(fall_events) == 0

    @pytest.mark.asyncio
    async def test_fall_cooldown_suppresses_duplicates(self, pipe):
        """Same camera + fall_confirmed + same tracking_id within cooldown -> suppressed."""
        pipe.shared_detector.detections = [
            FakeDetection(track_id=1, cls=0, conf=0.9, box=(100, 100, 200, 400))
        ]

        # First call: confirmed fall allowed
        cam = pipe._get_camera_state(0)
        cam.fall_detectors[1] = FakeFallDetector(["confirmed_fall"])
        events1 = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01", timestamp=1000.0
        )
        assert len([e for e in events1 if e.event_type == "fall_confirmed"]) == 1

        # Second call immediately after: suppressed by cooldown
        cam.fall_detectors[1] = FakeFallDetector(["confirmed_fall"])
        events2 = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01", timestamp=1005.0
        )
        assert len([e for e in events2 if e.event_type == "fall_confirmed"]) == 0

    @pytest.mark.asyncio
    async def test_fall_after_cooldown_allowed(self, pipe):
        pipe.shared_detector.detections = [
            FakeDetection(track_id=1, cls=0, conf=0.9, box=(100, 100, 200, 400))
        ]

        cam = pipe._get_camera_state(0)
        cam.fall_detectors[1] = FakeFallDetector(["confirmed_fall"])
        events1 = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01", timestamp=1000.0
        )
        assert len([e for e in events1 if e.event_type == "fall_confirmed"]) == 1

        # After cooldown (30s): allowed again
        cam.fall_detectors[1] = FakeFallDetector(["confirmed_fall"])
        events2 = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01", timestamp=1031.0
        )
        assert len([e for e in events2 if e.event_type == "fall_confirmed"]) == 1

    @pytest.mark.asyncio
    async def test_inference_error_event_on_exception(self, pipe):
        # Make detect() raise
        pipe.shared_detector.detect = MagicMock(side_effect=RuntimeError("model crashed"))

        events = await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01"
        )
        error_events = [e for e in events if e.event_type == "inference_error"]
        assert len(error_events) == 1
        assert error_events[0].payload["error_type"] == "RuntimeError"

    @pytest.mark.asyncio
    async def test_bounded_frame_processing_one_at_a_time(self, pipe):
        """Same camera frames are processed sequentially (lock serializes them)."""
        pipe.shared_detector.detections = []
        call_count = 0

        def tracking_detect(frame):
            nonlocal call_count
            call_count += 1
            return []

        pipe.shared_detector.detect = tracking_detect

        results = await asyncio.gather(
            pipe.process_frame(make_frame(), camera_id=0, timestamp=1.0),
            pipe.process_frame(make_frame(), camera_id=0, timestamp=2.0),
        )

        # Both frames processed, detect called once per frame
        assert call_count == 2
        assert len(results[0]) == 0
        assert len(results[1]) == 0

    @pytest.mark.asyncio
    async def test_different_cameras_process_concurrently(self, pipe):
        """Different cameras have independent locks, both processed."""
        pipe.shared_detector.detections = []
        call_count = 0

        def tracking_detect(frame):
            nonlocal call_count
            call_count += 1
            return []

        pipe.shared_detector.detect = tracking_detect

        results = await asyncio.gather(
            pipe.process_frame(make_frame(), camera_id=0, timestamp=1.0),
            pipe.process_frame(make_frame(), camera_id=1, timestamp=2.0),
        )

        assert call_count == 2
        assert len(results[0]) == 0
        assert len(results[1]) == 0

    @pytest.mark.asyncio
    async def test_person_cleanup_when_absent(self, pipe):
        """Fall detector for a person is cleaned up after they leave the frame."""
        cam = pipe._get_camera_state(0)

        # Frame 1: person present
        pipe.shared_detector.detections = [
            FakeDetection(track_id=1, cls=0, conf=0.9, box=(100, 100, 200, 400))
        ]
        cam.fall_detectors[1] = FakeFallDetector([None])
        await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01", timestamp=1000.0
        )
        assert 1 in cam.fall_detectors

        # Frame 2: person absent, but within idle timeout -> still present
        pipe.shared_detector.detections = []
        await pipe.process_frame(
            frame=make_frame(), camera_id=0, source_id="cam-01", timestamp=1001.0
        )
        assert 1 in cam.fall_detectors

        # Frame 3: simulate old last_seen timestamp, then cleanup removes it
        cam.last_person_seen[1] = 1000.0
        cam.cleanup_stale(active_ids=set(), max_idle_seconds=0.5, now=1001.0)
        assert 1 not in cam.fall_detectors


# ---------------------------------------------------------------------------
# Event delivery tests (mocked HTTP client)
# ---------------------------------------------------------------------------

class TestEventDelivery:
    @pytest.mark.asyncio
    async def test_emit_events_posts_to_backend(self):
        pipe = UnifiedPipeline(
            config_path="nonexistent.yaml", backend_url="http://backend:8000"
        )
        mock_client = AsyncMock()
        pipe._http_client = mock_client

        ev = PipelineEvent(
            event_id="evt_test1",
            event_type="fall_confirmed",
            camera_id=1,
            tracking_id=5,
            confidence=None,
            timestamp=time.time(),
            payload={"class": "person"},
        )

        await pipe.emit_events([ev])
        mock_client.post.assert_awaited_once()
        args, kwargs = mock_client.post.call_args
        assert "/api/v1/agents/events" in args[0]
        assert kwargs["json"]["event_type"] == "fall_confirmed"
        assert kwargs["json"]["payload"]["tracking_id"] == 5

    @pytest.mark.asyncio
    async def test_emit_events_no_backend_url(self):
        pipe = UnifiedPipeline(config_path="nonexistent.yaml", backend_url=None)
        # Should not raise
        await pipe.emit_events(
            [
                PipelineEvent(
                    event_id="evt_x",
                    event_type="person_detected",
                    camera_id=0,
                )
            ]
        )

    @pytest.mark.asyncio
    async def test_emit_events_backend_failure_non_fatal(self):
        pipe = UnifiedPipeline(
            config_path="nonexistent.yaml", backend_url="http://backend:8000"
        )
        mock_client = AsyncMock()
        mock_client.post.side_effect = Exception("connection refused")
        pipe._http_client = mock_client

        # Should not raise
        await pipe.emit_events(
            [
                PipelineEvent(
                    event_id="evt_y",
                    event_type="person_detected",
                    camera_id=0,
                )
            ]
        )


# ---------------------------------------------------------------------------
# Base64 frame round-trip test (via inference_server logic, mocked)
# ---------------------------------------------------------------------------

def test_base64_frame_roundtrip():
    """A synthetic frame can be encoded/decoded without corruption."""
    frame = make_frame(width=100, height=100)
    # Draw a colored rectangle so content is detectable
    cv2.rectangle(frame, (10, 10), (90, 90), (0, 255, 0), -1)

    _, buf = cv2.imencode(".jpg", frame)
    b64 = base64.b64encode(buf).decode("ascii")

    decoded = base64.b64decode(b64)
    arr = np.frombuffer(decoded, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    assert img is not None
    assert img.shape == (100, 100, 3)
    # Green pixel present
    assert np.any(img[:, :, 1] > 200)
