#include "counter_controller.h"

CounterController::CounterController()
    : state_(CounterState::IDLE),
      occupancy_(0),
      totalEntered_(0),
      totalExited_(0),
      stateTimer_(0),
      pulseTimerEntry_(0),
      pulseTimerExit_(0),
      entryPulseActive_(false),
      exitPulseActive_(false),
      lastSensorAState_(HIGH),
      lastSensorBState_(HIGH),
      lastResetBtnState_(HIGH),
      lastDebounceTime_(0),
      onUpdateCallback_(nullptr),
      onEventCallback_(nullptr) {}

void CounterController::begin() {
    pinMode(CounterHardware::PIN_SENSOR_A, INPUT_PULLUP);
    pinMode(CounterHardware::PIN_SENSOR_B, INPUT_PULLUP);
    pinMode(CounterHardware::PIN_RESET_BTN, INPUT_PULLUP);

    pinMode(CounterHardware::PIN_LED_ENTRY, OUTPUT);
    pinMode(CounterHardware::PIN_LED_EXIT, OUTPUT);
    pinMode(CounterHardware::PIN_LED_STATUS, OUTPUT);
    pinMode(CounterHardware::PIN_BUZZER, OUTPUT);

    digitalWrite(CounterHardware::PIN_LED_ENTRY, LOW);
    digitalWrite(CounterHardware::PIN_LED_EXIT, LOW);
    digitalWrite(CounterHardware::PIN_LED_STATUS, HIGH); // System online
    digitalWrite(CounterHardware::PIN_BUZZER, LOW);

    Serial.println(F("[COUNTER] Passenger counter initialized in IDLE state"));
}

const char* CounterController::getStateString() const {
    switch (state_) {
        case CounterState::IDLE:               return "IDLE";
        case CounterState::SENSOR_A_TRIGGERED: return "SENSOR_A_TRIGGERED";
        case CounterState::WAITING_FOR_B:      return "WAITING_FOR_B";
        case CounterState::ENTRY_CONFIRMED:    return "ENTRY_CONFIRMED";
        case CounterState::SENSOR_B_TRIGGERED: return "SENSOR_B_TRIGGERED";
        case CounterState::WAITING_FOR_A:      return "WAITING_FOR_A";
        case CounterState::EXIT_CONFIRMED:     return "EXIT_CONFIRMED";
        case CounterState::COOLDOWN:           return "COOLDOWN";
        default:                               return "UNKNOWN";
    }
}

void CounterController::setState(CounterState newState) {
    if (state_ == newState) return;
    state_ = newState;
    stateTimer_ = millis();
    Serial.printf("[COUNTER] State -> %s\n", getStateString());
}

void CounterController::resetCounters() {
    occupancy_ = 0;
    totalEntered_ = 0;
    totalExited_ = 0;
    setState(CounterState::IDLE);
    Serial.println(F("[COUNTER] Counters reset to zero"));
    if (onEventCallback_) {
        onEventCallback_("counters_reset", "MANUAL_OR_COMMAND");
    }
    if (onUpdateCallback_) {
        onUpdateCallback_(occupancy_, totalEntered_, totalExited_, "reset");
    }
}

void CounterController::setOccupancy(uint32_t count) {
    occupancy_ = count;
    Serial.printf("[COUNTER] Occupancy set to %u\n", count);
    if (onUpdateCallback_) {
        onUpdateCallback_(occupancy_, totalEntered_, totalExited_, "set_occupancy");
    }
}

void CounterController::simulateEntry() {
    occupancy_++;
    totalEntered_++;
    Serial.printf("[COUNTER] Entry: Occupancy=%u, Entered=%u, Exited=%u\n", occupancy_, totalEntered_, totalExited_);
    
    // Feedback
    digitalWrite(CounterHardware::PIN_LED_ENTRY, HIGH);
    digitalWrite(CounterHardware::PIN_BUZZER, HIGH);
    entryPulseActive_ = true;
    pulseTimerEntry_ = millis();

    if (onEventCallback_) {
        onEventCallback_("passenger_entered", "DIRECTION_A_TO_B");
    }
    if (onUpdateCallback_) {
        onUpdateCallback_(occupancy_, totalEntered_, totalExited_, "passenger_entered");
    }
    setState(CounterState::COOLDOWN);
}

void CounterController::simulateExit() {
    if (occupancy_ > 0) {
        occupancy_--;
    } else {
        occupancy_ = 0; // Guard against negative occupancy
    }
    totalExited_++;
    Serial.printf("[COUNTER] Exit: Occupancy=%u, Entered=%u, Exited=%u\n", occupancy_, totalEntered_, totalExited_);

    // Feedback
    digitalWrite(CounterHardware::PIN_LED_EXIT, HIGH);
    digitalWrite(CounterHardware::PIN_BUZZER, HIGH);
    exitPulseActive_ = true;
    pulseTimerExit_ = millis();

    if (onEventCallback_) {
        onEventCallback_("passenger_exited", "DIRECTION_B_TO_A");
    }
    if (onUpdateCallback_) {
        onUpdateCallback_(occupancy_, totalEntered_, totalExited_, "passenger_exited");
    }
    setState(CounterState::COOLDOWN);
}

void CounterController::handleInputs() {
    unsigned long now = millis();
    if (now - lastDebounceTime_ < AirportIoT::Counter::SENSOR_DEBOUNCE_MS) {
        return;
    }
    lastDebounceTime_ = now;

    int sensorA = digitalRead(CounterHardware::PIN_SENSOR_A);
    int sensorB = digitalRead(CounterHardware::PIN_SENSOR_B);
    int resetBtn = digitalRead(CounterHardware::PIN_RESET_BTN);

    // Reset button
    if (resetBtn == LOW && lastResetBtnState_ == HIGH) {
        resetCounters();
    }
    lastResetBtnState_ = resetBtn;

    // Sensor A transition (active LOW)
    if (sensorA == LOW && lastSensorAState_ == HIGH) {
        if (state_ == CounterState::IDLE) {
            Serial.println(F("[COUNTER] Sensor A triggered -> Waiting for Sensor B (Entry Flow)"));
            if (onEventCallback_) {
                onEventCallback_("sensor_a_triggered", "ENTRY_STARTED");
            }
            setState(CounterState::WAITING_FOR_B);
        } else if (state_ == CounterState::WAITING_FOR_A) {
            // Sensor B was triggered first, now Sensor A is triggered -> Passenger Exit Confirmed!
            simulateExit();
        }
    }
    lastSensorAState_ = sensorA;

    // Sensor B transition (active LOW)
    if (sensorB == LOW && lastSensorBState_ == HIGH) {
        if (state_ == CounterState::IDLE) {
            Serial.println(F("[COUNTER] Sensor B triggered -> Waiting for Sensor A (Exit Flow)"));
            if (onEventCallback_) {
                onEventCallback_("sensor_b_triggered", "EXIT_STARTED");
            }
            setState(CounterState::WAITING_FOR_A);
        } else if (state_ == CounterState::WAITING_FOR_B) {
            // Sensor A was triggered first, now Sensor B is triggered -> Passenger Entry Confirmed!
            simulateEntry();
        }
    }
    lastSensorBState_ = sensorB;
}

void CounterController::handleStateTransitions() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateTimer_;

    // Handle LED / Buzzer pulse turn-off
    if (entryPulseActive_ && (now - pulseTimerEntry_ >= 300)) {
        digitalWrite(CounterHardware::PIN_LED_ENTRY, LOW);
        digitalWrite(CounterHardware::PIN_BUZZER, LOW);
        entryPulseActive_ = false;
    }
    if (exitPulseActive_ && (now - pulseTimerExit_ >= 300)) {
        digitalWrite(CounterHardware::PIN_LED_EXIT, LOW);
        digitalWrite(CounterHardware::PIN_BUZZER, LOW);
        exitPulseActive_ = false;
    }

    switch (state_) {
        case CounterState::IDLE:
            break;

        case CounterState::WAITING_FOR_B:
        case CounterState::WAITING_FOR_A:
            // Timeout if second sensor is not tripped in time
            if (elapsed >= AirportIoT::Counter::DIRECTION_TIMEOUT_MS) {
                Serial.println(F("[COUNTER] Transit timeout. Returning to IDLE"));
                if (onEventCallback_) {
                    onEventCallback_("transit_timeout", "ABORTED_OR_TURNED_BACK");
                }
                setState(CounterState::IDLE);
            }
            break;

        case CounterState::ENTRY_CONFIRMED:
        case CounterState::EXIT_CONFIRMED:
            setState(CounterState::COOLDOWN);
            break;

        case CounterState::COOLDOWN:
            if (elapsed >= AirportIoT::Counter::SENSOR_COOLDOWN_MS) {
                setState(CounterState::IDLE);
            }
            break;

        default:
            break;
    }
}

void CounterController::update() {
    handleInputs();
    handleStateTransitions();
}
