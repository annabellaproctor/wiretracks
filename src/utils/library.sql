-- Wiretracks Component Library Database Schema
CREATE TABLE IF NOT EXISTS library (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT,
  value TEXT,
  width INTEGER,
  height INTEGER,
  pins TEXT, -- JSON Array
  customShapes TEXT, -- JSON Array
  manufacturer TEXT,
  partNumber TEXT,
  cost TEXT,
  datasheet TEXT
);

-- -- Pre-populate robust microcontroller library presets
INSERT INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES
('esp32', 'mcu', 'ESP32 DevKit', 'ESP32-DevKitC v4', 120, 315, 
'[{"name":"3V3","x":30,"y":0,"dir":"up"},{"name":"EN","x":60,"y":0,"dir":"up"},{"name":"5V","x":90,"y":0,"dir":"up"},{"name":"GND","x":40,"y":315,"dir":"down"},{"name":"GND2","x":80,"y":315,"dir":"down"},{"name":"IO36","x":0,"y":30,"dir":"left"},{"name":"IO39","x":0,"y":50,"dir":"left"},{"name":"IO34","x":0,"y":70,"dir":"left"},{"name":"IO35","x":0,"y":90,"dir":"left"},{"name":"IO32","x":0,"y":110,"dir":"left"},{"name":"IO33","x":0,"y":130,"dir":"left"},{"name":"IO25","x":0,"y":150,"dir":"left"},{"name":"IO26","x":0,"y":170,"dir":"left"},{"name":"IO27","x":0,"y":190,"dir":"left"},{"name":"IO14","x":0,"y":210,"dir":"left"},{"name":"IO12","x":0,"y":230,"dir":"left"},{"name":"IO13","x":0,"y":250,"dir":"left"},{"name":"TXD0","x":120,"y":30,"dir":"right"},{"name":"RXD0","x":120,"y":50,"dir":"right"},{"name":"IO22","x":120,"y":70,"dir":"right"},{"name":"IO21","x":120,"y":90,"dir":"right"},{"name":"IO19","x":120,"y":110,"dir":"right"},{"name":"IO18","x":120,"y":130,"dir":"right"},{"name":"IO5","x":120,"y":150,"dir":"right"},{"name":"IO17","x":120,"y":170,"dir":"right"},{"name":"IO16","x":120,"y":190,"dir":"right"},{"name":"IO4","x":120,"y":210,"dir":"right"},{"name":"IO2","x":120,"y":230,"dir":"right"},{"name":"IO15","x":120,"y":250,"dir":"right"}]',
'[{"type":"rect","x":10,"y":10,"w":100,"h":295,"fill":"#0f172a","stroke":"#334155"},{"type":"rect","x":25,"y":25,"w":70,"h":90,"fill":"#1e293b","stroke":"#475569"},{"type":"text","text":"ESP32","x":60,"y":55,"fill":"#94a3b8","font":"bold 9px sans-serif"},{"type":"text","text":"WROOM","x":60,"y":75,"fill":"#64748b","font":"7px sans-serif"}]',
'Espressif Systems', 'ESP32-DevKitC-32E', '$3.45', '#'),

('rp2040', 'mcu', 'RP2040 Pico', 'Raspberry Pi Pico', 120, 330,
'[{"name":"VBUS","x":24,"y":0,"dir":"up"},{"name":"VSYS","x":48,"y":0,"dir":"up"},{"name":"3V3_OUT","x":72,"y":0,"dir":"up"},{"name":"RUN","x":96,"y":0,"dir":"up"},{"name":"GND","x":15,"y":330,"dir":"down"},{"name":"GND2","x":35,"y":330,"dir":"down"},{"name":"GND3","x":55,"y":330,"dir":"down"},{"name":"GND4","x":75,"y":330,"dir":"down"},{"name":"GND_PWR","x":95,"y":330,"dir":"down"},{"name":"GND_ADC","x":105,"y":330,"dir":"down"},{"name":"GP0","x":0,"y":30,"dir":"left"},{"name":"GP1","x":0,"y":55,"dir":"left"},{"name":"GP2","x":0,"y":80,"dir":"left"},{"name":"GP3","x":0,"y":105,"dir":"left"},{"name":"GP4","x":0,"y":130,"dir":"left"},{"name":"GP5","x":0,"y":155,"dir":"left"},{"name":"GP6","x":0,"y":180,"dir":"left"},{"name":"GP7","x":0,"y":205,"dir":"left"},{"name":"GP8","x":0,"y":230,"dir":"left"},{"name":"GP9","x":0,"y":255,"dir":"left"},{"name":"GP28","x":120,"y":30,"dir":"right"},{"name":"GP27","x":120,"y":55,"dir":"right"},{"name":"GP26","x":120,"y":80,"dir":"right"},{"name":"GP22","x":120,"y":105,"dir":"right"},{"name":"GP21","x":120,"y":130,"dir":"right"},{"name":"GP20","x":120,"y":155,"dir":"right"}]',
'[{"type":"rect","x":10,"y":10,"w":100,"h":310,"fill":"#065f46","stroke":"#10b981"},{"type":"rect","x":35,"y":20,"w":50,"h":40,"fill":"#047857","stroke":"#10b981"},{"type":"text","text":"RP2040","x":60,"y":40,"fill":"#ffffff","font":"bold 9px sans-serif"}]',
'Raspberry Pi', 'SC0915', '$4.00', '#'),

('stm32', 'mcu', 'STM32 BluePill', 'STM32F103C8T6', 120, 360,
'[{"name":"5V","x":30,"y":0,"dir":"up"},{"name":"3V3","x":90,"y":0,"dir":"up"},{"name":"GND","x":40,"y":360,"dir":"down"},{"name":"GND2","x":80,"y":360,"dir":"down"},{"name":"PB9 (SCL)","x":0,"y":30,"dir":"left"},{"name":"PB8 (SDA)","x":0,"y":55,"dir":"left"},{"name":"PB7","x":0,"y":80,"dir":"left"},{"name":"PB6","x":0,"y":105,"dir":"left"},{"name":"PB5","x":0,"y":130,"dir":"left"},{"name":"PB4","x":0,"y":155,"dir":"left"},{"name":"PB3","x":0,"y":180,"dir":"left"},{"name":"PA15","x":0,"y":205,"dir":"left"},{"name":"PA12","x":0,"y":230,"dir":"left"},{"name":"PA11","x":0,"y":255,"dir":"left"},{"name":"PA10 (RX)","x":0,"y":280,"dir":"left"},{"name":"PA9 (TX)","x":0,"y":305,"dir":"left"},{"name":"PA0","x":120,"y":30,"dir":"right"},{"name":"PA1","x":120,"y":55,"dir":"right"},{"name":"PA2","x":120,"y":80,"dir":"right"},{"name":"PA3","x":120,"y":105,"dir":"right"},{"name":"PA4","x":120,"y":130,"dir":"right"},{"name":"PA5","x":120,"y":155,"dir":"right"},{"name":"PA6","x":120,"y":180,"dir":"right"},{"name":"PA7","x":120,"y":205,"dir":"right"},{"name":"PB0","x":120,"y":230,"dir":"right"},{"name":"PB1","x":120,"y":255,"dir":"right"}]',
'[{"type":"rect","x":10,"y":10,"w":100,"h":340,"fill":"#1e3a8a","stroke":"#3b82f6"},{"type":"text","text":"STM32F103","x":60,"y":40,"fill":"#93c5fd","font":"bold 9px sans-serif"}]',
'STMicroelectronics', 'STM32F103C8T6', '$2.50', '#'),

('atmega328p', 'mcu', 'ATmega328P', 'ATmega328P DIP-28', 105, 240,
'[{"name":"RESET","x":20,"y":0,"dir":"up"},{"name":"VCC","x":40,"y":0,"dir":"up"},{"name":"AVCC","x":60,"y":0,"dir":"up"},{"name":"AREF","x":80,"y":0,"dir":"up"},{"name":"GND","x":35,"y":240,"dir":"down"},{"name":"GND2","x":70,"y":240,"dir":"down"},{"name":"PD0 (RXD)","x":0,"y":30,"dir":"left"},{"name":"PD1 (TXD)","x":0,"y":50,"dir":"left"},{"name":"PD2","x":0,"y":70,"dir":"left"},{"name":"PD3","x":0,"y":90,"dir":"left"},{"name":"PD4","x":0,"y":110,"dir":"left"},{"name":"XTAL1","x":0,"y":130,"dir":"left"},{"name":"XTAL2","x":0,"y":150,"dir":"left"},{"name":"PD5","x":0,"y":170,"dir":"left"},{"name":"PC5 (SCL)","x":105,"y":30,"dir":"right"},{"name":"PC4 (SDA)","x":105,"y":50,"dir":"right"},{"name":"PC3","x":105,"y":70,"dir":"right"},{"name":"PC2","x":105,"y":90,"dir":"right"},{"name":"PC1","x":105,"y":110,"dir":"right"},{"name":"PC0","x":105,"y":130,"dir":"right"},{"name":"PB5 (SCK)","x":105,"y":150,"dir":"right"},{"name":"PB4","x":105,"y":170,"dir":"right"}]',
'[{"type":"rect","x":15,"y":10,"w":75,"h":220,"fill":"#111827","stroke":"#374151","strokeWidth":2},{"type":"circle","cx":52.5,"cy":12,"r":8,"fill":"#1f2937"},{"type":"text","text":"ATmega328P","x":52.5,"y":110,"fill":"#9ca3af","font":"bold 8px sans-serif"}]',
'Microchip Technology', 'ATmega328P-PU', '$2.10', '#'),

('attiny85', 'mcu', 'ATTiny85', 'ATTiny85 8-pin DIP', 90, 90,
'[{"name":"RESET","x":30,"y":0,"dir":"up"},{"name":"VCC","x":60,"y":0,"dir":"up"},{"name":"GND","x":45,"y":90,"dir":"down"},{"name":"PB3","x":0,"y":30,"dir":"left"},{"name":"PB4","x":0,"y":60,"dir":"left"},{"name":"PB2","x":90,"y":22,"dir":"right"},{"name":"PB1","x":90,"y":44,"dir":"right"},{"name":"PB0","x":90,"y":66,"dir":"right"}]',
'[{"type":"rect","x":15,"y":10,"w":60,"h":70,"fill":"#111827","stroke":"#374151","strokeWidth":1.5},{"type":"circle","cx":45,"cy":12,"r":5,"fill":"#1f2937"},{"type":"text","text":"ATTINY85","x":45,"y":45,"fill":"#9ca3af","font":"bold 7px sans-serif"}]',
'Microchip Technology', 'ATTINY85-20PU', '$1.25', '#'),

('esp12f', 'mcu', 'ESP-12F Module', 'ESP-12F WiFi Module', 105, 165,
'[{"name":"RESET","x":25,"y":0,"dir":"up"},{"name":"CH_PD","x":50,"y":0,"dir":"up"},{"name":"VCC","x":75,"y":0,"dir":"up"},{"name":"GND","x":52.5,"y":165,"dir":"down"},{"name":"ADC","x":0,"y":25,"dir":"left"},{"name":"GPIO16","x":0,"y":50,"dir":"left"},{"name":"GPIO14","x":0,"y":75,"dir":"left"},{"name":"GPIO12","x":0,"y":100,"dir":"left"},{"name":"GPIO13","x":0,"y":125,"dir":"left"},{"name":"GPIO15","x":105,"y":25,"dir":"right"},{"name":"GPIO2","x":105,"y":50,"dir":"right"},{"name":"GPIO0","x":105,"y":75,"dir":"right"},{"name":"GPIO4","x":105,"y":100,"dir":"right"},{"name":"GPIO5","x":105,"y":125,"dir":"right"},{"name":"RXD","x":105,"y":140,"dir":"right"},{"name":"TXD","x":105,"y":155,"dir":"right"}]',
'[{"type":"rect","x":15,"y":15,"w":75,"h":135,"fill":"#1e293b","stroke":"#475569"},{"type":"text","text":"ESP-12F","x":52.5,"y":60,"fill":"#e2e8f0","font":"bold 8px sans-serif"}]',
'AI-Thinker', 'ESP-12F', '$1.85', '#'),

('lm7805', 'regulator', 'Linear Regulator', 'LM7805 (5V)', 90, 60,
'[{"name":"IN","x":0,"y":15,"dir":"left"},{"name":"GND","x":45,"y":60,"dir":"down"},{"name":"OUT","x":90,"y":15,"dir":"right"}]',
'[]', 'STMicroelectronics', 'LM7805CT', '$0.45', '#'),

('resistor_10k', 'resistor', 'Resistor', '10kΩ', 60, 30,
'[{"name":"1","x":0,"y":15,"dir":"left"},{"name":"2","x":60,"y":15,"dir":"right"}]',
'[]', 'Generic', 'RES_10K_0805', '$0.02', '#'),

('capacitor_100n', 'capacitor', 'Capacitor', '100nF', 30, 45,
'[{"name":"1","x":15,"y":0,"dir":"up"},{"name":"2","x":15,"y":45,"dir":"down"}]',
'[]', 'Generic', 'CAP_100NF_0805', '$0.03', '#'),

('led_red', 'led', 'GaAs LED', 'Red LED', 45, 60,
'[{"name":"A","x":0,"y":30,"dir":"left"},{"name":"K","x":45,"y":30,"dir":"right"}]',
'[]', 'Generic', 'LED_RED_0805', '$0.05', '#');
