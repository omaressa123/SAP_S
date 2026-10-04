"""Kiosk check-in integration: face → passport → verify → boarding pass."""

from io import BytesIO

import cv2
import numpy as np

from tests.conftest import person_embedding
from tests.fixtures_mrz import SAMPLE_MRZ


def _jpeg_bytes(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_kiosk_full_flow(client, monkeypatch, mock_person):
    import app.services.kiosk as kiosk_mod

    mock_person["set"]("Brad Pitt")

    def fake_extract(image):
        return person_embedding(mock_person["name"], noise=0.01)

    monkeypatch.setattr(kiosk_mod.face_embedder, "extract", fake_extract)
    monkeypatch.setattr(
        kiosk_mod,
        "extract_passport_face",
        lambda image: np.zeros((112, 112, 3), dtype=np.uint8),
    )
    monkeypatch.setattr(
        kiosk_mod,
        "parse_passport_image",
        lambda image, mrz_text=None: __import__(
            "app.services.mrz", fromlist=["parse_td3"]
        ).parse_td3(mrz_text or SAMPLE_MRZ),
    )

    start = client.post("/kiosk/session", json={"kiosk_id": "KIOSK-T", "flight_id": "GV101"})
    assert start.status_code == 200
    session_id = start.json()["session_id"]

    frame = np.random.default_rng(0).integers(0, 255, size=(240, 320, 3), dtype=np.uint8)
    frame2 = np.clip(frame.astype(np.int16) + 12, 0, 255).astype(np.uint8)
    files = {
        "frame1": ("f1.jpg", BytesIO(_jpeg_bytes(frame)), "image/jpeg"),
        "frame2": ("f2.jpg", BytesIO(_jpeg_bytes(frame2)), "image/jpeg"),
    }
    face = client.post(
        f"/kiosk/session/{session_id}/face",
        data={"skip_liveness": "true"},
        files=files,
    )
    assert face.status_code == 200, face.text
    assert face.json()["status"] == "AWAITING_PASSPORT"

    passport_img = np.zeros((400, 600, 3), dtype=np.uint8)
    passport = client.post(
        f"/kiosk/session/{session_id}/passport",
        data={"mrz_text": SAMPLE_MRZ},
        files={"image": ("pass.jpg", BytesIO(_jpeg_bytes(passport_img)), "image/jpeg")},
    )
    assert passport.status_code == 200, passport.text
    assert passport.json()["passport"]["passport_number"] == "L898902C3"

    verify = client.post(f"/kiosk/session/{session_id}/verify")
    assert verify.status_code == 200, verify.text
    body = verify.json()
    assert body["verified"] is True
    assert body["boarding_pass"]["pass_id"]
    assert "READY_FOR_BAGGAGE_DROP" in body["boarding_pass"]["status"]

    html = client.get(body["boarding_pass"]["print_url"])
    assert html.status_code == 200
    assert "BOARDING PASS" in html.text
