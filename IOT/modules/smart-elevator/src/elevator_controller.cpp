#include "elevator_controller.h"

using namespace AirportIoT;

ElevatorController::ElevatorController()
    : state_(ElevatorState::IDLE),
      floor_(0),
      overload_(false),
      stateTimer_(0),
      blinkTimer_(0),
      blinkState_(false),
      lastUpState_(HIGH),
      lastDownState_(HIGH),
      lastOverloadState_(HIGH),
      lastEstopState_(HIGH),
      lastResetState_(HIGH),
      lastDebounceTime_(0),
      onEventCallback_(nullptr) {}

void ElevatorController::begin() {
    pinMode(ElevatorHardware::PIN_LED_GREEN, OUTPUT);
    pinMode(ElevatorHardware::PIN_LED_RED, OUTPUT);
    pinMode(ElevatorHardware::PIN_BUZZER, OUTPUT);
    pinMode(ElevatorHardware::PIN_CALL_UP_BTN, INPUT_PULLUP);
    pinMode(ElevatorHardware::PIN_CALL_DOWN_BTN, INPUT_PULLUP);
    pinMode(ElevatorHardware::PIN_OVERLOAD_BTN, INPUT_PULLUP);
    pinMode(ElevatorHardware::PIN_ESTOP_BTN, INPUT_PULLUP);
    pinMode(ElevatorHardware::PIN_RESET_BTN, INPUT_PULLUP);
    digitalWrite(ElevatorHardware::PIN_LED_GREEN, LOW);
    digitalWrite(ElevatorHardware::PIN_LED_RED, LOW);
    digitalWrite(ElevatorHardware::PIN_BUZZER, LOW);
    ESP32PWM::allocateTimer(0);
    doorServo_.setPeriodHertz(50);
    doorServo_.attach(ElevatorHardware::PIN_DOOR_SERVO, 500, 2400);
    doorServo_.write(0); // door closed
    Serial.println(F("[ELEV] Elevator controller initialized: IDLE floor 0"));
}

const char* ElevatorController::getStateString() const {
    switch (state_) {
        case ElevatorState::IDLE:       return "IDLE";
        case ElevatorState::MOVING_UP:   return "MOVING_UP";
        case ElevatorState::MOVING_DOWN: return "MOVING_DOWN";
        case ElevatorState::DOOR_OPEN:   return "DOOR_OPEN";
        case ElevatorState::OVERLOAD:    return "OVERLOAD";
        case ElevatorState::EMERGENCY:   return "EMERGENCY";
        case ElevatorState::LOCKED:      return "LOCKED";
        default:                        return "UNKNOWN";
    }
}

bool ElevatorController::isDoorOpen() const {
    return state_ == ElevatorState::DOOR_OPEN;
}

void ElevatorController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[ELEV] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) onEventCallback_(eventName, details);
}

void ElevatorController::setState(ElevatorState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[ELEV] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

bool ElevatorController::commandCallUp() {
    if (state_ == ElevatorState::EMERGENCY || overload_) return false;
    if (state_ != ElevatorState::IDLE && state_ != ElevatorState::DOOR_OPEN) return false;
    emitEvent("call_up", "CABIN_DISPATCHED_UP");
    setState(ElevatorState::MOVING_UP);
    return true;
}

bool ElevatorController::commandCallDown() {
    if (state_ == ElevatorState::EMERGENCY || overload_) return false;
    if (state_ != ElevatorState::IDLE && state_ != ElevatorState::DOOR_OPEN) return false;
    emitEvent("call_down", "CABIN_DISPATCHED_DOWN");
    setState(ElevatorState::MOVING_DOWN);
    return true;
}

bool ElevatorController::commandOpenDoor() {
    if (state_ == ElevatorState::EMERGENCY || overload_) return false;
    if (state_ != ElevatorState::IDLE) return false;
    emitEvent("door_opened", "DOOR_SERVO_90");
    setState(ElevatorState::DOOR_OPEN);
    return true;
}

bool ElevatorController::commandCloseDoor() {
    if (state_ != ElevatorState::DOOR_OPEN) return false;
    emitEvent("door_closed", "DOOR_SERVO_0");
    setState(ElevatorState::IDLE);
    return true;
}

void ElevatorController::commandOverload(bool active) {
    overload_ = active;
    if (active) {
        emitEvent("overload_detected", "CABIN_HELD_DOOR_OPEN");
        setState(ElevatorState::OVERLOAD);
    } else {
        emitEvent("overload_cleared", "LOAD_NORMAL");
        setState(ElevatorState::DOOR_OPEN);
    }
}

void ElevatorController::commandEmergencyStop() {
    doorServo_.write(0);
    emitEvent("emergency_triggered", "ESTOP_LATCHED");
    setState(ElevatorState::EMERGENCY);
}

bool ElevatorController::commandReset() {
    overload_ = false;
    doorServo_.write(0);
    digitalWrite(ElevatorHardware::PIN_BUZZER, LOW);
    emitEvent("system_reset", "SYSTEM_NORMAL");
    setState(ElevatorState::IDLE);
    return true;
}

void ElevatorController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < Elevator::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int estop = digitalRead(ElevatorHardware::PIN_ESTOP_BTN);
    if (estop == LOW && lastEstopState_ == HIGH) commandEmergencyStop();
    lastEstopState_ = estop;

    int resetBtn = digitalRead(ElevatorHardware::PIN_RESET_BTN);
    if (resetBtn == LOW && lastResetState_ == HIGH) commandReset();
    lastResetState_ = resetBtn;

    if (state_ == ElevatorState::EMERGENCY) {
        lastUpState_ = digitalRead(ElevatorHardware::PIN_CALL_UP_BTN);
        lastDownState_ = digitalRead(ElevatorHardware::PIN_CALL_DOWN_BTN);
        lastOverloadState_ = digitalRead(ElevatorHardware::PIN_OVERLOAD_BTN);
        return;
    }

    int up = digitalRead(ElevatorHardware::PIN_CALL_UP_BTN);
    if (up == LOW && lastUpState_ == HIGH) commandCallUp();
    lastUpState_ = up;

    int down = digitalRead(ElevatorHardware::PIN_CALL_DOWN_BTN);
    if (down == LOW && lastDownState_ == HIGH) commandCallDown();
    lastDownState_ = down;

    int ov = digitalRead(ElevatorHardware::PIN_OVERLOAD_BTN);
    if (ov == LOW && lastOverloadState_ == HIGH) commandOverload(!overload_);
    lastOverloadState_ = ov;
}

void ElevatorController::updateFeedbackOutputs() {
    switch (state_) {
        case ElevatorState::IDLE:
            digitalWrite(ElevatorHardware::PIN_LED_GREEN, LOW);
            digitalWrite(ElevatorHardware::PIN_LED_RED, LOW);
            digitalWrite(ElevatorHardware::PIN_BUZZER, LOW);
            doorServo_.write(0);
            break;
        case ElevatorState::MOVING_UP:
        case ElevatorState::MOVING_DOWN:
            digitalWrite(ElevatorHardware::PIN_LED_GREEN, LOW);
            digitalWrite(ElevatorHardware::PIN_LED_RED, HIGH);
            digitalWrite(ElevatorHardware::PIN_BUZZER, LOW);
            doorServo_.write(0);
            break;
        case ElevatorState::DOOR_OPEN:
            digitalWrite(ElevatorHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(ElevatorHardware::PIN_LED_RED, LOW);
            digitalWrite(ElevatorHardware::PIN_BUZZER, LOW);
            doorServo_.write(90);
            break;
        case ElevatorState::OVERLOAD:
            digitalWrite(ElevatorHardware::PIN_LED_GREEN, LOW);
            digitalWrite(ElevatorHardware::PIN_LED_RED, HIGH);
            digitalWrite(ElevatorHardware::PIN_BUZZER, HIGH);
            doorServo_.write(90);
            break;
        case ElevatorState::EMERGENCY:
        case ElevatorState::LOCKED:
            digitalWrite(ElevatorHardware::PIN_LED_GREEN, LOW);
            digitalWrite(ElevatorHardware::PIN_LED_RED, HIGH);
            digitalWrite(ElevatorHardware::PIN_BUZZER, HIGH);
            doorServo_.write(0);
            break;
    }
}

void ElevatorController::handleStateLogic() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateTimer_;

    switch (state_) {
        case ElevatorState::IDLE: break;
        case ElevatorState::MOVING_UP:
            if (elapsed >= Elevator::TRAVEL_MS) {
                floor_++;
                emitEvent("floor_reached", "DOOR_OPENING");
                setState(ElevatorState::DOOR_OPEN);
            }
            break;
        case ElevatorState::MOVING_DOWN:
            if (elapsed >= Elevator::TRAVEL_MS) {
                if (floor_ > 0) floor_--;
                emitEvent("floor_reached", "DOOR_OPENING");
                setState(ElevatorState::DOOR_OPEN);
            }
            break;
        case ElevatorState::DOOR_OPEN:
            if (elapsed >= Elevator::DOOR_DWELL_MS) {
                emitEvent("door_closed", "AUTO_CLOSE");
                setState(ElevatorState::IDLE);
            }
            break;
        case ElevatorState::OVERLOAD:
            if (now - blinkTimer_ >= 300) {
                blinkTimer_ = now;
                blinkState_ = !blinkState_;
                digitalWrite(ElevatorHardware::PIN_BUZZER, blinkState_ ? HIGH : LOW);
            }
            break;
        case ElevatorState::EMERGENCY:
        case ElevatorState::LOCKED:
            break;
    }
}

void ElevatorController::update() {
    handleButtonInputs();
    handleStateLogic();
}
