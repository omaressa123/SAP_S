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

    # Crop to the bottom 30% of the image where the MRZ is located
    h, w = image.shape[:2]
    mrz_crop = image[int(h * 0.70):, :]

    # EasyOCR's neural networks perform better on natural RGB images than on 
    # severely thresholded binary images (which can break character strokes).
    rgb = cv2.cvtColor(mrz_crop, cv2.COLOR_BGR2RGB)

    # Run OCR with a strict allowlist of MRZ characters
    allowlist = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
    lines = reader.readtext(rgb, detail=0, paragraph=False, allowlist=allowlist)
    
    return "\n".join(str(x) for x in lines)


def extract_mrz_text(image: np.ndarray, mrz_text: str | None = None) -> str:
    if mrz_text and mrz_text.strip():
        return mrz_text.strip().upper()
        
    ocr = _run_easyocr(image)
    
    # Keep likely MRZ characters and ensure strict length bounds
    cleaned = []
    for line in ocr.splitlines():
        line = re.sub(r"[^A-Z0-9<]", "", line.upper())
        if len(line) >= 30:
            # Force pad to 44 characters for TD3 compliance
            padded = line.ljust(44, "<")[:44]
            cleaned.append(padded)
            
    # If we found at least two lines, return them
    if len(cleaned) >= 2:
        return "\n".join(cleaned[-2:])
        
    # If the lines were split, reconstruct based on length 88
    full_text = re.sub(r"[^A-Z0-9<]", "", ocr.upper())
    if len(full_text) >= 88:
        mrz_str = full_text[-88:]
        return mrz_str[:44] + "\n" + mrz_str[44:]
        
    return "\n".join(cleaned)


def _fallback_parse(ocr_text: str) -> PassportData:
    print("\n\n=== RAW OCR TEXT START ===")
    print(ocr_text)
    print("=== RAW OCR TEXT END ===\n\n")
    import re
    # Try to find a passport-like number
    pp_match = re.search(r'([A-Z0-9]{8,10})', ocr_text)
    passport_num = pp_match.group(1) if pp_match else "UNKNOWN123"
    
    # Try to find names
    words = [w for w in re.split(r'\W+', ocr_text) if w.isalpha() and len(w) > 2]
    name = " ".join(words[:2]).upper() if len(words) >= 2 else "UNKNOWN PASSENGER"
    
    return PassportData(
        document_type="P",
        issuing_country="XXX",
        surname=name.split(" ")[-1] if " " in name else name,
        given_names=name.split(" ")[0] if " " in name else "",
        full_name=name,
        passport_number=passport_num,
        nationality="XXX",
        date_of_birth="1990-01-01",
        sex="X",
        expiry_date="2030-01-01",
        personal_number="",
        mrz_raw=ocr_text[:88].replace("\n", ""),
        valid_check_digits=False
    )


def parse_passport_image(image: np.ndarray, mrz_text: str | None = None) -> PassportData:
    text = extract_mrz_text(image, mrz_text=mrz_text)
    data = find_mrz_in_text(text)
    if data is None:
        try:
            lines = [ln for ln in text.splitlines() if len(ln) >= 28]
            if len(lines) >= 2:
                data = parse_td3(lines[:2])
            else:
                raise ValueError("fallback")
        except Exception:
            # Extreme fallback: just scrape whatever text EasyOCR found
            ocr_raw = _run_easyocr(image)
            data = _fallback_parse(ocr_raw)
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
