# SMART AIRPORT — AI + IoT + Software + Cisco Network
## Architecture Foundation (Business → Software → Network)
**Central principle:** The passenger journey is the ONE central business process. AI, IoT, Software, Database and Network are technical layers of ONE system.

**Canonical vocabulary (used identically in every diagram):**
Actors: `Passenger, CheckInStaff, SecurityOfficer, GateStaff, BaggageStaff, GroundStaff, AirportAdmin, ITAdmin, MaintenanceTeam, EmergencyTeam, Airline, BorderControl, AISystem, IoTSystem`
Systems: `MobileApp, SmartKiosk, SmartGate, BaggageSystem, SecuritySystem, Backend, AIPlatform, IoTPlatform, Database, DigitalTwinService, NotificationService, AdminDashboard, CiscoNetwork`
DB entities (from schema.sql): `passenger, travel_document, face_enrollment, face_verification_log, booking, checkin_record, bag, bag_checkpoint_log, baggage_inspection, detected_item, security_gate, security_gate_log, boarding_gate, boarding_log, flight, zone, equipment, camera, emergency_event, monitoring_alert, notification, user_account, staff, digital_twin_position`

Chain: BUSINESS MODEL → BUSINESS DIAGRAM → BUSINESS WORKFLOW → SYSTEM REQUIREMENTS → SOFTWARE ARCHITECTURE → SOFTWARE DIAGRAMS → NETWORK ARCHITECTURE.

All Mermaid blocks below can be pasted into draw.io via Arrange → Insert → Advanced → Mermaid.
A starter multi-page file is at `docs/drawio/Smart_Airport_Foundation.drawio`.
