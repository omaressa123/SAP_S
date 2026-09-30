from unittest.mock import patch

import numpy as np
import pytest

from app.services.face_embedder import FaceEmbedder


@pytest.fixture
def embedder():
    return FaceEmbedder(model_name="ArcFace", detector_backend="retinaface")


def test_extract_embedding_not_none_and_512(embedder):
    fake = [{"embedding": list(np.random.randn(512))}]
    image = np.zeros((112, 112, 3), dtype=np.uint8)

    with patch("app.services.face_embedder.DeepFace.represent", return_value=fake):
        emb = embedder.extract(image)

    assert emb is not None
    assert emb.shape == (512,)
    assert abs(float(np.linalg.norm(emb)) - 1.0) < 1e-5


def test_extract_embedding_no_face_raises(embedder):
    image = np.zeros((64, 64, 3), dtype=np.uint8)
    with patch("app.services.face_embedder.DeepFace.represent", return_value=[]):
        with pytest.raises(ValueError, match="No face"):
            embedder.extract(image)
