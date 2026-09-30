from datetime import datetime

from pydantic import BaseModel, Field

from app.models import BoardingStatus, Checkpoint, SecurityStatus, VerificationResult


class EnrollResponse(BaseModel):
    passenger_id: int
    name: str
    passport: str
    flight_id: str
    embedding_id: int
    model_version: str
    created_at: datetime


class PassengerOut(BaseModel):
    passenger_id: int
    name: str
    passport: str
    flight_id: str
    embedding_id: int | None
    security_status: SecurityStatus
    boarding_status: BoardingStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchCandidate(BaseModel):
    passenger_id: int
    name: str
    passport: str
    flight_id: str
    similarity: float


class VerifyResponse(BaseModel):
    checkpoint: Checkpoint
    result: VerificationResult
    similarity: float | None = None
    threshold: float
    camera_id: str
    passenger: PassengerOut | None = None
    top_matches: list[MatchCandidate] = Field(default_factory=list)
    message: str
    verification_id: int | None = None
    timestamp: datetime


class LogOut(BaseModel):
    verification_id: int
    passenger_id: int | None
    passenger_name: str | None = None
    checkpoint: Checkpoint
    similarity: float | None
    camera_id: str
    result: VerificationResult
    created_at: datetime

    model_config = {"from_attributes": True}


class SecurityAction(BaseModel):
    security_status: SecurityStatus = SecurityStatus.CLEARED


class BoardingRequest(BaseModel):
    expected_flight_id: str | None = None
