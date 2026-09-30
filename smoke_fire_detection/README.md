# Smoke & Fire Detection — Training Infrastructure

Part of the **Smart Airport** project (Passenger Monitoring / Emergency AI module).

This repository is **training infrastructure only** — it contains no images and no
trained weights. It's a ready-to-populate pipeline: drop in your collected/labeled
images, run three commands, and you have a trained, evaluated, exportable model.
It does **not** include the live camera-scanning/scheduler system that consumes
this model in production — that's a separate, later stage of the project.

---

## 1. The 9 Classes

| Class | Type | Notes |
|---|---|---|
| `fire` | Hazard | |
| `smoke` | Hazard | |
| `explosion` | Hazard | Dataset should mostly capture the aftermath (plume/debris), not the instantaneous flash — see project notes |
| `steam` | Confounder | Visually close to smoke |
| `fog` | Confounder | Environmental mist/haze |
| `dust` | Confounder | Baggage handling, construction-style dust |
| `sunlight` | Confounder | Glare through windows |
| `reflection` | Confounder | Glare off glass/metal |
| `normal` | Background | Required — "nothing is happening." Do not remove this class. |

## 2. Recommended Data Volume

| Class type | Recommended minimum (train split) |
|---|---|
| Hazard classes (fire, smoke, explosion) | 300–500 images each |
| Confounder classes (steam, fog, dust, sunlight, reflection) | 200–300 images each |
| Normal | 500+ images (widest variety of conditions) |

The pipeline will still run below these numbers — `check_dataset.py` will just warn you.

---

## 3. Project Structure

```
smoke_fire_detection/
├── data/
│   ├── raw/            # drop newly collected images here, one subfolder per class
│   │   ├── fire/
│   │   ├── smoke/
│   │   ├── explosion/
│   │   ├── steam/
│   │   ├── fog/
│   │   ├── dust/
│   │   ├── sunlight/
│   │   ├── reflection/
│   │   └── normal/
│   ├── train/           # populated automatically by split_dataset.py (or fill manually)
│   ├── val/
│   └── test/
├── scripts/
│   ├── utils.py          # shared config loader
│   ├── split_dataset.py  # data/raw -> data/train + val + test
│   ├── check_dataset.py  # validates counts & image integrity before training
│   ├── train.py           # fine-tunes YOLOv8-cls
│   ├── evaluate.py        # per-class metrics on the test set
│   └── export.py          # export trained weights to ONNX/TorchScript/etc.
├── configs/
│   └── train_config.yaml  # every setting lives here — classes, split ratios, hyperparameters
├── outputs/                # training runs land here (weights, logs, confusion matrix)
├── requirements.txt
└── README.md
```

---

## 4. Setup

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 5. Add Your Data

Two options:

**Option A — drop unsplit images into `data/raw/<class>/`, then run:**
```bash
python scripts/split_dataset.py
```
This splits each class 70/20/10 into `data/train`, `data/val`, `data/test`
(ratios configurable in `configs/train_config.yaml`). Use `--copy` if you want
to keep the originals in `data/raw/` untouched instead of moving them.

**Option B — place images directly into `data/train/<class>/`, `data/val/<class>/`,
`data/test/<class>/` yourself**, e.g. if you already have a pre-split dataset
or are pulling one split from a public dataset and another from your own footage.

## 6. Validate Before Training

```bash
python scripts/check_dataset.py
```
This checks that every class has images, flags corrupt files, and warns on any
class below the recommended minimum. Fix anything it flags before training —
it's much cheaper to catch a missing/corrupt class here than after a training run.

## 7. Train

```bash
python scripts/train.py
```
Uses every setting from `configs/train_config.yaml` by default. Override anything
from the command line without editing the file:
```bash
python scripts/train.py --epochs 80 --batch 16 --device cpu
```
Trained weights land in `outputs/smoke_fire_v1/weights/best.pt` (path configurable
via `run_name` in the config).

## 8. Evaluate

```bash
python scripts/evaluate.py --weights outputs/smoke_fire_v1/weights/best.pt
```
Reports top-1/top-5 accuracy and points you to the saved confusion matrix.
**What to check first:** how often a confounder class (steam/fog/dust/sunlight/
reflection) is misclassified as a hazard class — that's the false-alarm rate this
9-class design exists to minimize.

## 9. Export (optional, once you're happy with accuracy)

```bash
python scripts/export.py --weights outputs/smoke_fire_v1/weights/best.pt --format onnx
```
Supported formats: `onnx`, `torchscript`, `engine` (TensorRT), `openvino`.

---

## 10. Config Reference (`configs/train_config.yaml`)

Every script reads from this one file, so it's the single place to change:
- `classes` / `hazard_classes` — the label set
- `min_images_per_class` — thresholds used by `check_dataset.py`
- `split_ratios`, `split_seed` — used by `split_dataset.py`
- `model`, `imgsz`, `epochs`, `batch`, `patience`, `optimizer`, `lr0`, `device`, `workers`
- Augmentation settings (`hsv_h/s/v`, `degrees`, `flipud`, `fliplr`, `translate`, `scale`) —
  note `flipud: 0.0`: vertical flip is disabled on purpose, since fire/smoke have a
  meaningful "rises upward" orientation that a flipped image would break
- `output_dir`, `run_name`

---

## Out of Scope (by design)

This repo stops at a trained, exported model. Not included here:
- The 10-second polling scheduler that scans live camera feeds
- The confirmation-window / consecutive-detection decision logic
- Database logging (`smoke_fire_scans`, `emergency_events`)
- Threshold tuning for production alerting

Those belong to the deployment/integration stage of the Smart Airport project,
once this model is trained and its accuracy is validated.
