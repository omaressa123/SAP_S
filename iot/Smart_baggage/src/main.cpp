#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

#include "constants.h"
#include "Device_config.h"
#include "Mqtt_topics.h"

// =====================================================
// DEVICE CONFIGURATION
// =====================================================

#define DEVICE_ID "BAGGAGE-01"

#define DHT_PIN 4
#define DHT_TYPE DHT22

#define WEIGHT_PIN 34

#define MPU_SDA 21
#define MPU_SCL 22

#define RFID_SS_PIN 5
#define RFID_RST_PIN 27

#define MAX_WEIGHT_KG 23.0
#define IMPACT_THRESHOLD 2.5

// =====================================================
// AUTOMATIC DEMO SETTINGS
// =====================================================

#define AUTO_DEMO true

// Time between route steps
const unsigned long ROUTE_STEP_INTERVAL = 5000;

// Time before starting the automatic demo
const unsigned long DEMO_START_DELAY = 3000;

// Time to wait after normal route before misroute demo
const unsigned long MISROUTE_START_DELAY = 7000;

// Time to wait after misroute before restarting
const unsigned long DEMO_RESET_DELAY = 8000;

// =====================================================
// OBJECTS
// =====================================================

DHT dht(DHT_PIN, DHT_TYPE);

Adafruit_MPU6050 mpu;

MFRC522 rfid(
    RFID_SS_PIN,
    RFID_RST_PIN
);

WiFiClient espClient;

PubSubClient mqttClient(
    espClient
);

// =====================================================
// MQTT TOPICS
// =====================================================

String statusTopic;
String eventTopic;
String heartbeatTopic;

// =====================================================
// TIMERS
// =====================================================

unsigned long lastWiFiAttempt = 0;
unsigned long lastMQTTAttempt = 0;

unsigned long lastPublish = 0;
unsigned long lastHeartbeat = 0;

unsigned long demoStartTime = 0;
unsigned long lastRouteChange = 0;

const unsigned long SENSOR_PUBLISH_INTERVAL = 3000;

// =====================================================
// BAG DATA
// =====================================================

String bagId = "BAG-1024";

String flightNumber = "MS123";

String currentZone = "BAG_DROP";

String currentStatus = "WAITING";

bool bagDetected = false;

// =====================================================
// ROUTE
// =====================================================

const char* expectedRoute[] =
{
    "BAG_DROP",
    "SECURITY",
    "SORTING",
    "GATE_A",
    "AIRCRAFT"
};

const int ROUTE_LENGTH = 5;

int currentRouteIndex = 0;

// =====================================================
// DEMO STATE
// =====================================================

enum DemoState
{
    DEMO_START,
    NORMAL_ROUTE,
    NORMAL_COMPLETE,
    MISROUTE_ROUTE,
    MISROUTE_COMPLETE,
    DEMO_RESET
};

DemoState demoState = DEMO_START;

// =====================================================
// FUNCTION DECLARATIONS
// =====================================================

void connectWiFi();

void connectMQTT();

void publishStatus();

void publishHeartbeat();

void publishEvent(
    const char* eventName
);

float readWeight();

float readTemperature();

bool detectMovement();

bool detectImpact();

void checkRFID();

void changeZone(
    String newZone
);

bool isValidZone(
    String zone
);

int getRouteIndex(
    String zone
);

void publishMisrouteAlert(
    String expectedZone,
    String actualZone
);

void runAutomaticDemo();

void resetBagDemo();

// =====================================================
// SETUP
// =====================================================

void setup()
{
    Serial.begin(115200);

    delay(1000);

    Serial.println();
    Serial.println("========================================");
    Serial.println("       SMART AIRPORT BAGGAGE IoT");
    Serial.println("========================================");

    // -------------------------------------------------
    // DHT22
    // -------------------------------------------------

    dht.begin();

    Serial.println("[OK] DHT22 initialized");

    // -------------------------------------------------
    // MPU6050
    // -------------------------------------------------

    Wire.begin(
        MPU_SDA,
        MPU_SCL
    );

    if (!mpu.begin())
    {
        Serial.println(
            "[ERROR] MPU6050 not found!"
        );
    }
    else
    {
        Serial.println(
            "[OK] MPU6050 initialized"
        );

        mpu.setAccelerometerRange(
            MPU6050_RANGE_8_G
        );

        mpu.setGyroRange(
            MPU6050_RANGE_500_DEG
        );

        mpu.setFilterBandwidth(
            MPU6050_BAND_21_HZ
        );
    }

    // -------------------------------------------------
    // RFID
    // -------------------------------------------------

    SPI.begin();

    rfid.PCD_Init();

    Serial.println(
        "[OK] RC522 RFID initialized"
    );

    // -------------------------------------------------
    // WEIGHT
    // -------------------------------------------------

    pinMode(
        WEIGHT_PIN,
        INPUT
    );

    Serial.println(
        "[OK] Weight sensor initialized"
    );

    // -------------------------------------------------
    // MQTT TOPICS
    // -------------------------------------------------

    statusTopic =
        AirportIoT::Topics::buildTopic(
            AirportIoT::Topics::MODULE_BAGGAGE,
            DEVICE_ID,
            AirportIoT::Topics::SUFFIX_STATUS
        );

    eventTopic =
        AirportIoT::Topics::buildTopic(
            AirportIoT::Topics::MODULE_BAGGAGE,
            DEVICE_ID,
            AirportIoT::Topics::SUFFIX_EVENT
        );

    heartbeatTopic =
        AirportIoT::Topics::buildHeartbeatTopic(
            DEVICE_ID
        );

    Serial.println();
    Serial.println("MQTT Topics:");

    Serial.println(statusTopic);
    Serial.println(eventTopic);
    Serial.println(heartbeatTopic);

    // -------------------------------------------------
    // WIFI
    // -------------------------------------------------

    WiFi.mode(WIFI_STA);

    connectWiFi();

    // -------------------------------------------------
    // MQTT
    // -------------------------------------------------

    mqttClient.setServer(
        MQTT_HOST,
        MQTT_PORT
    );

    Serial.println();
    Serial.println("========================================");
    Serial.println("SETUP COMPLETE");
    Serial.println("========================================");

    Serial.println();
    Serial.println(
        "[DEMO] Automatic baggage simulation enabled"
    );

    Serial.println(
        "[DEMO] No Serial commands required"
    );

    Serial.println();

    demoStartTime = millis();

    lastRouteChange = millis();
}

// =====================================================
// WIFI
// =====================================================

void connectWiFi()
{
    if (WiFi.status() == WL_CONNECTED)
        return;

    Serial.println(
        "[WiFi] Connecting..."
    );

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );

    unsigned long startAttempt =
        millis();

    while (
        WiFi.status() != WL_CONNECTED &&
        millis() - startAttempt < 10000
    )
    {
        delay(500);

        Serial.print(".");
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println(
            "[WiFi] Connected!"
        );

        Serial.print(
            "[WiFi] IP: "
        );

        Serial.println(
            WiFi.localIP()
        );
    }
    else
    {
        Serial.println(
            "[WiFi] Connection failed"
        );
    }
}

// =====================================================
// MQTT
// =====================================================

void connectMQTT()
{
    if (mqttClient.connected())
        return;

    Serial.println(
        "[MQTT] Connecting..."
    );

    String clientId =
        String(DEVICE_ID) +
        "-" +
        String(random(0xffff), HEX);

    bool connected;

    if (strlen(MQTT_USER) > 0)
    {
        connected =
            mqttClient.connect(
                clientId.c_str(),
                MQTT_USER,
                MQTT_PASS
            );
    }
    else
    {
        connected =
            mqttClient.connect(
                clientId.c_str()
            );
    }

    if (connected)
    {
        Serial.println(
            "[MQTT] Connected!"
        );

        Serial.print(
            "[MQTT] Status: "
        );

        Serial.println(
            statusTopic
        );

        Serial.print(
            "[MQTT] Event: "
        );

        Serial.println(
            eventTopic
        );

        Serial.print(
            "[MQTT] Heartbeat: "
        );

        Serial.println(
            heartbeatTopic
        );
    }
    else
    {
        Serial.print(
            "[MQTT] Failed. State = "
        );

        Serial.println(
            mqttClient.state()
        );
    }
}

// =====================================================
// WEIGHT
// =====================================================

float readWeight()
{
    int adcValue =
        analogRead(
            WEIGHT_PIN
        );

    float weight =
        (adcValue / 4095.0) * 30.0;

    return weight;
}

// =====================================================
// TEMPERATURE
// =====================================================

float readTemperature()
{
    float temperature =
        dht.readTemperature();

    if (isnan(temperature))
    {
        return -1.0;
    }

    return temperature;
}

// =====================================================
// MOVEMENT
// =====================================================

bool detectMovement()
{
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;

    mpu.getEvent(
        &accel,
        &gyro,
        &temp
    );

    float magnitude =
        sqrt(
            accel.acceleration.x *
            accel.acceleration.x +

            accel.acceleration.y *
            accel.acceleration.y +

            accel.acceleration.z *
            accel.acceleration.z
        );

    float difference =
        fabs(
            magnitude - 9.81
        );

    return difference > 0.5;
}

// =====================================================
// IMPACT
// =====================================================

bool detectImpact()
{
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;

    mpu.getEvent(
        &accel,
        &gyro,
        &temp
    );

    float magnitude =
        sqrt(
            accel.acceleration.x *
            accel.acceleration.x +

            accel.acceleration.y *
            accel.acceleration.y +

            accel.acceleration.z *
            accel.acceleration.z
        );

    float difference =
        fabs(
            magnitude - 9.81
        );

    return difference >
           IMPACT_THRESHOLD;
}

// =====================================================
// RFID
// =====================================================

void checkRFID()
{
    if (!rfid.PICC_IsNewCardPresent())
        return;

    if (!rfid.PICC_ReadCardSerial())
        return;

    Serial.println();
    Serial.println(
        "========================================"
    );

    Serial.println(
        "[RFID] BAG DETECTED"
    );

    Serial.println(
        "========================================"
    );

    Serial.print(
        "[RFID] UID: "
    );

    for (
        byte i = 0;
        i < rfid.uid.size;
        i++
    )
    {
        if (
            rfid.uid.uidByte[i] < 0x10
        )
        {
            Serial.print("0");
        }

        Serial.print(
            rfid.uid.uidByte[i],
            HEX
        );

        Serial.print(" ");
    }

    Serial.println();

    bagDetected = true;

    currentStatus = "ACCEPTED";

    publishEvent(
        "BAG_DETECTED"
    );

    rfid.PICC_HaltA();

    rfid.PCD_StopCrypto1();
}

// =====================================================
// VALIDATE ZONE
// =====================================================

bool isValidZone(
    String zone
)
{
    if (zone == "BAG_DROP")
        return true;

    if (zone == "SECURITY")
        return true;

    if (zone == "SORTING")
        return true;

    if (zone == "GATE_A")
        return true;

    if (zone == "GATE_B")
        return true;

    if (zone == "AIRCRAFT")
        return true;

    return false;
}

// =====================================================
// GET ROUTE INDEX
// =====================================================

int getRouteIndex(
    String zone
)
{
    for (
        int i = 0;
        i < ROUTE_LENGTH;
        i++
    )
    {
        if (
            zone == expectedRoute[i]
        )
        {
            return i;
        }
    }

    return -1;
}

// =====================================================
// CHANGE ZONE
// =====================================================

void changeZone(
    String newZone
)
{
    newZone.trim();

    newZone.toUpperCase();

    if (!isValidZone(newZone))
    {
        Serial.println(
            "[ROUTE] Invalid zone!"
        );

        return;
    }

    Serial.println();
    Serial.println(
        "========================================"
    );

    Serial.println(
        "[ROUTE] BAG MOVEMENT"
    );

    Serial.println(
        "========================================"
    );

    Serial.print(
        "Previous Zone : "
    );

    Serial.println(
        currentZone
    );

    Serial.print(
        "New Zone      : "
    );

    Serial.println(
        newZone
    );

    // -------------------------------------------------
    // GATE B = intentional wrong route
    // -------------------------------------------------

    if (newZone == "GATE_B")
    {
        String expectedZone;

        if (
            currentRouteIndex <
            ROUTE_LENGTH - 1
        )
        {
            expectedZone =
                expectedRoute[
                    currentRouteIndex + 1
                ];
        }
        else
        {
            expectedZone =
                "NONE";
        }

        currentZone =
            newZone;

        currentStatus =
            "MISROUTED";

        Serial.println();
        Serial.println(
            "!!!!!!!! ROUTE ALERT !!!!!!!!"
        );

        Serial.println(
            "[ROUTE] MISROUTED BAGGAGE"
        );

        Serial.print(
            "Expected : "
        );

        Serial.println(
            expectedZone
        );

        Serial.print(
            "Actual   : "
        );

        Serial.println(
            newZone
        );

        publishMisrouteAlert(
            expectedZone,
            newZone
        );

        Serial.println(
            "========================================"
        );

        return;
    }

    int newIndex =
        getRouteIndex(
            newZone
        );

    // -------------------------------------------------
    // Correct route
    // -------------------------------------------------

    if (
        newIndex ==
        currentRouteIndex + 1
    )
    {
        currentZone =
            newZone;

        currentRouteIndex =
            newIndex;

        currentStatus =
            "MOVING";

        Serial.println(
            "[ROUTE] CORRECT ROUTE"
        );

        publishEvent(
            "BAG_ZONE_CHANGED"
        );
    }

    // -------------------------------------------------
    // Same zone
    // -------------------------------------------------

    else if (
        newIndex ==
        currentRouteIndex
    )
    {
        Serial.println(
            "[ROUTE] BAG IS ALREADY IN THIS ZONE"
        );
    }

    // -------------------------------------------------
    // Wrong route
    // -------------------------------------------------

    else
    {
        String expectedZone;

        if (
            currentRouteIndex <
            ROUTE_LENGTH - 1
        )
        {
            expectedZone =
                expectedRoute[
                    currentRouteIndex + 1
                ];
        }
        else
        {
            expectedZone =
                "NONE";
        }

        currentZone =
            newZone;

        currentStatus =
            "MISROUTED";

        Serial.println(
            "[ROUTE] MISROUTED BAGGAGE"
        );

        Serial.print(
            "Expected : "
        );

        Serial.println(
            expectedZone
        );

        Serial.print(
            "Actual   : "
        );

        Serial.println(
            newZone
        );

        publishMisrouteAlert(
            expectedZone,
            newZone
        );
    }

    Serial.println(
        "========================================"
    );
}

// =====================================================
// MISROUTE ALERT
// =====================================================

void publishMisrouteAlert(
    String expectedZone,
    String actualZone
)
{
    if (!mqttClient.connected())
        return;

    JsonDocument doc;

    doc["bag_id"] =
        bagId;

    doc["device_id"] =
        DEVICE_ID;

    doc["flight"] =
        flightNumber;

    doc["event"] =
        "MISROUTED_BAGGAGE";

    doc["expected_zone"] =
        expectedZone;

    doc["actual_zone"] =
        actualZone;

    doc["status"] =
        "MISROUTED";

    String payload;

    serializeJson(
        doc,
        payload
    );

    mqttClient.publish(
        eventTopic.c_str(),
        payload.c_str()
    );

    Serial.print(
        "[MQTT MISROUTE ALERT] "
    );

    Serial.println(
        payload
    );
}

// =====================================================
// STATUS
// =====================================================

void publishStatus()
{
    if (!mqttClient.connected())
        return;

    float weight =
        readWeight();

    float temperature =
        readTemperature();

    bool moving =
        detectMovement();

    bool impact =
        detectImpact();

    // -------------------------------------------------
    // Status Logic
    // -------------------------------------------------

    if (
        currentStatus ==
        "MISROUTED"
    )
    {
        // Keep MISROUTED
    }
    else if (impact)
    {
        currentStatus =
            "ALERT";
    }
    else if (
        weight > MAX_WEIGHT_KG
    )
    {
        currentStatus =
            "OVERWEIGHT";
    }
    else if (moving)
    {
        currentStatus =
            "MOVING";
    }
    else if (bagDetected)
    {
        currentStatus =
            "ACCEPTED";
    }
    else
    {
        currentStatus =
            "WAITING";
    }

    // -------------------------------------------------
    // JSON
    // -------------------------------------------------

    JsonDocument doc;

    doc["bag_id"] =
        bagId;

    doc["device_id"] =
        DEVICE_ID;

    doc["flight"] =
        flightNumber;

    doc["zone"] =
        currentZone;

    doc["status"] =
        currentStatus;

    doc["weight"] =
        weight;

    if (temperature >= 0)
    {
        doc["temperature"] =
            temperature;
    }
    else
    {
        doc["temperature"] =
            nullptr;
    }

    doc["moving"] =
        moving;

    doc["impact"] =
        impact;

    String payload;

    serializeJson(
        doc,
        payload
    );

    mqttClient.publish(
        statusTopic.c_str(),
        payload.c_str()
    );

    // -------------------------------------------------
    // SERIAL OUTPUT
    // -------------------------------------------------

    Serial.println();
    Serial.println(
        "----------- BAG STATUS -----------"
    );

    Serial.print(
        "Bag ID       : "
    );

    Serial.println(
        bagId
    );

    Serial.print(
        "Flight       : "
    );

    Serial.println(
        flightNumber
    );

    Serial.print(
        "Zone         : "
    );

    Serial.println(
        currentZone
    );

    Serial.print(
        "Status       : "
    );

    Serial.println(
        currentStatus
    );

    Serial.print(
        "Weight       : "
    );

    Serial.print(
        weight,
        2
    );

    Serial.println(
        " kg"
    );

    Serial.print(
        "Temperature  : "
    );

    if (temperature >= 0)
    {
        Serial.print(
            temperature,
            2
        );
    }
    else
    {
        Serial.print(
            "N/A"
        );
    }

    Serial.println(
        " C"
    );

    Serial.print(
        "Moving       : "
    );

    Serial.println(
        moving ? "YES" : "NO"
    );

    Serial.print(
        "Impact       : "
    );

    Serial.println(
        impact ? "YES" : "NO"
    );

    Serial.println(
        "---------------------------------"
    );

    Serial.print(
        "MQTT JSON: "
    );

    Serial.println(
        payload
    );
}

// =====================================================
// EVENT
// =====================================================

void publishEvent(
    const char* eventName
)
{
    if (!mqttClient.connected())
        return;

    JsonDocument doc;

    doc["bag_id"] =
        bagId;

    doc["device_id"] =
        DEVICE_ID;

    doc["flight"] =
        flightNumber;

    doc["zone"] =
        currentZone;

    doc["event"] =
        eventName;

    String payload;

    serializeJson(
        doc,
        payload
    );

    mqttClient.publish(
        eventTopic.c_str(),
        payload.c_str()
    );

    Serial.print(
        "[EVENT] "
    );

    Serial.println(
        payload
    );
}

// =====================================================
// HEARTBEAT
// =====================================================

void publishHeartbeat()
{
    if (!mqttClient.connected())
        return;

    JsonDocument doc;

    doc["device_id"] =
        DEVICE_ID;

    doc["status"] =
        AirportIoT::Status::ONLINE;

    doc["zone"] =
        currentZone;

    doc["uptime_ms"] =
        millis();

    String payload;

    serializeJson(
        doc,
        payload
    );

    mqttClient.publish(
        heartbeatTopic.c_str(),
        payload.c_str()
    );

    Serial.print(
        "[HEARTBEAT] "
    );

    Serial.println(
        payload
    );
}

// =====================================================
// RESET DEMO
// =====================================================

void resetBagDemo()
{
    Serial.println();
    Serial.println(
        "========================================"
    );

    Serial.println(
        "[DEMO] RESETTING BAG SIMULATION"
    );

    Serial.println(
        "========================================"
    );

    currentZone =
        "BAG_DROP";

    currentRouteIndex =
        0;

    currentStatus =
        "WAITING";

    bagDetected =
        false;

    demoState =
        DEMO_START;

    demoStartTime =
        millis();

    lastRouteChange =
        millis();
}

// =====================================================
// AUTOMATIC DEMO
// =====================================================

void runAutomaticDemo()
{
    if (!AUTO_DEMO)
        return;

    unsigned long now =
        millis();

    // -------------------------------------------------
    // START
    // -------------------------------------------------

    if (
        demoState ==
        DEMO_START
    )
    {
        if (
            now - demoStartTime >=
            DEMO_START_DELAY
        )
        {
            Serial.println();
            Serial.println(
                "========================================"
            );

            Serial.println(
                "🧳 BAGGAGE DEMO STARTED"
            );

            Serial.println(
                "========================================"
            );

            bagDetected =
                true;

            currentStatus =
                "ACCEPTED";

            publishEvent(
                "BAG_DETECTED"
            );

            publishStatus();

            demoState =
                NORMAL_ROUTE;

            lastRouteChange =
                now;
        }

        return;
    }

    // -------------------------------------------------
    // NORMAL ROUTE
    // -------------------------------------------------

    if (
        demoState ==
        NORMAL_ROUTE
    )
    {
        if (
            now - lastRouteChange >=
            ROUTE_STEP_INTERVAL
        )
        {
            lastRouteChange =
                now;

            if (
                currentRouteIndex <
                ROUTE_LENGTH - 1
            )
            {
                String nextZone =
                    expectedRoute[
                        currentRouteIndex + 1
                    ];

                changeZone(
                    nextZone
                );

                publishStatus();

                if (
                    currentRouteIndex ==
                    ROUTE_LENGTH - 1
                )
                {
                    currentStatus =
                        "ARRIVED";

                    publishEvent(
                        "BAG_ARRIVED_AT_AIRCRAFT"
                    );

                    publishStatus();

                    Serial.println();
                    Serial.println(
                        "✈️ BAG ARRIVED AT AIRCRAFT"
                    );

                    demoState =
                        NORMAL_COMPLETE;

                    lastRouteChange =
                        now;
                }
            }
        }

        return;
    }

    // -------------------------------------------------
    // NORMAL COMPLETE
    // -------------------------------------------------

    if (
        demoState ==
        NORMAL_COMPLETE
    )
    {
        if (
            now - lastRouteChange >=
            MISROUTE_START_DELAY
        )
        {
            Serial.println();
            Serial.println(
                "========================================"
            );

            Serial.println(
                "🚨 STARTING MISROUTE DEMO"
            );

            Serial.println(
                "========================================"
            );

            resetBagDemo();

            demoState =
                MISROUTE_ROUTE;

            bagDetected =
                true;

            currentStatus =
                "ACCEPTED";

            publishEvent(
                "BAG_DETECTED"
            );

            publishStatus();

            lastRouteChange =
                now;
        }

        return;
    }

    // -------------------------------------------------
    // MISROUTE ROUTE
    // -------------------------------------------------

    if (
        demoState ==
        MISROUTE_ROUTE
    )
    {
        if (
            now - lastRouteChange >=
            ROUTE_STEP_INTERVAL
        )
        {
            lastRouteChange =
                now;

            // BAG_DROP → SECURITY
            if (
                currentRouteIndex == 0
            )
            {
                changeZone(
                    "SECURITY"
                );

                publishStatus();

                return;
            }

            // SECURITY → SORTING
            if (
                currentRouteIndex == 1
            )
            {
                changeZone(
                    "SORTING"
                );

                publishStatus();

                return;
            }

            // SORTING → GATE_B ❌
            if (
                currentRouteIndex == 2
            )
            {
                changeZone(
                    "GATE_B"
                );

                publishStatus();

                demoState =
                    MISROUTE_COMPLETE;

                lastRouteChange =
                    now;
            }
        }

        return;
    }

    // -------------------------------------------------
    // MISROUTE COMPLETE
    // -------------------------------------------------

    if (
        demoState ==
        MISROUTE_COMPLETE
    )
    {
        if (
            now - lastRouteChange >=
            DEMO_RESET_DELAY
        )
        {
            resetBagDemo();

            demoState =
                DEMO_START;

            Serial.println();
            Serial.println(
                "[DEMO] Restarting..."
            );
        }

        return;
    }
}

// =====================================================
// LOOP
// =====================================================

void loop()
{
    // -------------------------------------------------
    // WIFI
    // -------------------------------------------------

    if (
        WiFi.status() !=
        WL_CONNECTED
    )
    {
        if (
            millis() -
            lastWiFiAttempt >=
            AirportIoT::WIFI_RETRY_INTERVAL_MS
        )
        {
            lastWiFiAttempt =
                millis();

            connectWiFi();
        }

        delay(10);

        return;
    }

    // -------------------------------------------------
    // MQTT
    // -------------------------------------------------

    if (
        !mqttClient.connected()
    )
    {
        if (
            millis() -
            lastMQTTAttempt >=
            AirportIoT::MQTT_RETRY_INTERVAL_MS
        )
        {
            lastMQTTAttempt =
                millis();

            connectMQTT();
        }
    }
    else
    {
        mqttClient.loop();
    }

    // -------------------------------------------------
    // RFID
    // -------------------------------------------------

    checkRFID();

    // -------------------------------------------------
    // AUTOMATIC DEMO
    // -------------------------------------------------

    runAutomaticDemo();

    // -------------------------------------------------
    // SENSOR STATUS
    // -------------------------------------------------

    if (
        millis() -
        lastPublish >=
        SENSOR_PUBLISH_INTERVAL
    )
    {
        lastPublish =
            millis();

        publishStatus();
    }

    // -------------------------------------------------
    // HEARTBEAT
    // -------------------------------------------------

    if (
        millis() -
        lastHeartbeat >=
        AirportIoT::HEARTBEAT_INTERVAL_MS
    )
    {
        lastHeartbeat =
            millis();

        publishHeartbeat();
    }

    delay(10);
}