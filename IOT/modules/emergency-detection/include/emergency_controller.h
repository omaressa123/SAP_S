#pragma once

#include <Arduino.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class EmergencyState {
    NORMAL,
    ALERT,
    EVACUATION,
    LOCKDOWN,
    SILENCED
};

using EmergencyEventCallback = std::function<void(const char* eventName, const char* details)>;

class EmergencyController {
public:
    EmergencyController();

    void begin();
    void update();

    void setOnEventCallback(EmergencyEventCallback callback) { onEventCallback_ = callback; }

    void commandTrigger(const char* details);
    void commandEvacuate();
    void commandLockdown();
    void commandSilence();
    bool commandReset();

    EmergencyState getState() const { return state_; }
    const char* getStateString() const;
    bool isAlarmActive() const;

private:
    void setState(EmergencyState newState);
    void emitEvent(const char* eventName, const char* details);
    void handleButtonInputs();
    void handleStateLogic();
    void updateFeedbackOutputs();

    EmergencyState state_;
    unsigned long stateTimer_;
    unsigned long blinkTimer_;
    bool blinkState_;

    int lastTriggerState_;
    int lastSilenceState_;
    int lastLockdownState_;
    int lastResetState_;
    unsigned long lastDebounceTime_;

    EmergencyEventCallback onEventCallback_;
};
