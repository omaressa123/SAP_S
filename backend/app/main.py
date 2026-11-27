from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .utils.errors import AirportException
from .utils.response_envelope import error_response

# Import all controllers
from .controllers import (
    auth_controller, passenger_controller, kiosk_controller, baggage_drop_controller,
    inspection_controller, baggage_tracking_controller, security_gate_controller,
    boarding_gate_controller, monitoring_controller, k9_patrols_controller,
    maintenance_controller, flight_controller,
    reports_controller, ai_controller, agent_controller, orchestration_controller, saga_controller, hitl_controller,
)

# Agent service initialization
from .agents.service import agent_service

app = FastAPI(title="Smart Airport System API", version="2.0.0")

# CORS Middleware — origins come from Settings (CORS_ORIGINS in .env).
# NOTE: allow_credentials must be False when origins are ["*"], otherwise
# browsers reject credentialed responses served with `Access-Control-Allow-Origin: *`.
_cors_origins = settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False if _cors_origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers
@app.exception_handler(AirportException)
async def airport_exception_handler(request: Request, exc: AirportException):
    return error_response(code=exc.code, message=exc.message, status_code=exc.status_code)

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return error_response(code="INTERNAL_SERVER_ERROR", message=str(exc), status_code=500)

# Initialize agent service on startup
@app.on_event("startup")
def init_agent_service():
    agent_service.init(
        face_service_url=settings.FACE_RECO_URL,
        baggage_backend_url="http://localhost:8000/api/v1/ai/baggage/analyze",
        btd_inference_url=settings.BTD_INFERENCE_URL,
        smoke_fire_url=settings.SMOKE_FIRE_URL,
        fall_detection_url=settings.FULL_DETECTION_URL,
    )

# Register all routers
app.include_router(auth_controller.router, prefix="/api/v1/auth", tags=["1. Auth & User Management"])
app.include_router(passenger_controller.router, prefix="/api/v1/passenger", tags=["2. Passenger Mobile App"])
app.include_router(flight_controller.router, prefix="/api/v1/flights", tags=["System - Flights"])
app.include_router(kiosk_controller.router, prefix="/api/v1/kiosk", tags=["3. Kiosk & Passport Smart Login"])
app.include_router(baggage_drop_controller.router, prefix="/api/v1/baggage-drop", tags=["4. Smart Check-in & Baggage Drop"])
app.include_router(inspection_controller.router, prefix="/api/v1/inspection", tags=["5. AI Baggage Inspection"])
app.include_router(baggage_tracking_controller.router, prefix="/api/v1/baggage-tracking", tags=["6. Baggage Tracking"])
app.include_router(security_gate_controller.router, prefix="/api/v1/security-gate", tags=["7. Biometric Security Gate"])
app.include_router(boarding_gate_controller.router, prefix="/api/v1/boarding-gate", tags=["8. Biometric Boarding Gate"])
app.include_router(monitoring_controller.router, prefix="/api/v1/monitoring", tags=["9. CCTV Monitoring"])
app.include_router(k9_patrols_controller.router, prefix="/api/v1/k9-patrols", tags=["10. K9 Units"])
app.include_router(maintenance_controller.router, prefix="/api/v1/maintenance", tags=["11. IoT Maintenance"])
app.include_router(reports_controller.router, prefix="/api/v1/reports", tags=["13. Reports & Analytics"])
app.include_router(ai_controller.router, prefix="/api/v1/ai", tags=["14. AI Center"])
app.include_router(agent_controller.router, prefix="/api/v1/agents", tags=["15. Agent System"])
app.include_router(orchestration_controller.router, prefix="/api/v1/agents", tags=["15. Agent System"])
app.include_router(saga_controller.router, prefix="/api/v1/agents", tags=["15. Agent System"])
app.include_router(hitl_controller.router, prefix="/api/v1/agents", tags=["15. Agent System"])

from fastapi.staticfiles import StaticFiles
import os
_data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(_data_dir, exist_ok=True)
app.mount("/data", StaticFiles(directory=_data_dir), name="data")

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}