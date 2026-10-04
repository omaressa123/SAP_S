#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "DHT.h"

// Pin definitions
#define DHTPIN 4
#define DHTTYPE DHT22

#define PIR_PIN 13
#define LDR_PIN 35
#define POT_PIN 34

// Hardware instances
LiquidCrystal_I2C lcd(0x27, 20, 4);
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  
  // Configure input pins
  pinMode(PIR_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);
  pinMode(POT_PIN, INPUT);

  // Initialize sensors and peripherals
  dht.begin();
  
  // Initialize LCD display
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Airport IEQ");
  lcd.setCursor(0, 1);
  lcd.print("Gate Lounge Node");
  lcd.setCursor(0, 2);
  lcd.print("System Starting...");
  delay(2000);
  lcd.clear();
}

void loop() {
  // Read sensor data
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  int motion = digitalRead(PIR_PIN);
  int ldrVal = analogRead(LDR_PIN);
  int airVal = analogRead(POT_PIN);

  // Line 1: Temperature and Humidity
  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(temp, 1);
  lcd.print("C  H:");
  lcd.print(hum, 0);
  lcd.print("%   ");

  // Line 2: Air Quality Index (from Potentiometer)
  lcd.setCursor(0, 1);
  lcd.print("Air: ");
  lcd.print(airVal);
  if (airVal > 2500) {
    lcd.print(" (POOR) ");
  } else {
    lcd.print(" (GOOD) ");
  }

  // Line 3: Ambient Light Level
  lcd.setCursor(0, 2);
  lcd.print("Light: ");
  lcd.print(ldrVal);
  lcd.print(" lux    ");

  // Line 4: Lounge Occupancy and Power Mode
  lcd.setCursor(0, 3);
  if (motion == HIGH) {
    lcd.print("Gate: OCCUPIED  ");
  } else {
    lcd.print("Gate: ECO-MODE  ");
  }

  delay(1000);
}