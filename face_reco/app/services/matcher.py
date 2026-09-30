"""FAISS match helpers."""

from __future__ import annotations

import numpy as np

from app.config import settings
from app.services.faiss_index import FaissIndex, faiss_index
from app.services.similarity import is_match


def find_best_match(
    embedding: np.ndarray,
    *,
    index: FaissIndex | None = None,
    top_k: int | None = None,
    threshold: float | None = None,
) -> tuple[int, float] | None:
    """
    Search FAISS for the best face match above threshold.

    Returns (passenger_id, similarity) or None for empty / unknown faces.
    """
    store = index or faiss_index
    hits = store.search(embedding, top_k=top_k or settings.faiss_top_k)
    if not hits:
        return None
    passenger_id, similarity = hits[0]
    if not is_match(similarity, threshold):
        return None
    return passenger_id, similarity
