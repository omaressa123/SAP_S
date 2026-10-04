#pragma once

#include <Arduino.h>
#include <ESP32Servo.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class ParkingState {
    STAND_EMPTY,
    AIRCRAFT_DETECTED,
    APPROACHING,
    ALIGNMENT_REQUIRED,
    PARKED,
    DEPARTING,
    UNSAFE_DISTANCE,
    WARNING
};

// Callback signatures (mirror Smart Gate pattern)
using ParkingEventCallback = std::function<void(const char* eventName, const char* details)>;
using ParkingTelemetryCallback = std::function<void()>;

class ParkingController {
public:
    ParkingController();

    void begin();
    void update();

    void setOnEventCallback(ParkingEventCallback callback) { onEventCallback_ = callback; }
    void setOnTelemetryCallback(ParkingTelemetryCallback callback) { onTelemetryCallback_ = callback; }

    // External commands (from MQTT or buttons)
    void commandStartSimulation();
    void commandAircraftArrival();
    void commandAircraftDeparture();
    void commandReset();

    // State getters (for MQTT telemetry / status)
    ParkingState getState() const { return state_; }
    const char* getStateString() const;
    const char* getSafetyStatus() const;
    const char* getAircraftStatus() const;
    float getFrontDistanceCm() const { return frontDistanceCm_; }
    float getSideDistanceCm() const { return sideDistanceCm_; }

private:
    void setState(ParkingState newState);
    void emitEvent(const char* eventName, const char* details);
    void readDistanceSensors();
    void handleButtonInputs();
    void handleStateLogic();
    void updateFeedbackOutputs();

    ParkingState state_;
    float frontDistanceCm_;
    float sideDistanceCm_;
    unsigned long stateTimer_;
    unsigned long lastTelemetry_;
    unsigned long lastDebounceTime_;
    unsigned long warnBlinkTimer_;
    bool warnLedState_;
    bool simulationActive_;

    int lastArrivalBtnState_;
    int lastDepartBtnState_;
    int lastResetBtnState_;

    Servo indicatorServo_;

    ParkingEventCallback onEventCallback_;
    ParkingTelemetryCallback onTelemetryCallback_;
};
