import numpy as np

from app.config import settings


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors (assumes L2-normalized preferred)."""
    a = np.asarray(a, dtype=np.float32).ravel()
    b = np.asarray(b, dtype=np.float32).ravel()
    if a.size == 0 or b.size == 0:
        raise ValueError("Empty embedding vector")
    if a.shape != b.shape:
        raise ValueError(f"Invalid vector shapes: {a.shape} vs {b.shape}")
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def calculate_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Alias used by the testing pyramid / docs."""
    return cosine_similarity(a, b)


def is_match(similarity: float, threshold: float | None = None) -> bool:
    """
    Decide match using ArcFace-calibrated cosine similarity threshold.

    Default is settings.similarity_threshold (0.40), not 0.5 or 0.7.
    """
    cut = settings.similarity_threshold if threshold is None else threshold
    return similarity >= cut


def is_verified(similarity: float, threshold: float | None = None) -> bool:
    """Alias for threshold verification checks."""
    return is_match(similarity, threshold)
