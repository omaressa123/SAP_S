"""
Shared helpers for the smoke_fire_detection training pipeline.
"""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("Missing dependency 'PyYAML'. Run: pip install -r requirements.txt")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "configs" / "train_config.yaml"


def load_config(config_path: str | Path = DEFAULT_CONFIG_PATH) -> dict:
    """Load and lightly validate the YAML training config."""
    config_path = Path(config_path)
    if not config_path.exists():
        sys.exit(f"Config file not found: {config_path}")

    with open(config_path, "r") as f:
        cfg = yaml.safe_load(f)

    required_keys = ["classes", "data_dir", "model", "imgsz", "epochs", "batch"]
    missing = [k for k in required_keys if k not in cfg]
    if missing:
        sys.exit(f"Config is missing required keys: {missing}")

    if "normal" not in cfg["classes"]:
        sys.exit(
            "Config error: 'normal' class is missing from classes list. "
            "A no-hazard background class is required."
        )

    return cfg


def resolve_path(cfg: dict, key: str) -> Path:
    """Resolve a config path value relative to the project root."""
    p = Path(cfg[key])
    return p if p.is_absolute() else PROJECT_ROOT / p


def class_dirs(base_dir: Path, classes: list[str]) -> dict[str, Path]:
    """Return {class_name: Path} for every class folder under base_dir."""
    return {c: base_dir / c for c in classes}
