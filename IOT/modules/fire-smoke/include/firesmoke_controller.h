#pragma once

#include <Arduino.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class FireSmokeState {
    NORMAL,
    WARNING,
    CRITICAL,
    ALARM_LATCHED,
    SILENCED
};

using FireSmokeEventCallback = std::function<void(const char* eventName, const char* details)>;
using FireSmokeTelemetryCallback = std::function<void()>;

class FireSmokeController {
public:
    FireSmokeController();

    void begin();
    void update();

    void setOnEventCallback(FireSmokeEventCallback callback) { onEventCallback_ = callback; }
    void setOnTelemetryCallback(FireSmokeTelemetryCallback callback) { onTelemetryCallback_ = callback; }

    void commandTestAlarm();
    void commandSilence();
    bool commandReset();

    FireSmokeState getState() const { return state_; }
    const char* getStateString() const;
    float getSmokePpm() const { return smokePpm_; }
    float getTemperature() const { return temperatureC_; }

private:
    void setState(FireSmokeState newState);
    void emitEvent(const char* eventName, const char* details);
    void handleButtonInputs();
    void handleStateLogic();
    void updateFeedbackOutputs();
    void readSensors();

    FireSmokeState state_;
    float smokePpm_;
    float temperatureC_;
    unsigned long stateTimer_;
    unsigned long lastTelemetry_;
    unsigned long lastDebounceTime_;
    unsigned long blinkTimer_;
    bool blinkState_;

    int lastTestState_;
    int lastSilenceState_;
    int lastResetState_;

    FireSmokeEventCallback onEventCallback_;
    FireSmokeTelemetryCallback onTelemetryCallback_;
};
