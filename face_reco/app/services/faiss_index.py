from pathlib import Path

import faiss
import numpy as np

from app.config import settings


class FaissIndex:
    """
    Inner-product FAISS index over L2-normalized embeddings.

    For unit vectors, inner product == cosine similarity.
    """

    def __init__(
        self,
        dim: int = settings.embedding_dim,
        index_path: str = settings.faiss_index_path,
        ids_path: str = settings.faiss_ids_path,
    ) -> None:
        self.dim = dim
        self.index_path = Path(index_path)
        self.ids_path = Path(ids_path)
        self.index = faiss.IndexFlatIP(dim)
        self.passenger_ids: list[int] = []
        self._load()

    def _load(self) -> None:
        if self.index_path.exists() and self.ids_path.exists():
            self.index = faiss.read_index(str(self.index_path))
            self.passenger_ids = np.load(self.ids_path).astype(int).tolist()

    def save(self) -> None:
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(self.index_path))
        np.save(self.ids_path, np.asarray(self.passenger_ids, dtype=np.int64))

    def add(self, passenger_id: int, embedding: np.ndarray) -> None:
        vector = np.asarray(embedding, dtype=np.float32).reshape(1, -1)
        self.index.add(vector)
        self.passenger_ids.append(passenger_id)
        self.save()

    def search(self, embedding: np.ndarray, top_k: int = settings.faiss_top_k) -> list[tuple[int, float]]:
        if self.index.ntotal == 0:
            return []

        k = min(top_k, self.index.ntotal)
        vector = np.asarray(embedding, dtype=np.float32).reshape(1, -1)
        scores, indices = self.index.search(vector, k)

        results: list[tuple[int, float]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            results.append((self.passenger_ids[idx], float(score)))
        return results

    def rebuild(self, items: list[tuple[int, np.ndarray]]) -> None:
        self.index = faiss.IndexFlatIP(self.dim)
        self.passenger_ids = []
        if not items:
            self.save()
            return

        matrix = np.vstack([emb.astype(np.float32) for _, emb in items])
        self.index.add(matrix)
        self.passenger_ids = [pid for pid, _ in items]
        self.save()


faiss_index = FaissIndex()
