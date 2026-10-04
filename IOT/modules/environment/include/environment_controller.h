#pragma once

#include <Arduino.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class EnvironmentState {
    NORMAL,
    COMFORT_WARNING,
    POOR_AIR
};

enum class FanMode {
    AUTO,
    FORCED_ON,
    FORCED_OFF
};

using EnvironmentEventCallback = std::function<void(const char* eventName, const char* details)>;
using EnvironmentTelemetryCallback = std::function<void()>;

class EnvironmentController {
public:
    EnvironmentController();

    void begin();
    void update();

    void setOnEventCallback(EnvironmentEventCallback callback) { onEventCallback_ = callback; }
    void setOnTelemetryCallback(EnvironmentTelemetryCallback callback) { onTelemetryCallback_ = callback; }

    void commandFanOn();
    void commandFanOff();
    void commandFanAuto();
    bool commandReset();

    EnvironmentState getState() const { return state_; }
    const char* getStateString() const;
    const char* getFanModeString() const;
    bool isFanOn() const { return fanOn_; }
    float getTemperature() const { return temperatureC_; }
    float getHumidity() const { return humidityRh_; }
    float getCo2() const { return co2Ppm_; }

private:
    void setState(EnvironmentState newState);
    void emitEvent(const char* eventName, const char* details);
    void handleButtonInputs();
    void handleStateLogic();
    void updateFeedbackOutputs();
    void readSensors();

    EnvironmentState state_;
    FanMode fanMode_;
    bool fanOn_;
    float temperatureC_;
    float humidityRh_;
    float co2Ppm_;
    unsigned long lastTelemetry_;
    unsigned long lastDebounceTime_;

    int lastFanBtnState_;
    int lastResetBtnState_;

    EnvironmentEventCallback onEventCallback_;
    EnvironmentTelemetryCallback onTelemetryCallback_;
};
