#pragma once

#include <Arduino.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class CounterState {
    IDLE,
    SENSOR_A_TRIGGERED,
    WAITING_FOR_B,
    ENTRY_CONFIRMED,
    SENSOR_B_TRIGGERED,
    WAITING_FOR_A,
    EXIT_CONFIRMED,
    COOLDOWN
};

// Callbacks
using CounterUpdateCallback = std::function<void(uint32_t occupancy, uint32_t totalEntered, uint32_t totalExited, const char* eventType)>;
using CounterEventCallback = std::function<void(const char* eventName, const char* details)>;

class CounterController {
public:
    CounterController();

    void begin();
    void update();

    void setOnUpdateCallback(CounterUpdateCallback callback) { onUpdateCallback_ = callback; }
    void setOnEventCallback(CounterEventCallback callback) { onEventCallback_ = callback; }

    // Manual/Command overrides
    void resetCounters();
    void setOccupancy(uint32_t count);
    void simulateEntry();
    void simulateExit();

    // Getters
    uint32_t getOccupancy() const { return occupancy_; }
    uint32_t getTotalEntered() const { return totalEntered_; }
    uint32_t getTotalExited() const { return totalExited_; }
    CounterState getState() const { return state_; }
    const char* getStateString() const;

private:
    void setState(CounterState newState);
    void handleInputs();
    void handleStateTransitions();
    void triggerLedPulse(uint8_t pin);
    void updateFeedbackOutputs();

    CounterState state_;
    uint32_t occupancy_;
    uint32_t totalEntered_;
    uint32_t totalExited_;

    unsigned long stateTimer_;
    unsigned long pulseTimerEntry_;
    unsigned long pulseTimerExit_;
    bool entryPulseActive_;
    bool exitPulseActive_;

    // Button / sensor debounce
    int lastSensorAState_;
    int lastSensorBState_;
    int lastResetBtnState_;
    unsigned long lastDebounceTime_;

    CounterUpdateCallback onUpdateCallback_;
    CounterEventCallback onEventCallback_;
};
