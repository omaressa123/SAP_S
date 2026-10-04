#include "equipment_controller.h"

using namespace AirportIoT;

EquipmentController::EquipmentController()
    : state_(EquipmentState::IDLE),
      temperatureC_(25.0f),
      vibrationMMs_(0.5f),
      currentA_(0.0f),
      runtimeS_(0),
      healthScore_(100),
      stateTimer_(0),
      lastTelemetry_(0),
      lastRuntimeTick_(0),
      lastDebounceTime_(0),
      alarmBlinkTimer_(0),
      alarmLedState_(false),
      tempWarnLatched_(false),
      vibWarnLatched_(false),
      currWarnLatched_(false),
      lastRunBtnState_(HIGH),
      lastMaintBtnState_(HIGH),
      lastResetBtnState_(HIGH),
      onEventCallback_(nullptr),
      onTelemetryCallback_(nullptr) {}

void EquipmentController::begin() {
    pinMode(EquipmentHardware::PIN_LED_RUN, OUTPUT);
    pinMode(EquipmentHardware::PIN_LED_WARNING, OUTPUT);
    pinMode(EquipmentHardware::PIN_LED_CRITICAL, OUTPUT);
    pinMode(EquipmentHardware::PIN_BUZZER, OUTPUT);

    pinMode(EquipmentHardware::PIN_RUN_BTN, INPUT_PULLUP);
    pinMode(EquipmentHardware::PIN_MAINT_BTN, INPUT_PULLUP);
    pinMode(EquipmentHardware::PIN_RESET_BTN, INPUT_PULLUP);

    digitalWrite(EquipmentHardware::PIN_LED_RUN, LOW);
    digitalWrite(EquipmentHardware::PIN_LED_WARNING, LOW);
    digitalWrite(EquipmentHardware::PIN_LED_CRITICAL, LOW);
    digitalWrite(EquipmentHardware::PIN_BUZZER, LOW);

    readSensors();
    Serial.println(F("[EQP] Equipment monitor initialized (CONVEYOR MOTOR) in IDLE"));
}

const char* EquipmentController::getStateString() const {
    switch (state_) {
        case EquipmentState::OFFLINE:              return "OFFLINE";
        case EquipmentState::IDLE:                 return "IDLE";
        case EquipmentState::RUNNING:              return "RUNNING";
        case EquipmentState::WARNING:              return "WARNING";
        case EquipmentState::CRITICAL:             return "CRITICAL";
        case EquipmentState::MAINTENANCE_REQUIRED: return "MAINTENANCE_REQUIRED";
        default:                                   return "UNKNOWN";
    }
}

const char* EquipmentController::getCondition() const {
    switch (state_) {
        case EquipmentState::CRITICAL:
        case EquipmentState::MAINTENANCE_REQUIRED:
            return "CRITICAL";
        case EquipmentState::WARNING:
            return "WARNING";
        case EquipmentState::OFFLINE:
            return "OFFLINE";
        default:
            return "HEALTHY";
    }
}

void EquipmentController::emitEvent(const char* eventName, const char* details) {
    Serial.printf("[EQP] Event: %s (%s)\n", eventName, details);
    if (onEventCallback_) {
        onEventCallback_(eventName, details);
    }
}

void EquipmentController::setState(EquipmentState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[EQP] Transitioned to state: %s\n", getStateString());
    updateFeedbackOutputs();
}

void EquipmentController::readSensors() {
    int rawT = analogRead(EquipmentHardware::PIN_TEMP_ADC);
    int rawV = analogRead(EquipmentHardware::PIN_VIBRATION_ADC);
    int rawC = analogRead(EquipmentHardware::PIN_CURRENT_ADC);
    temperatureC_ = 20.0f + (static_cast<float>(rawT) / 4095.0f) * 90.0f;  // 20..110 C
    vibrationMMs_ = (static_cast<float>(rawV) / 4095.0f) * 10.0f;         // 0..10 mm/s
    currentA_ = (static_cast<float>(rawC) / 4095.0f) * 20.0f;             // 0..20 A
}

void EquipmentController::commandStart() {
    if (state_ == EquipmentState::CRITICAL ||
        state_ == EquipmentState::MAINTENANCE_REQUIRED) {
        Serial.println(F("[EQP] Start rejected: fault latched, run MAINTENANCE then RESET"));
        return;
    }
    if (state_ == EquipmentState::RUNNING ||
        state_ == EquipmentState::WARNING) {
        return;
    }
    tempWarnLatched_ = vibWarnLatched_ = currWarnLatched_ = false;
    emitEvent("equipment_started", "CONVEYOR_RUN");
    setState(EquipmentState::RUNNING);
}

void EquipmentController::commandStop() {
    if (state_ == EquipmentState::IDLE || state_ == EquipmentState::OFFLINE) return;
    if (state_ == EquipmentState::CRITICAL ||
        state_ == EquipmentState::MAINTENANCE_REQUIRED) {
        Serial.println(F("[EQP] Stop ignored in fault state: use MAINTENANCE/RESET"));
        return;
    }
    emitEvent("equipment_stopped", "OPERATOR_STOP");
    setState(EquipmentState::IDLE);
}

void EquipmentController::commandReset() {
    Serial.println(F("[EQP] RESET command executed"));
    digitalWrite(EquipmentHardware::PIN_BUZZER, LOW);
    tempWarnLatched_ = vibWarnLatched_ = currWarnLatched_ = false;
    runtimeS_ = 0;
    healthScore_ = 100;
    emitEvent("equipment_reset", "FAULTS_CLEARED");
    setState(EquipmentState::IDLE);
}

void EquipmentController::commandMaintenance() {
    if (state_ == EquipmentState::CRITICAL) {
        emitEvent("maintenance_required", "WORK_ORDER_OPEN");
        setState(EquipmentState::MAINTENANCE_REQUIRED);
    } else if (state_ == EquipmentState::MAINTENANCE_REQUIRED) {
        // Maintenance completed -> back to IDLE with latches cleared.
        tempWarnLatched_ = vibWarnLatched_ = currWarnLatched_ = false;
        healthScore_ = 100;
        emitEvent("maintenance_completed", "RETURN_TO_SERVICE");
        setState(EquipmentState::IDLE);
    } else {
        Serial.println(F("[EQP] MAINTENANCE acknowledged (no active fault)"));
        emitEvent("maintenance_required", "PREVENTIVE_CHECK");
        setState(EquipmentState::MAINTENANCE_REQUIRED);
    }
}

void EquipmentController::handleButtonInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < Equipment::BUTTON_DEBOUNCE_MS) return;
    lastDebounceTime_ = now;

    int runBtn = digitalRead(EquipmentHardware::PIN_RUN_BTN);
    int maintBtn = digitalRead(EquipmentHardware::PIN_MAINT_BTN);
    int resetBtn = digitalRead(EquipmentHardware::PIN_RESET_BTN);

    if (runBtn == LOW && lastRunBtnState_ == HIGH) {
        if (state_ == EquipmentState::RUNNING || state_ == EquipmentState::WARNING) {
            commandStop();
        } else {
            commandStart();
        }
    }
    lastRunBtnState_ = runBtn;

    if (maintBtn == LOW && lastMaintBtnState_ == HIGH) {
        commandMaintenance();
    }
    lastMaintBtnState_ = maintBtn;

    if (resetBtn == LOW && lastResetBtnState_ == HIGH) {
        commandReset();
    }
    lastResetBtnState_ = resetBtn;
}

void EquipmentController::evaluateCondition() {
    // Threshold-based condition monitoring ONLY. No ML/prediction involved.
    bool tempCrit = temperatureC_ >= Equipment::TEMP_CRITICAL_C;
    bool vibCrit = vibrationMMs_ >= Equipment::VIBRATION_CRITICAL_G;
    bool currCrit = currentA_ >= Equipment::CURRENT_CRITICAL_A;
    bool tempWarn = temperatureC_ >= Equipment::TEMP_WARNING_C;
    bool vibWarn = vibrationMMs_ >= Equipment::VIBRATION_WARNING_G;
    bool currWarn = currentA_ >= Equipment::CURRENT_WARNING_A;

    // Edge-triggered warning events (one per excursion).
    if (tempWarn && !tempWarnLatched_) {
        tempWarnLatched_ = true;
        emitEvent("temperature_warning", "HIGH_TEMP");
    } else if (!tempWarn) {
        tempWarnLatched_ = false;
    }
    if (vibWarn && !vibWarnLatched_) {
        vibWarnLatched_ = true;
        emitEvent("vibration_warning", "HIGH_VIBRATION");
    } else if (!vibWarn) {
        vibWarnLatched_ = false;
    }
    if (currWarn && !currWarnLatched_) {
        currWarnLatched_ = true;
        emitEvent("overcurrent", "HIGH_CURRENT");
    } else if (!currWarn) {
        currWarnLatched_ = false;
    }

    // Rule-based health score 0..100 (simulated indicator, NOT an AI prediction).
    int score = 100;
    if (temperatureC_ > 40.0f) {
        score -= static_cast<int>((temperatureC_ - 40.0f) * 1.2f);
    }
    score -= static_cast<int>(vibrationMMs_ * 5.0f);
    if (currentA_ > Equipment::CURRENT_RATED_A) {
        score -= static_cast<int>((currentA_ - Equipment::CURRENT_RATED_A) * 6.0f);
    }
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    healthScore_ = score;

    if (tempCrit || vibCrit || currCrit ||
        (tempWarn && vibWarn)) { // high temp + high vibration combined
        if (state_ == EquipmentState::RUNNING || state_ == EquipmentState::WARNING) {
            emitEvent("critical_condition", "THRESHOLD_EXCEEDED");
            emitEvent("maintenance_required", "INSPECTION_DUE");
            setState(EquipmentState::CRITICAL);
        }
    } else if (tempWarn || vibWarn || currWarn) {
        if (state_ == EquipmentState::RUNNING) {
            setState(EquipmentState::WARNING);
        } else if (state_ == EquipmentState::WARNING) {
            // remain in WARNING; recover below
        }
    } else {
        if (state_ == EquipmentState::WARNING) {
            emitEvent("condition_normal", "RECOVERED");
            setState(EquipmentState::RUNNING);
        }
    }
}

void EquipmentController::updateFeedbackOutputs() {
    switch (state_) {
        case EquipmentState::OFFLINE:
        case EquipmentState::IDLE:
            digitalWrite(EquipmentHardware::PIN_LED_RUN, LOW);
            digitalWrite(EquipmentHardware::PIN_LED_WARNING, LOW);
            digitalWrite(EquipmentHardware::PIN_LED_CRITICAL, LOW);
            digitalWrite(EquipmentHardware::PIN_BUZZER, LOW);
            break;
        case EquipmentState::RUNNING:
            digitalWrite(EquipmentHardware::PIN_LED_RUN, HIGH);
            digitalWrite(EquipmentHardware::PIN_LED_WARNING, LOW);
            digitalWrite(EquipmentHardware::PIN_LED_CRITICAL, LOW);
            digitalWrite(EquipmentHardware::PIN_BUZZER, LOW);
            break;
        case EquipmentState::WARNING:
            digitalWrite(EquipmentHardware::PIN_LED_RUN, HIGH);
            digitalWrite(EquipmentHardware::PIN_LED_WARNING, HIGH);
            digitalWrite(EquipmentHardware::PIN_LED_CRITICAL, LOW);
            digitalWrite(EquipmentHardware::PIN_BUZZER, LOW);
            break;
        case EquipmentState::CRITICAL:
        case EquipmentState::MAINTENANCE_REQUIRED:
            digitalWrite(EquipmentHardware::PIN_LED_RUN, LOW);
            digitalWrite(EquipmentHardware::PIN_LED_WARNING, LOW);
            digitalWrite(EquipmentHardware::PIN_LED_CRITICAL, HIGH);
            digitalWrite(EquipmentHardware::PIN_BUZZER, HIGH);
            break;
    }
}

void EquipmentController::handleStateLogic() {
    unsigned long now = millis();

    switch (state_) {
        case EquipmentState::OFFLINE:
        case EquipmentState::IDLE:
            if (lastRuntimeTick_ == 0) lastRuntimeTick_ = now;
            break;

        case EquipmentState::RUNNING:
        case EquipmentState::WARNING:
            // Accumulate runtime only while operating.
            if (lastRuntimeTick_ == 0) lastRuntimeTick_ = now;
            if (now - lastRuntimeTick_ >= 1000) {
                lastRuntimeTick_ = now;
                runtimeS_++;
            }
            evaluateCondition();
            break;

        case EquipmentState::CRITICAL:
            // Blink critical LED + buzzer while latched.
            if (now - alarmBlinkTimer_ >= 300) {
                alarmBlinkTimer_ = now;
                alarmLedState_ = !alarmLedState_;
                digitalWrite(EquipmentHardware::PIN_LED_CRITICAL, alarmLedState_ ? HIGH : LOW);
                digitalWrite(EquipmentHardware::PIN_BUZZER, alarmLedState_ ? HIGH : LOW);
            }
            if (lastRuntimeTick_ == 0) lastRuntimeTick_ = now;
            break;

        case EquipmentState::MAINTENANCE_REQUIRED:
            digitalWrite(EquipmentHardware::PIN_BUZZER, LOW);
            if (lastRuntimeTick_ == 0) lastRuntimeTick_ = now;
            break;
    }
}

void EquipmentController::update() {
    readSensors();
    handleButtonInputs();
    handleStateLogic();

    unsigned long now = millis();
    if (now - lastTelemetry_ >= Equipment::TELEMETRY_INTERVAL_MS) {
        lastTelemetry_ = now;
        if (onTelemetryCallback_) {
            onTelemetryCallback_();
        }
    }
}
