#include "security_controller.h"

using namespace AirportIoT;

SecurityController::SecurityController()
    : state_(SecurityState::IDLE),
      isLocked_(false),
      personPresent_(false),
      stateTimer_(0),
      alarmBlinkTimer_(0),
      alarmLedState_(false),
      lastPersonBtnState_(HIGH),
      lastValidCardBtnState_(HIGH),
      lastInvalidCardBtnState_(HIGH),
      lastEstopBtnState_(HIGH),
      lastResetBtnState_(HIGH),
      lastDebounceTime_(0),
      onEventCallback_(nullptr),
      onAccessCallback_(nullptr) {}

void SecurityController::begin() {
    pinMode(SecurityHardware::PIN_LED_GREEN, OUTPUT);
    pinMode(SecurityHardware::PIN_LED_RED, OUTPUT);
    pinMode(SecurityHardware::PIN_BUZZER, OUTPUT);

    pinMode(SecurityHardware::PIN_PERSON_SENSOR, INPUT_PULLUP);
    pinMode(SecurityHardware::PIN_VALID_CARD, INPUT_PULLUP);
    pinMode(SecurityHardware::PIN_INVALID_CARD, INPUT_PULLUP);
    pinMode(SecurityHardware::PIN_ESTOP_BTN, INPUT_PULLUP);
    pinMode(SecurityHardware::PIN_RESET_BTN, INPUT_PULLUP);

    digitalWrite(SecurityHardware::PIN_LED_GREEN, LOW);
    digitalWrite(SecurityHardware::PIN_LED_RED, LOW);
    digitalWrite(SecurityHardware::PIN_BUZZER, LOW);

    ESP32PWM::allocateTimer(0);
    gateServo_.setPeriodHertz(50);
    gateServo_.attach(SecurityHardware::PIN_SERVO, 500, 2400);
    gateServo_.write(0); // gate closed

    Serial.println(F("[SEC] Security area controller initialized in IDLE"));
}

const char* SecurityController::getStateString() const {
    switch (state_) {
        case SecurityState::IDLE:              return "IDLE";
        case SecurityState::PERSON_DETECTED:   return "PERSON_DETECTED";
        case SecurityState::WAITING_FOR_AUTH:  return "WAITING_FOR_AUTH";
        case SecurityState::AUTHORIZED:         return "AUTHORIZED";
        case SecurityState::GATE_OPENING:       return "GATE_OPENING";
        case SecurityState::ACCESS_GRANTED:    return "ACCESS_GRANTED";
        case SecurityState::GATE_CLOSING:      return "GATE_CLOSING";
        case SecurityState::ACCESS_DENIED:     return "ACCESS_DENIED";
        case SecurityState::ALARM:             return "ALARM";
        case SecurityState::EMERGENCY:         return "EMERGENCY";
        case SecurityState::LOCKED:            return "LOCKED";
        default:                               return "UNKNOWN";
    }
}

bool SecurityController::isGateOpen() const {
    return state_ == SecurityState::ACCESS_GRANTED ||
           state_ == SecurityState::GATE_OPENING;
}

void SecurityController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[SEC] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) {
        onEventCallback_(eventName, details);
    }
}

void SecurityController::emitAccess(const char* cardUid, bool authorized, const char* reason) {
    if (onAccessCallback_) {
        onAccessCallback_(cardUid, authorized, reason);
    }
}

void SecurityController::setState(SecurityState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[SEC] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

void SecurityController::simulateCardPresent(const char* cardUid, bool isAuthorized) {
    if (state_ == SecurityState::EMERGENCY || state_ == SecurityState::LOCKED || isLocked_) {
        Serial.println(F("[SEC] Card rejected: gate locked or emergency active"));
        emitAccess(cardUid, false, "GATE_LOCKED");
        return;
    }
    if (state_ != SecurityState::WAITING_FOR_AUTH &&
        state_ != SecurityState::PERSON_DETECTED &&
        state_ != SecurityState::IDLE) {
        Serial.println(F("[SEC] Card ignored: no authorization pending"));
        return;
    }
    commandAuthorize(cardUid, isAuthorized);
}

void SecurityController::commandAuthorize(const char* cardUid, bool authorized) {
    if (state_ == SecurityState::EMERGENCY || isLocked_) {
        emitAccess(cardUid, false, "GATE_LOCKED");
        return;
    }
    if (authorized) {
        Serial.printf("[SEC] Access GRANTED for card: %s\n", cardUid);
        emitAccess(cardUid, true, "AUTHORIZED");
        emitEvent("access_granted", cardUid);
        setState(SecurityState::AUTHORIZED);
    } else {
        Serial.printf("[SEC] Access DENIED for card: %s\n", cardUid);
        emitAccess(cardUid, false, "UNAUTHORIZED_CARD");
        emitEvent("access_denied", cardUid);
        setState(SecurityState::ACCESS_DENIED);
    }
}

bool SecurityController::commandOpen() {
    if (isLocked_ || state_ == SecurityState::EMERGENCY) {
        Serial.println(F("[SEC] Remote OPEN rejected: locked or emergency"));
        return false;
    }
    Serial.println(F("[SEC] Remote OPEN command executed"));
    emitEvent("remote_open_command", "MANUAL_OVERRIDE");
    setState(SecurityState::AUTHORIZED);
    return true;
}

bool SecurityController::commandClose() {
    Serial.println(F("[SEC] Remote CLOSE command executed"));
    if (isGateOpen()) {
        setState(SecurityState::GATE_CLOSING);
    } else if (state_ != SecurityState::EMERGENCY) {
        setState(SecurityState::IDLE);
    }
    return true;
}

bool SecurityController::commandLock() {
    Serial.println(F("[SEC] Gate LOCKED by command"));
    isLocked_ = true;
    gateServo_.write(0);
    emitEvent("gate_locked", "SECURITY_LOCK");
    setState(SecurityState::LOCKED);
    return true;
}

bool SecurityController::commandUnlock() {
    Serial.println(F("[SEC] Gate UNLOCKED by command"));
    isLocked_ = false;
    emitEvent("gate_unlocked", "NORMAL_OPERATION");
    setState(SecurityState::IDLE);
    return true;
}

bool SecurityController::commandReset() {
    Serial.println(F("[SEC] RESET command executed"));
    isLocked_ = false;
    personPresent_ = false;
    gateServo_.write(0);
    digitalWrite(SecurityHardware::PIN_BUZZER, LOW);
    emitEvent("system_reset", "SYSTEM_NORMAL");
    setState(SecurityState::IDLE);
    return true;
}

void SecurityController::commandEmergencyStop() {
    // Emergency has priority over ALL normal operations.
    gateServo_.write(0); // gate forced locked/closed
    isLocked_ = true;
    emitEvent("emergency_triggered", "ESTOP_BUTTON");
    setState(SecurityState::EMERGENCY);
}

void SecurityController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < Security::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int estopBtn = digitalRead(SecurityHardware::PIN_ESTOP_BTN);
    int resetBtn = digitalRead(SecurityHardware::PIN_RESET_BTN);

    // Emergency button has absolute priority and is always honored.
    if (estopBtn == LOW && lastEstopBtnState_ == HIGH) {
        commandEmergencyStop();
    }
    lastEstopBtnState_ = estopBtn;

    if (resetBtn == LOW && lastResetBtnState_ == HIGH) {
        commandReset();
    }
    lastResetBtnState_ = resetBtn;

    // Normal inputs are ignored while emergency/latched-alarm is active.
    if (state_ == SecurityState::EMERGENCY) {
        lastPersonBtnState_ = digitalRead(SecurityHardware::PIN_PERSON_SENSOR);
        lastValidCardBtnState_ = digitalRead(SecurityHardware::PIN_VALID_CARD);
        lastInvalidCardBtnState_ = digitalRead(SecurityHardware::PIN_INVALID_CARD);
        return;
    }

    int personBtn = digitalRead(SecurityHardware::PIN_PERSON_SENSOR);
    int validBtn = digitalRead(SecurityHardware::PIN_VALID_CARD);
    int invalidBtn = digitalRead(SecurityHardware::PIN_INVALID_CARD);

    if (personBtn == LOW && lastPersonBtnState_ == HIGH) {
        if (state_ == SecurityState::IDLE && !isLocked_) {
            personPresent_ = true;
            emitEvent("person_detected", "PRESENCE_SENSOR");
            setState(SecurityState::PERSON_DETECTED);
        }
    }
    lastPersonBtnState_ = personBtn;

    if (validBtn == LOW && lastValidCardBtnState_ == HIGH) {
        simulateCardPresent("SEC-CARD-VALID-01", true);
    }
    lastValidCardBtnState_ = validBtn;

    if (invalidBtn == LOW && lastInvalidCardBtnState_ == HIGH) {
        simulateCardPresent("SEC-CARD-DENIED-99", false);
    }
    lastInvalidCardBtnState_ = invalidBtn;
}

void SecurityController::updateFeedbackOutputs() {
    switch (state_) {
        case SecurityState::IDLE:
            digitalWrite(SecurityHardware::PIN_LED_GREEN, LOW);
            digitalWrite(SecurityHardware::PIN_LED_RED, LOW);
            digitalWrite(SecurityHardware::PIN_BUZZER, LOW);
            gateServo_.write(0);
            break;
        case SecurityState::PERSON_DETECTED:
        case SecurityState::WAITING_FOR_AUTH:
            digitalWrite(SecurityHardware::PIN_LED_GREEN, LOW);
            digitalWrite(SecurityHardware::PIN_LED_RED, LOW);
            digitalWrite(SecurityHardware::PIN_BUZZER, LOW);
            break;
        case SecurityState::AUTHORIZED:
            digitalWrite(SecurityHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(SecurityHardware::PIN_LED_RED, LOW);
            digitalWrite(SecurityHardware::PIN_BUZZER, HIGH); // short beep
            break;
        case SecurityState::GATE_OPENING:
        case SecurityState::ACCESS_GRANTED:
            digitalWrite(SecurityHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(SecurityHardware::PIN_LED_RED, LOW);
            digitalWrite(SecurityHardware::PIN_BUZZER, LOW);
            gateServo_.write(90);
            break;
        case SecurityState::GATE_CLOSING:
            digitalWrite(SecurityHardware::PIN_LED_GREEN, LOW);
            digitalWrite(SecurityHardware::PIN_LED_RED, LOW);
            digitalWrite(SecurityHardware::PIN_BUZZER, LOW);
            gateServo_.write(0);
            break;
        case SecurityState::ACCESS_DENIED:
        case SecurityState::ALARM:
            digitalWrite(SecurityHardware::PIN_LED_GREEN, LOW);
            digitalWrite(SecurityHardware::PIN_LED_RED, HIGH);
            digitalWrite(SecurityHardware::PIN_BUZZER, HIGH);
            break;
        case SecurityState::EMERGENCY:
            digitalWrite(SecurityHardware::PIN_LED_GREEN, LOW);
            digitalWrite(SecurityHardware::PIN_LED_RED, HIGH);
            digitalWrite(SecurityHardware::PIN_BUZZER, HIGH);
            gateServo_.write(0);
            break;
        case SecurityState::LOCKED:
            digitalWrite(SecurityHardware::PIN_LED_GREEN, LOW);
            digitalWrite(SecurityHardware::PIN_LED_RED, HIGH);
            digitalWrite(SecurityHardware::PIN_BUZZER, LOW);
            gateServo_.write(0);
            break;
    }
}

void SecurityController::handleStateLogic() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateTimer_;

    switch (state_) {
        case SecurityState::IDLE:
            break;

        case SecurityState::PERSON_DETECTED:
            emitEvent("authorization_requested", "WAITING_CARD");
            setState(SecurityState::WAITING_FOR_AUTH);
            break;

        case SecurityState::WAITING_FOR_AUTH:
            if (elapsed >= Security::AUTH_TIMEOUT_MS) {
                Serial.println(F("[SEC] Authorization timed out, returning to IDLE"));
                emitEvent("auth_timeout", "NO_CARD_PRESENTED");
                personPresent_ = false;
                setState(SecurityState::IDLE);
            }
            break;

        case SecurityState::AUTHORIZED:
            if (elapsed >= 300) {
                digitalWrite(SecurityHardware::PIN_BUZZER, LOW);
                setState(SecurityState::GATE_OPENING);
            }
            break;

        case SecurityState::GATE_OPENING:
            if (elapsed >= Security::GATE_MOTION_DURATION_MS) {
                emitEvent("gate_opened", "PASSAGE_CLEAR");
                setState(SecurityState::ACCESS_GRANTED);
            }
            break;

        case SecurityState::ACCESS_GRANTED:
            if (elapsed >= Security::GATE_OPEN_DWELL_MS) {
                setState(SecurityState::GATE_CLOSING);
            }
            break;

        case SecurityState::GATE_CLOSING:
            if (elapsed >= Security::GATE_MOTION_DURATION_MS) {
                emitEvent("gate_closed", "NORMAL");
                personPresent_ = false;
                setState(SecurityState::IDLE);
            }
            break;

        case SecurityState::ACCESS_DENIED:
            emitEvent("alarm_triggered", "UNAUTHORIZED_ATTEMPT");
            setState(SecurityState::ALARM);
            break;

        case SecurityState::ALARM:
            // Blink red LED during alarm dwell.
            if (now - alarmBlinkTimer_ >= 250) {
                alarmBlinkTimer_ = now;
                alarmLedState_ = !alarmLedState_;
                digitalWrite(SecurityHardware::PIN_LED_RED, alarmLedState_ ? HIGH : LOW);
                digitalWrite(SecurityHardware::PIN_BUZZER, alarmLedState_ ? HIGH : LOW);
            }
            if (elapsed >= Security::ALARM_DURATION_MS) {
                digitalWrite(SecurityHardware::PIN_BUZZER, LOW);
                digitalWrite(SecurityHardware::PIN_LED_RED, LOW);
                personPresent_ = false;
                setState(SecurityState::IDLE);
            }
            break;

        case SecurityState::EMERGENCY:
            // Latched: gate forced locked, alarm on until RESET.
            // Keep alarm outputs asserted (re-assert in case of drift).
            digitalWrite(SecurityHardware::PIN_LED_RED, HIGH);
            digitalWrite(SecurityHardware::PIN_BUZZER, HIGH);
            break;

        case SecurityState::LOCKED:
            // Remain locked until UNLOCK or RESET.
            break;
    }
}

void SecurityController::update() {
    handleButtonInputs();
    handleStateLogic();
}
