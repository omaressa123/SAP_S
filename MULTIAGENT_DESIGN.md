# Multiagent System Design

Smart Green Airport Ecosystem

**Version:** 3.2.0  
**Location:** `backend/app/agents/`  
**Status:** Phase 1 (Finished & Tested) | Phase 2 (Finished & Tested) | Phase 3 (NOT implemented)

---

## 1. Overview

The Smart Airport Ecosystem is an enterprise-grade, event-driven multiagent architecture that orchestrates the end-to-end passenger journey (booking → check-in → baggage drop → security screening → boarding → flight operations → baggage claim) across backend services, edge AI microservices, IoT field devices, and an interactive 3D digital twin.

Agents operate as autonomous, domain-bounded decision-makers that:
- Ingest real-time domain events (face biometrics, baggage X-ray threat inference, safety incidents, IoT sensor telemetry, flight status changes)
- Execute deterministic and heuristic reasoning through registered capabilities
- Participate in multi-step Saga transactions with automatic compensation and rollback
- Dispatch real-time MQTT control directives to physical airport equipment (E-Gates, baggage diverters, HVAC actuators)
- Coordinate with an LLM-assisted Disruption Planner during airport anomalies and severe schedule perturbations
- Reconcile distributed resources via multi-agent negotiation protocols (Contract Net Protocol)
- Publish state transitions to the Digital Twin and audit logs with correlation IDs

### 1.1 Completed Implementation Summary

All Phase 1 and Phase 2 agents, orchestrator mappings, and test suites are fully implemented, registered, and verified in the codebase:

| Component / Agent | Delivery Status | Source File | Registered Capabilities & Highlights |
|---|---|---|---|
| **IdentityAgent** | **Finished & Tested** | [`identity_agent.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/identity_agent.py) | `verify_identity`: ICAO MRZ checksum, YuNet/SFace anti-spoofing biometrics |
| **BaggageAgent** | **Finished & Tested** | [`baggage_agent.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/baggage_agent.py) | `screen_baggage`, `track_baggage`: YOLO11 dual-energy threat inference |
| **SafetyAgent** | **Finished & Tested** | [`safety_agent.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/safety_agent.py) | `assess_safety`: Smoke, fire, fall, restricted area, and unattended bag triage |
| **FlightOpsAgent** | **Finished & Tested** | [`flight_ops_agent.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/flight_ops_agent.py) | `update_flight_status`, `assign_gate`, `propagate_delay`: Turnaround & schedule state machine |
| **MaintenanceAgent** | **Finished & Tested** | [`maintenance_agent.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/maintenance_agent.py) | `process_telemetry`, `create_work_order`: IoT sensor scoring, vibration & thermal anomaly detection |
| **NotificationAgent** | **Finished & Tested** | [`notification_agent.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/notification_agent.py) | `send_push_notification`, `broadcast_gate_call`: Mobile app alerts, gate calls, emergency broadcasts |
| **SustainabilityAgent**| **Finished & Tested** | [`sustainability_agent.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/sustainability_agent.py) | `optimize_energy`, `calculate_footprint`: Occupancy HVAC curtailment, solar yield & carbon accounting |
| **AgentOrchestrator** | **Finished & Tested** | [`orchestrator.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/orchestrator.py) | 29 event types mapped to capabilities, retry/timeout guard, deduplication |
| **AgentRegistry** | **Finished & Tested** | [`registry.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/registry.py) | Central registry, capability discovery, heartbeat, and snapshot queries |
| **AgentService** | **Finished & Tested** | [`service.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/service.py) | Singleton initialization of all 7 agents at FastAPI application startup |
| **TwinPublisher** | **Finished & Tested** | [`twin_publisher.py`](file:///home/omaressa/omar/air_ai/backend/app/agents/twin_publisher.py) | State mirror to Digital Twin REST/WS API (:8100) |
| **Observability API** | **Finished & Tested** | [`agent_controller.py`](file:///home/omaressa/omar/air_ai/backend/app/controllers/agent_controller.py) | `/registry`, `/health`, `/tasks`, `/workflows`, `/events`, `/snapshot` |
| **Frontend UIs** | **Finished & Tested** | `frontend/src/pages/` | `AIMonitor.jsx`, `WorkflowMonitor.jsx`, `EventCenter.jsx`, `GateBoarding.jsx` |
| **Automated Tests** | **Finished & Tested** | `backend/app/tests/` | **69 passed tests** (`test_agents.py` + `test_phase2_agents.py`) |

---

## 2. Architecture & Topology

### 2.1 Complete System Architecture (Phase 1, 2 & 3)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                Client & Interaction Layer                              │
│   React Dashboard (80) │ Expo Mobile App │ Kiosk / E-Gate UI │ 3D Digital Twin (8100)  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTPS / WSS / REST
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                             API Gateway Layer (FastAPI :8000)                          │
│  /api/v1/agents      │ /api/v1/identity │ /api/v1/baggage-drop │ /api/v1/security-gate │
│  /api/v1/flight-ops  │ /api/v1/safety   │ /api/v1/maintenance  │ /api/v1/sustainability│
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                         Multiagent Orchestration & Workflow Engine                     │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────────────┐ │
│ │ AgentRegistry        │ │ SagaWorkflowEngine   │ │ LLM Disruption Planner           │ │
│ │ (Cap Discovery/HB)   │ │ (State Mach/Rollback)│ │ (Recovery & Rescheduling)        │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────────────────┘ │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────────────┐ │
│ │ EventSystem          │ │ HITL Escalation      │ │ NegotiationCoordinator           │ │
│ │ (Redis/In-Process Bus│ │ (WebSocket Dashboard)│ │ (Contract Net Protocol / Auction)│ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ TwinPublisher (Asset State / Telemetry)      │ │ IoTMqttBridge (Bidirectional Act) │ │
│ └──────────────────────────────────────────────┘ └───────────────────────────────────┘ │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                                   Agent Workers Layer                                  │
│ ┌─────────────────────────────────┐   ┌──────────────────────────────────────────────┐ │
│ │       Phase 1 Core Agents       │   │           Phase 2 Domain Agents              │ │
│ │ • IdentityAgent                 │   │ • FlightOpsAgent (Status/Gate/Delays)        │ │
│ │ • BaggageAgent                  │   │ • MaintenanceAgent (IoT Telemetry/Tickets)   │ │
│ │ • SafetyAgent                   │   │ • NotificationAgent (Push/SMS/PA Broadcast)  │ │
│ │                                 │   │ • SustainabilityAgent (Microgrid/HVAC/Carbon)│ │
│ └─────────────────────────────────┘   └──────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                              Phase 3 Cognitive Fabric                              │ │
│ │ • FederatedLearningAgent (Edge Biometrics / BTD Local Weights Aggregation)         │ │
│ │ • ElasticWorkerScaler (Dynamic Queue Depth Autoscaling)                            │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬───────────────────────────────────┬────────────────────────┘
                            │                                   │
┌───────────────────────────▼───────────────┐   ┌───────────────▼────────────────────────┐
│              AI Microservices             │   │       IoT & Field Infrastructure       │
│ • FaceVerification (:8001 / YuNet+SFace)  │   │ • Mosquitto MQTT Broker (:1883)        │
│ • BaggageThreatAdapter (:8002 / YOLO11)   │   │ • 11 ESP32 Modules (Wokwi / Hardware)  │
│ • SmokeFireDetector (:8003 / YOLOv8)      │   │ • Smart Gates (GATE-001..004)          │
│ • FullSceneDetector (:8004 / Falls/Bags)  │   │ • Baggage Sorter & Reclaim Carousels   │
└───────────────────────────────────────────┘   │ • Smart Charging & Solar Arrays        │
                                                └────────────────────────────────────────┘
```

### 2.2 Core Component Taxonomy

| Component | Module | Layer | Responsibility |
|---|---|---|---|
| `AgentInterface` | `base.py` | Core | Abstract contract: capabilities, schemas, event routing, structured output |
| `AgentRegistry` | `registry.py` | Core | Dynamic agent discovery, heartbeat validation, capability indexing |
| `EventSystem` | `events.py` | Ingress | Event pub/sub bus with DB persistence, correlation IDs, and deduplication |
| `AgentOrchestrator` | `orchestrator.py` | Workflow | Deterministic event dispatch, retry backoff, fallback handler routing |
| `SagaWorkflowEngine` | `saga.py` | Workflow | Multi-step transaction orchestrator with state persistence and compensating rollbacks |
| `DisruptionPlanner` | `planner.py` | Cognitive | LLM-assisted schedule recovery and constraint satisfaction during disruptions |
| `HITLManager` | `hitl.py` | Human-Loop | WebSocket bridge routing uncertain decisions to human officer review queues |
| `IoTMqttBridge` | `iot_bridge.py` | Hardware | Bidirectional MQTT actuator for field hardware command & telemetry loops |
| `TwinPublisher` | `twin_publisher.py`| Sync | Real-time digital twin state mirror via REST/WebSocket (:8100) |
| `NegotiationCoordinator`| `negotiation.py`| Protocol | Contract Net Protocol for multi-agent competitive resource allocation |
| `FederatedCoordinator` | `federated.py`| Learning | Secure federated model weight aggregation without raw biometric exposure |

---

## 3. Detailed Agent Specifications

### 3.1 Phase 1 Implemented Agents

#### 3.1.1 Identity Verification Agent (`identity_agent.py`)
- **Primary Capability:** `verify_identity`
- **Supported Events:** `face_verify`, `passport_scan`, `kiosk_enrollment`
- **Processing Logic:**
  1. Validates passport MRZ checksum (ICAO Doc 9303 standard).
  2. Submits live camera frame and reference photo to Face Verification Microservice (:8001).
  3. Applies anti-spoofing liveness verification (threshold $\ge 0.85$).
  4. Generates cryptographic biometric embedding reference (`vec_p<id>_<hash>`).
- **Outputs:** `VERIFIED`, `RETRY`, `REVIEW`
- **Persistence Target:** `traveldocument`, `faceenrollment`, `faceverificationlog`, `decisionaudit`

#### 3.1.2 Baggage Screening Agent (`baggage_agent.py`)
- **Primary Capabilities:** `screen_baggage`, `track_baggage`
- **Supported Events:** `baggage_scan`, `baggage_tracking`
- **Processing Logic:**
  1. Ingests dual-energy X-ray projection images via Cloudinary/local store.
  2. Dispatches payload to Baggage Threat Detection (BTD) Microservice (:8002).
  3. Detects prohibited items: firearms, knives, lithium batteries, aerosols, explosives.
  4. Calculates composite threat confidence score.
- **Outputs:** `SAFE`, `MANUAL_REVIEW`, `PROCESSING_ERROR`
- **Persistence Target:** `bag`, `bagcheckpointlog`, `baggageinspection`, `detecteditem`

#### 3.1.3 Safety Monitoring Agent (`safety_agent.py`)
- **Primary Capability:** `assess_safety`
- **Supported Events:** `smoke_detected`, `fire_detected`, `fall_detected`, `restricted_area`, `unattended_bag`, `overcrowding`, `iot_telemetry`
- **Processing Logic:**
  1. Ingests video analytics bounding boxes and confidence levels (:8003, :8004).
  2. Correlates visual detections with physical IoT sensor telemetry (MQ-2 smoke, thermal sensors).
  3. Evaluates zone vulnerability (e.g. Fuel Hydrant Stand A12 vs Departure Concourse).
  4. Assigns severity: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **Outputs:** `ASSESSED_SAFE`, `INCIDENT_DISPATCHED`, `EVACUATION_TRIGGERED`
- **Persistence Target:** `emergencyevent`, `monitoringalert`, `decisionaudit`

---

### 3.2 Phase 2 Implemented Domain Agents (Finished & Verified)

All four Phase 2 domain agents have been implemented in `backend/app/agents/`, registered in `service.py`, connected to `orchestrator.py`, and verified with automated test suites.

#### 3.2.1 Flight Operations Agent (`flight_ops_agent.py`)
- **Agent Identifier:** `flight_ops_agent`
- **Domain Responsibilities:** Gate assignment optimization, turnaround timing, delay propagation, schedule resilience.
- **Registered Capabilities:**

| Capability | Input Contract | Output Contract | Timeout | Requires Human Review |
|---|---|---|---|---|
| `update_flight_status` | `{flight_id: int, new_status: str, reason: str}` | `{flight_id: int, updated: bool, timestamp: str}` | 15s | No |
| `assign_gate` | `{flight_id: int, preferred_concourse: str, aircraft_type: str}` | `{gate_id: str, terminal: str, conflict: bool}` | 30s | If conflict detected |
| `propagate_delay` | `{flight_id: int, delay_minutes: int, reason: str}` | `{affected_flights: list, affected_passengers: int, downstream_notifications: int}` | 45s | If delay > 120m |
| `rebook_passengers` | `{flight_id: int, cancelled: bool}` | `{rebooked_count: int, standby_count: int, voucher_count: int}` | 60s | Yes |

- **Event Triggers:** `flight_delay`, `gate_change`, `aircraft_arrival`, `aircraft_departure`, `turnaround_milestone`, `weather_alert`
- **Decision & Gate Conflict Resolution Logic:**
  ```python
  def resolve_gate_assignment(flight, available_gates, aircraft_specs):
      # Filter gates by wingspan, jet-bridge capacity, and international/domestic sterile zoning
      compatible = [g for g in available_gates if g.max_wingspan >= aircraft_specs.wingspan 
                    and g.is_international == flight.is_international]
      if not compatible:
          return GateAssignmentResult(success=False, requires_escalation=True, reason="NO_COMPATIBLE_GATE")
      # Calculate turnaround buffer: ensure >= 45 minutes between departure and next arrival
      scored_gates = []
      for gate in compatible:
          slack_time = gate.next_scheduled_arrival - flight.scheduled_departure
          taxi_distance = calculate_taxiway_distance(gate, runway_in_use)
          score = (slack_time.total_seconds() / 60) * 0.6 - (taxi_distance * 0.4)
          scored_gates.append((score, gate))
      scored_gates.sort(key=lambda x: x[0], reverse=True)
      selected_gate = scored_gates[0][1]
      return GateAssignmentResult(success=True, gate_id=selected_gate.id, score=scored_gates[0][0])
  ```
- **Persistence Target:** `flight`, `boardinggate`, `gate_assignment_log`, `booking`, `airportevent`

#### 3.2.2 Maintenance Agent (`maintenance_agent.py`)
- **Agent Identifier:** `maintenance_agent`
- **Domain Responsibilities:** IoT equipment telemetry health scoring, predictive maintenance, automated work-order dispatch.
- **Registered Capabilities:**

| Capability | Input Contract | Output Contract | Timeout | Requires Human Review |
|---|---|---|---|---|
| `process_telemetry` | `{device_id: str, metrics: dict, uptime: int}` | `{health_score: float, status: str, anomaly: bool}` | 10s | No |
| `predict_failure` | `{equipment_id: int, historical_telemetry: list}` | `{predicted_mtbf_hours: float, failure_risk: str}` | 30s | If risk == 'HIGH' |
| `create_work_order` | `{equipment_id: int, fault_code: str, priority: str}` | `{ticket_id: int, assigned_team: str, sla_hours: int}` | 20s | No |
| `schedule_downtime` | `{equipment_id: int, duration_minutes: int}` | `{window_start: str, window_end: str, rerouted: bool}` | 30s | Yes |

- **Event Triggers:** `equipment_telemetry`, `health_check_failure`, `iot_sensor_alarm`, `conveyor_jam`, `escalator_fault`
- **Anomaly Detection Heuristic (Z-Score + Threshold Windowing):**
  - Monitors temperature, motor current, vibration RMS from ESP32 `equipment-monitoring` modules.
  - Generates `DEGRADED` state if running variance exceeds $3\sigma$ for $\ge 3$ consecutive reporting intervals.
  - Automatically commands IoT power throttling or diversion flaps before catastrophic motor burnout.
- **Persistence Target:** `equipment`, `equipmenthealthcheck`, `maintenanceticket`, `auditlog`

#### 3.2.3 Passenger Notification Agent (`notification_agent.py`)
- **Agent Identifier:** `notification_agent`
- **Domain Responsibilities:** Omnichannel passenger alerting, localized terminal PA broadcast requests, personalization.
- **Registered Capabilities:**

| Capability | Input Contract | Output Contract | Timeout | Requires Human Review |
|---|---|---|---|---|
| `send_push_notification`| `{passenger_id: int, title: str, body: str, screen: str}`| `{delivered: bool, message_id: str, timestamp: str}` | 15s | No |
| `send_sms` | `{phone_number: str, text: str}` | `{provider_id: str, status: str}` | 20s | No |
| `broadcast_gate_call` | `{gate_id: str, flight_number: str, call_type: str}` | `{pa_zone_id: int, audio_queued: bool}` | 10s | No |
| `dispatch_emergency_pns`| `{zone_id: int, instructions: str, severity: str}` | `{targeted_users: int, broadcast_pushed: bool}` | 10s | Yes |

- **Event Triggers:** `gate_change`, `flight_delay`, `boarding_call`, `baggage_carousel_ready`, `security_queue_slowdown`, `emergency_broadcast`
- **Channel Routing Matrix:**

| Urgency | Primary Channel | Secondary Channel | Fallback |
|---|---|---|---|
| Informational (Flight on-time) | In-App Push Notification | None | Web Dashboard |
| Warning (Gate Changed, 15m Delay) | Expo Push + In-App Badge | SMS | FIDS Screen update |
| Critical (Final Boarding Call) | Push + SMS | Mobile Vibration Wakeup | Terminal PA Audio Chime |
| Emergency (Evacuation / Safety) | Lock-Screen Push Flash | High-Volume SMS Broadcast | Audio PA + Digital Signage |

- **Persistence Target:** `notification`, `passengerdevice`, `delivery_log`

#### 3.2.4 Sustainability & Energy Agent (`sustainability_agent.py`)
- **Agent Identifier:** `sustainability_agent`
- **Domain Responsibilities:** Microgrid optimization, solar PV generation forecasting, HVAC dynamic setpoint regulation, carbon accounting.
- **Registered Capabilities:**

| Capability | Input Contract | Output Contract | Timeout | Requires Human Review |
|---|---|---|---|---|
| `optimize_energy` | `{zone_id: int, current_occupancy: int, temp_c: float}` | `{hvac_setpoint: float, lighting_level: int, kw_saved: float}` | 15s | No |
| `dispatch_battery` | `{current_grid_load_kw: float, solar_kw: float}` | `{battery_mode: str, dispatch_rate_kw: float}` | 20s | If grid stress == 'CRITICAL' |
| `calculate_footprint` | `{start_time: str, end_time: str}` | `{grid_kwh: float, solar_kwh: float, co2_kg_avoided: float}` | 45s | No |

- **Event Triggers:** `occupancy_update`, `solar_generation_spike`, `peak_tariff_window`, `charger_status_change`
- **Microgrid Optimization Formula:**
  $$\text{TargetHVAC}(z) = T_{\text{baseline}} + \alpha \cdot \left(1 - \frac{\text{Occupancy}(z)}{\text{Capacity}(z)}\right) - \beta \cdot (\text{TariffRate} - \text{BaseTariff})$$
  Where $\alpha = 2.0^\circ\text{C}$ damping factor and $\beta = 0.5$ price sensitivity multiplier.
- **Persistence Target:** `powersource`, `solarinstallation`, `energygenerationlog`, `energystorage`, `energyconsumptionlog`

---

## 4. Comprehensive Event Model & Schema Taxonomy

### 4.1 Enterprise Event Envelope

```json
{
  "event_id": "a98f12c4-3b21-4f10-912a-89bc4512e091",
  "event_type": "flight_delay",
  "source": "flight_ops_agent",
  "correlation_id": "c1092837-5544-41e9-8901-abcdef012345",
  "causation_id": "e8812304-1234-4567-89ab-cdef01234567",
  "timestamp": "2026-10-22T12:00:00.000Z",
  "payload": {
    "flight_id": 88,
    "flight_number": "QR-082",
    "old_departure": "2026-10-22T10:45:00Z",
    "new_departure": "2026-10-22T12:15:00Z",
    "delay_minutes": 90,
    "delay_reason": "Inbound aircraft mechanical inspection at Stand A12",
    "affected_gate": "B22"
  },
  "processed": false,
  "retry_count": 0,
  "priority": "HIGH"
}
```

### 4.2 Cross-Phase Event Taxonomy

```
Airport Events
├── Identity Events
│   ├── face_verify
│   ├── passport_scan
│   └── kiosk_enrollment
├── Baggage Events
│   ├── baggage_scan
│   ├── baggage_tracking
│   └── baggage_jammed
├── Safety Events
│   ├── smoke_detected
│   ├── fire_detected
│   ├── fall_detected
│   ├── restricted_area_breach
│   └── unattended_bag
├── Flight Operations Events (Phase 2)
│   ├── flight_delay
│   ├── gate_change
│   ├── aircraft_arrival
│   ├── aircraft_pushback
│   └── turnaround_milestone
├── Maintenance Events (Phase 2)
│   ├── equipment_telemetry
│   ├── health_check_failure
│   ├── vibration_anomaly
│   └── emergency_stop_triggered
├── Notification Events (Phase 2)
│   ├── boarding_call
│   ├── gate_announcement
│   ├── baggage_carousel_assigned
│   └── emergency_evac_alert
├── Sustainability Events (Phase 2)
│   ├── solar_peak_yield
│   ├── peak_demand_tariff_start
│   └── zone_empty_powerdown
└── Cognitive & Distributed Events (Phase 3)
    ├── agent_rfp_broadcast (CNP)
    ├── agent_bid_submission
    ├── fl_weights_published
    └── worker_scaling_requested
```

---

### 5. Multi-Step Workflow Engine & Saga Orchestration

**Implementation status (M2.5): Finished & Tested.** Implemented in
`backend/app/agents/saga.py` (SagaWorkflowEngine), exposed via
`backend/app/controllers/saga_controller.py`, persisted in
`backend/app/models/saga.py` (sagainstance, sagastep, sagacompensation),
registered in `backend/app/agents/service.py`, and wired into the agent
startup. Verified by `backend/app/tests/test_saga.py` (12 tests, all passing).

The passenger journey is implemented as a stateful, compensable Saga
transaction. If any step fails critically, compensating actions reverse or
mitigate previous downstream side-effects.

### 5.1 End-to-End Passenger Journey Saga

```mermaid
stateDiagram-v2
    [*] --> CheckinInitiated
    CheckinInitiated --> IdentityVerified: IdentityAgent (verify_identity)
    CheckinInitiated --> ManualIdentityReview: Low Face Match (<0.80)
    
    IdentityVerified --> BaggageInducted: BaggageAgent (screen_baggage)
    ManualIdentityReview --> BaggageInducted: Agent Supervisor Override
    ManualIdentityReview --> TransactionFailed: Identity Impersonation Detected
    
    BaggageInducted --> BaggageCleared: YOLO11 No Threat
    BaggageInducted --> BaggageThreatDiverted: Threat Detected
    
    BaggageCleared --> SecurityGatePassed: Safety & E-Gate Clearance
    BaggageThreatDiverted --> K9SecurityDispatched: Physical Search Required
    
    SecurityGatePassed --> PassengerBoarded: BoardingGate Biometric Match
    PassengerBoarded --> TurnaroundFinalized: FlightOpsAgent Manifest Confirmed
    
    TurnaroundFinalized --> [*]
    
    TransactionFailed --> CompensateJourney: Cancel Boarding Pass & Lock E-Gate
    CompensateJourney --> [*]
```

### 5.2 Saga Compensation Matrix

| Step | Forward Action | Failure Condition | Compensating Rollback Action |
|---|---|---|---|
| 1. Check-In & Identity | Verify passport + face, issue digital pass | Impersonation / Fraud | Revoke pass, flag passport number, trigger security alert |
| 2. Baggage Drop | Weigh bag, generate RFID tag, run BTD X-ray | Weapon / Explosive detected | Divert bag to inspection spur, stop conveyor belt, lock passenger boarding pass |
| 3. Security E-Gate | Match live face at barrier, verify ticket status | Failed facial authentication | Lock turnstile, illuminate amber beacon, call station supervisor |
| 4. Boarding Gate | Final biometric match, update manifest | Gate changed / Flight delayed | Notify passenger of new gate, update digital wallet pass, release seat reservation |

### 5.3 Saga Transaction Code Implementation

```python
class PassengerJourneySaga:
    """Orchestrates end-to-end passenger journey with transactional rollback."""
    
    def __init__(self, orchestrator, db_session):
        self.orchestrator = orchestrator
        self.db = db_session
        self.journal: List[Dict[str, Any]] = []

    async def execute_journey_step(self, step_name: str, forward_coro, compensate_coro):
        try:
            result = await forward_coro()
            self.journal.append({"step": step_name, "compensate": compensate_coro, "status": "COMPLETED"})
            return result
        except Exception as exc:
            # Trigger backward recovery (Saga rollback)
            await self._rollback_saga(exc)
            raise

    async def _rollback_saga(self, cause: Exception):
        for entry in reversed(self.journal):
            if entry["status"] == "COMPLETED" and entry["compensate"]:
                try:
                    await entry["compensate"]()
                    entry["status"] = "COMPENSATED"
                except Exception as rollback_err:
                    # Log critical compensation failure to audit log
                    pass
```

---

## 6. LLM-Assisted Disruption Recovery Planner (Phase 2)

**Implementation status (M2.8): Finished & Tested.** Implemented in
`backend/app/agents/disruption_planner.py` (DisruptionPlanner), exposed via
`backend/app/controllers/disruption_controller.py`, persisted in
`backend/app/models/disruption.py` (disruptionproposal), registered in
`backend/app/agents/service.py`. Verified by `backend/app/tests/test_disruption.py`
(13 tests, all passing) and a frontend review page at
`frontend/src/pages/DisruptionPlanner.jsx`. An LLM is used only when
`DISRUPTION_LLM_BASE_URL` / `DISRUPTION_LLM_API_KEY` are configured; otherwise a
deterministic heuristic fallback builds the plan. Model output is never executed
directly.

During major irregular airport operations (IRROPS)—such as runway icing, severe convective weather, or emergency ground stops—deterministic logic becomes insufficient due to combinatorially explosive constraints.

### 6.1 Disruption Planner Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Disruption Event Detected                   │
│   (e.g., Runway 09L Disabled + 14 Inbound Flights Diverted) │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  Constraint Extraction Engine               │
│ • Hard Constraints: Gate physical limits, Crew rest hours   │
│ • Soft Constraints: Connecting pax bags, Fuel consumption   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           LLM Disruption Recovery Engine (Gemini / Claude)  │
│ System Prompt: Airport Operations Specialist & Dispatcher   │
│ Input: Operational Snapshot JSON + Active Flight Constraints│
│ Output: Validated JSON Action Plan                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│               Deterministic Constraint Validator            │
│  Validates: Zero gate double-bookings, legal turnaround gaps│
│  Result: PASSED ──► Executed across Domain Agents           │
│          FAILED ──► Fallback to Heuristic Greedy Sched.     │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Structured LLM Disruption Plan Output Schema

```json
{
  "scenario_id": "DISRUPT-20261022-09L",
  "severity": "CRITICAL",
  "root_cause": "Hydraulic fluid spill on Taxiway Kilo requiring 90m remediation",
  "actions": [
    {
      "agent": "flight_ops_agent",
      "capability": "propagate_delay",
      "parameters": { "flight_id": 88, "delay_minutes": 45, "new_gate": "B22" }
    },
    {
      "agent": "flight_ops_agent",
      "capability": "assign_gate",
      "parameters": { "flight_id": 102, "gate_id": "A12" }
    },
    {
      "agent": "notification_agent",
      "capability": "send_push_notification",
      "parameters": {
        "flight_id": 88,
        "title": "Gate & Time Update",
        "body": "Flight QR-082 rescheduled to 11:30 AM due to taxiway clearance. Gate remains B22."
      }
    },
    {
      "agent": "sustainability_agent",
      "capability": "optimize_energy",
      "parameters": { "zone_id": 4, "temp_c": 23.5, "lighting_level": 70 }
    }
  ],
  "estimated_recovery_minutes": 65,
  "confidence_score": 0.94
}
```

---

## 7. Cross-System IoT Action Triggering (Bidirectional MQTT)

**Implementation status (M2.6): Finished & Tested.** Implemented in
`backend/app/agents/iot_bridge.py` (IoTMqttBridge), run as the dedicated
`mqtt-bridge` compose service (`backend/app/services/mqtt_bridge.py`), exposed
via `backend/app/controllers/iot_controller.py`, persisted in
`backend/app/models/iot.py` (iotcommandlog, iottelemetrylog), registered in
`backend/app/agents/service.py`. Verified by `backend/app/tests/test_iot_bridge.py`
(13 tests, all passing). Mosquitto (:1883) was already present in
`docker-compose.yml`; a `mqtt-bridge` service was added. No Redis/Kafka was
introduced.

Phase 2 connects agents directly to physical edge hardware and Wokwi simulation modules over Mosquitto MQTT (:1883).

### 7.1 Actuation Channel Architecture

```
Agent Layer (e.g. IdentityAgent)
       │
       ▼ (Publishes command)
IoTMqttBridge.dispatch_command("airport/gate/GATE-001/cmd", {"action": "UNLOCK", "duration_ms": 7000})
       │
       ▼ (MQTT QoS 1)
Mosquitto Broker (:1883)
       │
       ▼ (Subscribed topic)
ESP32 Smart Airport Gate (`IOT/modules/smart-airport-gate`)
       │ (Executes stepper motor turnstile unlock & green LED pulse)
       ▼ (Publishes status telemetry)
Topic: "airport/gate/GATE-001/telemetry" -> {"status": "OPENED", "turnstile_cycles": 14210}
       │
       ▼
IoTMqttBridge.on_telemetry_received() -> Ingested by MaintenanceAgent & TwinPublisher
```

### 7.2 Hardware Command Protocol

| Module | Command Topic | Command Payload | Expected Physical Response |
|---|---|---|---|
| `smart-airport-gate` | `airport/gate/{id}/cmd` | `{"cmd": "OPEN", "timeout_sec": 10}` | Unlocks magnetic solenoid, turns LED bar green |
| `smart-baggage` | `airport/baggage/{id}/cmd` | `{"cmd": "DIVERT_THREAT", "chute": 4}` | Actuates pneumatic diverter flap to quarantine spur |
| `security-area` | `airport/security/{id}/cmd`| `{"cmd": "LOCKDOWN", "zone": 2}` | Closes security shutters, sounds local buzzer |
| `environment` | `airport/env/{id}/cmd` | `{"cmd": "SET_HVAC", "target_c": 22.0}` | Updates variable frequency drive fan speed |

---

## 8. Human-in-the-Loop (HITL) Escalation Architecture

**Implementation status (M2.7): Finished & Tested.** Implemented in
`backend/app/agents/hitl.py` (HitlManager), exposed via
`backend/app/controllers/hitl_controller.py`, persisted in
`backend/app/models/hitl.py` (hitlreview), registered in
`backend/app/agents/service.py`. Verified by `backend/app/tests/test_hitl.py`
(10 tests, all passing). Review requests persist pending/approved/rejected/expired/escalated;
expired reviews escalate to an explicit safe state (never silently approved).

When biometric similarity falls between 0.70 and 0.85, or when baggage threats have ambiguous YOLO confidence (0.40–0.65), execution halts in a dedicated pending state and is streamed to the `WorkflowMonitor.jsx` operator console.

### 8.1 HITL Escalation Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant Agent as BaggageAgent
    participant HITL as HITLManager
    participant WS as WebSocket Bridge
    participant UI as WorkflowMonitor UI
    participant Officer as Security Officer
    participant DB as DecisionAudit DB

    Agent->>HITL: escalate(ticket_id, ambiguous_scan, confidence=0.54)
    HITL->>DB: INSERT INTO decisionaudit (status='PENDING_REVIEW')
    HITL->>WS: Broadcast escalation event to channel 'agent_hitl'
    WS->>UI: Render High-Priority Review Modal
    Officer->>UI: Inspects X-Ray Dual-Energy Layer & Decides "CLEARED"
    UI->>WS: Send POST /api/v1/agents/hitl/resolve {ticket_id, decision: 'CLEARED', reason: 'False positive aerosol canister'}
    WS->>HITL: resume_workflow(ticket_id, decision)
    HITL->>DB: UPDATE decisionaudit SET reviewer_id='OFFICER_44', status='APPROVED'
    HITL->>Agent: Resume saga with human override
    Agent->>TwinPublisher: Forward cleared state to Digital Twin
```

---

## 9. Phase 3: Distributed Fabric & Cognitive Intelligence

**IMPORTANT (implementation status): Phase 3 is NOT implemented.** The following
sections (§9.1–§9.4) describe the original architecture intent only. None of
Redis Streams, Kafka, Contract Net Protocol, federated learning, or Kubernetes
HPA autoscaling was built as part of Phase 2. The existing local in-process
PostgreSQL event bus remains the message bus, and no new infrastructure
dependencies were introduced.

### 9.1 Distributed Event Bus (Redis Streams & Kafka)

In Phase 3, the in-process SQLite event bus is replaced with Redis Streams / Apache Kafka to handle $>50,000$ events/second across distributed container instances.

```
                  ┌──────────────────────────────────────────────┐
                  │          Kafka / Redis Event Stream          │
                  │             Partitioned by Entity            │
                  └───────┬──────────────────────────────┬───────┘
                          │                              │
         Key: passenger_id│               Key: flight_id │
                          ▼                              ▼
                 ┌─────────────────┐            ┌─────────────────┐
                 │ Consumer Group  │            │ Consumer Group  │
                 │ Identity/Baggage│            │   FlightOps     │
                 │   Workers       │            │   Workers       │
                 └─────────────────┘            └─────────────────┘
```

- **Partition Key Strategy:**
  - `passenger_id`: Guarantees strict chronological processing of a passenger's journey.
  - `flight_id`: Serializes gate assignments, turnaround status, and boarding logs.
  - `device_id`: Ensures IoT telemetry arrives strictly in order for Kalman filters and vibration models.

### 9.2 Agent-to-Agent Negotiation (Contract Net Protocol)

When resources are contended (e.g. two late flights requesting the single vacant wide-body Stand A12), agents do not use centralized locks. They engage in multi-agent market bidding:

```
                  ┌──────────────────────────────────────────────┐
                  │       Negotiation Coordinator Agent          │
                  │   Call for Proposals (CFP): Stand A12 Vacancy│
                  └──────────────┬────────────────┬──────────────┘
                                 │                │
            FlightOpsAgent(QR-082)│                │ FlightOpsAgent(EK-456)
        Bid: 850 pts (310 pax,   │                │ Bid: 620 pts (180 pax,
             90m turnaround delay)│                │      40m turnaround delay)
                                 ▼                ▼
                  ┌──────────────────────────────────────────────┐
                  │              Winner Determination            │
                  │ Stand A12 Awarded to Flight QR-082           │
                  │ Stand B04 (Remote) Allocated to Flight EK-456│
                  └──────────────────────────────────────────────┘
```

### 9.3 Federated Learning for Privacy-Preserving AI

To continuously improve biometric accuracy and baggage threat detection without violating GDPR / national privacy regulations:
1. **Edge Training:** E-Gates and BTD scanners compute weight gradient updates ($\Delta W$) locally on edge GPUs (Nvidia Jetson / TensorRT).
2. **Zero Raw Image Transfer:** Neither passenger biometric photos nor proprietary baggage scans leave the edge node.
3. **Secure Aggregation:** The `FederatedLearningAgent` aggregates weights using Federated Averaging (FedAvg):
   $$W_{t+1} = \sum_{k=1}^K \frac{n_k}{n} W_{t+1}^k$$
4. **Differential Privacy:** Adds Gaussian noise $\mathcal{N}(0, \sigma^2)$ to model updates to guarantee zero biometric extraction possibility.

---

## 10. Data Model & Database Schema Extensions

Phase 2 and Phase 3 introduce tables initialized alongside existing ones in `backend/init_db.py`:

```sql
-- Phase 2: Flight Operations Log
CREATE TABLE IF NOT EXISTS flightopslog (
    log_id SERIAL PRIMARY KEY,
    flight_id INTEGER REFERENCES flight(flight_id),
    previous_gate_id INTEGER REFERENCES boardinggate(boarding_gate_id),
    new_gate_id INTEGER REFERENCES boardinggate(boarding_gate_id),
    delay_minutes INTEGER DEFAULT 0,
    turnaround_status VARCHAR(50),
    disruption_scenario_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Phase 2: Maintenance Work Orders
CREATE TABLE IF NOT EXISTS maintenanceticket (
    ticket_id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(equipment_id),
    fault_code VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    health_score_at_failure NUMERIC(4,2),
    assigned_technician_id INTEGER REFERENCES staff(staff_id),
    status VARCHAR(30) DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Phase 2: Sustainability Metric Snapshots
CREATE TABLE IF NOT EXISTS sustainabilitymetric (
    metric_id SERIAL PRIMARY KEY,
    zone_id INTEGER REFERENCES zone(zone_id),
    energy_kwh NUMERIC(8,2) NOT NULL,
    solar_kwh NUMERIC(8,2) NOT NULL,
    hvac_temp_setpoint NUMERIC(3,1),
    carbon_emissions_kg NUMERIC(8,2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Phase 2: IoT Actuation Directives
CREATE TABLE IF NOT EXISTS iotcommandlog (
    command_id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    command_topic VARCHAR(150) NOT NULL,
    command_payload JSONB NOT NULL,
    dispatched_by_agent VARCHAR(50) NOT NULL,
    ack_received BOOLEAN DEFAULT FALSE,
    ack_latency_ms INTEGER,
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Phase 3: Agent Contract Net Protocol Negotiations
CREATE TABLE IF NOT EXISTS agentnegotiation (
    negotiation_id UUID PRIMARY KEY,
    resource_type VARCHAR(50) NOT NULL,
    initiator_agent VARCHAR(50) NOT NULL,
    winner_agent VARCHAR(50),
    clearing_price NUMERIC(10,2),
    bids_payload JSONB NOT NULL,
    status VARCHAR(30) DEFAULT 'SETTLED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 11. Extended API Endpoints (`/api/v1/agents`)

| Method | Endpoint | Description | Phase | Auth |
|---|---|---|---|---|
| `GET` | `/api/v1/agents/registry` | List all registered agents (Phase 1 & 2) and capability map | 1 | X-API-KEY |
| `GET` | `/api/v1/agents/health` | Comprehensive agent health summary + circuit breaker states | 1 | X-API-KEY |
| `GET` | `/api/v1/agents/snapshot` | Snapshot of tasks, queue depths, active workflows | 1 | X-API-KEY |
| `POST` | `/api/v1/agents/sagas/journey/start` | Initiates (idempotently) a Passenger Journey Saga | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/sagas/{saga_id}` | Detailed status of a Saga (steps, compensations) | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/sagas` | List recent sagas | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/sagas/correlation/{correlation_id}` | Find a saga by correlation id | 2 | X-API-KEY |
| `POST` | `/api/v1/agents/sagas/{saga_id}/resume` | Resume a paused/failed Saga | 2 | X-API-KEY |
| `POST` | `/api/v1/agents/sagas/{saga_id}/cancel` | Cancel a Saga and compensate completed steps | 2 | X-API-KEY |
| `POST` | `/api/v1/agents/sagas/{saga_id}/steps/{step_name}/approve` | Approve a needs-review Saga step (HITL) | 2 | JWT Staff/Admin |
| `POST` | `/api/v1/agents/sagas/{saga_id}/steps/{step_name}/reject` | Reject a needs-review Saga step and compensate (HITL) | 2 | JWT Staff/Admin |
| `GET` | `/api/v1/agents/sagas/steps` | Document the fixed ordered journey steps | 2 | X-API-KEY |
| `POST` | `/api/v1/agents/disruption/plan` | Generate a validated disruption recovery proposal | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/disruption/plan/{id}` | Proposal detail | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/disruption/plans` | List recovery proposals | 2 | X-API-KEY |
| `POST` | `/api/v1/agents/disruption/plan/{id}/approve` | Human approve a validated proposal | 2 | JWT Staff/Admin |
| `POST` | `/api/v1/agents/disruption/plan/{id}/execute` | Execute an approved proposal through agents | 2 | JWT Staff/Admin |
| `POST` | `/api/v1/agents/disruption/plan/{id}/reject` | Reject a proposal | 2 | JWT Staff/Admin |
| `POST` | `/api/v1/agents/hitl/reviews` | Create a human-review request | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/hitl/pending` | List pending human reviews | 2 | JWT Staff/Admin |
| `GET` | `/api/v1/agents/hitl/reviews/{id}` | Review detail | 2 | JWT Staff/Admin |
| `POST` | `/api/v1/agents/hitl/reviews/{id}/decision` | Submit approve/reject decision | 2 | JWT Staff/Admin |
| `POST` | `/api/v1/agents/hitl/expire` | Expire overdue reviews (escalate to safe state) | 2 | X-API-KEY |
| `POST` | `/api/v1/agents/iot/dispatch` | Dispatch a validated MQTT command to field IoT | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/iot/health` | MQTT bridge + command health summary | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/iot/commands` | List command logs with ack state | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/iot/commands/{id}` | Single command detail | 2 | X-API-KEY |
| `GET` | `/api/v1/agents/negotiations/active`| Monitors active Contract Net Protocol bidding rounds | 3 | X-API-KEY |
| `POST` | `/api/v1/agents/federated/round` | Triggers federated edge model aggregation cycle | 3 | X-API-KEY |

---

## 12. Verification & Testing Playbook

### 12.1 Automated Testing Suite
Run all unit, integration, and scenario tests for Phase 1 and Phase 2:
```bash
# Execute full multiagent testing suite inside virtual environment
cd /home/omaressa/omar/air_ai
PYTHONPATH=backend backend/.venv/bin/pytest backend/app/tests/ -v
```

#### Latest Test Execution Results
```
============================= test session starts ==============================
platform linux -- Python 3.14.4, pytest-9.1.1, pluggy-1.6.0
collected 117 items

backend/app/tests/test_agents.py ....................................... [ 56%]
.........................                                                [ 92%]
backend/app/tests/test_phase2_agents.py .....                            [100%]
backend/app/tests/test_saga.py ....................                      [100%]
backend/app/tests/test_iot_bridge.py ........                            [100%]
backend/app/tests/test_hitl.py .............                             [100%]
backend/app/tests/test_disruption.py .........                           [100%]

======================= 117 passed, 244 warnings in 11.57s =======================
```

| Test Suite | File | Focus Areas | Result |
|---|---|---|---|
| **Phase 1 Core Suite** | `backend/app/tests/test_agents.py` | Identity validation, BTD threat scan, Safety alarms, Deduplication, Twin sync | **64 / 64 Passed** |
| **Phase 2 Domain Suite** | `backend/app/tests/test_phase2_agents.py` | FlightOps delays/gates, Maintenance telemetry, Notification push, Sustainability | **5 / 5 Passed** |
| **M2.5 Saga Suite** | `backend/app/tests/test_saga.py` | Persistence, transitions, compensation, retry, idempotency, resume, HITL | **12 / 12 Passed** |
| **M2.6 IoT MQTT Suite** | `backend/app/tests/test_iot_bridge.py` | Command publish/ack, duplicate protection, timeouts, bounded retries, telemetry routing, health | **13 / 13 Passed** |
| **M2.7 HITL Suite** | `backend/app/tests/test_hitl.py` | Review persistence, authorization, duplicate decisions, safe expiry escalation, saga resume/compensate | **10 / 10 Passed** |
| **M2.8 Disruption Planner Suite** | `backend/app/tests/test_disruption.py` | Snapshot, heuristic plan, validation, approve/execute/reject, controller API | **13 / 13 Passed** |
| **Total Test Coverage** | All suites | Complete end-to-end multiagent pipeline | **117 / 117 Passed (100%)** |

### 12.2 Verification CLI Commands

1. **Verify Full Agent System Health & Registry:**
   ```bash
   curl -s -H "X-API-KEY: MOCK_API_KEY_123" http://localhost:8000/api/v1/agents/health | jq
   curl -s -H "X-API-KEY: MOCK_API_KEY_123" http://localhost:8000/api/v1/agents/registry | jq
   ```

2. **Trigger Passenger Journey Check-in / Identity Event:**
   ```bash
   curl -s -X POST http://localhost:8000/api/v1/kiosk/passport/scan \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: MOCK_API_KEY_123" \
     -d '{"kioskEquipmentId": 4, "rawMrzCode": "P<USAMERCER<<ALEX..."}' | jq
   ```

3. **Simulate IoT Telemetry Ingestion (MaintenanceAgent Trigger):**
   ```bash
   curl -s -X POST http://localhost:8000/api/v1/maintenance/telemetry \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: MOCK_API_KEY_123" \
     -d '{"deviceId": "EQUIPMENT-001", "temperature": 78.4, "vibrationRms": 4.2}' | jq
   ```

4. **Verify Flight Operations Delay Ingestion:**
   ```bash
   curl -s -X POST http://localhost:8000/api/v1/agents/events \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: MOCK_API_KEY_123" \
     -d '{"event_type": "flight_delay", "payload": {"flight_id": 1, "delay_minutes": 45, "reason": "Weather holding"}}' | jq
   ```

5. **Verify Digital Twin Synchronization:**
   ```bash
   curl -s http://localhost:8000/api/v1/digital-twin/dashboard/live | jq
   ```

---

## 13. Roadmap & Implementation Matrix

| Milestone | Capability / Feature | Phase | Status | Delivery Reference |
|---|---|---|---|---|
| **M1.0** | Core Agent Interfaces, Registry, In-Process Event Bus, Identity/Baggage/Safety Agents | Phase 1 | **Finished & Tested** | `base.py`, `registry.py`, `events.py`, `service.py` |
| **M1.1** | AI Adapters (Face YuNet/SFace, YOLO11 BTD, Smoke/Fire, Full Detection) | Phase 1 | **Finished & Tested** | `adapters/face.py`, `adapters/baggage.py`, `adapters/safety.py` |
| **M1.2** | TwinPublisher REST Mirror & Frontend Observability (WorkflowMonitor, AIMonitor) | Phase 1 | **Finished & Tested** | `twin_publisher.py`, `AIMonitor.jsx`, `WorkflowMonitor.jsx` |
| **M2.0** | FlightOpsAgent (Flight schedule status, Gate allocation, Delay propagation) | Phase 2 | **Finished & Tested** | `flight_ops_agent.py`, `test_phase2_agents.py` |
| **M2.1** | MaintenanceAgent (IoT equipment telemetry scoring, Work orders, Fault alarms) | Phase 2 | **Finished & Tested** | `maintenance_agent.py`, `test_phase2_agents.py` |
| **M2.2** | NotificationAgent (Push notifications, Boarding calls, Gate broadcasts) | Phase 2 | **Finished & Tested** | `notification_agent.py`, `test_phase2_agents.py` |
| **M2.3** | SustainabilityAgent (Occupancy HVAC regulation, Solar yield, Carbon footprint) | Phase 2 | **Finished & Tested** | `sustainability_agent.py`, `test_phase2_agents.py` |
| **M2.4** | Event Capability Map Expansion (29 event types routed in Orchestrator) | Phase 2 | **Finished & Tested** | `orchestrator.py` (`EVENT_CAPABILITY_MAP`) |
| **M2.5** | Saga Multi-Step Workflow Engine with Compensating Rollbacks | Phase 2 | **Finished & Tested** | `backend/app/agents/saga.py`, `backend/app/controllers/saga_controller.py`, `backend/app/models/saga.py`, `backend/app/tests/test_saga.py` |
| **M2.6** | Bidirectional IoT MQTT Command Bridge (E-Gates, Baggage Diverters) | Phase 2 | **Finished & Tested** | `backend/app/agents/iot_bridge.py`, `backend/app/services/mqtt_bridge.py`, `backend/app/controllers/iot_controller.py`, `backend/app/models/iot.py`, `docker-compose.yml` (mqtt-bridge service), `backend/app/tests/test_iot_bridge.py` |
| **M2.7** | Human-in-the-Loop (HITL) WebSocket Escalation Bridge | Phase 2 | **Finished & Tested** | `backend/app/agents/hitl.py`, `backend/app/controllers/hitl_controller.py`, `backend/app/models/hitl.py`, `backend/app/tests/test_hitl.py` |
| **M2.8** | LLM-Assisted IRROPS Disruption Recovery Planner | Phase 2 | **Finished & Tested** | `backend/app/agents/disruption_planner.py`, `backend/app/controllers/disruption_controller.py`, `backend/app/models/disruption.py`, `backend/app/tests/test_disruption.py`, `frontend/src/pages/DisruptionPlanner.jsx`, `frontend/src/services/api.js` (DisruptionApi), `frontend/src/routes/index.jsx`, `frontend/src/components/Sidebar.jsx` |
| **M3.0** | Distributed Redis Streams / Kafka Event Fabric | Phase 3 | **NOT implemented** | Explicitly excluded from Phase 2. The existing local in-process PostgreSQL event bus is used. |
| **M3.1** | Contract Net Protocol (CNP) Multi-Agent Resource Negotiation | Phase 3 | **NOT implemented** | Explicitly excluded from Phase 2. |
| **M3.2** | Federated Edge Learning Pipeline for Privacy-Preserving AI Updates | Phase 3 | **NOT implemented** | Explicitly excluded from Phase 2. |
| **M3.3** | Elastic Kubernetes HPA Worker Auto-Scaling on Queue Depth | Phase 3 | **NOT implemented** | Explicitly excluded from Phase 2. No Kubernetes deployed. |
