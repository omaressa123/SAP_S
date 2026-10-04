#include "gate_controller.h"

GateController::GateController()
    : state_(GateState::CLOSED),
      isLocked_(false),
      stateTimer_(0),
      alarmBlinkTimer_(0),
      alarmLedState_(false),
      lastPassengerBtnState_(HIGH),
      lastValidCardBtnState_(HIGH),
      lastInvalidCardBtnState_(HIGH),
      lastResetBtnState_(HIGH),
      lastDebounceTime_(0),
      onEventCallback_(nullptr),
      onAccessCallback_(nullptr) {}

void GateController::begin() {
    // Configure Pins
    pinMode(GateHardware::PIN_LED_GREEN, OUTPUT);
    pinMode(GateHardware::PIN_LED_RED, OUTPUT);
    pinMode(GateHardware::PIN_BUZZER, OUTPUT);

    pinMode(GateHardware::PIN_PASSENGER_SENSOR, INPUT_PULLUP);
    pinMode(GateHardware::PIN_RFID_VALID_BTN, INPUT_PULLUP);
    pinMode(GateHardware::PIN_RFID_INVALID_BTN, INPUT_PULLUP);
    pinMode(GateHardware::PIN_MANUAL_RESET_BTN, INPUT_PULLUP);

    // Initial Outputs
    digitalWrite(GateHardware::PIN_LED_GREEN, LOW);
    digitalWrite(GateHardware::PIN_LED_RED, HIGH); // Red ON when gate is closed
    digitalWrite(GateHardware::PIN_BUZZER, LOW);

    // Attach Servo
    ESP32PWM::allocateTimer(0);
    gateServo_.setPeriodHertz(50);
    gateServo_.attach(GateHardware::PIN_SERVO, 500, 2400);
    setServoAngle(AirportIoT::Gate::SERVO_CLOSED_POS);

    Serial.println(F("[GATE] Gate controller initialized in CLOSED state"));
}

void GateController::setServoAngle(int angle) {
    gateServo_.write(angle);
}

const char* GateController::getStateString() const {
    switch (state_) {
        case GateState::CLOSED:             return "CLOSED";
        case GateState::PASSENGER_DETECTED: return "PASSENGER_DETECTED";
        case GateState::WAITING_FOR_AUTH:   return "WAITING_FOR_AUTH";
        case GateState::AUTHORIZED:         return "AUTHORIZED";
        case GateState::DENIED:             return "DENIED";
        case GateState::OPENING:            return "OPENING";
        case GateState::OPEN:               return "OPEN";
        case GateState::CLOSING:            return "CLOSING";
        case GateState::ALARM:              return "ALARM";
        case GateState::LOCKED:             return "LOCKED";
        default:                            return "UNKNOWN";
    }
}

void GateController::setState(GateState newState) {
    if (state_ == newState) return;

    state_ = newState;
    stateTimer_ = millis();

    Serial.printf("[GATE] Transitioned to state: %s\n", getStateString());

    updateFeedbackOutputs();
}

void GateController::updateFeedbackOutputs() {
    switch (state_) {
        case GateState::CLOSED:
            digitalWrite(GateHardware::PIN_LED_GREEN, LOW);
            digitalWrite(GateHardware::PIN_LED_RED, HIGH);
            digitalWrite(GateHardware::PIN_BUZZER, LOW);
            setServoAngle(AirportIoT::Gate::SERVO_CLOSED_POS);
            break;

        case GateState::PASSENGER_DETECTED:
        case GateState::WAITING_FOR_AUTH:
            digitalWrite(GateHardware::PIN_LED_GREEN, LOW);
            digitalWrite(GateHardware::PIN_LED_RED, HIGH);
            digitalWrite(GateHardware::PIN_BUZZER, LOW);
            break;

        case GateState::AUTHORIZED:
            digitalWrite(GateHardware::PIN_LED_RED, LOW);
            digitalWrite(GateHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(GateHardware::PIN_BUZZER, HIGH); // Short beep
            break;

        case GateState::OPENING:
            digitalWrite(GateHardware::PIN_BUZZER, LOW);
            digitalWrite(GateHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(GateHardware::PIN_LED_RED, LOW);
            setServoAngle(AirportIoT::Gate::SERVO_OPEN_POS);
            break;

        case GateState::OPEN:
            digitalWrite(GateHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(GateHardware::PIN_LED_RED, LOW);
            digitalWrite(GateHardware::PIN_BUZZER, LOW);
            setServoAngle(AirportIoT::Gate::SERVO_OPEN_POS);
            break;

        case GateState::CLOSING:
            digitalWrite(GateHardware::PIN_LED_GREEN, LOW);
            digitalWrite(GateHardware::PIN_LED_RED, HIGH);
            digitalWrite(GateHardware::PIN_BUZZER, LOW);
            setServoAngle(AirportIoT::Gate::SERVO_CLOSED_POS);
            break;

        case GateState::DENIED:
        case GateState::ALARM:
            digitalWrite(GateHardware::PIN_LED_GREEN, LOW);
            digitalWrite(GateHardware::PIN_LED_RED, HIGH);
            digitalWrite(GateHardware::PIN_BUZZER, HIGH);
            break;

        case GateState::LOCKED:
            digitalWrite(GateHardware::PIN_LED_GREEN, LOW);
            digitalWrite(GateHardware::PIN_LED_RED, HIGH);
            digitalWrite(GateHardware::PIN_BUZZER, LOW);
            setServoAngle(AirportIoT::Gate::SERVO_CLOSED_POS);
            break;
    }
}

void GateController::simulateCardScan(const char* cardUid, bool isAuthorized) {
    if (isLocked_) {
        Serial.println(F("[GATE] Scan rejected: Gate is LOCKED"));
        if (onAccessCallback_) {
            onAccessCallback_(cardUid, false, "GATE_LOCKED");
        }
        return;
    }

    if (onEventCallback_) {
        onEventCallback_("rfid_detected", cardUid);
    }

    if (isAuthorized) {
        Serial.printf("[GATE] Access GRANTED for Card UID: %s\n", cardUid);
        if (onAccessCallback_) {
            onAccessCallback_(cardUid, true, "VALID_BOARDING_PASS");
        }
        if (onEventCallback_) {
            onEventCallback_("access_granted", cardUid);
        }
        setState(GateState::AUTHORIZED);
    } else {
        Serial.printf("[GATE] Access DENIED for Card UID: %s\n", cardUid);
        if (onAccessCallback_) {
            onAccessCallback_(cardUid, false, "UNAUTHORIZED_CARD");
        }
        if (onEventCallback_) {
            onEventCallback_("access_denied", cardUid);
        }
        setState(GateState::DENIED);
    }
}

bool GateController::commandOpen() {
    if (isLocked_) {
        Serial.println(F("[GATE] Remote OPEN rejected: Gate is LOCKED"));
        return false;
    }
    Serial.println(F("[GATE] Remote OPEN command executed"));
    if (onEventCallback_) {
        onEventCallback_("remote_open_command", "MANUAL_OVERRIDE");
    }
    setState(GateState::AUTHORIZED);
    return true;
}

bool GateController::commandClose() {
    Serial.println(F("[GATE] Remote CLOSE command executed"));
    if (state_ == GateState::OPEN || state_ == GateState::OPENING) {
        setState(GateState::CLOSING);
    } else {
        setState(GateState::CLOSED);
    }
    return true;
}

bool GateController::commandReset() {
    Serial.println(F("[GATE] Gate RESET command executed"));
    isLocked_ = false;
    setState(GateState::CLOSED);
    if (onEventCallback_) {
        onEventCallback_("gate_reset", "SYSTEM_NORMAL");
    }
    return true;
}

bool GateController::commandLock() {
    Serial.println(F("[GATE] Gate LOCKED by command"));
    isLocked_ = true;
    setState(GateState::LOCKED);
    if (onEventCallback_) {
        onEventCallback_("gate_locked", "SECURITY_LOCK");
    }
    return true;
}

bool GateController::commandUnlock() {
    Serial.println(F("[GATE] Gate UNLOCKED by command"));
    isLocked_ = false;
    setState(GateState::CLOSED);
    if (onEventCallback_) {
        onEventCallback_("gate_unlocked", "NORMAL_OPERATION");
    }
    return true;
}

void GateController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < AirportIoT::Gate::BUTTON_DEBOUNCE_MS) {
        return;
    }
    lastDebounceTime_ = now;

    int passBtn = digitalRead(GateHardware::PIN_PASSENGER_SENSOR);
    int validCardBtn = digitalRead(GateHardware::PIN_RFID_VALID_BTN);
    int invalidCardBtn = digitalRead(GateHardware::PIN_RFID_INVALID_BTN);
    int resetBtn = digitalRead(GateHardware::PIN_MANUAL_RESET_BTN);

    // Passenger presence sensor (active LOW)
    if (passBtn == LOW && lastPassengerBtnState_ == HIGH) {
        if (state_ == GateState::CLOSED && !isLocked_) {
            Serial.println(F("[GATE] Proximity sensor triggered: Passenger present"));
            if (onEventCallback_) {
                onEventCallback_("passenger_detected", "IR_PROXIMITY");
            }
            setState(GateState::PASSENGER_DETECTED);
        }
    }
    lastPassengerBtnState_ = passBtn;

    // Valid RFID button (active LOW)
    if (validCardBtn == LOW && lastValidCardBtnState_ == HIGH) {
        if (state_ == GateState::WAITING_FOR_AUTH || state_ == GateState::CLOSED) {
            simulateCardScan("PASS-7788-OK", true);
        }
    }
    lastValidCardBtnState_ = validCardBtn;

    // Invalid RFID button (active LOW)
    if (invalidCardBtn == LOW && lastInvalidCardBtnState_ == HIGH) {
        if (state_ == GateState::WAITING_FOR_AUTH || state_ == GateState::CLOSED) {
            simulateCardScan("PASS-0000-DENIED", false);
        }
    }
    lastInvalidCardBtnState_ = invalidCardBtn;

    // Manual Reset button (active LOW)
    if (resetBtn == LOW && lastResetBtnState_ == HIGH) {
        commandReset();
    }
    lastResetBtnState_ = resetBtn;
}

void GateController::handleStateLogic() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateTimer_;

    switch (state_) {
        case GateState::CLOSED:
            // Waiting for passenger or command
            break;

        case GateState::PASSENGER_DETECTED:
            if (onEventCallback_) {
                onEventCallback_("authorization_requested", "WAITING_RFID");
            }
            setState(GateState::WAITING_FOR_AUTH);
            break;

        case GateState::WAITING_FOR_AUTH:
            if (elapsed >= AirportIoT::Gate::PASSENGER_AUTH_TIMEOUT_MS) {
                Serial.println(F("[GATE] Auth timed out. Returning to CLOSED"));
                if (onEventCallback_) {
                    onEventCallback_("auth_timeout", "NO_CARD_PRESENTED");
                }
                setState(GateState::CLOSED);
            }
            break;

        case GateState::AUTHORIZED:
            // Short delay after buzzer beep before opening
            if (elapsed >= 300) {
                digitalWrite(GateHardware::PIN_BUZZER, LOW);
                setState(GateState::OPENING);
            }
            break;

        case GateState::OPENING:
            if (elapsed >= AirportIoT::Gate::GATE_MOTION_DURATION_MS) {
                if (onEventCallback_) {
                    onEventCallback_("gate_opened", "PASSAGE_CLEAR");
                }
                setState(GateState::OPEN);
            }
            break;

        case GateState::OPEN:
            if (elapsed >= AirportIoT::Gate::GATE_OPEN_DURATION_MS) {
                setState(GateState::CLOSING);
            }
            break;

        case GateState::CLOSING:
            if (elapsed >= AirportIoT::Gate::GATE_MOTION_DURATION_MS) {
                if (onEventCallback_) {
                    onEventCallback_("gate_closed", "NORMAL");
                }
                setState(GateState::CLOSED);
            }
            break;

        case GateState::DENIED:
            if (onEventCallback_) {
                onEventCallback_("alarm_triggered", "UNAUTHORIZED_ATTEMPT");
            }
            setState(GateState::ALARM);
            break;

        case GateState::ALARM:
            // Blink red LED and toggle buzzer during alarm
            if (now - alarmBlinkTimer_ >= 250) {
                alarmBlinkTimer_ = now;
                alarmLedState_ = !alarmLedState_;
                digitalWrite(GateHardware::PIN_LED_RED, alarmLedState_ ? HIGH : LOW);
                digitalWrite(GateHardware::PIN_BUZZER, alarmLedState_ ? HIGH : LOW);
            }

            if (elapsed >= AirportIoT::Gate::ALARM_DURATION_MS) {
                digitalWrite(GateHardware::PIN_BUZZER, LOW);
                digitalWrite(GateHardware::PIN_LED_RED, HIGH);
                setState(GateState::CLOSED);
            }
            break;

        case GateState::LOCKED:
            // Remain locked until command or reset
            break;
    }
}

void GateController::update() {
    handleButtonInputs();
    handleStateLogic();
}
