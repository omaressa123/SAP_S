from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key, require_role

router = APIRouter()

class AiScanRequest(BaseModel):
    bagId: int
    scannerCameraId: int
    xrayFrameBase64: str

class ManualReviewRequest(BaseModel):
    inspectionId: int
    staffId: int
    decision: str
    notes: str

@router.post("/ai-scan", dependencies=[Depends(verify_api_key)])
def ai_scan_baggage(payload: AiScanRequest):
    return success_response(data={
        "inspectionId": 4401,
        "bagId": payload.bagId,
        "scanTime": "2026-08-24T08:22:10Z",
        "result": "MANUAL_REVIEW",
        "aiConfidence": 0.94,
        "detectedItems": [
            {
                "itemType": "suspicious_liquid",
                "confidenceScore": 0.94,
                "boundingBox": { "x": 120, "y": 80, "width": 50, "height": 90 }
            }
        ],
        "actionRequired": "ROUTE_TO_REINSPECTION_LINE"
    })

@router.put("/manual-review", dependencies=[Depends(require_role(["security_staff", "admin"]))])
def manual_override(payload: ManualReviewRequest):
    return success_response(data={
        "inspectionId": payload.inspectionId,
        "status": payload.decision,
        "reviewedByStaffId": payload.staffId,
        "updatedAt": "2026-08-24T08:25:00Z"
    })
