# Models package — importing every model module here guarantees the full
# SQLAlchemy metadata (cross-module foreign keys) is registered no matter
# which entrypoint runs: uvicorn app.main:app, init_db.py, seed_db.py,
# scripts_smoke.py or app.services.mqtt_consumer.
# NOTE: legacy `passenger.py` (orphan `passengers` table, superseded by
# identity.Passenger) is intentionally NOT imported.
from . import (  # noqa: F401
    identity,
    flights,
    check_in,
    baggage_security_screening,
    security,
    wayfinding,
    staff,
    admin_cameras,
    devices,
    sustainability,
    agents,
    saga,
    iot,
    hitl,
    disruption,
)
