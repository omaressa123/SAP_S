"""Passenger business-rule validation for boarding / gates."""

from dataclasses import dataclass

from app.models import BoardingStatus, Passenger, SecurityStatus


@dataclass
class ValidationResult:
    ok: bool
    reasons: list[str]


def validate_passenger(
    passenger: Passenger | None,
    *,
    expected_flight_id: str | None = None,
    require_boarding_open: bool = False,
) -> ValidationResult:
    """
    Ensure passenger exists, flight is valid, and boarding is still open when required.
    """
    reasons: list[str] = []

    if passenger is None:
        return ValidationResult(ok=False, reasons=["passenger_not_found"])

    if not passenger.flight_id:
        reasons.append("flight_missing")

    if expected_flight_id and passenger.flight_id != expected_flight_id:
        reasons.append("flight_mismatch")

    if require_boarding_open:
        if passenger.boarding_status == BoardingStatus.BOARDED:
            reasons.append("already_boarded")
        elif passenger.boarding_status == BoardingStatus.DENIED:
            reasons.append("boarding_denied")
        if passenger.security_status != SecurityStatus.CLEARED:
            reasons.append("security_not_cleared")

    return ValidationResult(ok=len(reasons) == 0, reasons=reasons)
