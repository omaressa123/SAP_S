import numpy as np

from app.services.liveness import check_liveness


def test_liveness_insufficient_frames():
    result = check_liveness([])
    assert result.passed is False


def test_liveness_static_photo_fails():
    frame = np.full((120, 160, 3), 120, dtype=np.uint8)
    # Add texture so sharpness passes but motion fails
    rng = np.random.default_rng(0)
    noise = rng.integers(0, 40, size=frame.shape, dtype=np.uint8)
    frame = cv2_add(frame, noise)
    result = check_liveness([frame, frame.copy(), frame.copy()], min_motion=2.0)
    assert result.passed is False
    assert "no_motion_possible_static_photo" in result.reasons


def test_liveness_motion_passes():
    rng = np.random.default_rng(1)
    frames = []
    for i in range(3):
        base = rng.integers(40, 200, size=(120, 160, 3), dtype=np.uint8)
        frames.append(base)
    result = check_liveness(frames, min_motion=0.5, min_sharpness=5.0)
    assert result.passed is True
    assert result.score > 0


def cv2_add(a, b):
    return np.clip(a.astype(np.int16) + b.astype(np.int16), 0, 255).astype(np.uint8)
