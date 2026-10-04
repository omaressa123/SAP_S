#pragma once

#include <Arduino.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class EquipmentState {
    OFFLINE,
    IDLE,
    RUNNING,
    WARNING,
    CRITICAL,
    MAINTENANCE_REQUIRED
};

// Callback signatures (mirror Smart Gate pattern)
using EquipmentEventCallback = std::function<void(const char* eventName, const char* details)>;
using EquipmentTelemetryCallback = std::function<void()>;

class EquipmentController {
public:
    EquipmentController();

    void begin();
    void update();

    void setOnEventCallback(EquipmentEventCallback callback) { onEventCallback_ = callback; }
    void setOnTelemetryCallback(EquipmentTelemetryCallback callback) { onTelemetryCallback_ = callback; }

    // External commands (from MQTT or buttons)
    void commandStart();
    void commandStop();
    void commandReset();
    void commandMaintenance();

    // Getters (for MQTT telemetry / status)
    EquipmentState getState() const { return state_; }
    const char* getStateString() const;
    // Rule-based condition indicator (threshold logic ONLY - NOT an AI prediction).
    const char* getCondition() const;
    // Simulated rule-based health score 0..100 (NOT an AI prediction).
    int getHealthScore() const { return healthScore_; }
    float getTemperature() const { return temperatureC_; }
    float getVibration() const { return vibrationMMs_; }
    float getCurrent() const { return currentA_; }
    unsigned long getRuntimeS() const { return runtimeS_; }

private:
    void setState(EquipmentState newState);
    void emitEvent(const char* eventName, const char* details);
    void readSensors();
    void handleButtonInputs();
    void handleStateLogic();
    void evaluateCondition();
    void updateFeedbackOutputs();

    EquipmentState state_;
    float temperatureC_;
    float vibrationMMs_;
    float currentA_;
    unsigned long runtimeS_;
    int healthScore_;

    unsigned long stateTimer_;
    unsigned long lastTelemetry_;
    unsigned long lastRuntimeTick_;
    unsigned long lastDebounceTime_;
    unsigned long alarmBlinkTimer_;
    bool alarmLedState_;

    bool tempWarnLatched_;
    bool vibWarnLatched_;
    bool currWarnLatched_;

    int lastRunBtnState_;
    int lastMaintBtnState_;
    int lastResetBtnState_;

    EquipmentEventCallback onEventCallback_;
    EquipmentTelemetryCallback onTelemetryCallback_;
};
