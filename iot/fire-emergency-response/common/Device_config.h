#pragma once

#include <Arduino.h>

// Wi-Fi Configuration
#ifndef WIFI_SSID
#define WIFI_SSID "Wokwi-GUEST"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

// MQTT Broker Configuration
#ifndef MQTT_HOST
#define MQTT_HOST "broker.hivemq.com"
#endif

#ifndef MQTT_PORT
#define MQTT_PORT 1883
#endif

#ifndef MQTT_USER
#define MQTT_USER ""
#endif

#ifndef MQTT_PASS
#define MQTT_PASS ""
#endif

// Heartbeat Interval in Milliseconds
#ifndef DEVICE_HEARTBEAT_INTERVAL
#define DEVICE_HEARTBEAT_INTERVAL 15000
#endif

// Terminal / Zone Assignment
#ifndef AIRPORT_ZONE
#define AIRPORT_ZONE "TERMINAL-1"
#endif
