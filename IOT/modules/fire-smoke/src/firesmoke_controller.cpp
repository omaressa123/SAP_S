#include "firesmoke_controller.h"

using namespace AirportIoT;

FireSmokeController::FireSmokeController()
    : state_(FireSmokeState::NORMAL),
      smokePpm_(0),
      temperatureC_(25.0f),
      stateTimer_(0),
      lastTelemetry_(0),
      lastDebounceTime_(0),
      blinkTimer_(0),
      blinkState_(false),
      lastTestState_(HIGH),
      lastSilenceState_(HIGH),
      lastResetState_(HIGH),
      onEventCallback_(nullptr),
      onTelemetryCallback_(nullptr) {}

void FireSmokeController::begin() {
    pinMode(FireSmokeHardware::PIN_LED_OK, OUTPUT);
    pinMode(FireSmokeHardware::PIN_LED_WARNING, OUTPUT);
    pinMode(FireSmokeHardware::PIN_LED_CRITICAL, OUTPUT);
    pinMode(FireSmokeHardware::PIN_BUZZER, OUTPUT);
    pinMode(FireSmokeHardware::PIN_TEST_BTN, INPUT_PULLUP);
    pinMode(FireSmokeHardware::PIN_SILENCE_BTN, INPUT_PULLUP);
    pinMode(FireSmokeHardware::PIN_RESET_BTN, INPUT_PULLUP);
    analogReadResolution(12);
    Serial.println(F("[FIRE] Fire/smoke controller initialized: NORMAL"));
    updateFeedbackOutputs();
}

const char* FireSmokeController::getStateString() const {
    switch (state_) {
        case FireSmokeState::NORMAL:       return "NORMAL";
        case FireSmokeState::WARNING:      return "WARNING";
        case FireSmokeState::CRITICAL:     return "CRITICAL";
        case FireSmokeState::ALARM_LATCHED: return "ALARM_LATCHED";
        case FireSmokeState::SILENCED:     return "SILENCED";
        default:                          return "UNKNOWN";
    }
}

void FireSmokeController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[FIRE] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) onEventCallback_(eventName, details);
}

void FireSmokeController::setState(FireSmokeState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[FIRE] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

void FireSmokeController::commandTestAlarm() {
    emitEvent("test_alarm", "MANUAL_TEST");
    setState(FireSmokeState::ALARM_LATCHED);
}

void FireSmokeController::commandSilence() {
    if (state_ == FireSmokeState::ALARM_LATCHED || state_ == FireSmokeState::CRITICAL) {
        emitEvent("alarm_silenced", "SIREN_MUTED");
        setState(FireSmokeState::SILENCED);
    }
}

bool FireSmokeController::commandReset() {
    emitEvent("system_reset", "SYSTEM_NORMAL");
    setState(FireSmokeState::NORMAL);
    return true;
}

void FireSmokeController::readSensors() {
    int rawSmoke = analogRead(FireSmokeHardware::PIN_SMOKE_ADC);
    int rawTemp = analogRead(FireSmokeHardware::PIN_TEMP_ADC);
    // Map pot sweep to engineering units (simulation only).
    smokePpm_ = (rawSmoke / 4095.0f) * 1000.0f;
    temperatureC_ = 20.0f + (rawTemp / 4095.0f) * 70.0f;
}

void FireSmokeController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < FireSmoke::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int resetBtn = digitalRead(FireSmokeHardware::PIN_RESET_BTN);
    if (resetBtn == LOW && lastResetState_ == HIGH) commandReset();
    lastResetState_ = resetBtn;

    int testBtn = digitalRead(FireSmokeHardware::PIN_TEST_BTN);
    if (testBtn == LOW && lastTestState_ == HIGH) commandTestAlarm();
    lastTestState_ = testBtn;

    int silBtn = digitalRead(FireSmokeHardware::PIN_SILENCE_BTN);
    if (silBtn == LOW && lastSilenceState_ == HIGH) commandSilence();
    lastSilenceState_ = silBtn;
}

void FireSmokeController::updateFeedbackOutputs() {
    digitalWrite(FireSmokeHardware::PIN_LED_OK, state_ == FireSmokeState::NORMAL ? HIGH : LOW);
    digitalWrite(FireSmokeHardware::PIN_LED_WARNING, state_ == FireSmokeState::WARNING ? HIGH : LOW);
    digitalWrite(FireSmokeHardware::PIN_LED_CRITICAL,
        (state_ == FireSmokeState::CRITICAL || state_ == FireSmokeState::ALARM_LATCHED) ? HIGH : LOW);
    if (state_ == FireSmokeState::NORMAL || state_ == FireSmokeState::SILENCED) {
        digitalWrite(FireSmokeHardware::PIN_BUZZER, LOW);
    } else if (state_ == FireSmokeState::ALARM_LATCHED || state_ == FireSmokeState::CRITICAL) {
        digitalWrite(FireSmokeHardware::PIN_BUZZER, HIGH);
    } else {
        digitalWrite(FireSmokeHardware::PIN_BUZZER, LOW);
    }
}

void FireSmokeController::handleStateLogic() {
    unsigned long now = millis();
    readSensors();

    if (state_ == FireSmokeState::ALARM_LATCHED || state_ == FireSmokeState::SILENCED) {
        // Latched until RESET (silence only mutes siren).
        if (state_ == FireSmokeState::ALARM_LATCHED && now - blinkTimer_ >= 250) {
            blinkTimer_ = now;
            blinkState_ = !blinkState_;
            digitalWrite(FireSmokeHardware::PIN_BUZZER, blinkState_ ? HIGH : LOW);
        }
    } else {
        bool smokeWarn = smokePpm_ >= FireSmoke::SMOKE_WARNING_PPM;
        bool smokeCrit = smokePpm_ >= FireSmoke::SMOKE_CRITICAL_PPM;
        bool tempCrit = temperatureC_ >= FireSmoke::TEMP_CRITICAL_C;
        if (smokeCrit || tempCrit) {
            if (state_ != FireSmokeState::CRITICAL) {
                emitEvent("critical_condition", "SMOKE_OR_HEAT_CRITICAL");
                setState(FireSmokeState::CRITICAL);
            }
        } else if (smokeWarn || temperatureC_ >= FireSmoke::TEMP_WARNING_C) {
            if (state_ != FireSmokeState::WARNING) {
                emitEvent("warning_condition", "SMOKE_OR_HEAT_WARNING");
                setState(FireSmokeState::WARNING);
            }
        } else {
            if (state_ != FireSmokeState::NORMAL) {
                emitEvent("condition_normal", "CLEAR");
                setState(FireSmokeState::NORMAL);
            }
        }
    }

    if (now - lastTelemetry_ >= FireSmoke::TELEMETRY_INTERVAL_MS) {
        lastTelemetry_ = now;
        if (onTelemetryCallback_) onTelemetryCallback_();
    }
}

void FireSmokeController::update() {
    handleButtonInputs();
    handleStateLogic();
}
