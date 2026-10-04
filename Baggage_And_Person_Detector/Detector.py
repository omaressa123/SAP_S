"""
Shared General-Purpose Detector
--------------------------------
ONE pretrained object detector (YOLO, COCO weights) + post-processing rules.
No per-feature training needed.

Features:
  1. Overcrowding          -> too many people in frame / in a zone
  2. Unattended Baggage    -> bag stays still with no person nearby for N seconds
  3. Restricted-Zone Intrusion -> a person's feet enter a forbidden polygon

Install:
    pip install ultralytics opencv-python numpy

Run:
    python shared_detector.py --source 0                 # webcam
    python shared_detector.py --source airport.mp4       # video file
    python shared_detector.py --source rtsp://...        # CCTV stream
"""

import argparse
import time
from dataclasses import dataclass, field

import cv2
import numpy as np
from ultralytics import YOLO

# ----------------------------------------------------------------------------
# CONFIG  (edit these for your camera / site)
# ----------------------------------------------------------------------------
MODEL_PATH = "yolov8n.pt"          # auto-downloads. Use yolov8s/m for more accuracy
CONF_THRESHOLD = 0.35

PERSON_CLS = 0
BAG_CLS = {24: "backpack", 26: "handbag", 28: "suitcase"}   # COCO class ids

# Overcrowding
MAX_PEOPLE = 15                    # alert if more than this many people
CROWD_SECONDS = 3                  # ...for this many continuous seconds

# Unattended baggage
OWNER_RADIUS_FACTOR = 2.5          # "nearby" = within N x bag width of a person
STATIONARY_PX = 25                 # bag moved less than this = stationary
UNATTENDED_SECONDS = 20            # alert after this long with no owner nearby

# Restricted zone(s): polygons in PIXEL coordinates of the frame. EDIT THESE.
RESTRICTED_ZONES = [
    np.array([[100, 300], [400, 300], [400, 600], [100, 600]], dtype=np.int32),
]


# ----------------------------------------------------------------------------
# SHARED DETECTOR  (runs once per frame, used by every feature)
# ----------------------------------------------------------------------------
@dataclass
class Detection:
    track_id: int
    cls: int
    conf: float
    box: tuple  # x1, y1, x2, y2

    @property
    def center(self):
        x1, y1, x2, y2 = self.box
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    @property
    def foot(self):
        x1, y1, x2, y2 = self.box
        return ((x1 + x2) / 2, y2)

    @property
    def width(self):
        return self.box[2] - self.box[0]


class SharedDetector:
    def __init__(self, model_path=MODEL_PATH, conf=CONF_THRESHOLD):
        self.model = YOLO(model_path)
        self.conf = conf
        self.classes = [PERSON_CLS, *BAG_CLS.keys()]

    def detect(self, frame):
        res = self.model.track(
            frame, persist=True, conf=self.conf,
            classes=self.classes, verbose=False,
        )[0]
        dets = []
        if res.boxes is None or len(res.boxes) == 0:
            return dets
        ids = res.boxes.id
        for i, b in enumerate(res.boxes):
            tid = int(ids[i]) if ids is not None else -1
            dets.append(Detection(
                track_id=tid,
                cls=int(b.cls[0]),
                conf=float(b.conf[0]),
                box=tuple(map(float, b.xyxy[0])),
            ))
        return dets


# ----------------------------------------------------------------------------
# FEATURE RULES  (post-processing logic only)
# ----------------------------------------------------------------------------
class OvercrowdingRule:
    def __init__(self, max_people=MAX_PEOPLE, seconds=CROWD_SECONDS):
        self.max_people, self.seconds = max_people, seconds
        self.since = None

    def update(self, dets, now):
        n = sum(d.cls == PERSON_CLS for d in dets)
        if n > self.max_people:
            self.since = self.since or now
            if now - self.since >= self.seconds:
                return [f"OVERCROWDING: {n} people (limit {self.max_people})"]
        else:
            self.since = None
        return []


@dataclass
class BagState:
    anchor: tuple                      # position where it became "still"
    still_since: float
    last_owner_seen: float


class UnattendedBaggageRule:
    def __init__(self):
        self.bags: dict[int, BagState] = {}

    def update(self, dets, now):
        people = [d for d in dets if d.cls == PERSON_CLS]
        bags = [d for d in dets if d.cls in BAG_CLS and d.track_id != -1]
        alerts, seen = [], set()

        for bag in bags:
            seen.add(bag.track_id)
            radius = max(bag.width * OWNER_RADIUS_FACTOR, 60)
            owner_near = any(
                np.hypot(p.center[0] - bag.center[0], p.center[1] - bag.center[1]) < radius
                for p in people
            )
            st = self.bags.get(bag.track_id)
            if st is None:
                st = self.bags[bag.track_id] = BagState(bag.center, now, now)

            # bag moved -> reset stillness timer
            if np.hypot(bag.center[0] - st.anchor[0], bag.center[1] - st.anchor[1]) > STATIONARY_PX:
                st.anchor, st.still_since = bag.center, now
            if owner_near:
                st.last_owner_seen = now

            alone_for = now - st.last_owner_seen
            still_for = now - st.still_since
            if alone_for >= UNATTENDED_SECONDS and still_for >= UNATTENDED_SECONDS:
                alerts.append(
                    f"UNATTENDED {BAG_CLS[bag.cls].upper()} (id {bag.track_id}) "
                    f"~{int(alone_for)}s"
                )

        # forget bags that disappeared
        for tid in list(self.bags):
            if tid not in seen:
                del self.bags[tid]
        return alerts


class RestrictedZoneRule:
    def __init__(self, zones=RESTRICTED_ZONES):
        self.zones = zones

    def update(self, dets, now):
        alerts = []
        for d in dets:
            if d.cls != PERSON_CLS:
                continue
            fx, fy = d.foot
            for zi, poly in enumerate(self.zones):
                if cv2.pointPolygonTest(poly, (fx, fy), False) >= 0:
                    alerts.append(f"INTRUSION: person {d.track_id} in zone {zi + 1}")
        return alerts


# ----------------------------------------------------------------------------
# MAIN LOOP
# ----------------------------------------------------------------------------
def draw(frame, dets, alerts, zones):
    for poly in zones:
        cv2.polylines(frame, [poly], True, (0, 0, 255), 2)
    for d in dets:
        x1, y1, x2, y2 = map(int, d.box)
        color = (0, 200, 0) if d.cls == PERSON_CLS else (255, 160, 0)
        label = "person" if d.cls == PERSON_CLS else BAG_CLS[d.cls]
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"{label} #{d.track_id}", (x1, max(y1 - 6, 12)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    for i, a in enumerate(alerts):
        cv2.putText(frame, a, (10, 25 + i * 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 255), 2)
    return frame


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="0 for webcam, file path, or RTSP url")
    ap.add_argument("--no-display", action="store_true")
    args = ap.parse_args()

    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        raise SystemExit(f"Cannot open source: {args.source}")

    detector = SharedDetector()
    rules = [OvercrowdingRule(), UnattendedBaggageRule(), RestrictedZoneRule()]
    last_logged = {}

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        now = time.time()

        dets = detector.detect(frame)                 # shared: runs ONCE
        alerts = [a for r in rules for a in r.update(dets, now)]

        for a in alerts:                              # log each alert max every 5s
            if now - last_logged.get(a, 0) > 5:
                print(time.strftime("%H:%M:%S"), a)
                last_logged[a] = now

        if not args.no_display:
            cv2.imshow("Shared Detector", draw(frame, dets, alerts, RESTRICTED_ZONES))
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):          # q or Esc
                break
            if cv2.getWindowProperty("Shared Detector", cv2.WND_PROP_VISIBLE) < 1:
                break                          # window X button was clicked

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()