from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.db.session import get_db
from app.models.models import Passenger, Flight
from app.schemas.schemas import PassengerCreate, PassengerResponse, FlightCreate, FlightResponse

router = APIRouter()

# === Passengers Endpoints ===
@router.post("/passengers/", response_model=PassengerResponse)
async def create_passenger(passenger: PassengerCreate, db: AsyncSession = Depends(get_db)):
    new_passenger = Passenger(**passenger.model_dump())
    db.add(new_passenger)
    await db.commit()
    await db.refresh(new_passenger)
    return new_passenger

@router.get("/passengers/", response_model=List[PassengerResponse])
async def get_passengers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Passenger))
    return result.scalars().all()

# === Flights Endpoints ===
@router.post("/flights/", response_model=FlightResponse)
async def create_flight(flight: FlightCreate, db: AsyncSession = Depends(get_db)):
    new_flight = Flight(**flight.model_dump())
    db.add(new_flight)
    await db.commit()
    await db.refresh(new_flight)
    return new_flight

@router.get("/flights/", response_model=List[FlightResponse])
async def get_flights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flight))
    return result.scalars().all()