"""
Stage 3, Option A — Random Forest (or XGBoost) on window-aggregated features.

Recommended starting point: fast to train, works well on small datasets, and the feature
importances give you a defensible answer to "why did it flag this?" for your report.

Usage:
    python src/train_rf.py --data data/processed/windows.npz --out models/rf_fall_model.joblib
"""

import argparse
from pathlib import Path

import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

from utils import load_config

try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False


def build_model(cfg, model_type):
    rf_cfg = cfg.get("classifier", {}).get("random_forest", {})
    if model_type == "xgboost":
        if not HAS_XGBOOST:
            raise ImportError("xgboost not installed — run: pip install xgboost")
        return XGBClassifier(
            n_estimators=rf_cfg.get("n_estimators", 300),
            max_depth=rf_cfg.get("max_depth", 12),
            use_label_encoder=False,
            eval_metric="logloss",
        )
    return RandomForestClassifier(
        n_estimators=rf_cfg.get("n_estimators", 300),
        max_depth=rf_cfg.get("max_depth", 12),
        class_weight=rf_cfg.get("class_weight", "balanced"),
        random_state=42,
        n_jobs=-1,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="windows.npz produced by windowing.py")
    parser.add_argument("--out", required=True, help="Path to save the trained model (.joblib)")
    parser.add_argument("--model_type", choices=["random_forest", "xgboost"], default="random_forest")
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()

    cfg = load_config(args.config) if Path(args.config).exists() else {}

    data = np.load(args.data, allow_pickle=True)
    X_train, y_train = data["X_agg_train"], data["y_train"]
    X_test, y_test = data["X_agg_test"], data["y_test"]
    feature_names = data["feature_names"]

    print(f"Train: {X_train.shape}, Test: {X_test.shape}")
    print(f"Class balance — train: {np.bincount(y_train)}, test: {np.bincount(y_test)}")

    model = build_model(cfg, args.model_type)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("\n=== Test set performance ===")
    print(classification_report(y_test, y_pred, target_names=["not-fall", "fall"]))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))

    if hasattr(model, "feature_importances_"):
        importances = sorted(
            zip(feature_names, model.feature_importances_), key=lambda x: -x[1]
        )
        print("\nTop 10 feature importances (useful for your defense):")
        for name, importance in importances[:10]:
            print(f"  {name:25s} {importance:.4f}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_names": feature_names}, out_path)
    print(f"\nModel saved to {out_path}")


if __name__ == "__main__":
    main()