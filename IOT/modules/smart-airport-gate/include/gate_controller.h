#pragma once

#include <Arduino.h>
#include <ESP32Servo.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class GateState {
    CLOSED,
    PASSENGER_DETECTED,
    WAITING_FOR_AUTH,
    AUTHORIZED,
    DENIED,
    OPENING,
    OPEN,
    CLOSING,
    ALARM,
    LOCKED
};

// Callback signatures
using GateEventCallback = std::function<void(const char* eventName, const char* details)>;
using GateAccessCallback = std::function<void(const char* cardUid, bool authorized, const char* reason)>;

class GateController {
public:
    GateController();

    void begin();
    void update();

    // Event & Access callbacks for MQTT publishing
    void setOnEventCallback(GateEventCallback callback) { onEventCallback_ = callback; }
    void setOnAccessCallback(GateAccessCallback callback) { onAccessCallback_ = callback; }

    // External commands (from MQTT or UI)
    bool commandOpen();
    bool commandClose();
    bool commandReset();
    bool commandLock();
    bool commandUnlock();
    void simulateCardScan(const char* cardUid, bool isAuthorized);

    // State getters
    GateState getState() const { return state_; }
    const char* getStateString() const;
    bool isLocked() const { return isLocked_; }

private:
    void setState(GateState newState);
    void handleStateLogic();
    void handleButtonInputs();
    void setServoAngle(int angle);
    void updateFeedbackOutputs();

    GateState state_;
    bool isLocked_;
    unsigned long stateTimer_;
    unsigned long alarmBlinkTimer_;
    bool alarmLedState_;

    Servo gateServo_;

    // Button debounce states
    int lastPassengerBtnState_;
    int lastValidCardBtnState_;
    int lastInvalidCardBtnState_;
    int lastResetBtnState_;
    unsigned long lastDebounceTime_;

    GateEventCallback onEventCallback_;
    GateAccessCallback onAccessCallback_;
};
