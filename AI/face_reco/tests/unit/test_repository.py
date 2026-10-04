from app.models import Checkpoint, Passenger, VerificationResult
from app.services.repository import get_passenger, save_embedding, save_log
from tests.conftest import person_embedding


def test_save_embedding_and_get_passenger(db_session):
    passenger = Passenger(name="Tom Cruise", passport="P-TOM-1", flight_id="SV200")
    db_session.add(passenger)
    db_session.commit()
    db_session.refresh(passenger)

    emb = person_embedding("Tom Cruise")
    row = save_embedding(db_session, passenger_id=passenger.passenger_id, embedding=emb)

    assert row.embedding_id is not None
    loaded = get_passenger(db_session, passenger.passenger_id)
    assert loaded is not None
    assert loaded.embedding_id == row.embedding_id
    assert loaded.name == "Tom Cruise"


def test_save_log(db_session):
    passenger = Passenger(name="Tom Cruise", passport="P-TOM-2", flight_id="SV200")
    db_session.add(passenger)
    db_session.commit()
    db_session.refresh(passenger)

    log = save_log(
        db_session,
        checkpoint=Checkpoint.ENTRY,
        camera_id="CAM-T1",
        result=VerificationResult.MATCH,
        similarity=0.91,
        passenger_id=passenger.passenger_id,
    )
    assert log.verification_id is not None
    assert log.result == VerificationResult.MATCH
    assert log.similarity == 0.91
