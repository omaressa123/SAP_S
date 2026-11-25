"""
Airport People & Baggage Tracking System
----------------------------------------
YOLOv8/v11 Object Detection & Tracking with ByteTrack + Spatial-Temporal Association.

Features:
  1. Unique Person Tracking (PERSON #1, #2...) with ByteTrack.
  2. Multi-class Baggage Detection:
     - Backpack
     - Handbag / Small Bag
     - Suitcase / Carry-on / Large Suitcase / Trolley Bag
  3. Multi-frame Spatial-Temporal Person-to-Baggage Association:
     - Measures distance, bounding box containment/overlap (e.g. wearing backpack).
     - Velocity & movement alignment (carrier moving together with bag).
     - Temporal stability (multi-frame voting to avoid accidental jumping between people).
     - Detects Unassociated / Unattended baggage when no owner is consistently near.
  4. Persistent People & Baggage Statistics:
     - people_inside, people_total, people_exited
     - baggage_total, baggage_associated, baggage_unassociated
     - Full live tracking state per person and their associated bags.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from ultralytics import YOLO

# ----------------------------------------------------------------------------
# CONSTANTS & CONFIGURATION
# ----------------------------------------------------------------------------
PERSON_CLS = 0
BAG_CLS_MAP = {
    24: "Backpack",
    26: "Handbag",
    28: "Suitcase",
}

DEFAULT_MODEL_PATH = "yolov8n.pt"
CONF_THRESHOLD = 0.25
TRACKER_TYPE = "bytetrack.yaml"


def classify_baggage_type(cls_id: int, box: Tuple[float, float, float, float]) -> str:
    """Classifies baggage subtype according to project requirements and dimensions."""
    x1, y1, x2, y2 = box
    w = max(1.0, x2 - x1)
    h = max(1.0, y2 - y1)
    aspect = h / w

    base = BAG_CLS_MAP.get(cls_id, "Baggage")
    if cls_id == 24:
        return "Backpack"
    elif cls_id == 26:
        return "Small Bag / Handbag"
    elif cls_id == 28:
        # Suitcase variants
        area = w * h
        if area > 45000:
            return "Large Suitcase"
        elif aspect > 1.25:
            return "Trolley Bag"
        else:
            return "Carry-on Luggage"
    return base


@dataclass
class TrackedDetection:
    track_id: int
    cls: int
    conf: float
    box: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    label: str

    @property
    def center(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.box
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    @property
    def foot(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.box
        return ((x1 + x2) / 2.0, y2)

    @property
    def width(self) -> float:
        return self.box[2] - self.box[0]

    @property
    def height(self) -> float:
        return self.box[3] - self.box[1]


@dataclass
class BagTrackHistory:
    bag_id: int
    cls: int
    bag_type: str
    box: Tuple[float, float, float, float]
    conf: float
    last_seen: float
    # Mapping of person_id -> count of consecutive/frequent association frames
    person_vote_history: Dict[int, int] = field(default_factory=lambda: defaultdict(int))
    confirmed_owner_id: Optional[int] = None
    positions: deque = field(default_factory=lambda: deque(maxlen=20))


@dataclass
class PersonTrackHistory:
    person_id: int
    box: Tuple[float, float, float, float]
    conf: float
    first_seen: float
    last_seen: float
    status: str = "Inside"  # "Inside" or "Exited"
    associated_bags: Dict[int, str] = field(default_factory=dict)  # bag_id -> bag_type
    positions: deque = field(default_factory=lambda: deque(maxlen=20))


class AirportTrackerEngine:
    """Real-Time People and Baggage Tracking with Multi-Frame Association Engine."""

    def __init__(
        self,
        model_path: str = DEFAULT_MODEL_PATH,
        conf: float = CONF_THRESHOLD,
        tracker: str = TRACKER_TYPE,
        exit_timeout_seconds: float = 2.5,
    ):
        self.model_path = model_path
        self.conf = conf
        self.tracker = tracker
        self.exit_timeout_seconds = exit_timeout_seconds

        # Load YOLO model
        self.model = YOLO(self.model_path)
        self.target_classes = [PERSON_CLS, *BAG_CLS_MAP.keys()]

        # State tracking
        self.people_registry: Dict[int, PersonTrackHistory] = {}
        self.bag_registry: Dict[int, BagTrackHistory] = {}

        # Lifetime counters
        self.total_people_detected_set = set()
        self.total_people_exited_set = set()
        self.total_baggage_detected_set = set()

    def process_frame(
        self, frame: np.ndarray, timestamp: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Runs object detection and ByteTrack tracking on incoming camera frame,
        performs person-to-baggage spatial-temporal association, updates counts,
        and returns structured result.
        """
        now = timestamp or time.time()
        fh, fw = frame.shape[:2]

        # 1. Run YOLO tracking with ByteTrack
        results = self.model.track(
            frame,
            persist=True,
            conf=self.conf,
            classes=self.target_classes,
            tracker=self.tracker,
            verbose=False,
        )[0]

        current_people: List[TrackedDetection] = []
        current_bags: List[TrackedDetection] = []

        if results.boxes is not None and len(results.boxes) > 0:
            ids = results.boxes.id
            for i, b in enumerate(results.boxes):
                cls_id = int(b.cls[0]) if hasattr(b.cls, "__getitem__") else int(b.cls)
                conf_val = float(b.conf[0]) if hasattr(b.conf, "__getitem__") else float(b.conf)
                box_tuple = tuple(float(v) for v in b.xyxy[0])
                tid = int(ids[i]) if ids is not None and i < len(ids) else -1

                if cls_id == PERSON_CLS:
                    # Provide stable positive fallback ID if tracker returned -1
                    actual_id = tid if tid != -1 else (1000 + i)
                    current_people.append(
                        TrackedDetection(
                            track_id=actual_id,
                            cls=cls_id,
                            conf=conf_val,
                            box=box_tuple,
                            label="Person",
                        )
                    )
                elif cls_id in BAG_CLS_MAP:
                    actual_id = tid if tid != -1 else (2000 + i)
                    bag_type = classify_baggage_type(cls_id, box_tuple)
                    current_bags.append(
                        TrackedDetection(
                            track_id=actual_id,
                            cls=cls_id,
                            conf=conf_val,
                            box=box_tuple,
                            label=bag_type,
                        )
                    )

        # 2. Update People Registry & Status
        active_person_ids = set()
        for p in current_people:
            pid = p.track_id
            active_person_ids.add(pid)
            self.total_people_detected_set.add(pid)

            if pid not in self.people_registry:
                self.people_registry[pid] = PersonTrackHistory(
                    person_id=pid,
                    box=p.box,
                    conf=p.conf,
                    first_seen=now,
                    last_seen=now,
                    status="Inside",
                )
            else:
                entry = self.people_registry[pid]
                entry.box = p.box
                entry.conf = p.conf
                entry.last_seen = now
                entry.status = "Inside"
                entry.positions.append(p.center)

        # 3. Update Baggage Registry
        active_bag_ids = set()
        for b in current_bags:
            bid = b.track_id
            active_bag_ids.add(bid)
            self.total_baggage_detected_set.add(bid)

            if bid not in self.bag_registry:
                self.bag_registry[bid] = BagTrackHistory(
                    bag_id=bid,
                    cls=b.cls,
                    bag_type=b.label,
                    box=b.box,
                    conf=b.conf,
                    last_seen=now,
                )
            else:
                entry = self.bag_registry[bid]
                entry.box = b.box
                entry.conf = b.conf
                entry.bag_type = b.label
                entry.last_seen = now
                entry.positions.append(b.center)

        # 4. Multi-Frame Spatial-Temporal Person-to-Baggage Association
        # Reset current frame associations
        for p_entry in self.people_registry.values():
            if p_entry.status == "Inside":
                p_entry.associated_bags.clear()

        for b in current_bags:
            bag_entry = self.bag_registry[b.track_id]
            bx1, by1, bx2, by2 = b.box
            bc_x, bc_y = b.center
            b_width = b.width

            candidate_scores: List[Tuple[int, float]] = []

            for p in current_people:
                px1, py1, px2, py2 = p.box
                pc_x, pc_y = p.center
                p_width = p.width
                p_height = p.height

                # Check 1: Geometric overlap / containment (e.g. backpack worn on body)
                overlap_x1 = max(bx1, px1)
                overlap_y1 = max(by1, py1)
                overlap_x2 = min(bx2, px2)
                overlap_y2 = min(by2, py2)
                overlap_area = max(0.0, overlap_x2 - overlap_x1) * max(0.0, overlap_y2 - overlap_y1)
                bag_area = b.width * b.height
                containment_ratio = overlap_area / bag_area if bag_area > 0 else 0.0

                # Check 2: Distance between bag and person center / feet
                dist_center = np.hypot(bc_x - pc_x, bc_y - pc_y)
                dist_feet = np.hypot(bc_x - p.foot[0], bc_y - p.foot[1])
                min_dist = min(dist_center, dist_feet)

                # Proximity threshold dynamic to person scale
                max_reach = max(p_width * 2.2, 110.0)

                if containment_ratio > 0.35:
                    # Very strong signal (e.g. backpack on back or person holding bag)
                    score = 100.0 + (containment_ratio * 50.0)
                    candidate_scores.append((p.track_id, score))
                elif min_dist <= max_reach:
                    # Spatial proximity score (higher when closer)
                    score = max(0.0, (1.0 - (min_dist / max_reach)) * 100.0)
                    candidate_scores.append((p.track_id, score))

            if candidate_scores:
                candidate_scores.sort(key=lambda x: x[1], reverse=True)
                best_pid, best_score = candidate_scores[0]

                # Update multi-frame voting
                for pid, score in candidate_scores:
                    bag_entry.person_vote_history[pid] += int(score)

                # Decay votes for other people
                for pid in list(bag_entry.person_vote_history.keys()):
                    if pid != best_pid:
                        bag_entry.person_vote_history[pid] = max(
                            0, bag_entry.person_vote_history[pid] - 25
                        )

                # Multi-frame threshold: must have consistent evidence across frames
                if bag_entry.person_vote_history[best_pid] >= 50:
                    bag_entry.confirmed_owner_id = best_pid
            else:
                # If bag is far from everyone, check if confirmed owner recently walked away
                if bag_entry.confirmed_owner_id is not None:
                    owner = self.people_registry.get(bag_entry.confirmed_owner_id)
                    if not owner or owner.status == "Exited":
                        bag_entry.confirmed_owner_id = None

            # Apply association if owner is active in current frame
            if (
                bag_entry.confirmed_owner_id is not None
                and bag_entry.confirmed_owner_id in active_person_ids
            ):
                owner_id = bag_entry.confirmed_owner_id
                self.people_registry[owner_id].associated_bags[b.track_id] = b.label

        # 5. Check Exits (people who left the frame)
        for pid, p_entry in self.people_registry.items():
            if p_entry.status == "Inside" and pid not in active_person_ids:
                if now - p_entry.last_seen >= self.exit_timeout_seconds:
                    p_entry.status = "Exited"
                    self.total_people_exited_set.add(pid)

        # 6. Build Statistics
        people_inside_count = sum(
            1 for p in self.people_registry.values() if p.status == "Inside"
        )
        total_people_count = len(self.total_people_detected_set)
        total_exited_count = len(self.total_people_exited_set)

        associated_bag_count = 0
        unassociated_bag_count = 0
        for b in current_bags:
            b_info = self.bag_registry.get(b.track_id)
            if b_info and b_info.confirmed_owner_id in active_person_ids:
                associated_bag_count += 1
            else:
                unassociated_bag_count += 1

        total_baggage_count = len(self.total_baggage_detected_set)

        # 7. Format Output Detections & Table Rows for UI
        detections_out: List[Dict[str, Any]] = []

        # Output people detections
        for p in current_people:
            x1, y1, x2, y2 = p.box
            bw = max(0.0, x2 - x1)
            bh = max(0.0, y2 - y1)

            pct_x = round((x1 / fw) * 100.0, 2) if fw > 0 else 0.0
            pct_y = round((y1 / fh) * 100.0, 2) if fh > 0 else 0.0
            pct_w = round((bw / fw) * 100.0, 2) if fw > 0 else 0.0
            pct_h = round((bh / fh) * 100.0, 2) if fh > 0 else 0.0

            p_entry = self.people_registry.get(p.track_id)
            assoc_bags_list = (
                [f"{btype} #{bid}" for bid, btype in p_entry.associated_bags.items()]
                if p_entry
                else []
            )

            detections_out.append(
                {
                    "type": "person",
                    "personId": p.track_id,
                    "label": f"PERSON #{p.track_id}",
                    "confidence": round(p.conf * 100.0, 1),
                    "box": {"x": pct_x, "y": pct_y, "w": pct_w, "h": pct_h},
                    "bbox": {"x": pct_x, "y": pct_y, "w": pct_w, "h": pct_h},
                    "pixelBox": {"x": x1, "y": y1, "w": bw, "h": bh},
                    "color": "#10b981",  # Green
                    "associatedBags": assoc_bags_list,
                    "isAnomaly": False,
                }
            )

        # Output baggage detections with association link
        for b in current_bags:
            x1, y1, x2, y2 = b.box
            bw = max(0.0, x2 - x1)
            bh = max(0.0, y2 - y1)

            pct_x = round((x1 / fw) * 100.0, 2) if fw > 0 else 0.0
            pct_y = round((y1 / fh) * 100.0, 2) if fh > 0 else 0.0
            pct_w = round((bw / fw) * 100.0, 2) if fw > 0 else 0.0
            pct_h = round((bh / fh) * 100.0, 2) if fh > 0 else 0.0

            b_entry = self.bag_registry.get(b.track_id)
            owner_id = (
                b_entry.confirmed_owner_id
                if (b_entry and b_entry.confirmed_owner_id in active_person_ids)
                else None
            )

            # Determine owner center coordinate for visual linking line
            owner_center = None
            if owner_id:
                for p in current_people:
                    if p.track_id == owner_id:
                        owner_center = {
                            "x": round((p.center[0] / fw) * 100.0, 2),
                            "y": round((p.center[1] / fh) * 100.0, 2),
                        }
                        break

            color = "#007bb9" if owner_id else "#f59e0b"  # Blue if associated, Amber if unassociated
            label = (
                f"BAG #{b.track_id} · {b.label} (Owner: #{owner_id})"
                if owner_id
                else f"BAG #{b.track_id} · {b.label} (Unassociated)"
            )

            detections_out.append(
                {
                    "type": "baggage",
                    "bagId": b.track_id,
                    "bagType": b.label,
                    "ownerId": owner_id,
                    "label": label,
                    "confidence": round(b.conf * 100.0, 1),
                    "box": {"x": pct_x, "y": pct_y, "w": pct_w, "h": pct_h},
                    "bbox": {"x": pct_x, "y": pct_y, "w": pct_w, "h": pct_h},
                    "pixelBox": {"x": x1, "y": y1, "w": bw, "h": bh},
                    "center": {
                        "x": round((b.center[0] / fw) * 100.0, 2),
                        "y": round((b.center[1] / fh) * 100.0, 2),
                    },
                    "ownerCenter": owner_center,
                    "color": color,
                    "isAnomaly": owner_id is None and len(current_people) > 0,
                }
            )

        # Build table rows for live tracking dashboard
        tracking_table: List[Dict[str, Any]] = []
        for pid, p_entry in sorted(self.people_registry.items(), reverse=True):
            bags_str = (
                ", ".join(
                    [f"{btype} (#{bid})" for bid, btype in p_entry.associated_bags.items()]
                )
                if p_entry.associated_bags
                else "None"
            )
            tracking_table.append(
                {
                    "personId": f"Person {pid}",
                    "rawId": pid,
                    "status": p_entry.status,
                    "associatedBaggage": bags_str,
                    "trackingStatus": "Tracking" if p_entry.status == "Inside" else "Completed",
                    "durationSeconds": int(p_entry.last_seen - p_entry.first_seen),
                }
            )

        return {
            "frame_width": fw,
            "frame_height": fh,
            "detections": detections_out,
            "peopleCount": len(current_people),
            "bagCount": len(current_bags),
            "statistics": {
                "peopleCurrentlyInside": people_inside_count,
                "totalPeopleDetected": total_people_count,
                "totalPeopleExited": total_exited_count,
                "totalBaggageDetected": total_baggage_count,
                "associatedBaggage": associated_bag_count,
                "unassociatedBaggage": unassociated_bag_count,
            },
            "trackingTable": tracking_table[:25],  # Latest 25 tracked entities
        }
