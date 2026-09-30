"""
download_public_datasets.py

Pulls the public datasets that have a reliable, scriptable source straight
into data/raw/<class>/, and prints clear manual-download instructions for
the ones that don't (Google Drive folders can't be reliably scripted — links
expire, require auth prompts, or need per-file confirmation tokens).

What this script automates:
    - fire + smoke  <- D-Fire (Kaggle mirror), then auto-converts YOLO
                       detection labels into classification folders
    - fog           <- RESIDE RTTS subset (Kaggle mirror), real-world
                       hazy images, used directly as-is

What it does NOT automate (and tells you how to get manually):
    - dust          <- Construction Dust Emission (CDE) dataset — Google
                       Drive only, no maintained Kaggle mirror found
    - explosion, steam, sunlight, reflection, normal
                    <- no adequate public dataset exists for these in an
                       airport-CCTV context (see project notes); these are
                       self-collection classes by design

Requirements:
    pip install kaggle
    A Kaggle account + API token at ~/.kaggle/kaggle.json
    (https://www.kaggle.com/docs/api -> "Create New API Token")

Usage:
    python scripts/download_public_datasets.py
    python scripts/download_public_datasets.py --skip-dfire      # only RTTS
    python scripts/download_public_datasets.py --skip-rtts       # only D-Fire
    python scripts/download_public_datasets.py --keep-mixed --include-none
        # forwarded to convert_dfire_to_classification.py
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EXTERNAL_DIR = PROJECT_ROOT / "data" / "external"
RAW_DIR = PROJECT_ROOT / "data" / "raw"

DFIRE_KAGGLE_SLUG = "sayedgamal99/smoke-fire-detection-yolo"
RTTS_KAGGLE_SLUG = "tuncnguyn/rtts-dataset"

IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".bmp", ".webp"]


def check_kaggle_cli():
    if shutil.which("kaggle") is None:
        sys.exit(
            "The 'kaggle' CLI is not installed or not on PATH.\n"
            "Install it with:  pip install kaggle\n"
            "Then create an API token (Kaggle account settings -> 'Create New API Token')\n"
            "and place kaggle.json at ~/.kaggle/kaggle.json (chmod 600 on Linux/macOS)."
        )


def kaggle_download(slug: str, dest: Path):
    dest.mkdir(parents=True, exist_ok=True)
    print(f"\nDownloading Kaggle dataset '{slug}' -> {dest}")
    result = subprocess.run(
        ["kaggle", "datasets", "download", "-d", slug, "-p", str(dest), "--unzip"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        sys.exit(
            f"Kaggle download failed for '{slug}'. Common causes:\n"
            f"  - kaggle.json not configured (see --help for setup)\n"
            f"  - dataset slug moved/renamed since this script was written — "
            f"search kaggle.com for a current mirror and pass its path manually\n"
            f"  - you haven't accepted the dataset's terms on the Kaggle website yet"
        )
    print(f"Done: {slug}")


def move_flat_images(src: Path, dest: Path, label: str):
    """Move/copy every image found anywhere under src into a flat dest folder."""
    dest.mkdir(parents=True, exist_ok=True)
    images = [p for p in src.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS]
    if not images:
        print(f"  [warning] no images found under {src} for {label}")
        return 0
    for img in images:
        target = dest / img.name
        if target.exists():
            target = dest / f"{img.stem}_{abs(hash(str(img)))}{img.suffix}"
        shutil.copy2(str(img), str(target))
    print(f"  {label}: {len(images)} images -> {dest}")
    return len(images)


def print_manual_instructions():
    print("\n" + "=" * 70)
    print("MANUAL STEPS — the remaining classes need to be collected by hand")
    print("=" * 70)
    print("""
dust  (Construction Dust Emission dataset — Google Drive only, no
       reliable Kaggle mirror to script against):
    1. Open: https://github.com/ruoxinx/site-dust-detect
    2. Download the "Testing subset (real-world images)" Google Drive
       folder (the 234 dust-filled real photos — skip the synthetic
       training subset, real photos will transfer better to your camera)
    3. Place the images into: data/raw/dust/
    Note: this dataset is construction-site dust, not airport dust — plan
    to supplement with your own airport/terminal-context dust photos too.

explosion, steam, sunlight, reflection, normal:
    No adequate public dataset exists for these in an airport-CCTV
    context — these are self-collection classes by design (see the
    project's Smoke & Fire Detection notes for what to shoot and how much).
    Drop your own photos/frames directly into:
        data/raw/explosion/
        data/raw/steam/
        data/raw/sunlight/
        data/raw/reflection/
        data/raw/normal/
""")


def main():
    parser = argparse.ArgumentParser(description="Download public datasets for the smoke/fire classifier.")
    parser.add_argument("--skip-dfire", action="store_true", help="Skip the D-Fire (fire/smoke) download")
    parser.add_argument("--skip-rtts", action="store_true", help="Skip the RTTS (fog) download")
    parser.add_argument("--include-none", action="store_true",
                         help="Forwarded to the D-Fire converter: route empty-label images into normal/")
    parser.add_argument("--keep-mixed", action="store_true",
                         help="Forwarded to the D-Fire converter: route fire+smoke images into fire/")
    args = parser.parse_args()

    check_kaggle_cli()
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    if not args.skip_dfire:
        dfire_dir = EXTERNAL_DIR / "dfire"
        kaggle_download(DFIRE_KAGGLE_SLUG, dfire_dir)

        print("\nConverting D-Fire YOLO labels into classification folders...")
        convert_script = PROJECT_ROOT / "scripts" / "convert_dfire_to_classification.py"
        cmd = [sys.executable, str(convert_script), "--dataset-dir", str(dfire_dir), "--output-dir", str(RAW_DIR)]
        if args.include_none:
            cmd.append("--include-none")
        if args.keep_mixed:
            cmd.append("--keep-mixed")
        subprocess.run(cmd, check=True)

    if not args.skip_rtts:
        rtts_dir = EXTERNAL_DIR / "rtts"
        kaggle_download(RTTS_KAGGLE_SLUG, rtts_dir)
        print("\nCopying RTTS images into data/raw/fog/ ...")
        move_flat_images(rtts_dir, RAW_DIR / "fog", "fog")

    print_manual_instructions()

    print("=" * 70)
    print("Next steps once every class folder in data/raw/ has images:")
    print("  1. python scripts/split_dataset.py")
    print("  2. python scripts/check_dataset.py")
    print("  3. python scripts/train.py")
    print("=" * 70)


if __name__ == "__main__":
    main()
