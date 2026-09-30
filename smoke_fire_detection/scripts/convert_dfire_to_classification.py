"""
convert_dfire_to_classification.py

D-Fire (https://github.com/gaia-solutions-on-demand/DFireDataset) ships as an
OBJECT DETECTION dataset: one image + one YOLO-format .txt label file per
image, where each label line is "<class_id> <x_center> <y_center> <w> <h>".

Our pipeline trains a CLASSIFIER (one folder per class), so this script reads
each label file, decides which single class the image belongs to, and copies
the image into the matching data/raw/<class>/ folder.

Confirmed D-Fire class-id convention (verify against the downloaded dataset's
own README/data.yaml if you used a different mirror — some re-uploads swap
the order):
    0 = smoke
    1 = fire

Handling rules:
    - Label file has ONLY class 0 lines         -> goes to "smoke"
    - Label file has ONLY class 1 lines         -> goes to "fire"
    - Label file has BOTH class 0 and 1 lines   -> skipped by default
                                                    (ambiguous for a single-label
                                                    classifier); use --keep-mixed
                                                    to route these to "fire"
                                                    instead of skipping, since
                                                    fire presence is the more
                                                    safety-critical signal
    - Label file is EMPTY (0 bytes, no lines)   -> D-Fire's "none" images.
                                                    Skipped by default; pass
                                                    --include-none to route
                                                    these into "normal", which
                                                    is a legitimate source of
                                                    background/no-hazard images
                                                    for that class.

Usage:
    # Basic: point at wherever you extracted the Kaggle/OneDrive D-Fire download
    python scripts/convert_dfire_to_classification.py \\
        --dataset-dir path/to/dfire_extracted \\
        --output-dir data/raw

    # Also harvest "none" images into the normal/ class
    python scripts/convert_dfire_to_classification.py \\
        --dataset-dir path/to/dfire_extracted \\
        --output-dir data/raw \\
        --include-none

    # Route ambiguous fire+smoke images into fire/ instead of skipping them
    python scripts/convert_dfire_to_classification.py \\
        --dataset-dir path/to/dfire_extracted \\
        --output-dir data/raw \\
        --keep-mixed

This script only expects a folder tree containing .txt label files somewhere
alongside/near their matching images — it does not assume a fixed D-Fire
folder layout, since different mirrors (OneDrive vs. the Kaggle re-upload)
have organized files differently. It searches for images using several
common conventions (see find_matching_image()).
"""
import argparse
import shutil
import sys
from pathlib import Path

IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".bmp", ".webp"]

SMOKE_CLASS_ID = 0
FIRE_CLASS_ID = 1


def find_matching_image(label_path: Path) -> Path | None:
    """
    Given a YOLO label .txt file, find its matching image.
    Tries, in order:
      1. Same folder, same stem, common image extensions
      2. A sibling 'images' folder if this one is inside 'labels'
         (the standard YOLO dataset convention: .../labels/x.txt <-> .../images/x.jpg)
    """
    stem = label_path.stem

    # 1. Same folder
    for ext in IMAGE_EXTENSIONS:
        candidate = label_path.with_suffix(ext)
        if candidate.exists():
            return candidate

    # 2. labels/ -> images/ sibling convention
    if "labels" in label_path.parts:
        images_parts = [p if p != "labels" else "images" for p in label_path.parts]
        images_dir = Path(*images_parts).parent
        for ext in IMAGE_EXTENSIONS:
            candidate = images_dir / f"{stem}{ext}"
            if candidate.exists():
                return candidate

    return None


def classify_label(label_path: Path) -> str:
    """
    Read a YOLO label file and return one of: 'smoke', 'fire', 'mixed', 'none'.
    """
    text = label_path.read_text().strip()
    if not text:
        return "none"

    class_ids = set()
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        try:
            class_ids.add(int(parts[0]))
        except (ValueError, IndexError):
            continue

    has_smoke = SMOKE_CLASS_ID in class_ids
    has_fire = FIRE_CLASS_ID in class_ids

    if has_fire and has_smoke:
        return "mixed"
    if has_fire:
        return "fire"
    if has_smoke:
        return "smoke"
    return "none"  # label file had lines, but no recognized class id


def main():
    parser = argparse.ArgumentParser(description="Convert D-Fire YOLO labels into classification folders.")
    parser.add_argument("--dataset-dir", required=True, help="Root folder of the extracted D-Fire download")
    parser.add_argument("--output-dir", default="data/raw", help="Where to write fire/ and smoke/ folders (default: data/raw)")
    parser.add_argument("--include-none", action="store_true", help="Route empty-label images into output-dir/normal/")
    parser.add_argument("--keep-mixed", action="store_true", help="Route fire+smoke images into fire/ instead of skipping them")
    parser.add_argument("--copy", action="store_true", help="Copy files instead of the default (also copy — this dataset should stay reusable)")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset_dir)
    output_dir = Path(args.output_dir)

    if not dataset_dir.exists():
        sys.exit(f"Dataset directory not found: {dataset_dir}")

    label_files = sorted(dataset_dir.rglob("*.txt"))
    if not label_files:
        sys.exit(
            f"No .txt label files found under {dataset_dir}. "
            "Check that --dataset-dir points at the extracted D-Fire download."
        )

    print(f"Found {len(label_files)} label files under {dataset_dir}\n")

    # counts of images actually COPIED, by destination folder
    copied = {"fire": 0, "smoke": 0, "normal": 0}
    # counts of images SEEN, by original category (before mixed/none routing)
    seen = {"fire": 0, "smoke": 0, "mixed": 0, "none": 0}
    no_image_found = 0

    for label_path in label_files:
        image_path = find_matching_image(label_path)
        if image_path is None:
            no_image_found += 1
            continue

        category = classify_label(label_path)
        seen[category] += 1

        # Decide destination folder (or skip) based on category + flags
        if category in ("fire", "smoke"):
            dest_class = category
        elif category == "mixed":
            if not args.keep_mixed:
                continue
            dest_class = "fire"  # fire presence is the safety-critical signal
        else:  # category == "none"
            if not args.include_none:
                continue
            dest_class = "normal"

        dest_dir = output_dir / dest_class
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(image_path), str(dest_dir / image_path.name))
        copied[dest_class] += 1

    print("Conversion summary")
    print("-" * 40)
    print(f"  fire-only images found        : {seen['fire']}  (copied: {copied['fire']})")
    print(f"  smoke-only images found       : {seen['smoke']}  (copied: {copied['smoke']})")
    print(f"  fire+smoke images found       : {seen['mixed']}  "
          f"({'routed to fire/' if args.keep_mixed else 'skipped — pass --keep-mixed to route to fire/'})")
    print(f"  empty-label (none) images     : {seen['none']}  "
          f"({'routed to normal/, copied: ' + str(copied['normal']) if args.include_none else 'skipped — pass --include-none to route to normal/'})")
    if no_image_found:
        print(f"  [warning] labels with no matching image found: {no_image_found}")

    print(f"\nDone. Images written under: {output_dir}/fire, {output_dir}/smoke"
          + (f", {output_dir}/normal" if args.include_none else ""))
    print("Next: run scripts/split_dataset.py to divide these into train/val/test.")


if __name__ == "__main__":
    main()