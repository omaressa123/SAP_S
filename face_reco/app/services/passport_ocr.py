from app import env_config
import re
from dataclasses import asdict

import cv2
import numpy as np

from app.services.mrz import PassportData, find_mrz_in_text, parse_td3


def _run_easyocr(image: np.ndarray) -> str:
    try:
        import easyocr
    except ImportError as exc:
        raise RuntimeError(
            "easyocr is not installed. pip install easyocr  OR pass mrz_text manually."
        ) from exc

    reader = getattr(_run_easyocr, "_reader", None)
    if reader is None:
        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        _run_easyocr._reader = reader  # type: ignore[attr-defined]

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    lines = reader.readtext(rgb, detail=0, paragraph=False)
    return "\n".join(str(x) for x in lines)


def extract_mrz_text(image: np.ndarray, mrz_text: str | None = None) -> str:
    if mrz_text and mrz_text.strip():
        return mrz_text.strip().upper()
    ocr = _run_easyocr(image)
    # Keep likely MRZ characters
    cleaned = []
    for line in ocr.splitlines():
        line = re.sub(r"[^A-Za-z0-9<]", "", line.upper())
        if len(line) >= 20:
            cleaned.append(line)
    return "\n".join(cleaned)


def parse_passport_image(image: np.ndarray, mrz_text: str | None = None) -> PassportData:
    text = extract_mrz_text(image, mrz_text=mrz_text)
    data = find_mrz_in_text(text)
    if data is None:
        # Last attempt: force parse if exactly two dense lines exist
        lines = [ln for ln in text.splitlines() if len(ln) >= 28]
        if len(lines) >= 2:
            data = parse_td3(lines[:2])
        else:
            raise ValueError("Could not parse passport MRZ from image/OCR text")
    return data


def extract_passport_face(image: np.ndarray) -> np.ndarray:
    """
    Crop the holder photo from a passport data page.

    Graduation-project approach: prefer DeepFace face detection on the page;
    fall back to the left-side portrait region typical of ICAO layouts.
    """
    try:
        from deepface import DeepFace

        faces = DeepFace.extract_faces(
            img_path=image,
            detector_backend="retinaface",
            enforce_detection=False,
            align=True,
        )
        if faces:
            # Pick face closest to the left half (passport photo side)
            h, w = image.shape[:2]
            best = None
            best_score = -1.0
            for face in faces:
                fa = face.get("facial_area") or {}
                x = float(fa.get("x", w // 4))
                conf = float(face.get("confidence") or 0.5)
                left_bias = 1.0 - min(abs((x + fa.get("w", 0) / 2) - w * 0.22) / w, 1.0)
                score = conf + left_bias
                if score > best_score:
                    best_score = score
                    best = face
            if best is not None:
                arr = (best["face"] * 255).astype(np.uint8)
                if arr.shape[-1] == 3:
                    arr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
                return arr
    except Exception:
        pass

    h, w = image.shape[:2]
    # Typical data-page portrait box (left side)
    x0, y0 = int(w * 0.04), int(h * 0.18)
    x1, y1 = int(w * 0.38), int(h * 0.72)
    crop = image[y0:y1, x0:x1]
    if crop.size == 0:
        raise ValueError("Failed to crop passport holder photo")
    return crop


def passport_to_dict(data: PassportData) -> dict:
    return asdict(data)
