"""
Stage 2 — Feature engineering.

Turns a per-frame MediaPipe keypoint array (num_frames, 33, 3) into the five features that
actually distinguish a fall from bending/sitting:
  1. bounding-box aspect ratio
  2. centroid vertical position
  3. vertical velocity of centroid
  4. torso angle from vertical
  5. post-event stillness (computed separately, see `stillness_score`)

MediaPipe Pose landmark indices used here:
  11 = left shoulder, 12 = right shoulder, 23 = left hip, 24 = right hip
"""

import numpy as np

LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
LEFT_HIP, RIGHT_HIP = 23, 24


def _valid_mask(frame_kp):
    """True where a keypoint has usable (non-NaN) coordinates."""
    return ~np.isnan(frame_kp[:, 0])


def bbox_aspect_ratio(frame_kp):
    mask = _valid_mask(frame_kp)
    if mask.sum() < 2:
        return np.nan
    xs, ys = frame_kp[mask, 0], frame_kp[mask, 1]
    width = xs.max() - xs.min()
    height = ys.max() - ys.min()
    if height < 1e-6:
        return np.nan
    return width / height


def centroid_vertical_position(frame_kp):
    """Midpoint of shoulders and hips, normalized (0=top of frame, 1=bottom)."""
    idxs = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP]
    pts = frame_kp[idxs]
    if np.isnan(pts[:, 1]).all():
        return np.nan
    return np.nanmean(pts[:, 1])


def torso_angle_from_vertical(frame_kp):
    """Angle (degrees) between the shoulder-hip line and vertical. 0=upright, 90=horizontal."""
    shoulder_mid = np.nanmean(frame_kp[[LEFT_SHOULDER, RIGHT_SHOULDER]], axis=0)
    hip_mid = np.nanmean(frame_kp[[LEFT_HIP, RIGHT_HIP]], axis=0)
    if np.isnan(shoulder_mid).any() or np.isnan(hip_mid).any():
        return np.nan

    dx = hip_mid[0] - shoulder_mid[0]
    dy = hip_mid[1] - shoulder_mid[1]
    if dx == 0 and dy == 0:
        return np.nan

    angle_from_vertical = np.degrees(np.arctan2(abs(dx), abs(dy)))
    return angle_from_vertical


def per_frame_features(video_keypoints):
    """
    video_keypoints: (num_frames, 33, 3) array from pose_extraction.py

    Returns a DataFrame-like dict of arrays, one entry per feature, each of length num_frames:
        aspect_ratio, centroid_y, torso_angle, centroid_velocity
    """
    num_frames = video_keypoints.shape[0]

    aspect_ratio = np.full(num_frames, np.nan)
    centroid_y = np.full(num_frames, np.nan)
    torso_angle = np.full(num_frames, np.nan)

    for i in range(num_frames):
        frame_kp = video_keypoints[i]
        aspect_ratio[i] = bbox_aspect_ratio(frame_kp)
        centroid_y[i] = centroid_vertical_position(frame_kp)
        torso_angle[i] = torso_angle_from_vertical(frame_kp)

    # Vertical velocity = frame-to-frame change in centroid_y (first frame has no prior -> 0)
    centroid_velocity = np.zeros(num_frames)
    centroid_velocity[1:] = np.diff(centroid_y)

    return {
        "aspect_ratio": aspect_ratio,
        "centroid_y": centroid_y,
        "torso_angle": torso_angle,
        "centroid_velocity": centroid_velocity,
    }


def aggregate_window(feature_dict, start, end):
    """
    Option A input: collapses a window's per-frame features into a fixed-length vector of
    max/min/mean per feature. `start`/`end` are frame indices (end exclusive).
    """
    vector = []
    names = []
    for feat_name, values in feature_dict.items():
        window_vals = values[start:end]
        window_vals = window_vals[~np.isnan(window_vals)]
        if len(window_vals) == 0:
            agg = [0.0, 0.0, 0.0]
        else:
            agg = [window_vals.max(), window_vals.min(), window_vals.mean()]
        vector.extend(agg)
        names.extend([f"{feat_name}_max", f"{feat_name}_min", f"{feat_name}_mean"])
    return np.array(vector, dtype=np.float32), names


def stillness_score(video_keypoints, start_frame, num_frames_to_check):
    """
    Post-event stillness — the highest-value false-positive filter.
    Returns the mean frame-to-frame centroid movement over the following window.
    Low value = person stayed still (real fall). High value = person got back up / moved a lot.
    """
    end_frame = min(start_frame + num_frames_to_check, video_keypoints.shape[0])
    segment = video_keypoints[start_frame:end_frame]
    if segment.shape[0] < 2:
        return None  # not enough data to judge yet

    centroids = []
    for frame_kp in segment:
        cy = centroid_vertical_position(frame_kp)
        centroids.append(cy)
    centroids = np.array(centroids)

    valid = ~np.isnan(centroids)
    if valid.sum() < 2:
        return None

    movement = np.abs(np.diff(centroids[valid]))
    return float(np.mean(movement))