# Architecture

## Ultimate pipeline

```text
Camera
  │
  ▼
RetinaFace
  │
  ▼
Face Alignment
  │
  ▼
ArcFace (DeepFace)
  │
  ▼
512-D Embedding
  │
  ▼
FAISS Search (Top-K)
  │
  ▼
Cosine Similarity
  │
  ▼
Business Logic
  ├──────── Entry Gate
  ├──────── Security Gate
  └──────── Boarding Gate
```

The **model stack is identical** at every checkpoint. Only business rules change.

## Smart Check-in Kiosk

```text
Passenger → Webcam face + liveness → Passport data page (OCR/MRZ)
         → Extract passport photo → ArcFace match (live vs passport)
         → Issue Code128 boarding pass → Baggage drop
```

Hardware simulation in UI: webcam, passport capture, thermal print view, speaker prompts, LED status.

| AI task | Model / library |
|---------|-----------------|
| Face detection | RetinaFace |
| Face embedding | ArcFace (DeepFace) |
| Liveness | Multi-frame motion + sharpness heuristics |
| OCR | EasyOCR (optional; MRZ text bypass for demos) |
| MRZ parsing | ICAO 9303 TD3 parser (`app/services/mrz.py`) |
| Face matching | Cosine similarity |
| Boarding pass | IATA-style HTML + **Code128** (not QR-only) |

UI: **`/kiosk`**  
API prefix: **`/kiosk/session`** …



```text
Photo → Detect → Align → Embedding → Save vector + PassengerID
```

Stored fields:

- PassengerID, Name, Passport, FlightID
- FaceEmbedding (512 floats)
- ModelVersion, CreatedAt

Images are **not** the source of truth — embeddings are.

## Checkpoints

### 1. Entry

Identify the passenger from the face gallery.

### 2. Security

Identify → check / set security status → open or deny gate.

### 3. Boarding

Identify → flight match → security cleared → not already boarded → open.

## Search

Never scan thousands of rows with a Python `for` loop.

```text
Embedding → FAISS → Top 5 → Cosine → Best match ≥ threshold
```

FAISS uses **inner product** over L2-normalized vectors (= cosine similarity).

## Database tables

### Passenger

`PassengerID · Name · Passport · FlightID · EmbeddingID · SecurityStatus · BoardingStatus · CreatedAt`

### FaceEmbeddings

`EmbeddingID · PassengerID · ModelVersion · Embedding(512) · CreatedAt`

### FaceVerificationLogs

`VerificationID · PassengerID · Checkpoint · Similarity · Time · CameraID · Result`

Checkpoint enum: `ENTRY | SECURITY | BOARDING`

### Baggage / Emergency (ops extensions)

- `baggage_items` + `baggage_scans` — RFID last location
- `emergency_alerts` — smoke / emergency dashboard feed

## Package layout

```text
app/
  api/           # FastAPI routers
  services/      # embedder, FAISS, similarity, verification, baggage, emergency
  static/        # GateVision dashboard
  models.py      # SQLAlchemy
  config.py      # FACE_* settings
tests/
  unit/
  integration/
  e2e/
docs/
  readme.md
  arc.md
  test.md
```

## Configuration

| Env var | Default | Meaning |
|---------|---------|---------|
| `FACE_SIMILARITY_THRESHOLD` | `0.40` | Cosine match cutoff |
| `FACE_FAISS_TOP_K` | `5` | Neighbors retrieved |
| `FACE_DATABASE_URL` | SQLite under `data/` | DB connection |
| `FACE_MODEL_NAME` | `ArcFace` | DeepFace model |
| `FACE_DETECTOR_BACKEND` | `retinaface` | Detector |
