#pragma once

#include <Arduino.h>
#include <ESP32Servo.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class BaggageState {
    IDLE,
    TAG_DETECTED,
    WAITING_FOR_SORT,
    SORTING,
    SORTED,
    DIVERTED,
    ALARM,
    LOCKED
};

// Callback signatures (mirror Security/Gate pattern)
using BaggageEventCallback = std::function<void(const char* eventName, const char* details)>;
using BaggageTagCallback = std::function<void(const char* tagUid, const char* result, const char* reason)>;

class BaggageController {
public:
    BaggageController();

    void begin();
    void update();

    void setOnEventCallback(BaggageEventCallback callback) { onEventCallback_ = callback; }
    void setOnTagCallback(BaggageTagCallback callback) { onTagCallback_ = callback; }

    // External commands (from MQTT or buttons)
    bool commandSort(const char* tagUid);
    bool commandDivert(const char* tagUid, const char* reason);
    bool commandLock();
    bool commandUnlock();
    bool commandReset();
    // Simulated baggage tag presentation (RFID abstraction layer).
    void simulateTagPresent(const char* tagUid);

    // Getters
    BaggageState getState() const { return state_; }
    const char* getStateString() const;
    bool isLocked() const { return isLocked_; }
    unsigned long getSortedCount() const { return sortedCount_; }
    unsigned long getDivertedCount() const { return divertedCount_; }

private:
    void setState(BaggageState newState);
    void emitEvent(const char* eventName, const char* details);
    void emitTag(const char* tagUid, const char* result, const char* reason);
    void handleButtonInputs();
    void handleStateLogic();
    void updateFeedbackOutputs();

    BaggageState state_;
    bool isLocked_;
    char currentTag_[48];
    unsigned long stateTimer_;
    unsigned long alarmBlinkTimer_;
    bool alarmLedState_;
    unsigned long sortedCount_;
    unsigned long divertedCount_;

    Servo diverterServo_;

    int lastTagBtnState_;
    int lastSortBtnState_;
    int lastDivertBtnState_;
    int lastResetBtnState_;
    unsigned long lastDebounceTime_;

    BaggageEventCallback onEventCallback_;
    BaggageTagCallback onTagCallback_;
};
