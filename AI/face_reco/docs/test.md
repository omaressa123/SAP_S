# Testing Pyramid

```text
                E2E Tests
             (User Scenario)

          Integration Tests

       Unit Tests (Most Tests)
```

## Tools

```bash
pip install pytest pytest-cov httpx
pytest --cov=app --cov-report=term-missing
```

DeepFace / camera IO is **mocked** in the default suite so CI stays fast.  
Celebrity images under `data/Original Images/` are still used as multipart uploads.

## Unit tests (`tests/unit/`)

Isolated functions — no real camera, no live DeepFace, temp FAISS/DB when needed.

| File | Covers |
|------|--------|
| `test_embedding.py` | `extract()` → not None, length 512 |
| `test_similarity.py` | same person, different people, empty / invalid vectors |
| `test_threshold.py` | `is_verified(0.83, 0.75) is True` |
| `test_validator.py` | passenger exists, flight match, boarding open |
| `test_faiss_search.py` | empty index, unknown face, existing face |
| `test_mrz.py` | ICAO TD3 passport MRZ parsing |
| `test_liveness.py` | motion / static-photo heuristics |
| `test_boarding_pass.py` | Code128 boarding pass issue + HTML |
| `test_kiosk.py` (integration) | face → passport → verify → print |


## Integration tests (`tests/integration/`)

Components wired together with TestClient + mocked embeddings.

| File | Scenario |
|------|----------|
| `test_database.py` | Image → embedding → FAISS → correct passenger |
| `test_enroll_api.py` | `POST /enroll` writes DB + FAISS |
| `test_verify_api.py` | API + FAISS + DB pipeline |
| `test_security.py` | right person opens / unknown denied |
| `test_boarding.py` | flight ok opens / already boarded rejects |

## E2E tests (`tests/e2e/`)

Full user scenarios.

| File | Scenario |
|------|----------|
| `test_complete_passenger_flow.py` | Enroll → Entry → Security → Boarding success |
| | Unknown → Security reject |
| | Wrong flight → Boarding reject |
| `test_lost_baggage.py` | RFID → DB → last location |
| `test_emergency.py` | Smoke → alert → dashboard list |

## Project structure

```text
tests/
  unit/
    test_similarity.py
    test_embedding.py
    test_threshold.py
    test_validator.py
    test_faiss_search.py
    test_repository.py
  integration/
    test_verify_api.py
    test_enroll_api.py
    test_boarding.py
    test_security.py
    test_database.py
  e2e/
    test_complete_passenger_flow.py
    test_lost_baggage.py
    test_emergency.py
```

## Mocking DeepFace

```python
from unittest.mock import patch

with patch("app.services.face_embedder.DeepFace.represent", return_value=fake):
    emb = embedder.extract(image)
```

API tests bind a celebrity name via `mock_person["set"]("Brad Pitt")` so enroll and verify share a stable 512-D vector.

## CI/CD

On every push / PR, GitHub Actions runs:

1. Install dependencies  
2. `pytest --cov=app`  
3. Ruff lint  
4. Confirms the app package imports  

Workflow: `.github/workflows/ci.yml`
