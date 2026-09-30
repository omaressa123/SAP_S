from app import env_config
from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class LivenessResult:
    passed: bool
    score: float
    reasons: list[str]


def _laplacian_variance(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def check_liveness(
    frames: list[np.ndarray],
    *,
    min_frames: int = 2,
    min_motion: float = 1.5,
    min_sharpness: float = 40.0,
) -> LivenessResult:
    """
    Lightweight anti-spoof heuristics for a kiosk webcam stream.

    Checks:
    1. Enough frames captured
    2. Face region is sharp (not a blurry print / screen smear)
    3. Inter-frame motion exists (live subject vs static photo)
    """
    reasons: list[str] = []
    if len(frames) < min_frames:
        return LivenessResult(False, 0.0, ["insufficient_frames"])

    grays = []
    for frame in frames:
        if frame is None or frame.size == 0:
            reasons.append("empty_frame")
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
        grays.append(gray)

    if len(grays) < min_frames:
        return LivenessResult(False, 0.0, reasons or ["insufficient_frames"])

    sharp = float(np.mean([_laplacian_variance(g) for g in grays]))
    if sharp < min_sharpness:
        reasons.append("low_sharpness_possible_spoof")

    motions = []
    for a, b in zip(grays, grays[1:]):
        h = min(a.shape[0], b.shape[0])
        w = min(a.shape[1], b.shape[1])
        diff = cv2.absdiff(a[:h, :w], b[:h, :w])
        motions.append(float(np.mean(diff)))
    motion = float(np.mean(motions)) if motions else 0.0
    if motion < min_motion:
        reasons.append("no_motion_possible_static_photo")

    # Score blends sharpness + motion into 0..1-ish (native Python types for JSON)
    score = float(min(1.0, (sharp / 200.0) * 0.5 + min(motion / 10.0, 1.0) * 0.5))
    passed = bool(len(reasons) == 0 and score >= 0.25)
    return LivenessResult(passed=passed, score=score, reasons=reasons)
