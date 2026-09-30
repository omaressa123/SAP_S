# GateVision — Airport Face Recognition

Face-first passenger verification for airport entry, security, and boarding gates.

## Pipeline

```text
Camera → RetinaFace → Face Alignment → ArcFace (DeepFace)
       → 512-D Embedding → FAISS → Cosine Similarity → Gate Business Logic
```

## Quick start

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

Open **http://127.0.0.1:8000** for the dashboard.

> Use **Python 3.12** (TensorFlow / DeepFace are not available on 3.14 yet).

## Check-in kiosk

Open **http://127.0.0.1:8000/kiosk**

Flow: live face + liveness → passport MRZ/OCR → camera vs passport face match → Code128 boarding pass → baggage drop.

Optional: paste MRZ into the kiosk textarea if EasyOCR is not installed yet (`pip install easyocr`).

| Method | Path | Step |
|--------|------|------|
| POST | `/kiosk/session` | Start session |
| POST | `/kiosk/session/{id}/face` | Webcam + liveness |
| POST | `/kiosk/session/{id}/passport` | Passport scan |
| POST | `/kiosk/session/{id}/verify` | Match + print pass |
| GET | `/kiosk/boarding-pass/{pass_id}` | Thermal HTML pass |

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/enroll` | Register passenger + 512-D face embedding |
| POST | `/verify` | Checkpoint 1 — Entry identification |
| POST | `/security` | Checkpoint 2 — Security gate open/deny |
| POST | `/boarding` | Checkpoint 3 — Boarding + flight match |
| GET | `/passenger/{id}` | Passenger profile |
| GET | `/logs` | Verification feed |
| POST | `/baggage/register` | Register RFID bag |
| POST | `/baggage/scan` | Update bag location |
| GET | `/baggage/{rfid}` | Last known location |
| POST | `/emergency/smoke` | Raise smoke alert |
| GET | `/emergency/alerts` | Active dashboard alerts |

## Model choices

Always:

```python
DeepFace.represent(
    model_name="ArcFace",
    detector_backend="retinaface",
)
```

Do **not** use OpenFace / Facenet / Dlib for the recognizer, or OpenCV as the detector backend.

## Threshold

Default cosine similarity threshold is **0.40** (ArcFace-calibrated).  
Avoid naive cutoffs like `0.5` or `0.7`. Override with `FACE_SIMILARITY_THRESHOLD`.

## Test data

Celebrity face images live under:

```text
data/Original Images/<Person Name>/*.jpg
```

## Docs

| File | Contents |
|------|----------|
| [readme.md](readme.md) | This overview |
| [arc.md](arc.md) | Architecture |
| [test.md](test.md) | Testing pyramid |

## Tests

```bash
pip install pytest pytest-cov httpx
pytest --cov=app --cov-report=term-missing
```

See [test.md](test.md) for the full pyramid.
