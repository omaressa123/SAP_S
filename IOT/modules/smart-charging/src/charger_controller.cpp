#include "charger_controller.h"

using namespace AirportIoT;

ChargerController::ChargerController()
    : state_(ChargerState::AVAILABLE),
      voltageV_(0.0f),
      currentA_(0.0f),
      temperatureC_(25.0f),
      chargePercent_(0.0f),
      vehicleConnected_(false),
      stateTimer_(0),
      lastTelemetry_(0),
      lastProgressEvent_(0),
      lastChargeUpdate_(0),
      lastDebounceTime_(0),
      alarmBlinkTimer_(0),
      alarmLedState_(false),
      lastProgressPct_(0.0f),
      lastConnectBtnState_(HIGH),
      lastStartBtnState_(HIGH),
      lastEstopBtnState_(HIGH),
      lastResetBtnState_(HIGH),
      onEventCallback_(nullptr),
      onTelemetryCallback_(nullptr) {}

void ChargerController::begin() {
    pinMode(ChargerHardware::PIN_LED_AVAILABLE, OUTPUT);
    pinMode(ChargerHardware::PIN_LED_CHARGING, OUTPUT);
    pinMode(ChargerHardware::PIN_LED_ALARM, OUTPUT);
    pinMode(ChargerHardware::PIN_RELAY, OUTPUT);
    pinMode(ChargerHardware::PIN_BUZZER, OUTPUT);

    pinMode(ChargerHardware::PIN_CONNECT_BTN, INPUT_PULLUP);
    pinMode(ChargerHardware::PIN_START_BTN, INPUT_PULLUP);
    pinMode(ChargerHardware::PIN_ESTOP_BTN, INPUT_PULLUP);
    pinMode(ChargerHardware::PIN_RESET_BTN, INPUT_PULLUP);

    digitalWrite(ChargerHardware::PIN_LED_AVAILABLE, HIGH);
    digitalWrite(ChargerHardware::PIN_LED_CHARGING, LOW);
    digitalWrite(ChargerHardware::PIN_LED_ALARM, LOW);
    digitalWrite(ChargerHardware::PIN_RELAY, LOW);
    digitalWrite(ChargerHardware::PIN_BUZZER, LOW);

    readSensors();
    Serial.println(F("[CHG] Charging station initialized in AVAILABLE (simulation only)"));
}

const char* ChargerController::getStateString() const {
    switch (state_) {
        case ChargerState::AVAILABLE:         return "AVAILABLE";
        case ChargerState::VEHICLE_CONNECTED: return "VEHICLE_CONNECTED";
        case ChargerState::READY:              return "READY";
        case ChargerState::CHARGING:           return "CHARGING";
        case ChargerState::CHARGING_COMPLETE:  return "CHARGING_COMPLETE";
        case ChargerState::DISCONNECTED:       return "DISCONNECTED";
        case ChargerState::TEMPERATURE_HIGH:   return "TEMPERATURE_HIGH";
        case ChargerState::CHARGING_STOPPED:   return "CHARGING_STOPPED";
        case ChargerState::ALARM:              return "ALARM";
        default:                               return "UNKNOWN";
    }
}

bool ChargerController::isVehicleConnected() const {
    return vehicleConnected_;
}

void ChargerController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[CHG] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) {
        onEventCallback_(eventName, details);
    }
}

void ChargerController::setState(ChargerState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[CHG] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

void ChargerController::readSensors() {
    // Simulation mapping (LOW-VOLTAGE SIMULATION ONLY):
    //   voltage pot 0..4095 -> 360..440 V simulated DC bus
    //   temp pot    0..4095 -> 20..80 C connector temperature
    //   current pot 0..4095 -> 0..CURRENT_MAX_A demand (only flows while CHARGING)
    int rawV = analogRead(ChargerHardware::PIN_VOLTAGE_ADC);
    int rawT = analogRead(ChargerHardware::PIN_TEMP_ADC);
    voltageV_ = 360.0f + (static_cast<float>(rawV) / 4095.0f) * 80.0f;
    temperatureC_ = 20.0f + (static_cast<float>(rawT) / 4095.0f) * 60.0f;

    if (state_ == ChargerState::CHARGING) {
        int rawI = analogRead(ChargerHardware::PIN_CURRENT_ADC);
        currentA_ = (static_cast<float>(rawI) / 4095.0f) * Charging::CURRENT_MAX_A;
    } else {
        currentA_ = 0.0f;
    }
}

void ChargerController::commandConnectVehicle() {
    if (state_ == ChargerState::ALARM || state_ == ChargerState::CHARGING_STOPPED) {
        Serial.println(F("[CHG] Connect rejected: station in fault state, RESET first"));
        return;
    }
    if (vehicleConnected_) return;
    vehicleConnected_ = true;
    chargePercent_ = 0.0f;
    lastProgressPct_ = 0.0f;
    emitEvent("vehicle_connected", "CONNECTOR_LOCKED");
    setState(ChargerState::VEHICLE_CONNECTED);
}

void ChargerController::commandDisconnectVehicle() {
    if (!vehicleConnected_) return;
    if (state_ == ChargerState::CHARGING || state_ == ChargerState::TEMPERATURE_HIGH) {
        Serial.println(F("[CHG] Disconnect rejected while charging: stop first"));
        return;
    }
    vehicleConnected_ = false;
    currentA_ = 0.0f;
    emitEvent("vehicle_disconnected", "CONNECTOR_RELEASED");
    setState(ChargerState::DISCONNECTED);
}

void ChargerController::commandStartCharging() {
    if (!vehicleConnected_) {
        Serial.println(F("[CHG] Start rejected: no vehicle connected"));
        return;
    }
    if (state_ == ChargerState::ALARM || state_ == ChargerState::CHARGING_STOPPED) {
        Serial.println(F("[CHG] Start rejected: station in fault state, RESET first"));
        return;
    }
    if (state_ == ChargerState::CHARGING) return;
    if (temperatureC_ >= Charging::TEMP_CRITICAL_C) {
        Serial.println(F("[CHG] Start rejected: over-temperature"));
        emitEvent("temperature_warning", "START_INHIBITED");
        setState(ChargerState::TEMPERATURE_HIGH);
        return;
    }
    emitEvent("charging_started", "CONTACTOR_CLOSED");
    setState(ChargerState::CHARGING);
}

void ChargerController::commandStopCharging() {
    if (state_ != ChargerState::CHARGING && state_ != ChargerState::TEMPERATURE_HIGH) return;
    emitEvent("charging_stopped", "OPERATOR_STOP");
    setState(ChargerState::CHARGING_STOPPED);
}

void ChargerController::commandEmergencyStop() {
    // Emergency stop has immediate effect from ANY state.
    digitalWrite(ChargerHardware::PIN_RELAY, LOW);
    currentA_ = 0.0f;
    emitEvent("emergency_stop", "ESTOP_LATCHED");
    setState(ChargerState::ALARM);
}

void ChargerController::commandReset() {
    Serial.println(F("[CHG] RESET command executed"));
    digitalWrite(ChargerHardware::PIN_RELAY, LOW);
    digitalWrite(ChargerHardware::PIN_BUZZER, LOW);
    currentA_ = 0.0f;
    vehicleConnected_ = false;
    chargePercent_ = 0.0f;
    lastProgressPct_ = 0.0f;
    emitEvent("station_reset", "SYSTEM_NORMAL");
    setState(ChargerState::AVAILABLE);
}

void ChargerController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < Charging::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int connectBtn = digitalRead(ChargerHardware::PIN_CONNECT_BTN);
    int startBtn = digitalRead(ChargerHardware::PIN_START_BTN);
    int estopBtn = digitalRead(ChargerHardware::PIN_ESTOP_BTN);
    int resetBtn = digitalRead(ChargerHardware::PIN_RESET_BTN);

    // Emergency stop is checked first and is always honored.
    if (estopBtn == LOW && lastEstopBtnState_ == HIGH) {
        commandEmergencyStop();
    }
    lastEstopBtnState_ = estopBtn;

    if (connectBtn == LOW && lastConnectBtnState_ == HIGH) {
        if (vehicleConnected_) {
            commandDisconnectVehicle();
        } else {
            commandConnectVehicle();
        }
    }
    lastConnectBtnState_ = connectBtn;

    if (startBtn == LOW && lastStartBtnState_ == HIGH) {
        if (state_ == ChargerState::CHARGING) {
            commandStopCharging();
        } else {
            commandStartCharging();
        }
    }
    lastStartBtnState_ = startBtn;

    if (resetBtn == LOW && lastResetBtnState_ == HIGH) {
        commandReset();
    }
    lastResetBtnState_ = resetBtn;
}

void ChargerController::updateFeedbackOutputs() {
    switch (state_) {
        case ChargerState::AVAILABLE:
        case ChargerState::DISCONNECTED:
            digitalWrite(ChargerHardware::PIN_LED_AVAILABLE, HIGH);
            digitalWrite(ChargerHardware::PIN_LED_CHARGING, LOW);
            digitalWrite(ChargerHardware::PIN_LED_ALARM, LOW);
            digitalWrite(ChargerHardware::PIN_RELAY, LOW);
            digitalWrite(ChargerHardware::PIN_BUZZER, LOW);
            break;
        case ChargerState::VEHICLE_CONNECTED:
        case ChargerState::READY:
        case ChargerState::CHARGING_COMPLETE:
            digitalWrite(ChargerHardware::PIN_LED_AVAILABLE, HIGH);
            digitalWrite(ChargerHardware::PIN_LED_CHARGING, LOW);
            digitalWrite(ChargerHardware::PIN_LED_ALARM, LOW);
            digitalWrite(ChargerHardware::PIN_RELAY, LOW);
            digitalWrite(ChargerHardware::PIN_BUZZER, LOW);
            break;
        case ChargerState::CHARGING:
            digitalWrite(ChargerHardware::PIN_LED_AVAILABLE, LOW);
            digitalWrite(ChargerHardware::PIN_LED_CHARGING, HIGH);
            digitalWrite(ChargerHardware::PIN_LED_ALARM, LOW);
            digitalWrite(ChargerHardware::PIN_RELAY, HIGH);
            digitalWrite(ChargerHardware::PIN_BUZZER, LOW);
            break;
        case ChargerState::TEMPERATURE_HIGH:
            digitalWrite(ChargerHardware::PIN_LED_AVAILABLE, LOW);
            digitalWrite(ChargerHardware::PIN_LED_CHARGING, LOW);
            digitalWrite(ChargerHardware::PIN_LED_ALARM, HIGH);
            digitalWrite(ChargerHardware::PIN_RELAY, LOW); // charging paused
            digitalWrite(ChargerHardware::PIN_BUZZER, LOW);
            break;
        case ChargerState::CHARGING_STOPPED:
            digitalWrite(ChargerHardware::PIN_LED_AVAILABLE, LOW);
            digitalWrite(ChargerHardware::PIN_LED_CHARGING, LOW);
            digitalWrite(ChargerHardware::PIN_LED_ALARM, HIGH);
            digitalWrite(ChargerHardware::PIN_RELAY, LOW);
            digitalWrite(ChargerHardware::PIN_BUZZER, LOW);
            break;
        case ChargerState::ALARM:
            digitalWrite(ChargerHardware::PIN_LED_AVAILABLE, LOW);
            digitalWrite(ChargerHardware::PIN_LED_CHARGING, LOW);
            digitalWrite(ChargerHardware::PIN_LED_ALARM, HIGH);
            digitalWrite(ChargerHardware::PIN_RELAY, LOW);
            digitalWrite(ChargerHardware::PIN_BUZZER, HIGH);
            break;
    }
}

void ChargerController::handleStateLogic() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateTimer_;

    switch (state_) {
        case ChargerState::AVAILABLE:
            break;

        case ChargerState::VEHICLE_CONNECTED:
            // Vehicle handshake completes automatically -> READY.
            if (elapsed >= 1000) {
                emitEvent("vehicle_ready", "HANDSHAKE_OK");
                setState(ChargerState::READY);
            }
            break;

        case ChargerState::READY:
            break;

        case ChargerState::CHARGING: {
            // Over-temperature protection (checked before energy integration).
            if (temperatureC_ >= Charging::TEMP_CRITICAL_C) {
                emitEvent("temperature_warning", "OVER_TEMPERATURE");
                emitEvent("charging_stopped", "THERMAL_CUTOUT");
                setState(ChargerState::CHARGING_STOPPED);
                break;
            }
            if (temperatureC_ >= Charging::TEMP_WARNING_C) {
                emitEvent("temperature_warning", "HIGH_TEMPERATURE");
                setState(ChargerState::TEMPERATURE_HIGH);
                break;
            }
            // Integrate charge. Clamp at 100% (never increases infinitely).
            if (lastChargeUpdate_ == 0) lastChargeUpdate_ = now;
            float dtS = static_cast<float>(now - lastChargeUpdate_) / 1000.0f;
            lastChargeUpdate_ = now;
            if (dtS < 0.0f || dtS > 1.0f) dtS = 0.05f; // guard against stale timer
            chargePercent_ += Charging::CHARGE_RATE_PCT_S * dtS;
            if (chargePercent_ >= 100.0f) {
                chargePercent_ = 100.0f;
                currentA_ = 0.0f;
                emitEvent("charging_completed", "TARGET_SOC_REACHED");
                setState(ChargerState::CHARGING_COMPLETE);
                break;
            }
            // Periodic progress events (every 10% or 5 s, whichever first).
            if ((chargePercent_ - lastProgressPct_ >= 10.0f) ||
                (now - lastProgressEvent_ >= 5000)) {
                lastProgressPct_ = chargePercent_;
                lastProgressEvent_ = now;
                emitEvent("charging_progress", "SOC_UPDATE");
            }
            break;
        }

        case ChargerState::TEMPERATURE_HIGH:
            if (temperatureC_ >= Charging::TEMP_CRITICAL_C) {
                emitEvent("temperature_warning", "OVER_TEMPERATURE");
                emitEvent("charging_stopped", "THERMAL_CUTOUT");
                setState(ChargerState::CHARGING_STOPPED);
            } else if (temperatureC_ <= Charging::TEMP_WARNING_C - Charging::TEMP_HYSTERESIS_C) {
                emitEvent("charging_started", "THERMAL_RECOVERY");
                setState(ChargerState::CHARGING);
            }
            break;

        case ChargerState::CHARGING_COMPLETE:
            break;

        case ChargerState::DISCONNECTED:
            if (elapsed >= 2000) {
                setState(ChargerState::AVAILABLE);
            }
            break;

        case ChargerState::CHARGING_STOPPED:
            // Latched until RESET or new START (if cooled down).
            break;

        case ChargerState::ALARM:
            // Latched emergency state: blink alarm LED until RESET.
            if (now - alarmBlinkTimer_ >= 300) {
                alarmBlinkTimer_ = now;
                alarmLedState_ = !alarmLedState_;
                digitalWrite(ChargerHardware::PIN_LED_ALARM, alarmLedState_ ? HIGH : LOW);
            }
            break;
    }
}

void ChargerController::update() {
    readSensors();
    handleButtonInputs();
    handleStateLogic();

    unsigned long now = millis();
    if (now - lastTelemetry_ >= Charging::TELEMETRY_INTERVAL_MS) {
        lastTelemetry_ = now;
        if (onTelemetryCallback_) {
            onTelemetryCallback_();
        }
    }
}
