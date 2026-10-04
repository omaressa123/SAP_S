#include "environment_controller.h"

using namespace AirportIoT;

EnvironmentController::EnvironmentController()
    : state_(EnvironmentState::NORMAL),
      fanMode_(FanMode::AUTO),
      fanOn_(false),
      temperatureC_(22.0f),
      humidityRh_(45.0f),
      co2Ppm_(600.0f),
      lastTelemetry_(0),
      lastDebounceTime_(0),
      lastFanBtnState_(HIGH),
      lastResetBtnState_(HIGH),
      onEventCallback_(nullptr),
      onTelemetryCallback_(nullptr) {}

void EnvironmentController::begin() {
    pinMode(EnvironmentHardware::PIN_LED_OK, OUTPUT);
    pinMode(EnvironmentHardware::PIN_LED_WARNING, OUTPUT);
    pinMode(EnvironmentHardware::PIN_LED_POOR, OUTPUT);
    pinMode(EnvironmentHardware::PIN_FAN_RELAY, OUTPUT);
    pinMode(EnvironmentHardware::PIN_FAN_BTN, INPUT_PULLUP);
    pinMode(EnvironmentHardware::PIN_RESET_BTN, INPUT_PULLUP);
    analogReadResolution(12);
    digitalWrite(EnvironmentHardware::PIN_FAN_RELAY, LOW);
    Serial.println(F("[ENV] Environment controller initialized: NORMAL/AUTO"));
    updateFeedbackOutputs();
}

const char* EnvironmentController::getStateString() const {
    switch (state_) {
        case EnvironmentState::NORMAL:          return "NORMAL";
        case EnvironmentState::COMFORT_WARNING: return "COMFORT_WARNING";
        case EnvironmentState::POOR_AIR:        return "POOR_AIR";
        default:                               return "UNKNOWN";
    }
}

const char* EnvironmentController::getFanModeString() const {
    switch (fanMode_) {
        case FanMode::AUTO:       return "AUTO";
        case FanMode::FORCED_ON:  return "FORCED_ON";
        case FanMode::FORCED_OFF: return "FORCED_OFF";
        default:                  return "UNKNOWN";
    }
}

void EnvironmentController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[ENV] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) onEventCallback_(eventName, details);
}

void EnvironmentController::setState(EnvironmentState newState) {
    if (state_ == newState) return;
    state_ = newState;
    Serial.printf("[ENV] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

void EnvironmentController::commandFanOn() {
    fanMode_ = FanMode::FORCED_ON;
    emitEvent("fan_forced_on", "MANUAL_OVERRIDE");
    updateFeedbackOutputs();
}

void EnvironmentController::commandFanOff() {
    fanMode_ = FanMode::FORCED_OFF;
    emitEvent("fan_forced_off", "MANUAL_OVERRIDE");
    updateFeedbackOutputs();
}

void EnvironmentController::commandFanAuto() {
    fanMode_ = FanMode::AUTO;
    emitEvent("fan_auto", "AUTO_CONTROL");
    updateFeedbackOutputs();
}

bool EnvironmentController::commandReset() {
    fanMode_ = FanMode::AUTO;
    emitEvent("system_reset", "AUTO_CONTROL");
    setState(EnvironmentState::NORMAL);
    updateFeedbackOutputs();
    return true;
}

void EnvironmentController::readSensors() {
    int rawT = analogRead(EnvironmentHardware::PIN_TEMP_ADC);
    int rawH = analogRead(EnvironmentHardware::PIN_HUMIDITY_ADC);
    int rawC = analogRead(EnvironmentHardware::PIN_CO2_ADC);
    temperatureC_ = 10.0f + (rawT / 4095.0f) * 35.0f;
    humidityRh_ = (rawH / 4095.0f) * 100.0f;
    co2Ppm_ = 400.0f + (rawC / 4095.0f) * 1600.0f;
}

void EnvironmentController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < Environment::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int resetBtn = digitalRead(EnvironmentHardware::PIN_RESET_BTN);
    if (resetBtn == LOW && lastResetBtnState_ == HIGH) commandReset();
    lastResetBtnState_ = resetBtn;

    int fanBtn = digitalRead(EnvironmentHardware::PIN_FAN_BTN);
    if (fanBtn == LOW && lastFanBtnState_ == HIGH) {
        // Cycle AUTO -> FORCED_ON -> FORCED_OFF -> AUTO
        if (fanMode_ == FanMode::AUTO) commandFanOn();
        else if (fanMode_ == FanMode::FORCED_ON) commandFanOff();
        else commandFanAuto();
    }
    lastFanBtnState_ = fanBtn;
}

void EnvironmentController::updateFeedbackOutputs() {
    digitalWrite(EnvironmentHardware::PIN_LED_OK, state_ == EnvironmentState::NORMAL ? HIGH : LOW);
    digitalWrite(EnvironmentHardware::PIN_LED_WARNING, state_ == EnvironmentState::COMFORT_WARNING ? HIGH : LOW);
    digitalWrite(EnvironmentHardware::PIN_LED_POOR, state_ == EnvironmentState::POOR_AIR ? HIGH : LOW);
    if (fanMode_ == FanMode::FORCED_ON) fanOn_ = true;
    else if (fanMode_ == FanMode::FORCED_OFF) fanOn_ = false;
    else fanOn_ = (state_ != EnvironmentState::NORMAL);
    digitalWrite(EnvironmentHardware::PIN_FAN_RELAY, fanOn_ ? HIGH : LOW);
}

void EnvironmentController::handleStateLogic() {
    unsigned long now = millis();
    readSensors();

    bool hot = temperatureC_ >= Environment::TEMP_HIGH_C || temperatureC_ <= Environment::TEMP_LOW_C;
    bool humid = humidityRh_ >= Environment::HUMIDITY_HIGH_RH;
    bool poorAir = co2Ppm_ >= Environment::CO2_POOR_PPM;

    if (poorAir) {
        if (state_ != EnvironmentState::POOR_AIR) {
            emitEvent("poor_air", "CO2_THRESHOLD");
            setState(EnvironmentState::POOR_AIR);
        }
    } else if (hot || humid || co2Ppm_ >= Environment::CO2_WARNING_PPM) {
        if (state_ != EnvironmentState::COMFORT_WARNING) {
            emitEvent("comfort_warning", "TEMP_RH_CO2");
            setState(EnvironmentState::COMFORT_WARNING);
        }
    } else {
        if (state_ != EnvironmentState::NORMAL) {
            emitEvent("condition_normal", "COMFORT_OK");
            setState(EnvironmentState::NORMAL);
        }
    }
    updateFeedbackOutputs();

    if (now - lastTelemetry_ >= Environment::TELEMETRY_INTERVAL_MS) {
        lastTelemetry_ = now;
        if (onTelemetryCallback_) onTelemetryCallback_();
    }
}

void EnvironmentController::update() {
    handleButtonInputs();
    handleStateLogic();
}
