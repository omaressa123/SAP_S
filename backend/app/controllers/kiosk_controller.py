from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()

class ScanPassportRequest(BaseModel):
    kioskEquipmentId: int
    rawMrzCode: str
    scannedImageBase64: str

class EnrollFaceRequest(BaseModel):
    passengerId: int
    kioskEquipmentId: int
    capturedFaceBase64: str

@router.post("/passport/scan", dependencies=[Depends(verify_api_key)])
def scan_passport(payload: ScanPassportRequest):
    return success_response(data={
        "passportNumber": "A12345678",
        "fullName": "AHMED MOHAMED HASSAN",
        "nationalityCountryCode": "EG",
        "dateOfBirth": "1992-05-14",
        "matchingPassenger": {
            "passengerId": 501,
            "profileFound": True,
            "linkedBooking": {
                "bookingId": 2048,
                "flightNumber": "MS777"
            }
        }
    })

@router.post("/biometrics/enroll", dependencies=[Depends(verify_api_key)])
def enroll_biometrics(payload: EnrollFaceRequest):
    return success_response(data={
        "enrollmentStatus": "SUCCESS",
        "embeddingRef": "vec_p501_8f9a0b12",
        "faceQualityScore": 0.98,
        "matchWithPassportPhoto": True,
        "matchConfidence": 96.45,
        "sessionInitializedAt": "2026-08-24T08:15:00Z"
    })

class IssueBoardingPassRequest(BaseModel):
    bookingId: int
    passengerId: int
    kioskEquipmentId: int
    bagsToRegisterCount: int

@router.post("/boarding-pass/issue", dependencies=[Depends(verify_api_key)])
def issue_boarding_pass(payload: IssueBoardingPassRequest):
    return success_response(data={
        "checkinId": 8012,
        "boardingPassQrCode": "BP_2048_MS777_12A_501",
        "issuedBagTags": [
            { "bagId": 901, "rfidTag": "RF-EGY-901-A", "qrCode": "QR-BAG-901" },
            { "bagId": 902, "rfidTag": "RF-EGY-902-B", "qrCode": "QR-BAG-902" }
        ],
        "printerStatus": "PRINT_COMMAND_SENT"
    })
