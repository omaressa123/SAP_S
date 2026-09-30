from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import baggage as baggage_svc

router = APIRouter(tags=["baggage"])


class BagRegisterRequest(BaseModel):
    rfid_tag: str
    passenger_id: int | None = None
    location: str = "CHECKIN"


class BagScanRequest(BaseModel):
    rfid_tag: str
    location: str


class BagOut(BaseModel):
    bag_id: int
    rfid_tag: str
    passenger_id: int | None
    last_location: str
    status: str

    model_config = {"from_attributes": True}


@router.post("/baggage/register", response_model=BagOut)
def register_baggage(payload: BagRegisterRequest, db: Session = Depends(get_db)):
    bag = baggage_svc.register_bag(
        db,
        rfid_tag=payload.rfid_tag,
        passenger_id=payload.passenger_id,
        location=payload.location,
    )
    return BagOut.model_validate(bag)


@router.post("/baggage/scan", response_model=BagOut)
def scan_baggage(payload: BagScanRequest, db: Session = Depends(get_db)):
    try:
        bag = baggage_svc.scan_bag(db, rfid_tag=payload.rfid_tag, location=payload.location)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return BagOut.model_validate(bag)


@router.get("/baggage/{rfid_tag}", response_model=BagOut)
def get_baggage(rfid_tag: str, db: Session = Depends(get_db)):
    bag = baggage_svc.find_bag_by_rfid(db, rfid_tag)
    if bag is None:
        raise HTTPException(status_code=404, detail="Bag not found")
    return BagOut.model_validate(bag)
