#include "baggage_controller.h"

using namespace AirportIoT;

BaggageController::BaggageController()
    : state_(BaggageState::IDLE),
      isLocked_(false),
      stateTimer_(0),
      alarmBlinkTimer_(0),
      alarmLedState_(false),
      sortedCount_(0),
      divertedCount_(0),
      lastTagBtnState_(HIGH),
      lastSortBtnState_(HIGH),
      lastDivertBtnState_(HIGH),
      lastResetBtnState_(HIGH),
      lastDebounceTime_(0),
      onEventCallback_(nullptr),
      onTagCallback_(nullptr) {
    currentTag_[0] = '\0';
}

void BaggageController::begin() {
    pinMode(BaggageHardware::PIN_LED_GREEN, OUTPUT);
    pinMode(BaggageHardware::PIN_LED_RED, OUTPUT);
    pinMode(BaggageHardware::PIN_BUZZER, OUTPUT);

    pinMode(BaggageHardware::PIN_TAG_SENSOR, INPUT_PULLUP);
    pinMode(BaggageHardware::PIN_SORT_OK_BTN, INPUT_PULLUP);
    pinMode(BaggageHardware::PIN_DIVERT_BTN, INPUT_PULLUP);
    pinMode(BaggageHardware::PIN_RESET_BTN, INPUT_PULLUP);

    digitalWrite(BaggageHardware::PIN_LED_GREEN, LOW);
    digitalWrite(BaggageHardware::PIN_LED_RED, LOW);
    digitalWrite(BaggageHardware::PIN_BUZZER, LOW);

    ESP32PWM::allocateTimer(0);
    diverterServo_.setPeriodHertz(50);
    diverterServo_.attach(BaggageHardware::PIN_DIVERTER_SERVO, 500, 2400);
    diverterServo_.write(0); // main line

    Serial.println(F("[BAG] Baggage controller initialized in IDLE"));
}

const char* BaggageController::getStateString() const {
    switch (state_) {
        case BaggageState::IDLE:            return "IDLE";
        case BaggageState::TAG_DETECTED:    return "TAG_DETECTED";
        case BaggageState::WAITING_FOR_SORT: return "WAITING_FOR_SORT";
        case BaggageState::SORTING:         return "SORTING";
        case BaggageState::SORTED:          return "SORTED";
        case BaggageState::DIVERTED:        return "DIVERTED";
        case BaggageState::ALARM:           return "ALARM";
        case BaggageState::LOCKED:          return "LOCKED";
        default:                           return "UNKNOWN";
    }
}

void BaggageController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[BAG] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) onEventCallback_(eventName, details);
}

void BaggageController::emitTag(const char* tagUid, const char* result, const char* reason) {
    if (onTagCallback_) onTagCallback_(tagUid, result, reason);
}

void BaggageController::setState(BaggageState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[BAG] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

void BaggageController::simulateTagPresent(const char* tagUid) {
    if (isLocked_ || state_ == BaggageState::LOCKED) {
        Serial.println(F("[BAG] Tag rejected: line locked"));
        emitTag(tagUid, "REJECTED", "LINE_LOCKED");
        return;
    }
    if (state_ != BaggageState::IDLE) {
        Serial.println(F("[BAG] Tag ignored: line busy"));
        return;
    }
    strncpy(currentTag_, tagUid, sizeof(currentTag_) - 1);
    currentTag_[sizeof(currentTag_) - 1] = '\0';
    emitEvent("tag_detected", currentTag_);
    setState(BaggageState::TAG_DETECTED);
}

bool BaggageController::commandSort(const char* tagUid) {
    if (isLocked_) return false;
    if (state_ != BaggageState::WAITING_FOR_SORT && state_ != BaggageState::TAG_DETECTED) return false;
    emitTag(tagUid, "SORTED", "MAIN_LINE");
    emitEvent("baggage_sorted", tagUid);
    sortedCount_++;
    setState(BaggageState::SORTING);
    return true;
}

bool BaggageController::commandDivert(const char* tagUid, const char* reason) {
    if (isLocked_) return false;
    if (state_ != BaggageState::WAITING_FOR_SORT && state_ != BaggageState::TAG_DETECTED) return false;
    emitTag(tagUid, "DIVERTED", reason);
    emitEvent("baggage_diverted", reason);
    divertedCount_++;
    setState(BaggageState::DIVERTED);
    return true;
}

bool BaggageController::commandLock() {
    isLocked_ = true;
    emitEvent("line_locked", "MANUAL_LOCK");
    setState(BaggageState::LOCKED);
    return true;
}

bool BaggageController::commandUnlock() {
    isLocked_ = false;
    emitEvent("line_unlocked", "NORMAL_OPERATION");
    setState(BaggageState::IDLE);
    return true;
}

bool BaggageController::commandReset() {
    isLocked_ = false;
    currentTag_[0] = '\0';
    digitalWrite(BaggageHardware::PIN_BUZZER, LOW);
    emitEvent("system_reset", "SYSTEM_NORMAL");
    setState(BaggageState::IDLE);
    return true;
}

void BaggageController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < Baggage::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int resetBtn = digitalRead(BaggageHardware::PIN_RESET_BTN);
    if (resetBtn == LOW && lastResetBtnState_ == HIGH) commandReset();
    lastResetBtnState_ = resetBtn;

    if (isLocked_) {
        lastTagBtnState_ = digitalRead(BaggageHardware::PIN_TAG_SENSOR);
        lastSortBtnState_ = digitalRead(BaggageHardware::PIN_SORT_OK_BTN);
        lastDivertBtnState_ = digitalRead(BaggageHardware::PIN_DIVERT_BTN);
        return;
    }

    int tagBtn = digitalRead(BaggageHardware::PIN_TAG_SENSOR);
    int sortBtn = digitalRead(BaggageHardware::PIN_SORT_OK_BTN);
    int divertBtn = digitalRead(BaggageHardware::PIN_DIVERT_BTN);

    if (tagBtn == LOW && lastTagBtnState_ == HIGH) simulateTagPresent("BAG-TAG-001");
    lastTagBtnState_ = tagBtn;

    if (sortBtn == LOW && lastSortBtnState_ == HIGH) commandSort(currentTag_[0] ? currentTag_ : "BAG-TAG-001");
    lastSortBtnState_ = sortBtn;

    if (divertBtn == LOW && lastDivertBtnState_ == HIGH) commandDivert(currentTag_[0] ? currentTag_ : "BAG-TAG-001", "MANUAL_DIVERT");
    lastDivertBtnState_ = divertBtn;
}

void BaggageController::updateFeedbackOutputs() {
    switch (state_) {
        case BaggageState::IDLE:
            digitalWrite(BaggageHardware::PIN_LED_GREEN, LOW);
            digitalWrite(BaggageHardware::PIN_LED_RED, LOW);
            digitalWrite(BaggageHardware::PIN_BUZZER, LOW);
            diverterServo_.write(0);
            break;
        case BaggageState::TAG_DETECTED:
        case BaggageState::WAITING_FOR_SORT:
            digitalWrite(BaggageHardware::PIN_LED_GREEN, LOW);
            digitalWrite(BaggageHardware::PIN_LED_RED, LOW);
            digitalWrite(BaggageHardware::PIN_BUZZER, LOW);
            break;
        case BaggageState::SORTING:
        case BaggageState::SORTED:
            digitalWrite(BaggageHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(BaggageHardware::PIN_LED_RED, LOW);
            digitalWrite(BaggageHardware::PIN_BUZZER, LOW);
            diverterServo_.write(0);
            break;
        case BaggageState::DIVERTED:
        case BaggageState::ALARM:
            digitalWrite(BaggageHardware::PIN_LED_GREEN, LOW);
            digitalWrite(BaggageHardware::PIN_LED_RED, HIGH);
            digitalWrite(BaggageHardware::PIN_BUZZER, HIGH);
            diverterServo_.write(90);
            break;
        case BaggageState::LOCKED:
            digitalWrite(BaggageHardware::PIN_LED_GREEN, LOW);
            digitalWrite(BaggageHardware::PIN_LED_RED, HIGH);
            digitalWrite(BaggageHardware::PIN_BUZZER, LOW);
            diverterServo_.write(0);
            break;
    }
}

void BaggageController::handleStateLogic() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateTimer_;

    switch (state_) {
        case BaggageState::IDLE: break;
        case BaggageState::TAG_DETECTED:
            emitEvent("sort_requested", currentTag_);
            setState(BaggageState::WAITING_FOR_SORT);
            break;
        case BaggageState::WAITING_FOR_SORT:
            if (elapsed >= Baggage::SORT_TIMEOUT_MS) {
                emitEvent("sort_timeout", "NO_DECISION");
                emitTag(currentTag_, "DIVERTED", "SORT_TIMEOUT");
                divertedCount_++;
                setState(BaggageState::DIVERTED);
            }
            break;
        case BaggageState::SORTING:
            if (elapsed >= Baggage::SORT_MOTION_MS) setState(BaggageState::SORTED);
            break;
        case BaggageState::SORTED:
            if (elapsed >= 2000) {
                currentTag_[0] = '\0';
                setState(BaggageState::IDLE);
            }
            break;
        case BaggageState::DIVERTED:
            if (now - alarmBlinkTimer_ >= 300) {
                alarmBlinkTimer_ = now;
                alarmLedState_ = !alarmLedState_;
                digitalWrite(BaggageHardware::PIN_BUZZER, alarmLedState_ ? HIGH : LOW);
            }
            if (elapsed >= 3000) {
                digitalWrite(BaggageHardware::PIN_BUZZER, LOW);
                currentTag_[0] = '\0';
                setState(BaggageState::IDLE);
            }
            break;
        case BaggageState::ALARM:
            if (elapsed >= Baggage::ALARM_DURATION_MS) {
                digitalWrite(BaggageHardware::PIN_BUZZER, LOW);
                setState(BaggageState::IDLE);
            }
            break;
        case BaggageState::LOCKED: break;
    }
}

void BaggageController::update() {
    handleButtonInputs();
    handleStateLogic();
}
