"""
check_dataset.py

Validates the dataset BEFORE you spend time training:
  - every class folder exists in train/val/test
  - every image file actually opens (catches corrupt downloads)
  - warns if any class is below the recommended minimum count
  - prints a summary table

Usage:
    python scripts/check_dataset.py
    python scripts/check_dataset.py --config configs/train_config.yaml

Exit code is non-zero if a class folder is completely empty in train/,
since training cannot proceed without it. Low-count warnings do not
block the run — they're advisory.
"""
import argparse
import sys
from pathlib import Path

from utils import load_config, resolve_path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def count_and_validate(folder: Path) -> tuple[int, int]:
    """Return (valid_count, corrupt_count) for images in a folder."""
    if not folder.exists():
        return 0, 0

    valid, corrupt = 0, 0
    for f in folder.iterdir():
        if not f.is_file() or f.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if not PIL_AVAILABLE:
            valid += 1
            continue
        try:
            with Image.open(f) as img:
                img.verify()
            valid += 1
        except Exception:
            corrupt += 1
    return valid, corrupt


def main():
    parser = argparse.ArgumentParser(description="Validate dataset before training.")
    parser.add_argument("--config", default=None, help="Path to train_config.yaml")
    args = parser.parse_args()

    cfg = load_config(args.config) if args.config else load_config()
    classes = cfg["classes"]
    data_dir = resolve_path(cfg, "data_dir")
    min_counts = cfg.get("min_images_per_class", {"train": 150, "val": 40, "test": 20})

    if not PIL_AVAILABLE:
        print("[warning] Pillow not installed — skipping corrupt-image check. "
              "Run: pip install -r requirements.txt\n")

    splits = ["train", "val", "test"]
    rows = []
    has_blocking_error = False
    total_corrupt = 0

    print(f"Checking dataset at: {data_dir}\n")
    header = f"{'class':<12}" + "".join(f"{s:>16}" for s in splits)
    print(header)
    print("-" * len(header))

    for cls in classes:
        counts = {}
        for split in splits:
            folder = data_dir / split / cls
            valid, corrupt = count_and_validate(folder)
            total_corrupt += corrupt
            below_min = valid < min_counts.get(split, 0)
            flag = "!" if below_min else ""
            counts[split] = f"{valid}{flag}" + (f" ({corrupt} bad)" if corrupt else "")

            if split == "train" and valid == 0:
                has_blocking_error = True

        row = f"{cls:<12}" + "".join(f"{counts[s]:>16}" for s in splits)
        print(row)
        rows.append((cls, counts))

    print("\n'!' = below the recommended minimum for that split (see min_images_per_class in config).")
    print("'(N bad)' = images that failed to open and should be re-collected or removed.")

    if total_corrupt > 0:
        print(f"\n[warning] {total_corrupt} corrupt/unreadable image(s) found across all classes.")

    if has_blocking_error:
        print("\n[BLOCKED] One or more classes have zero training images. "
              "Training cannot start until every class has at least one image in data/train/<class>/.")
        sys.exit(1)

    print("\nDataset check passed — ready for scripts/train.py "
          "(review any '!' warnings above first if you want stronger results).")


if __name__ == "__main__":
    main()
