from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import create_access_token
from ..database import get_db
from ..services.auth_service import AuthService
from datetime import datetime

router = APIRouter()

class RegisterRequest(BaseModel):
    fullName: str
    email: str
    password: str
    passportNumber: str
    nationalityCountryCode: str
    dateOfBirth: str
    phone: str

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/register")
def register_passenger(payload: RegisterRequest, db: Session = Depends(get_db)):
    result = AuthService.register_passenger(db, payload)
    return success_response(data=result, status_code=201)

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    passenger = AuthService.login_passenger(db, payload.email, payload.password)
    
    token = create_access_token({
        "sub": passenger.email,
        "role": "passenger",
        "linkedPersonId": passenger.passenger_id
    })
    
    return success_response(data={
        "token": token,
        "tokenType": "Bearer",
        "expiresInSeconds": 86400,
        "userAccount": {
            "userAccountId": passenger.passenger_id,
            "role": "passenger",
            "linkedPersonId": passenger.passenger_id,
            "lastLogin": datetime.utcnow().isoformat() + "Z"
        }
    })
