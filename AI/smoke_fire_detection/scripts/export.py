"""
export.py

Exports trained weights to a deployment-ready format. Run this only
after training and evaluation look good — export is not part of
training itself, but is included here since every training pipeline
needs a defined "final artifact" step.

Usage:
    python scripts/export.py --weights outputs/smoke_fire_v1/weights/best.pt --format onnx
    python scripts/export.py --weights outputs/smoke_fire_v1/weights/best.pt --format torchscript
"""
import argparse
import sys

try:
    from ultralytics import YOLO
except ImportError:
    sys.exit("Missing dependency 'ultralytics'. Run: pip install -r requirements.txt")


def parse_args():
    parser = argparse.ArgumentParser(description="Export trained weights for deployment.")
    parser.add_argument("--weights", required=True, help="Path to trained .pt weights")
    parser.add_argument(
        "--format", default="onnx",
        choices=["onnx", "torchscript", "engine", "openvino"],
        help="Export format (engine=TensorRT, requires a compatible GPU/toolchain)",
    )
    parser.add_argument("--imgsz", type=int, default=224, help="Must match training imgsz")
    return parser.parse_args()


def main():
    args = parse_args()
    model = YOLO(args.weights)

    print(f"Exporting {args.weights} -> {args.format} (imgsz={args.imgsz})")
    exported_path = model.export(format=args.format, imgsz=args.imgsz)
    print(f"\nDone. Exported model: {exported_path}")


if __name__ == "__main__":
    main()
