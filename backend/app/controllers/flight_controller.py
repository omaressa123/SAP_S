from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..utils.response_envelope import success_response
from ..database import get_db
from ..models.flights import Flight, Airline, Airport

router = APIRouter()

@router.get("/all")
@router.get("")
def get_all_flights(db: Session = Depends(get_db)):
    flights = db.query(Flight).all()
    results = []
    for f in flights:
        airline = db.query(Airline).filter(Airline.airline_id == f.airline_id).first()
        origin = db.query(Airport).filter(Airport.airport_id == f.origin_airport_id).first()
        dest = db.query(Airport).filter(Airport.airport_id == f.destination_airport_id).first()
        gate_num = "TBD"
        if f.boarding_gate_id:
            from ..models.security import BoardingGate
            gate = db.query(BoardingGate).filter(BoardingGate.boarding_gate_id == f.boarding_gate_id).first()
            if gate:
                gate_num = gate.gate_number

        results.append({
            "flightId": f.flight_id,
            "flightNumber": f.flight_number,
            "airline": airline.name if airline else "Unknown",
            "airlineCode": airline.iata_code if airline else "",
            "originAirport": origin.iata_code if origin else "JFK",
            "destinationAirport": dest.iata_code if dest else "DOH",
            "boardingGate": gate_num,
            "status": f.status or "SCHEDULED",
            "scheduledDeparture": f.scheduled_departure.isoformat() + "Z" if f.scheduled_departure else None
        })
    return success_response(data=results)

class CreateFlightRequest(BaseModel):
    flightNumber: str
    airlineCode: str
    originAirportCode: str
    destinationAirportCode: str
    scheduledDeparture: str
    boardingGateCode: Optional[str] = None

@router.post("/create")
def create_flight(payload: CreateFlightRequest, db: Session = Depends(get_db)):
    # Auto-create airline if missing
    airline = db.query(Airline).filter(Airline.iata_code == payload.airlineCode).first()
    if not airline:
        airline = Airline(name=payload.airlineCode, iata_code=payload.airlineCode)
        db.add(airline)
        db.flush()
        
    # Auto-create origin airport if missing
    origin_airport = db.query(Airport).filter(Airport.iata_code == payload.originAirportCode).first()
    if not origin_airport:
        origin_airport = Airport(iata_code=payload.originAirportCode, city="Unknown")
        db.add(origin_airport)
        db.flush()
        
    # Auto-create destination airport if missing
    dest_airport = db.query(Airport).filter(Airport.iata_code == payload.destinationAirportCode).first()
    if not dest_airport:
        dest_airport = Airport(iata_code=payload.destinationAirportCode, city="Unknown")
        db.add(dest_airport)
        db.flush()
        
    # Auto-create boarding gate if provided
    gate_id = None
    if payload.boardingGateCode:
        from ..models.security import BoardingGate
        gate = db.query(BoardingGate).filter(BoardingGate.gate_number == payload.boardingGateCode).first()
        if not gate:
            gate = BoardingGate(gate_number=payload.boardingGateCode, status="OPEN")
            db.add(gate)
            db.flush()
        gate_id = gate.boarding_gate_id

    try:
        dep_time = datetime.strptime(payload.scheduledDeparture, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        dep_time = datetime.utcnow()
        
    new_flight = Flight(
        flight_number=payload.flightNumber,
        airline_id=airline.airline_id,
        origin_airport_id=origin_airport.airport_id,
        destination_airport_id=dest_airport.airport_id,
        boarding_gate_id=gate_id,
        scheduled_departure=dep_time,
        status="SCHEDULED",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_flight)
    db.commit()
    db.refresh(new_flight)
    
    return success_response(data={
        "flightId": new_flight.flight_id,
        "flightNumber": new_flight.flight_number,
        "airline": airline.name,
        "originAirport": origin_airport.iata_code,
        "destinationAirport": dest_airport.iata_code,
        "boardingGate": payload.boardingGateCode if gate_id else "TBD",
        "status": new_flight.status,
        "scheduledDeparture": new_flight.scheduled_departure.isoformat() + "Z"
    }, status_code=201)
