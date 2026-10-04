from app.models import BoardingStatus, Passenger, SecurityStatus
from app.services.passenger_validator import validate_passenger


def _passenger(**kwargs) -> Passenger:
    defaults = dict(
        passenger_id=1,
        name="Brad Pitt",
        passport="P-BRAD-1",
        flight_id="SV123",
        security_status=SecurityStatus.CLEARED,
        boarding_status=BoardingStatus.NOT_BOARDED,
    )
    defaults.update(kwargs)
    return Passenger(**defaults)


def test_validate_passenger_exists():
    result = validate_passenger(_passenger())
    assert result.ok is True


def test_validate_passenger_missing():
    result = validate_passenger(None)
    assert result.ok is False
    assert "passenger_not_found" in result.reasons


def test_validate_flight_exists_and_match():
    result = validate_passenger(_passenger(), expected_flight_id="SV123")
    assert result.ok is True


def test_validate_flight_mismatch():
    result = validate_passenger(_passenger(), expected_flight_id="MS999")
    assert result.ok is False
    assert "flight_mismatch" in result.reasons


def test_boarding_open():
    result = validate_passenger(_passenger(), require_boarding_open=True)
    assert result.ok is True


def test_boarding_already_boarded():
    p = _passenger(boarding_status=BoardingStatus.BOARDED)
    result = validate_passenger(p, require_boarding_open=True)
    assert result.ok is False
    assert "already_boarded" in result.reasons
