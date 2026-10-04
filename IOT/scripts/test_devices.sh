#!/usr/bin/env bash
# ==============================================================================
# Automated Test Suite for Airport IoT System
# ==============================================================================

set -e

MQTT_HOST="${1:-broker.hivemq.com}"
MQTT_PORT="${2:-1883}"

echo "=================================================="
echo " Starting Automated Airport IoT Device Validation"
echo " Target Broker: ${MQTT_HOST}:${MQTT_PORT}"
echo "=================================================="

# Function to test publishing command
send_command() {
    local topic=$1
    local payload=$2
    local label=$3
    echo -n "[TEST] $label ... "
    if mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "$topic" -m "$payload"; then
        echo " [OK]"
    else
        echo " [FAILED]"
        return 1
    fi
}

echo ""
echo "--- 1. Testing Smart Gate Commands (GATE-001) ---"
send_command "airport/gate/GATE-001/command" '{"command":"RESET"}' "Gate Reset Command"
sleep 1
send_command "airport/gate/GATE-001/command" '{"command":"AUTH_PASSENGER","card_uid":"BOARDING-PASS-VALID-123","authorized":true}' "Gate Authorize Valid Pass"
sleep 1
send_command "airport/gate/GATE-001/command" '{"command":"AUTH_PASSENGER","card_uid":"BOARDING-PASS-DENIED-999","authorized":false}' "Gate Deny Blacklisted Pass"
sleep 1
send_command "airport/gate/GATE-001/command" '{"command":"LOCK"}' "Gate Security Lock"
sleep 1
send_command "airport/gate/GATE-001/command" '{"command":"UNLOCK"}' "Gate Unlock"
sleep 1
send_command "airport/gate/GATE-001/command" '{"command":"OPEN"}' "Gate Remote Open"
sleep 1
send_command "airport/gate/GATE-001/command" '{"command":"CLOSE"}' "Gate Remote Close"

echo ""
echo "--- 2. Testing Passenger Counter Commands (COUNTER-001) ---"
send_command "airport/passenger-counter/COUNTER-001/command" '{"command":"RESET"}' "Counter Reset Command"
sleep 1
send_command "airport/passenger-counter/COUNTER-001/command" '{"command":"SET_OCCUPANCY","occupancy":100}' "Set Initial Occupancy"
sleep 1
send_command "airport/passenger-counter/COUNTER-001/command" '{"command":"SIMULATE_ENTRY"}' "Simulate Passenger Entry"
sleep 1
send_command "airport/passenger-counter/COUNTER-001/command" '{"command":"SIMULATE_EXIT"}' "Simulate Passenger Exit"
sleep 1
send_command "airport/passenger-counter/COUNTER-001/command" '{"command":"GET_STATUS"}' "Request Counter Status Telemetry"

echo ""
echo "--- 3. Testing Aircraft Parking Commands (AIRCRAFT-PARK-001) ---"
send_command "airport/aircraft-parking/AIRCRAFT-PARK-001/command" '{"command":"RESET"}' "Parking Reset"
sleep 1
send_command "airport/aircraft-parking/AIRCRAFT-PARK-001/command" '{"command":"START_SIMULATION"}' "Parking Start Simulation"
sleep 1
send_command "airport/aircraft-parking/AIRCRAFT-PARK-001/command" '{"command":"AIRCRAFT_ARRIVAL"}' "Parking Aircraft Arrival"
sleep 1
send_command "airport/aircraft-parking/AIRCRAFT-PARK-001/command" '{"command":"AIRCRAFT_DEPARTURE"}' "Parking Aircraft Departure"
sleep 1
send_command "airport/aircraft-parking/AIRCRAFT-PARK-001/command" '{"command":"GET_STATUS"}' "Parking Status Request"

echo ""
echo "--- 4. Testing Smart Charging Commands (CHARGER-001) ---"
send_command "airport/charging/CHARGER-001/command" '{"command":"RESET"}' "Charger Reset"
sleep 1
send_command "airport/charging/CHARGER-001/command" '{"command":"CONNECT_VEHICLE"}' "Charger Connect Vehicle"
sleep 1
send_command "airport/charging/CHARGER-001/command" '{"command":"START_CHARGING"}' "Charger Start Charging"
sleep 1
send_command "airport/charging/CHARGER-001/command" '{"command":"STOP_CHARGING"}' "Charger Stop Charging"
sleep 1
send_command "airport/charging/CHARGER-001/command" '{"command":"EMERGENCY_STOP"}' "Charger Emergency Stop"
sleep 1
send_command "airport/charging/CHARGER-001/command" '{"command":"DISCONNECT_VEHICLE"}' "Charger Disconnect Vehicle"
sleep 1
send_command "airport/charging/CHARGER-001/command" '{"command":"GET_STATUS"}' "Charger Status Request"

echo ""
echo "--- 5. Testing Equipment Monitoring Commands (EQUIPMENT-001) ---"
send_command "airport/equipment/EQUIPMENT-001/command" '{"command":"RESET"}' "Equipment Reset"
sleep 1
send_command "airport/equipment/EQUIPMENT-001/command" '{"command":"START"}' "Equipment Start"
sleep 1
send_command "airport/equipment/EQUIPMENT-001/command" '{"command":"STOP"}' "Equipment Stop"
sleep 1
send_command "airport/equipment/EQUIPMENT-001/command" '{"command":"MAINTENANCE"}' "Equipment Maintenance Ack"
sleep 1
send_command "airport/equipment/EQUIPMENT-001/command" '{"command":"GET_STATUS"}' "Equipment Status Request"

echo ""
echo "--- 6. Testing Security Area Commands (SECURITY-001) ---"
send_command "airport/security/SECURITY-001/command" '{"command":"RESET"}' "Security Reset"
sleep 1
send_command "airport/security/SECURITY-001/command" '{"command":"AUTHORIZE","card_uid":"SEC-CARD-77","authorized":true}' "Security Authorize Card"
sleep 1
send_command "airport/security/SECURITY-001/command" '{"command":"AUTHORIZE","card_uid":"SEC-CARD-99","authorized":false}' "Security Deny Card"
sleep 1
send_command "airport/security/SECURITY-001/command" '{"command":"OPEN"}' "Security Remote Open"
sleep 1
send_command "airport/security/SECURITY-001/command" '{"command":"CLOSE"}' "Security Remote Close"
sleep 1
send_command "airport/security/SECURITY-001/command" '{"command":"LOCK"}' "Security Lock"
sleep 1
send_command "airport/security/SECURITY-001/command" '{"command":"UNLOCK"}' "Security Unlock"
sleep 1
send_command "airport/security/SECURITY-001/command" '{"command":"EMERGENCY_STOP"}' "Security Emergency Stop"
sleep 1
send_command "airport/security/SECURITY-001/command" '{"command":"RESET"}' "Security Post-Emergency Reset"

echo ""
echo "--- 7. Testing Smart Baggage Commands (BAGGAGE-001) ---"
send_command "airport/baggage/BAGGAGE-001/command" '{"command":"RESET"}' "Baggage Reset"
sleep 1
send_command "airport/baggage/BAGGAGE-001/command" '{"command":"TAG_DETECT","tag_uid":"BAG-TAG-001"}' "Baggage Tag Detect"
sleep 1
send_command "airport/baggage/BAGGAGE-001/command" '{"command":"SORT","tag_uid":"BAG-TAG-001"}' "Baggage Sort"
sleep 1
send_command "airport/baggage/BAGGAGE-001/command" '{"command":"DIVERT","tag_uid":"BAG-TAG-002","reason":"MISROUTED"}' "Baggage Divert"
sleep 1
send_command "airport/baggage/BAGGAGE-001/command" '{"command":"GET_STATUS"}' "Baggage Status Request"

echo ""
echo "--- 8. Testing Emergency Detection Commands (EMERG-001) ---"
send_command "airport/emergency/EMERG-001/command" '{"command":"RESET"}' "Emergency Reset"
sleep 1
send_command "airport/emergency/EMERG-001/command" '{"command":"TRIGGER","details":"TEST_TRIGGER"}' "Emergency Trigger"
sleep 1
send_command "airport/emergency/EMERG-001/command" '{"command":"EVACUATE"}' "Emergency Evacuate"
sleep 1
send_command "airport/emergency/EMERG-001/command" '{"command":"SILENCE"}' "Emergency Silence"
sleep 1
send_command "airport/emergency/EMERG-001/command" '{"command":"LOCKDOWN"}' "Emergency Lockdown"
sleep 1
send_command "airport/emergency/EMERG-001/command" '{"command":"RESET"}' "Emergency Post-Alarm Reset"

echo ""
echo "--- 9. Testing Fire/Smoke Commands (FIRE-001) ---"
send_command "airport/fire-smoke/FIRE-001/command" '{"command":"RESET"}' "Fire Reset"
sleep 1
send_command "airport/fire-smoke/FIRE-001/command" '{"command":"TEST_ALARM"}' "Fire Test Alarm"
sleep 1
send_command "airport/fire-smoke/FIRE-001/command" '{"command":"SILENCE"}' "Fire Silence"
sleep 1
send_command "airport/fire-smoke/FIRE-001/command" '{"command":"GET_STATUS"}' "Fire Status Request"

echo ""
echo "--- 10. Testing Environment Commands (ENV-001) ---"
send_command "airport/environment/ENV-001/command" '{"command":"RESET"}' "Environment Reset"
sleep 1
send_command "airport/environment/ENV-001/command" '{"command":"FAN_ON"}' "Environment Fan On"
sleep 1
send_command "airport/environment/ENV-001/command" '{"command":"FAN_AUTO"}' "Environment Fan Auto"
sleep 1
send_command "airport/environment/ENV-001/command" '{"command":"GET_STATUS"}' "Environment Status Request"

echo ""
echo "--- 11. Testing Smart Elevator Commands (ELEV-001) ---"
send_command "airport/elevator/ELEV-001/command" '{"command":"RESET"}' "Elevator Reset"
sleep 1
send_command "airport/elevator/ELEV-001/command" '{"command":"CALL_UP"}' "Elevator Call Up"
sleep 1
send_command "airport/elevator/ELEV-001/command" '{"command":"CALL_DOWN"}' "Elevator Call Down"
sleep 1
send_command "airport/elevator/ELEV-001/command" '{"command":"OPEN_DOOR"}' "Elevator Open Door"
sleep 1
send_command "airport/elevator/ELEV-001/command" '{"command":"CLOSE_DOOR"}' "Elevator Close Door"
sleep 1
send_command "airport/elevator/ELEV-001/command" '{"command":"EMERGENCY_STOP"}' "Elevator Emergency Stop"
sleep 1
send_command "airport/elevator/ELEV-001/command" '{"command":"RESET"}' "Elevator Post-Emergency Reset"

echo ""
echo "=================================================="
echo " All device command payloads sent successfully!"
echo "=================================================="
