#include "emergency_controller.h"

using namespace AirportIoT;

EmergencyController::EmergencyController()
    : state_(EmergencyState::NORMAL),
      stateTimer_(0),
      blinkTimer_(0),
      blinkState_(false),
      lastTriggerState_(HIGH),
      lastSilenceState_(HIGH),
      lastLockdownState_(HIGH),
      lastResetState_(HIGH),
      lastDebounceTime_(0),
      onEventCallback_(nullptr) {}

void EmergencyController::begin() {
    pinMode(EmergencyHardware::PIN_LED_GREEN, OUTPUT);
    pinMode(EmergencyHardware::PIN_LED_RED, OUTPUT);
    pinMode(EmergencyHardware::PIN_BEACON, OUTPUT);
    pinMode(EmergencyHardware::PIN_BUZZER, OUTPUT);
    pinMode(EmergencyHardware::PIN_TRIGGER_BTN, INPUT_PULLUP);
    pinMode(EmergencyHardware::PIN_SILENCE_BTN, INPUT_PULLUP);
    pinMode(EmergencyHardware::PIN_LOCKDOWN_BTN, INPUT_PULLUP);
    pinMode(EmergencyHardware::PIN_RESET_BTN, INPUT_PULLUP);
    digitalWrite(EmergencyHardware::PIN_LED_GREEN, HIGH);
    digitalWrite(EmergencyHardware::PIN_LED_RED, LOW);
    digitalWrite(EmergencyHardware::PIN_BEACON, LOW);
    digitalWrite(EmergencyHardware::PIN_BUZZER, LOW);
    Serial.println(F("[EMERG] Emergency controller initialized: NORMAL"));
}

const char* EmergencyController::getStateString() const {
    switch (state_) {
        case EmergencyState::NORMAL:    return "NORMAL";
        case EmergencyState::ALERT:     return "ALERT";
        case EmergencyState::EVACUATION: return "EVACUATION";
        case EmergencyState::LOCKDOWN:  return "LOCKDOWN";
        case EmergencyState::SILENCED:  return "SILENCED";
        default:                        return "UNKNOWN";
    }
}

bool EmergencyController::isAlarmActive() const {
    return state_ == EmergencyState::ALERT ||
           state_ == EmergencyState::EVACUATION ||
           state_ == EmergencyState::LOCKDOWN;
}

void EmergencyController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[EMERG] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) onEventCallback_(eventName, details);
}

void EmergencyController::setState(EmergencyState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[EMERG] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

void EmergencyController::commandTrigger(const char* details) {
    if (state_ == EmergencyState::NORMAL || state_ == EmergencyState::SILENCED) {
        emitEvent("emergency_triggered", details);
        setState(EmergencyState::ALERT);
    }
}

void EmergencyController::commandEvacuate() {
    emitEvent("evacuation_ordered", "BACKEND_COMMAND");
    setState(EmergencyState::EVACUATION);
}

void EmergencyController::commandLockdown() {
    emitEvent("lockdown_ordered", "BACKEND_COMMAND");
    setState(EmergencyState::LOCKDOWN);
}

void EmergencyController::commandSilence() {
    if (isAlarmActive()) {
        emitEvent("alarm_silenced", "SIREN_MUTED_BEACON_ON");
        setState(EmergencyState::SILENCED);
    }
}

bool EmergencyController::commandReset() {
    emitEvent("system_reset", "SYSTEM_NORMAL");
    setState(EmergencyState::NORMAL);
    return true;
}

void EmergencyController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < Emergency::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int resetBtn = digitalRead(EmergencyHardware::PIN_RESET_BTN);
    if (resetBtn == LOW && lastResetState_ == HIGH) commandReset();
    lastResetState_ = resetBtn;

    int trig = digitalRead(EmergencyHardware::PIN_TRIGGER_BTN);
    if (trig == LOW && lastTriggerState_ == HIGH) commandTrigger("PANIC_BUTTON");
    lastTriggerState_ = trig;

    int sil = digitalRead(EmergencyHardware::PIN_SILENCE_BTN);
    if (sil == LOW && lastSilenceState_ == HIGH) commandSilence();
    lastSilenceState_ = sil;

    int lock = digitalRead(EmergencyHardware::PIN_LOCKDOWN_BTN);
    if (lock == LOW && lastLockdownState_ == HIGH) commandLockdown();
    lastLockdownState_ = lock;
}

void EmergencyController::updateFeedbackOutputs() {
    switch (state_) {
        case EmergencyState::NORMAL:
            digitalWrite(EmergencyHardware::PIN_LED_GREEN, HIGH);
            digitalWrite(EmergencyHardware::PIN_LED_RED, LOW);
            digitalWrite(EmergencyHardware::PIN_BEACON, LOW);
            digitalWrite(EmergencyHardware::PIN_BUZZER, LOW);
            break;
        case EmergencyState::ALERT:
        case EmergencyState::EVACUATION:
        case EmergencyState::LOCKDOWN:
            digitalWrite(EmergencyHardware::PIN_LED_GREEN, LOW);
            digitalWrite(EmergencyHardware::PIN_LED_RED, HIGH);
            digitalWrite(EmergencyHardware::PIN_BEACON, HIGH);
            digitalWrite(EmergencyHardware::PIN_BUZZER, HIGH);
            break;
        case EmergencyState::SILENCED:
            digitalWrite(EmergencyHardware::PIN_LED_GREEN, LOW);
            digitalWrite(EmergencyHardware::PIN_LED_RED, HIGH);
            digitalWrite(EmergencyHardware::PIN_BEACON, HIGH);
            digitalWrite(EmergencyHardware::PIN_BUZZER, LOW);
            break;
    }
}

void EmergencyController::handleStateLogic() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateTimer_;
    if (isAlarmActive()) {
        // Blink siren/beacon at 2 Hz; latched until SILENCE or RESET.
        if (now - blinkTimer_ >= 250) {
            blinkTimer_ = now;
            blinkState_ = !blinkState_;
            digitalWrite(EmergencyHardware::PIN_BUZZER, blinkState_ ? HIGH : LOW);
            digitalWrite(EmergencyHardware::PIN_BEACON, blinkState_ ? HIGH : LOW);
        }
        if (state_ == EmergencyState::ALERT && elapsed >= Emergency::AUTO_EVACUATE_MS) {
            emitEvent("auto_evacuation", "ALERT_DWELL_EXCEEDED");
            setState(EmergencyState::EVACUATION);
        }
    }
}

void EmergencyController::update() {
    handleButtonInputs();
    handleStateLogic();
}
