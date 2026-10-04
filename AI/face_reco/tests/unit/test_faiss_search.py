from app.services.matcher import find_best_match
from tests.conftest import person_embedding


def test_empty_index(tmp_faiss):
    assert find_best_match(person_embedding("Brad Pitt"), index=tmp_faiss) is None


def test_existing_face(tmp_faiss):
    emb = person_embedding("Brad Pitt")
    tmp_faiss.add(101, emb)
    match = find_best_match(person_embedding("Brad Pitt", noise=0.01), index=tmp_faiss)
    assert match is not None
    assert match[0] == 101
    assert match[1] > 0.9


def test_unknown_face(tmp_faiss):
    tmp_faiss.add(101, person_embedding("Brad Pitt"))
    match = find_best_match(person_embedding("Tom Cruise"), index=tmp_faiss, threshold=0.85)
    assert match is None
