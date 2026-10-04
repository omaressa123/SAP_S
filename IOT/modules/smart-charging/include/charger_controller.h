#pragma once

#include <Arduino.h>
#include <functional>
#include "constants.h"
#include "hardware_config.h"

enum class ChargerState {
    AVAILABLE,
    VEHICLE_CONNECTED,
    READY,
    CHARGING,
    CHARGING_COMPLETE,
    DISCONNECTED,
    TEMPERATURE_HIGH,
    CHARGING_STOPPED,
    ALARM
};

// Callback signatures (mirror Smart Gate pattern)
using ChargerEventCallback = std::function<void(const char* eventName, const char* details)>;
using ChargerTelemetryCallback = std::function<void()>;

class ChargerController {
public:
    ChargerController();

    void begin();
    void update();

    void setOnEventCallback(ChargerEventCallback callback) { onEventCallback_ = callback; }
    void setOnTelemetryCallback(ChargerTelemetryCallback callback) { onTelemetryCallback_ = callback; }

    // External commands (from MQTT or buttons)
    void commandConnectVehicle();
    void commandDisconnectVehicle();
    void commandStartCharging();
    void commandStopCharging();
    void commandEmergencyStop();
    void commandReset();

    // Getters (for MQTT telemetry / status)
    ChargerState getState() const { return state_; }
    const char* getStateString() const;
    bool isVehicleConnected() const;
    float getVoltage() const { return voltageV_; }
    float getCurrent() const { return currentA_; }
    float getPower() const { return voltageV_ * currentA_; }
    float getTemperature() const { return temperatureC_; }
    float getChargePercent() const { return chargePercent_; }

private:
    void setState(ChargerState newState);
    void emitEvent(const char* eventName, const char* details);
    void readSensors();
    void handleButtonInputs();
    void handleStateLogic();
    void updateFeedbackOutputs();

    ChargerState state_;
    float voltageV_;
    float currentA_;
    float temperatureC_;
    float chargePercent_;
    bool vehicleConnected_;

    unsigned long stateTimer_;
    unsigned long lastTelemetry_;
    unsigned long lastProgressEvent_;
    unsigned long lastChargeUpdate_;
    unsigned long lastDebounceTime_;
    unsigned long alarmBlinkTimer_;
    bool alarmLedState_;
    float lastProgressPct_;

    int lastConnectBtnState_;
    int lastStartBtnState_;
    int lastEstopBtnState_;
    int lastResetBtnState_;

    ChargerEventCallback onEventCallback_;
    ChargerTelemetryCallback onTelemetryCallback_;
};
