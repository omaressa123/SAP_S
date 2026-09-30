"""
evaluate.py

Runs the trained model against the held-out test set and reports
per-class accuracy — most important: how often confounder classes
(steam, fog, dust, sunlight, reflection) get misclassified as a
hazard class (fire, smoke, explosion). That confusion rate is the
key number for this module.

Usage:
    python scripts/evaluate.py --weights outputs/smoke_fire_v1/weights/best.pt
    python scripts/evaluate.py --weights outputs/smoke_fire_v1/weights/best.pt --config configs/train_config.yaml
"""
import argparse
import sys

from utils import load_config, resolve_path

try:
    from ultralytics import YOLO
except ImportError:
    sys.exit("Missing dependency 'ultralytics'. Run: pip install -r requirements.txt")


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate the trained smoke/fire classifier.")
    parser.add_argument("--weights", required=True, help="Path to trained .pt weights (e.g. outputs/.../best.pt)")
    parser.add_argument("--config", default=None, help="Path to train_config.yaml")
    parser.add_argument("--split", default="test", choices=["train", "val", "test"],
                         help="Which split to evaluate on (default: test)")
    return parser.parse_args()


def main():
    args = parse_args()
    cfg = load_config(args.config) if args.config else load_config()
    data_dir = resolve_path(cfg, "data_dir")
    hazard_classes = set(cfg.get("hazard_classes", ["fire", "smoke", "explosion"]))

    model = YOLO(args.weights)

    print(f"Evaluating on: {data_dir} [{args.split}]")
    metrics = model.val(data=str(data_dir), split=args.split)

    print("\n" + "=" * 60)
    print("Overall metrics")
    print("=" * 60)
    print(f"Top-1 accuracy: {metrics.top1:.4f}")
    print(f"Top-5 accuracy: {metrics.top5:.4f}")

    print("\nA confusion matrix plot is saved automatically by ultralytics under the")
    print("run's output folder (e.g. outputs/<run_name>/confusion_matrix.png).")
    print("\nWhen you review it, check specifically:")
    print(f"  - hazard classes {sorted(hazard_classes)} — false negatives here are the costly errors")
    print("  - confounder classes (steam/fog/dust/sunlight/reflection) misclassified INTO a hazard")
    print("    class — that's the false-alarm rate this dataset design was meant to reduce.")


if __name__ == "__main__":
    main()
