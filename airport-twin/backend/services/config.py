"""Runtime configuration for the Airport Twin backend (Step 4)."""
import os

#: When true (default), the built-in Simulation Service drives telemetry,
#: flight phases and robot motion. Set TWIN_SIMULATION=false when real
#: sensors/gateways POST to /api/twin/ingest — the client contract is
#: identical either way; every broadcast carries its `source`.
SIMULATION_ENABLED = os.getenv("TWIN_SIMULATION", "true").lower() not in ("0", "false", "no", "off")
