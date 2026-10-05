"""Central registry for AI modules. Single source of truth for backend + frontend.

Do NOT invent capabilities here — each entry reflects what the module
under AI/ actually supports (verified during repo audit).
"""
from .config import settings

AI_MODULES = [
    {
        "id": "face_recognition",
        "name": "Face Recognition",
        "description": "Biometric identity verification (passport + camera kiosk)",
        "endpoint": "/api/v1/ai/face/verify",
        "service_url": settings.FACE_RECO_URL,
        "input_type": "image",
        "supported_operations": ["enroll", "verify"],
        "local_module": "AI/face_reco",
        "status_field": "face_verification_log",
    },
    {
        "id": "baggage_threat_detection",
        "name": "Baggage Threat Detection",
        "description": "X-Ray baggage analysis (YOLO11, best.pt/best.onnx)",
        "endpoint": "/api/v1/ai/baggage/analyze",
        "service_url": settings.BTD_URL,
        "input_type": "image",
        "supported_operations": ["analyze"],
        "local_module": "AI/BTD",
        "status_field": "baggage_inspection",
    },
    {
        "id": "baggage_person_detection",
        "name": "Baggage & Person Detection",
        "description": "Object and passenger detection (YOLOv8n COCO)",
        "endpoint": "/api/v1/ai/scene/baggage-person",
        "service_url": "",
        "input_type": "image",
        "supported_operations": ["detect"],
        "local_module": "AI/Baggage_And_Person_Detector",
        "status_field": "monitoring_alert",
    },
    {
        "id": "smoke_fire_detection",
        "name": "Smoke & Fire Detection",
        "description": "Emergency vision monitoring (YOLO classification)",
        "endpoint": "/api/v1/ai/smoke-fire/analyze",
        "service_url": settings.SMOKE_FIRE_URL,
        "input_type": "image",
        "supported_operations": ["analyze"],
        "local_module": "AI/smoke_fire_detection",
        "status_field": "emergency_event",
    },
    {
        "id": "full_scene_detection",
        "name": "Full Scene Detection",
        "description": "YOLO object detection + fall detection pipeline",
        "endpoint": "/api/v1/ai/scene/analyze",
        "service_url": settings.FULL_DETECTION_URL,
        "input_type": "image",
        "supported_operations": ["analyze"],
        "local_module": "AI/fulldetection",
        "status_field": "monitoring_alert",
    },
]


def get_registry():
    return {"modules": AI_MODULES}
