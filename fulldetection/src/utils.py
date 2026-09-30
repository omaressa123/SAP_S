"""Shared helpers: annotation parsing, video discovery, config loading."""

from pathlib import Path
import yaml


def load_config(config_path="config.yaml"):
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def parse_le2i_annotation(annotation_path):
    """
    Parses a Le2i-style annotation .txt file.

    Standard Le2i format: the first line is the fall start frame number, the second
    line is the fall end frame number, and remaining lines (if present) hold per-frame
    bounding boxes — we only need the start/end here.

    Returns (start_frame, end_frame) as ints, or (None, None) for an ADL (no-fall) video
    that has no annotation file at all.
    """
    annotation_path = Path(annotation_path)
    if not annotation_path.exists():
        return None, None

    with open(annotation_path, "r") as f:
        lines = [line.strip() for line in f if line.strip()]

    if len(lines) < 2:
        return None, None

    try:
        start_frame = int(lines[0])
        end_frame = int(lines[1])
    except ValueError:
        # Some mirrors prepend a header row — fall back to scanning for the first two ints
        ints = [int(l) for l in lines if l.lstrip("-").isdigit()]
        if len(ints) < 2:
            return None, None
        start_frame, end_frame = ints[0], ints[1]

    return start_frame, end_frame


def find_videos(root_dir, extensions=(".avi", ".mp4", ".mov")):
    root = Path(root_dir)
    return sorted(p for p in root.rglob("*") if p.suffix.lower() in extensions)


def find_matching_annotation(video_path, annotations_dir):
    """
    Le2i mirrors typically name annotation files after the video (e.g. video (1).avi ->
    video (1).txt). Adjust this matching rule if your copy of the dataset differs.
    """
    video_path = Path(video_path)
    annotations_dir = Path(annotations_dir)
    candidates = sorted(annotations_dir.rglob(video_path.stem + ".txt"))
    if not candidates:
        return None

    # Prefer an annotation from the same recording folder when keypoints preserve
    # the dataset's relative directory structure.
    for candidate in candidates:
        if any(part in video_path.parts for part in candidate.parts[:-1]):
            return candidate
    return candidates[0]