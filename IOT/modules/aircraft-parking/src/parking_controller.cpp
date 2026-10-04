#include "parking_controller.h"

using namespace AirportIoT;

ParkingController::ParkingController()
    : state_(ParkingState::STAND_EMPTY),
      frontDistanceCm_(Parking::SENSOR_MAX_RANGE_CM),
      sideDistanceCm_(Parking::SENSOR_MAX_RANGE_CM),
      stateTimer_(0),
      lastTelemetry_(0),
      lastDebounceTime_(0),
      warnBlinkTimer_(0),
      warnLedState_(false),
      simulationActive_(false),
      lastArrivalBtnState_(HIGH),
      lastDepartBtnState_(HIGH),
      lastResetBtnState_(HIGH),
      onEventCallback_(nullptr),
      onTelemetryCallback_(nullptr) {}

void ParkingController::begin() {
    pinMode(ParkingHardware::PIN_LED_GREEN, OUTPUT);
    pinMode(ParkingHardware::PIN_LED_YELLOW, OUTPUT);
    pinMode(ParkingHardware::PIN_LED_RED, OUTPUT);
    pinMode(ParkingHardware::PIN_BUZZER, OUTPUT);

    pinMode(ParkingHardware::PIN_ARRIVAL_BTN, INPUT_PULLUP);
    pinMode(ParkingHardware::PIN_DEPART_BTN, INPUT_PULLUP);
    pinMode(ParkingHardware::PIN_RESET_BTN, INPUT_PULLUP);
    // ADC pins are input by default; no pinMode needed on ESP32 ADC1.

    digitalWrite(ParkingHardware::PIN_LED_GREEN, LOW);
    digitalWrite(ParkingHardware::PIN_LED_YELLOW, LOW);
    digitalWrite(ParkingHardware::PIN_LED_RED, LOW);
    digitalWrite(ParkingHardware::PIN_BUZZER, LOW);

    ESP32PWM::allocateTimer(0);
    indicatorServo_.setPeriodHertz(50);
    indicatorServo_.attach(ParkingHardware::PIN_SERVO, 500, 2400);
    indicatorServo_.write(0);

    readDistanceSensors();
    Serial.println(F("[PARK] Aircraft parking controller initialized in STAND_EMPTY"));
}

const char* ParkingController::getStateString() const {
    switch (state_) {
        case ParkingState::STAND_EMPTY:        return "STAND_EMPTY";
        case ParkingState::AIRCRAFT_DETECTED:  return "AIRCRAFT_DETECTED";
        case ParkingState::APPROACHING:        return "APPROACHING";
        case ParkingState::ALIGNMENT_REQUIRED: return "ALIGNMENT_REQUIRED";
        case ParkingState::PARKED:             return "PARKED";
        case ParkingState::DEPARTING:          return "DEPARTING";
        case ParkingState::UNSAFE_DISTANCE:    return "UNSAFE_DISTANCE";
        case ParkingState::WARNING:            return "WARNING";
        default:                               return "UNKNOWN";
    }
}

const char* ParkingController::getSafetyStatus() const {
    switch (state_) {
        case ParkingState::UNSAFE_DISTANCE:
        case ParkingState::WARNING:
            return "UNSAFE";
        case ParkingState::PARKED:
            return "SECURED";
        case ParkingState::STAND_EMPTY:
            return "CLEAR";
        default:
            return "CAUTION";
    }
}

const char* ParkingController::getAircraftStatus() const {
    switch (state_) {
        case ParkingState::STAND_EMPTY: return "ABSENT";
        case ParkingState::DEPARTING:   return "DEPARTING";
        case ParkingState::PARKED:      return "PARKED";
        default:                        return "PRESENT";
    }
}

void ParkingController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[PARK] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) {
        onEventCallback_(eventName, details);
    }
}

void ParkingController::setState(ParkingState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[PARK] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

void ParkingController::readDistanceSensors() {
    // Map 12-bit ADC (0..4095) to 0..SENSOR_MAX_RANGE_CM.
    int rawFront = analogRead(ParkingHardware::PIN_DIST_FRONT_ADC);
    int rawSide = analogRead(ParkingHardware::PIN_DIST_SIDE_ADC);
    frontDistanceCm_ = (static_cast<float>(rawFront) / 4095.0f) * Parking::SENSOR_MAX_RANGE_CM;
    sideDistanceCm_ = (static_cast<float>(rawSide) / 4095.0f) * Parking::SENSOR_MAX_RANGE_CM;
}

void ParkingController::commandStartSimulation() {
    Serial.println(F("[PARK] START_SIMULATION: scripted approach sweep started"));
    simulationActive_ = true;
    emitEvent("simulation_started", "SCRIPTED_APPROACH");
    setState(ParkingState::AIRCRAFT_DETECTED);
}

void ParkingController::commandAircraftArrival() {
    Serial.println(F("[PARK] AIRCRAFT_ARRIVAL command executed"));
    simulationActive_ = false;
    emitEvent("aircraft_detected", "ARRIVAL_SIGNAL");
    setState(ParkingState::AIRCRAFT_DETECTED);
}

void ParkingController::commandAircraftDeparture() {
    if (state_ == ParkingState::STAND_EMPTY) {
        Serial.println(F("[PARK] Departure ignored: stand already empty"));
        return;
    }
    Serial.println(F("[PARK] AIRCRAFT_DEPARTURE command executed"));
    simulationActive_ = false;
    emitEvent("aircraft_departing", "PUSHBACK");
    setState(ParkingState::DEPARTING);
}

void ParkingController::commandReset() {
    Serial.println(F("[PARK] RESET command executed"));
    simulationActive_ = false;
    frontDistanceCm_ = Parking::SENSOR_MAX_RANGE_CM;
    setState(ParkingState::STAND_EMPTY);
    emitEvent("stand_empty", "RESET");
}

void ParkingController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < Parking::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int arrivalBtn = digitalRead(ParkingHardware::PIN_ARRIVAL_BTN);
    int departBtn = digitalRead(ParkingHardware::PIN_DEPART_BTN);
    int resetBtn = digitalRead(ParkingHardware::PIN_RESET_BTN);

    if (arrivalBtn == LOW && lastArrivalBtnState_ == HIGH) {
        commandAircraftArrival();
    }
    lastArrivalBtnState_ = arrivalBtn;

    if (departBtn == LOW && lastDepartBtnState_ == HIGH) {
        commandAircraftDeparture();
    }
    lastDepartBtnState_ = departBtn;

    if (resetBtn == LOW && lastResetBtnState_ == HIGH) {
        commandReset();
    }
    lastResetBtnState_ = resetBtn;
}

void ParkingController::updateFeedbackOutputs() {
    // Steady-state outputs per state; WARNING blinking handled in update().
    switch (state_) {
        case ParkingState::STAND_EMPTY:
            digitalWrite(ParkingHardware::PIN_LED_GREEN, LOW);
            digitalWrite(ParkingHardware::PIN_LED_YELLOW, LOW);
            digitalWrite(ParkingHardware::PIN_LED_RED, LOW);
            digitalWrite(ParkingHardware::PIN_BUZZER, LOW);
            indicatorServo_.write(0);
            break;
        case ParkingState::AIRCRAFT_DETECTED:
        case ParkingState::APPROACHING:
        case ParkingState::ALIGNMENT_REQUIRED:
            digitalWrite(ParkingHardware::PIN_LED_GREEN, LOW);
            digitalWrite(ParkingHardware::PIN_LED_YELLOW, HIGH);
            digitalWrite(ParkingHardware::PIN_LED_RED, LOW);
            digitalWrite(ParkingHardware::PIN_BUZZER, LOW);
            indicatorServo_.write(45);
            break;
        case ParkingState::PARKED:
            digitalWrite(ParkingHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(ParkingHardware::PIN_LED_YELLOW, LOW);
            digitalWrite(ParkingHardware::PIN_LED_RED, LOW);
            digitalWrite(ParkingHardware::PIN_BUZZER, LOW);
            indicatorServo_.write(90);
            break;
        case ParkingState::DEPARTING:
            digitalWrite(ParkingHardware::PIN_LED_GREEN, LOW);
            digitalWrite(ParkingHardware::PIN_LED_YELLOW, HIGH);
            digitalWrite(ParkingHardware::PIN_LED_RED, LOW);
            digitalWrite(ParkingHardware::PIN_BUZZER, LOW);
            indicatorServo_.write(45);
            break;
        case ParkingState::UNSAFE_DISTANCE:
        case ParkingState::WARNING:
            digitalWrite(ParkingHardware::PIN_LED_GREEN, LOW);
            digitalWrite(ParkingHardware::PIN_LED_YELLOW, LOW);
            digitalWrite(ParkingHardware::PIN_LED_RED, HIGH);
            digitalWrite(ParkingHardware::PIN_BUZZER, HIGH);
            indicatorServo_.write(0);
            break;
    }
}

void ParkingController::handleStateLogic() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateTimer_;

    // Scripted simulation sweep: walk the distance down through the zones.
    if (simulationActive_) {
        static const float sweep[] = {280.0f, 120.0f, 60.0f, 30.0f};
        static const ParkingState sweepState[] = {
            ParkingState::AIRCRAFT_DETECTED,
            ParkingState::APPROACHING,
            ParkingState::ALIGNMENT_REQUIRED,
            ParkingState::PARKED
        };
        size_t step = (elapsed / 2500) % 5;
        if (step < 4) {
            frontDistanceCm_ = sweep[step];
            if (state_ != sweepState[step]) {
                setState(sweepState[step]);
            }
        } else {
            simulationActive_ = false;
            emitEvent("aircraft_parked", "SIMULATION_COMPLETE");
        }
        return;
    }

    float d = frontDistanceCm_;

    switch (state_) {
        case ParkingState::STAND_EMPTY:
            if (d <= Parking::DETECTION_THRESHOLD_CM) {
                emitEvent("aircraft_detected", "PROXIMITY");
                setState(ParkingState::AIRCRAFT_DETECTED);
            }
            break;

        case ParkingState::AIRCRAFT_DETECTED:
            if (d > Parking::DETECTION_THRESHOLD_CM) {
                emitEvent("stand_empty", "TARGET_LOST");
                setState(ParkingState::STAND_EMPTY);
            } else if (d <= Parking::APPROACH_THRESHOLD_CM) {
                emitEvent("aircraft_approaching", "CLOSING");
                setState(ParkingState::APPROACHING);
            }
            break;

        case ParkingState::APPROACHING:
            if (d > Parking::DETECTION_THRESHOLD_CM) {
                emitEvent("stand_empty", "TARGET_LOST");
                setState(ParkingState::STAND_EMPTY);
            } else if (d <= Parking::UNSAFE_THRESHOLD_CM) {
                emitEvent("unsafe_distance", "TOO_CLOSE");
                setState(ParkingState::UNSAFE_DISTANCE);
            } else if (d <= Parking::ALIGNMENT_THRESHOLD_CM) {
                emitEvent("alignment_required", "LATERAL_ADJUST");
                setState(ParkingState::ALIGNMENT_REQUIRED);
            }
            break;

        case ParkingState::ALIGNMENT_REQUIRED:
            if (d <= Parking::UNSAFE_THRESHOLD_CM) {
                emitEvent("unsafe_distance", "TOO_CLOSE");
                setState(ParkingState::UNSAFE_DISTANCE);
            } else if (d <= Parking::PARKED_THRESHOLD_CM && elapsed >= Parking::STATE_SETTLE_MS) {
                emitEvent("aircraft_parked", "ON_BLOCKS");
                setState(ParkingState::PARKED);
            } else if (d > Parking::APPROACH_THRESHOLD_CM) {
                emitEvent("aircraft_approaching", "REALIGN");
                setState(ParkingState::APPROACHING);
            }
            break;

        case ParkingState::PARKED:
            if (d <= Parking::UNSAFE_THRESHOLD_CM) {
                emitEvent("unsafe_distance", "OVERSHOOT");
                setState(ParkingState::UNSAFE_DISTANCE);
            } else if (d > Parking::ALIGNMENT_THRESHOLD_CM) {
                emitEvent("aircraft_departing", "POSITION_LEFT");
                setState(ParkingState::DEPARTING);
            }
            break;

        case ParkingState::DEPARTING:
            if (elapsed >= 3000) {
                emitEvent("stand_empty", "DEPARTED");
                setState(ParkingState::STAND_EMPTY);
            }
            break;

        case ParkingState::UNSAFE_DISTANCE:
            if (d > Parking::UNSAFE_THRESHOLD_CM) {
                digitalWrite(ParkingHardware::PIN_BUZZER, LOW);
                emitEvent("alignment_required", "RECOVERED");
                setState(ParkingState::ALIGNMENT_REQUIRED);
            } else if (elapsed >= Parking::UNSAFE_ALARM_MS) {
                emitEvent("warning", "STOP_INSTRUCTION");
                setState(ParkingState::WARNING);
            }
            break;

        case ParkingState::WARNING:
            // Blink red LED + buzzer while latched in WARNING.
            if (now - warnBlinkTimer_ >= 250) {
                warnBlinkTimer_ = now;
                warnLedState_ = !warnLedState_;
                digitalWrite(ParkingHardware::PIN_LED_RED, warnLedState_ ? HIGH : LOW);
                digitalWrite(ParkingHardware::PIN_BUZZER, warnLedState_ ? HIGH : LOW);
            }
            if (d > Parking::UNSAFE_THRESHOLD_CM) {
                digitalWrite(ParkingHardware::PIN_BUZZER, LOW);
                digitalWrite(ParkingHardware::PIN_LED_RED, LOW);
                emitEvent("alignment_required", "RECOVERED");
                setState(ParkingState::ALIGNMENT_REQUIRED);
            }
            break;
    }
}

void ParkingController::update() {
    readDistanceSensors();
    handleButtonInputs();
    handleStateLogic();

    unsigned long now = millis();
    if (now - lastTelemetry_ >= 2000) {
        lastTelemetry_ = now;
        if (onTelemetryCallback_) {
            onTelemetryCallback_();
        }
    }
}
