"""
split_dataset.py

Splits raw, collected images (data/raw/<class>/*.jpg) into the
train/val/test structure that train.py expects (data/train, data/val,
data/test), according to the ratios in configs/train_config.yaml.

Usage:
    python scripts/split_dataset.py
    python scripts/split_dataset.py --config configs/train_config.yaml
    python scripts/split_dataset.py --copy      # copy instead of move (keeps data/raw intact)

Run this BEFORE train.py, once your team has dropped collected/labeled
images into data/raw/<class_name>/.
"""
import argparse
import random
import shutil
from pathlib import Path

from utils import load_config, resolve_path, PROJECT_ROOT

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def find_images(folder: Path) -> list[Path]:
    return sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )


def split_list(items: list, ratios: dict, seed: int) -> dict:
    rng = random.Random(seed)
    shuffled = items[:]
    rng.shuffle(shuffled)

    n = len(shuffled)
    n_train = int(n * ratios["train"])
    n_val = int(n * ratios["val"])
    # test gets the remainder so rounding never drops an image
    return {
        "train": shuffled[:n_train],
        "val": shuffled[n_train:n_train + n_val],
        "test": shuffled[n_train + n_val:],
    }


def main():
    parser = argparse.ArgumentParser(description="Split raw class images into train/val/test.")
    parser.add_argument("--config", default=None, help="Path to train_config.yaml")
    parser.add_argument("--copy", action="store_true", help="Copy files instead of moving them")
    args = parser.parse_args()

    cfg = load_config(args.config) if args.config else load_config()
    classes = cfg["classes"]
    raw_dir = resolve_path(cfg, "raw_dir")
    data_dir = resolve_path(cfg, "data_dir")
    ratios = cfg["split_ratios"]
    seed = cfg.get("split_seed", 42)
    transfer = shutil.copy2 if args.copy else shutil.move

    assert abs(sum(ratios.values()) - 1.0) < 1e-6, "split_ratios must sum to 1.0"

    print(f"Splitting from: {raw_dir}")
    print(f"Writing to:     {data_dir}")
    print(f"Ratios:         {ratios}  (seed={seed}, {'copy' if args.copy else 'move'})\n")

    summary = []
    for cls in classes:
        src = raw_dir / cls
        if not src.exists():
            print(f"  [skip] {cls}: no folder at {src}")
            continue

        images = find_images(src)
        if not images:
            print(f"  [skip] {cls}: 0 images found in {src}")
            continue

        splits = split_list(images, ratios, seed)
        for split_name, files in splits.items():
            dest_dir = data_dir / split_name / cls
            dest_dir.mkdir(parents=True, exist_ok=True)
            for f in files:
                transfer(str(f), str(dest_dir / f.name))

        summary.append((cls, len(images), len(splits["train"]), len(splits["val"]), len(splits["test"])))
        print(f"  [ok]   {cls}: {len(images)} images -> "
              f"train={len(splits['train'])}, val={len(splits['val'])}, test={len(splits['test'])}")

    print("\nDone. Run scripts/check_dataset.py next to verify counts before training.")


if __name__ == "__main__":
    main()
