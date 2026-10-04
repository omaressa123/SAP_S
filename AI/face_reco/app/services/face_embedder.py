from app import env_config
env_config.setup_tf()

import json

import numpy as np
from deepface import DeepFace

from app.config import settings


class FaceEmbedder:
    """Extract 512-D ArcFace embeddings via DeepFace + RetinaFace."""

    def __init__(
        self,
        model_name: str = settings.model_name,
        detector_backend: str = settings.detector_backend,
    ) -> None:
        self.model_name = model_name
        self.detector_backend = detector_backend

    def extract(self, image: str | np.ndarray) -> np.ndarray:
        """
        Run RetinaFace detection + alignment, then ArcFace embedding.

        Always uses:
            DeepFace.represent(model_name="ArcFace", detector_backend="retinaface")
        """
        representations = DeepFace.represent(
            img_path=image,
            model_name=self.model_name,
            detector_backend=self.detector_backend,
            enforce_detection=True,
            align=True,
        )
        if not representations:
            raise ValueError("No face detected in the image")

        embedding = np.asarray(representations[0]["embedding"], dtype=np.float32)
        if embedding.shape[0] != settings.embedding_dim:
            raise ValueError(
                f"Expected {settings.embedding_dim}-D embedding, got {embedding.shape[0]}"
            )
        return self.l2_normalize(embedding)

    @staticmethod
    def l2_normalize(vector: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(vector)
        if norm == 0:
            return vector
        return vector / norm

    @staticmethod
    def to_json(embedding: np.ndarray) -> str:
        return json.dumps(embedding.astype(float).tolist())

    @staticmethod
    def from_json(payload: str) -> np.ndarray:
        return np.asarray(json.loads(payload), dtype=np.float32)


face_embedder = FaceEmbedder()
