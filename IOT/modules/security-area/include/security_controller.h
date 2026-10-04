#pragma once

#include <Arduino.h>
#include <ESP32Servo.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class SecurityState {
    IDLE,
    PERSON_DETECTED,
    WAITING_FOR_AUTH,
    AUTHORIZED,
    GATE_OPENING,
    ACCESS_GRANTED,
    GATE_CLOSING,
    ACCESS_DENIED,
    ALARM,
    EMERGENCY,
    LOCKED
};

// Callback signatures (mirror Smart Gate pattern)
using SecurityEventCallback = std::function<void(const char* eventName, const char* details)>;
using SecurityAccessCallback = std::function<void(const char* cardUid, bool authorized, const char* reason)>;

class SecurityController {
public:
    SecurityController();

    void begin();
    void update();

    void setOnEventCallback(SecurityEventCallback callback) { onEventCallback_ = callback; }
    void setOnAccessCallback(SecurityAccessCallback callback) { onAccessCallback_ = callback; }

    // External commands (from MQTT or buttons)
    bool commandOpen();
    bool commandClose();
    bool commandLock();
    bool commandUnlock();
    bool commandReset();
    void commandEmergencyStop();
    // Backend/AI authorization decision for the waiting person/card.
    void commandAuthorize(const char* cardUid, bool authorized);
    // Simulated access-card presentation (RFID abstraction layer).
    void simulateCardPresent(const char* cardUid, bool isAuthorized);

    // Getters
    SecurityState getState() const { return state_; }
    const char* getStateString() const;
    bool isLocked() const { return isLocked_; }
    bool isGateOpen() const;
    bool isPersonPresent() const { return personPresent_; }

private:
    void setState(SecurityState newState);
    void emitEvent(const char* eventName, const char* details);
    void emitAccess(const char* cardUid, bool authorized, const char* reason);
    void handleButtonInputs();
    void handleStateLogic();
    void updateFeedbackOutputs();

    SecurityState state_;
    bool isLocked_;
    bool personPresent_;
    unsigned long stateTimer_;
    unsigned long alarmBlinkTimer_;
    bool alarmLedState_;

    Servo gateServo_;

    int lastPersonBtnState_;
    int lastValidCardBtnState_;
    int lastInvalidCardBtnState_;
    int lastEstopBtnState_;
    int lastResetBtnState_;
    unsigned long lastDebounceTime_;

    SecurityEventCallback onEventCallback_;
    SecurityAccessCallback onAccessCallback_;
};
