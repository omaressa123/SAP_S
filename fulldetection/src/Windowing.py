"""
Stage 2b — Sliding window + labeling + train/test split.

For every video's per-frame keypoints:
  1. Compute per-frame features
  2. Slide a window across the video (config: windowing.window_frames / windowing.stride)
  3. Label each window "fall" (1) if it overlaps the video's annotated fall interval, else
     "not-fall" (0)
  4. Store both the aggregated feature vector (for Option A / Random Forest) and the raw
     per-frame sequence (for Option B / LSTM)
  5. Split by video, not by frame, so no fall event leaks across train/test

Usage:
    python src/windowing.py --keypoints_dir data/processed/keypoints \
                             --annotations_dir data/raw/le2i_annotations \
                             --output data/processed/windows.npz
"""

import argparse
from pathlib import Path

import numpy as np
from sklearn.model_selection import train_test_split
from tqdm import tqdm

from utils import load_config, parse_le2i_annotation, find_matching_annotation
from Features import per_frame_features, aggregate_window


def label_window(start, end, fall_start, fall_end):
    """A window is 'fall' if it overlaps the annotated fall interval at all."""
    if fall_start is None or fall_end is None:
        return 0  # ADL / no-fall video
    return int(not (end <= fall_start or start >= fall_end))


def process_video(keypoints_path, annotations_dir, window_frames, stride):
    video_keypoints = np.load(keypoints_path)
    num_frames = video_keypoints.shape[0]
    if num_frames < window_frames:
        return [], [], [], []

    annotation_path = find_matching_annotation(keypoints_path, annotations_dir) if annotations_dir else None
    fall_start, fall_end = parse_le2i_annotation(annotation_path) if annotation_path else (None, None)

    feat_dict = per_frame_features(video_keypoints)

    agg_vectors, sequences, labels, feature_names = [], [], [], None

    for start in range(0, num_frames - window_frames + 1, stride):
        end = start + window_frames
        agg_vector, names = aggregate_window(feat_dict, start, end)
        feature_names = names

        seq = np.stack(
            [feat_dict[k][start:end] for k in ["aspect_ratio", "centroid_y", "torso_angle", "centroid_velocity"]],
            axis=1,
        )  # shape (window_frames, 4)
        seq = np.nan_to_num(seq, nan=0.0)

        label = label_window(start, end, fall_start, fall_end)

        agg_vectors.append(agg_vector)
        sequences.append(seq)
        labels.append(label)

    return agg_vectors, sequences, labels, feature_names


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keypoints_dir", required=True, help="Directory of per-video .npy keypoint files")
    parser.add_argument("--annotations_dir", default=None, help="Directory of Le2i-style .txt fall annotations")
    parser.add_argument("--output", required=True, help="Output .npz path")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--test_size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    cfg = load_config(args.config) if Path(args.config).exists() else {}
    win_cfg = cfg.get("windowing", {})
    window_frames = win_cfg.get("window_frames", 30)
    stride = win_cfg.get("stride", 5)

    keypoints_dir = Path(args.keypoints_dir)
    video_files = sorted(keypoints_dir.rglob("*.npy"))
    if not video_files:
        print(f"No keypoint files found under {keypoints_dir}. Run pose_extraction.py first.")
        return

    all_agg, all_seq, all_labels, all_video_ids = [], [], [], []
    feature_names = None

    for video_path in tqdm(video_files, desc="Windowing videos"):
        agg_vectors, sequences, labels, names = process_video(
            video_path, args.annotations_dir, window_frames, stride
        )
        if names:
            feature_names = names
        all_agg.extend(agg_vectors)
        all_seq.extend(sequences)
        all_labels.extend(labels)
        all_video_ids.extend([video_path.stem] * len(labels))

    if not all_labels:
        print("No windows produced — check keypoints_dir / annotations_dir paths.")
        return

    X_agg = np.array(all_agg, dtype=np.float32)
    X_seq = np.array(all_seq, dtype=np.float32)
    y = np.array(all_labels, dtype=np.int64)
    video_ids = np.array(all_video_ids)

    # Split by unique video/subject so a fall event never appears in both train and test
    unique_videos = np.unique(video_ids)
    train_videos, test_videos = train_test_split(unique_videos, test_size=args.test_size, random_state=args.seed)
    train_mask = np.isin(video_ids, train_videos)
    test_mask = np.isin(video_ids, test_videos)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        out_path,
        X_agg_train=X_agg[train_mask], X_agg_test=X_agg[test_mask],
        X_seq_train=X_seq[train_mask], X_seq_test=X_seq[test_mask],
        y_train=y[train_mask], y_test=y[test_mask],
        feature_names=np.array(feature_names),
    )

    print(f"Saved {len(y)} windows ({y.sum()} fall / {len(y) - y.sum()} not-fall) to {out_path}")
    print(f"Train videos: {len(train_videos)}  Test videos: {len(test_videos)}")


if __name__ == "__main__":
    main()