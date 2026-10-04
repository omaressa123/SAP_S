#!/usr/bin/env bash
# ==============================================================================
# Airport IoT MQTT Test & Monitor Utility
# ==============================================================================

set -e

MQTT_HOST="${1:-broker.hivemq.com}"
MQTT_PORT="${2:-1883}"

echo "=================================================="
echo " Airport IoT MQTT Test Utility"
echo " Broker: ${MQTT_HOST}:${MQTT_PORT}"
echo "=================================================="
echo ""
echo "Select an action:"
echo "1) Monitor ALL Airport IoT topics (airport/#)"
echo "2) Monitor Smart Gate topics (airport/gate/# and airport/device/GATE-001/#)"
echo "3) Monitor Passenger Counter topics (airport/passenger-counter/#)"
echo "4) Send OPEN command to Smart Gate (GATE-001)"
echo "5) Send CLOSE command to Smart Gate (GATE-001)"
echo "6) Send LOCK command to Smart Gate (GATE-001)"
echo "7) Send UNLOCK command to Smart Gate (GATE-001)"
echo "8) Send RESET command to Smart Gate (GATE-001)"
echo "9) Authorize Passenger Card on Gate (GATE-001)"
echo "10) Deny Passenger Card on Gate (GATE-001)"
echo "11) Send RESET command to Passenger Counter (COUNTER-001)"
echo "12) Set Occupancy on Passenger Counter (e.g. 50)"
echo "13) Simulate Passenger Entry on Counter (COUNTER-001)"
echo "14) Simulate Passenger Exit on Counter (COUNTER-001)"
echo "15) Monitor Aircraft Parking topics (airport/aircraft-parking/#)"
echo "16) Aircraft Arrival on Parking Stand (AIRCRAFT-PARK-001)"
echo "17) Aircraft Departure on Parking Stand (AIRCRAFT-PARK-001)"
echo "18) Monitor Charging Station topics (airport/charging/#)"
echo "19) Connect Vehicle + Start Charging (CHARGER-001)"
echo "20) Emergency Stop Charging Station (CHARGER-001)"
echo "21) Monitor Equipment topics (airport/equipment/#)"
echo "22) Start Equipment (EQUIPMENT-001)"
echo "23) Monitor Security Area topics (airport/security/#)"
echo "24) Authorize Card on Security Gate (SECURITY-001)"
echo "25) Emergency Stop Security Gate (SECURITY-001)"
echo "26) Monitor Baggage topics (airport/baggage/#)"
echo "27) Sort Baggage Tag (BAGGAGE-001)"
echo "28) Monitor Emergency topics (airport/emergency/#)"
echo "29) Trigger Emergency (EMERG-001)"
echo "30) Monitor Fire/Smoke topics (airport/fire-smoke/#)"
echo "31) Test Fire Alarm (FIRE-001)"
echo "32) Monitor Environment topics (airport/environment/#)"
echo "33) Fan On Environment (ENV-001)"
echo "34) Monitor Elevator topics (airport/elevator/#)"
echo "35) Call Elevator Up (ELEV-001)"
echo "q) Quit"
echo ""

read -p "Enter choice [1-35 or q]: " choice

case $choice in
  1)
    echo "Subscribing to all airport topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/#' -v
    ;;
  2)
    echo "Subscribing to Smart Gate topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/gate/#' -t 'airport/device/GATE-001/#' -v
    ;;
  3)
    echo "Subscribing to Passenger Counter topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/passenger-counter/#' -t 'airport/device/COUNTER-001/#' -v
    ;;
  4)
    echo "Sending OPEN command to GATE-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/gate/GATE-001/command' -m '{"command":"OPEN"}'
    echo "Done."
    ;;
  5)
    echo "Sending CLOSE command to GATE-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/gate/GATE-001/command' -m '{"command":"CLOSE"}'
    echo "Done."
    ;;
  6)
    echo "Sending LOCK command to GATE-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/gate/GATE-001/command' -m '{"command":"LOCK"}'
    echo "Done."
    ;;
  7)
    echo "Sending UNLOCK command to GATE-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/gate/GATE-001/command' -m '{"command":"UNLOCK"}'
    echo "Done."
    ;;
  8)
    echo "Sending RESET command to GATE-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/gate/GATE-001/command' -m '{"command":"RESET"}'
    echo "Done."
    ;;
  9)
    read -p "Enter Passenger Card UID [default: BOARDING-PASS-99]: " uid
    uid=${uid:-BOARDING-PASS-99}
    echo "Authorizing Card $uid..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/gate/GATE-001/command' -m "{\"command\":\"AUTH_PASSENGER\",\"card_uid\":\"$uid\",\"authorized\":true}"
    echo "Done."
    ;;
  10)
    read -p "Enter Passenger Card UID [default: BLACKLIST-01]: " uid
    uid=${uid:-BLACKLIST-01}
    echo "Denying Card $uid..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/gate/GATE-001/command' -m "{\"command\":\"AUTH_PASSENGER\",\"card_uid\":\"$uid\",\"authorized\":false}"
    echo "Done."
    ;;
  11)
    echo "Sending RESET command to COUNTER-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/passenger-counter/COUNTER-001/command' -m '{"command":"RESET"}'
    echo "Done."
    ;;
  12)
    read -p "Enter target occupancy [default: 50]: " occ
    occ=${occ:-50}
    echo "Setting occupancy to $occ..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/passenger-counter/COUNTER-001/command' -m "{\"command\":\"SET_OCCUPANCY\",\"occupancy\":$occ}"
    echo "Done."
    ;;
  13)
    echo "Simulating passenger entry..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/passenger-counter/COUNTER-001/command' -m '{"command":"SIMULATE_ENTRY"}'
    echo "Done."
    ;;
  14)
    echo "Simulating passenger exit..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/passenger-counter/COUNTER-001/command' -m '{"command":"SIMULATE_EXIT"}'
    echo "Done."
    ;;
  15)
    echo "Subscribing to Aircraft Parking topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/aircraft-parking/#' -t 'airport/device/AIRCRAFT-PARK-001/#' -v
    ;;
  16)
    echo "Signalling aircraft arrival to AIRCRAFT-PARK-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/aircraft-parking/AIRCRAFT-PARK-001/command' -m '{"command":"AIRCRAFT_ARRIVAL"}'
    echo "Done."
    ;;
  17)
    echo "Signalling aircraft departure to AIRCRAFT-PARK-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/aircraft-parking/AIRCRAFT-PARK-001/command' -m '{"command":"AIRCRAFT_DEPARTURE"}'
    echo "Done."
    ;;
  18)
    echo "Subscribing to Charging Station topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/charging/#' -t 'airport/device/CHARGER-001/#' -v
    ;;
  19)
    echo "Connecting vehicle and starting charge on CHARGER-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/charging/CHARGER-001/command' -m '{"command":"CONNECT_VEHICLE"}'
    sleep 2
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/charging/CHARGER-001/command' -m '{"command":"START_CHARGING"}'
    echo "Done."
    ;;
  20)
    echo "Sending EMERGENCY STOP to CHARGER-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/charging/CHARGER-001/command' -m '{"command":"EMERGENCY_STOP"}'
    echo "Done."
    ;;
  21)
    echo "Subscribing to Equipment Monitoring topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/equipment/#' -t 'airport/device/EQUIPMENT-001/#' -v
    ;;
  22)
    echo "Starting equipment on EQUIPMENT-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/equipment/EQUIPMENT-001/command' -m '{"command":"START"}'
    echo "Done."
    ;;
  23)
    echo "Subscribing to Security Area topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/security/#' -t 'airport/device/SECURITY-001/#' -v
    ;;
  24)
    read -p "Enter Card UID [default: SEC-CARD-77]: " uid
    uid=${uid:-SEC-CARD-77}
    echo "Authorizing Card $uid..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/security/SECURITY-001/command' -m "{\"command\":\"AUTHORIZE\",\"card_uid\":\"$uid\",\"authorized\":true}"
    echo "Done."
    ;;
  25)
    echo "Sending EMERGENCY STOP to SECURITY-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/security/SECURITY-001/command' -m '{"command":"EMERGENCY_STOP"}'
    echo "Done."
    ;;
  26)
    echo "Subscribing to Baggage topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/baggage/#' -t 'airport/device/BAGGAGE-001/#' -v
    ;;
  27)
    echo "Sorting baggage tag on BAGGAGE-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/baggage/BAGGAGE-001/command' -m '{"command":"TAG_DETECT","tag_uid":"BAG-TAG-001"}'
    sleep 2
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/baggage/BAGGAGE-001/command' -m '{"command":"SORT","tag_uid":"BAG-TAG-001"}'
    echo "Done."
    ;;
  28)
    echo "Subscribing to Emergency topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/emergency/#' -t 'airport/device/EMERG-001/#' -v
    ;;
  29)
    echo "Triggering emergency on EMERG-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/emergency/EMERG-001/command' -m '{"command":"TRIGGER","details":"MANUAL_TEST"}'
    echo "Done."
    ;;
  30)
    echo "Subscribing to Fire/Smoke topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/fire-smoke/#' -t 'airport/device/FIRE-001/#' -v
    ;;
  31)
    echo "Sending TEST ALARM to FIRE-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/fire-smoke/FIRE-001/command' -m '{"command":"TEST_ALARM"}'
    echo "Done."
    ;;
  32)
    echo "Subscribing to Environment topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/environment/#' -t 'airport/device/ENV-001/#' -v
    ;;
  33)
    echo "Forcing fan ON on ENV-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/environment/ENV-001/command' -m '{"command":"FAN_ON"}'
    echo "Done."
    ;;
  34)
    echo "Subscribing to Elevator topics..."
    mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/elevator/#' -t 'airport/device/ELEV-001/#' -v
    ;;
  35)
    echo "Calling elevator up on ELEV-001..."
    mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t 'airport/elevator/ELEV-001/command' -m '{"command":"CALL_UP"}'
    echo "Done."
    ;;
  q|Q)
    echo "Exiting."
    exit 0
    ;;
  *)
    echo "Invalid option."
    exit 1
    ;;
esac
