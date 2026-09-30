from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Passenger
from app.schemas import PassengerOut

router = APIRouter(tags=["passengers"])


@router.get("/passenger/{passenger_id}", response_model=PassengerOut)
def get_passenger(passenger_id: int, db: Session = Depends(get_db)):
    passenger = db.get(Passenger, passenger_id)
    if passenger is None:
        raise HTTPException(status_code=404, detail="Passenger not found")
    return PassengerOut.model_validate(passenger)


@router.get("/passengers", response_model=list[PassengerOut])
def list_passengers(db: Session = Depends(get_db)):
    rows = db.query(Passenger).order_by(Passenger.passenger_id.desc()).all()
    return [PassengerOut.model_validate(p) for p in rows]
