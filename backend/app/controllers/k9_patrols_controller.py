from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from ..utils.response_envelope import success_response
from ..utils.auth import get_current_user

router = APIRouter()

class K9AlertRequest(BaseModel):
    patrolId: int
    k9Id: int
    bagId: int
    passengerId: Optional[int] = None
    location: str
    alertType: str

@router.post("/alerts", dependencies=[Depends(get_current_user)])
def log_k9_alert(payload: K9AlertRequest):
    return success_response(data={
        "alertId": 650,
        "k9Id": payload.k9Id,
        "dogName": "Rex",
        "confirmedByStaffId": None,
        "status": "UNCONFIRMED_FLAGGED"
    }, status_code=201)
