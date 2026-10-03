import numpy as np
from typing import List
from ..utils.errors import AirportException

class BiometricService:
    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

    @staticmethod
    def match_face_embedding(input_embedding: List[float], stored_embeddings: List[List[float]], threshold: float = 0.8):
        if len(input_embedding) != 512:
            raise AirportException(code="INVALID_EMBEDDING", message="Embedding must be 512-D for ArcFace/InsightFace.")
        
        for idx, stored in enumerate(stored_embeddings):
            sim = BiometricService.cosine_similarity(input_embedding, stored)
            if sim >= threshold:
                return {"matched": True, "index": idx, "similarity": sim}
        
        return {"matched": False, "similarity": 0.0}
