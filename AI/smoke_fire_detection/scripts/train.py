"""
train.py

Fine-tunes a YOLOv8 classification model on the 9-class
smoke / fire / confounder dataset.

Usage:
    python scripts/train.py
    python scripts/train.py --config configs/train_config.yaml
    python scripts/train.py --epochs 80 --batch 16      # override individual config values
    python scripts/train.py --device cpu                # force CPU

Before running this:
    1. Populate data/raw/<class>/ with collected images (or fill
       data/train, data/val, data/test directly).
    2. python scripts/split_dataset.py     (if using data/raw)
    3. python scripts/check_dataset.py     (must pass first)
"""
import argparse
import sys

from utils import load_config, resolve_path, PROJECT_ROOT

try:
    from ultralytics import YOLO
except ImportError:
    sys.exit(
        "Missing dependency 'ultralytics'. Run: pip install -r requirements.txt"
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Train the smoke/fire classifier.")
    parser.add_argument("--config", default=None, help="Path to train_config.yaml")
    parser.add_argument("--epochs", type=int, default=None, help="Override epochs")
    parser.add_argument("--batch", type=int, default=None, help="Override batch size")
    parser.add_argument("--imgsz", type=int, default=None, help="Override image size")
    parser.add_argument("--model", default=None, help="Override base model checkpoint")
    parser.add_argument("--device", default=None, help="Override device, e.g. 'cpu' or '0'")
    parser.add_argument("--run-name", default=None, help="Override output run name")
    return parser.parse_args()


def main():
    args = parse_args()
    cfg = load_config(args.config) if args.config else load_config()

    # CLI overrides take priority over the YAML config
    epochs = args.epochs or cfg["epochs"]
    batch = args.batch or cfg["batch"]
    imgsz = args.imgsz or cfg["imgsz"]
    base_model = args.model or cfg["model"]
    device = args.device if args.device is not None else cfg.get("device", "cpu")
    run_name = args.run_name or cfg.get("run_name", "smoke_fire_run")

    data_dir = resolve_path(cfg, "data_dir")
    output_dir = resolve_path(cfg, "output_dir")

    print("=" * 60)
    print("Smoke & Fire Detection — Training")
    print("=" * 60)
    print(f"Base model : {base_model}")
    print(f"Data dir   : {data_dir}")
    print(f"Classes    : {cfg['classes']}")
    print(f"Epochs     : {epochs}")
    print(f"Batch size : {batch}")
    print(f"Image size : {imgsz}")
    print(f"Device     : {device}")
    print(f"Output dir : {output_dir}/{run_name}")
    print("=" * 60)

    # Fail fast with a clear message rather than a cryptic ultralytics error
    for split in ["train", "val"]:
        split_dir = data_dir / split
        if not split_dir.exists() or not any(split_dir.iterdir()):
            sys.exit(
                f"'{split_dir}' is empty or missing. Populate your dataset and run "
                f"scripts/check_dataset.py before training."
            )

    model = YOLO(base_model)  # downloads pretrained ImageNet weights on first run

    model.train(
        data=str(data_dir),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        patience=cfg.get("patience", 10),
        optimizer=cfg.get("optimizer", "auto"),
        lr0=cfg.get("lr0", 0.001),
        seed=cfg.get("seed", 42),
        device=device,
        workers=cfg.get("workers", 4),
        augment=cfg.get("augment", True),
        hsv_h=cfg.get("hsv_h", 0.015),
        hsv_s=cfg.get("hsv_s", 0.5),
        hsv_v=cfg.get("hsv_v", 0.4),
        degrees=cfg.get("degrees", 10.0),
        flipud=cfg.get("flipud", 0.0),
        fliplr=cfg.get("fliplr", 0.5),
        translate=cfg.get("translate", 0.1),
        scale=cfg.get("scale", 0.3),
        project=str(output_dir),
        name=run_name,
        exist_ok=True,
    )

    print("\nTraining complete.")
    print(f"Best weights: {output_dir}/{run_name}/weights/best.pt")
    print("Next: python scripts/evaluate.py  to check per-class performance on the test set.")


if __name__ == "__main__":
    main()
