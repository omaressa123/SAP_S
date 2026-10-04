from tests.conftest import person_embedding, sample_image


def test_face_faiss_database_returns_right_person(db_session, tmp_faiss, mock_person):
    """Image → embedding → FAISS → passenger."""
    from app.models import Passenger
    from app.services.matcher import find_best_match
    from app.services.repository import save_embedding

    mock_person["set"]("Priyanka Chopra")
    img = sample_image("Priyanka Chopra", 0)
    assert img.exists()

    passenger = Passenger(
        name="Priyanka Chopra",
        passport="P-PC-1",
        flight_id="AI101",
    )
    db_session.add(passenger)
    db_session.commit()
    db_session.refresh(passenger)

    emb = person_embedding("Priyanka Chopra")
    save_embedding(db_session, passenger_id=passenger.passenger_id, embedding=emb)
    tmp_faiss.add(passenger.passenger_id, emb)

    probe = person_embedding("Priyanka Chopra", noise=0.02)
    match = find_best_match(probe, index=tmp_faiss)
    assert match is not None
    found = db_session.get(Passenger, match[0])
    assert found is not None
    assert found.name == "Priyanka Chopra"
