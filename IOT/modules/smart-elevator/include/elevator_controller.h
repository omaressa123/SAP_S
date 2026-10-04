#pragma once

#include <Arduino.h>
#include <ESP32Servo.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class ElevatorState {
    IDLE,
    MOVING_UP,
    MOVING_DOWN,
    DOOR_OPEN,
    OVERLOAD,
    EMERGENCY,
    LOCKED
};

using ElevatorEventCallback = std::function<void(const char* eventName, const char* details)>;

class ElevatorController {
public:
    ElevatorController();

    void begin();
    void update();

    void setOnEventCallback(ElevatorEventCallback callback) { onEventCallback_ = callback; }

    bool commandCallUp();
    bool commandCallDown();
    bool commandOpenDoor();
    bool commandCloseDoor();
    void commandOverload(bool active);
    void commandEmergencyStop();
    bool commandReset();

    ElevatorState getState() const { return state_; }
    const char* getStateString() const;
    int getFloor() const { return floor_; }
    bool isDoorOpen() const;

private:
    void setState(ElevatorState newState);
    void emitEvent(const char* eventName, const char* details);
    void handleButtonInputs();
    void handleStateLogic();
    void updateFeedbackOutputs();

    ElevatorState state_;
    int floor_;
    bool overload_;
    unsigned long stateTimer_;
    unsigned long blinkTimer_;
    bool blinkState_;

    Servo doorServo_;

    int lastUpState_;
    int lastDownState_;
    int lastOverloadState_;
    int lastEstopState_;
    int lastResetState_;
    unsigned long lastDebounceTime_;

    ElevatorEventCallback onEventCallback_;
};
