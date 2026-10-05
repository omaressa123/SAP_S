// Central AI module registry (frontend mirror).
// Preferred source is GET /api/v1/ai/registry (backend ai_registry.py).
// The static list below is only a fallback so the AI Center still renders
// honestly when the backend is unreachable — capabilities match the audit.
export const AI_MODULE_FALLBACK = [
  { id: 'face_recognition', name: 'Face Recognition', description: 'Biometric identity verification', endpoint: '/api/v1/ai/face/verify', input_type: 'image', supported_operations: ['enroll', 'verify'], local_module: 'AI/face_reco', route: '/ai/face' },
  { id: 'baggage_threat_detection', name: 'Baggage Threat Detection', description: 'X-Ray baggage analysis', endpoint: '/api/v1/ai/baggage/analyze', input_type: 'image', supported_operations: ['analyze'], local_module: 'AI/BTD', route: '/ai/baggage' },
  { id: 'baggage_person_detection', name: 'Baggage & Person Detection', description: 'Object and passenger detection', endpoint: '/api/v1/ai/scene/baggage-person', input_type: 'image', supported_operations: ['detect'], local_module: 'AI/Baggage_And_Person_Detector', route: '/ai/baggage' },
  { id: 'smoke_fire_detection', name: 'Smoke & Fire Detection', description: 'Emergency vision monitoring', endpoint: '/api/v1/ai/smoke-fire/analyze', input_type: 'image', supported_operations: ['analyze'], local_module: 'AI/smoke_fire_detection', route: '/ai/smoke-fire' },
  { id: 'full_scene_detection', name: 'Full Scene Detection', description: 'YOLO object detection', endpoint: '/api/v1/ai/scene/analyze', input_type: 'image', supported_operations: ['analyze'], local_module: 'AI/fulldetection', route: '/ai/full-detection' },
]
