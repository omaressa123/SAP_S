import numpy as np
import pytest

from app.services.similarity import calculate_similarity, cosine_similarity


def _unit(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(512).astype(np.float32)
    return v / np.linalg.norm(v)


def test_same_vector():
    v1 = _unit(1)
    assert cosine_similarity(v1, v1) > 0.99


def test_same_person_high_similarity():
    a = _unit(42)
    b = a + np.random.default_rng(0).normal(0, 0.01, size=512).astype(np.float32)
    b = b / np.linalg.norm(b)
    assert calculate_similarity(a, b) > 0.9


def test_different_people_lower_similarity():
    a = _unit(1)
    b = _unit(999)
    assert calculate_similarity(a, b) < 0.5


def test_empty_vector_raises():
    with pytest.raises(ValueError, match="Empty"):
        cosine_similarity(np.array([]), _unit(1))


def test_invalid_vector_shape_raises():
    with pytest.raises(ValueError, match="Invalid"):
        cosine_similarity(_unit(1), np.ones(128, dtype=np.float32))
