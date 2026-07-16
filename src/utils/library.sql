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
('esp32', 'mcu', 'ESP32 DevKit', 'ESP32-DevKitC v4', 120, 255, 
'[{"name":"3V3","x":0,"y":15,"dir":"left"},{"name":"EN","x":0,"y":30,"dir":"left"},{"name":"VP","x":0,"y":45,"dir":"left"},{"name":"VN","x":0,"y":60,"dir":"left"},{"name":"D34","x":0,"y":75,"dir":"left"},{"name":"D35","x":0,"y":90,"dir":"left"},{"name":"D32","x":0,"y":105,"dir":"left"},{"name":"D33","x":0,"y":120,"dir":"left"},{"name":"D25","x":0,"y":135,"dir":"left"},{"name":"D26","x":0,"y":150,"dir":"left"},{"name":"D27","x":0,"y":165,"dir":"left"},{"name":"D14","x":0,"y":180,"dir":"left"},{"name":"D12","x":0,"y":195,"dir":"left"},{"name":"D13","x":0,"y":210,"dir":"left"},{"name":"GND","x":0,"y":225,"dir":"left"},{"name":"VIN","x":120,"y":15,"dir":"right"},{"name":"GND","x":120,"y":30,"dir":"right"},{"name":"D15","x":120,"y":45,"dir":"right"},{"name":"D2","x":120,"y":60,"dir":"right"},{"name":"D4","x":120,"y":75,"dir":"right"},{"name":"RX2","x":120,"y":90,"dir":"right"},{"name":"TX2","x":120,"y":105,"dir":"right"},{"name":"D5","x":120,"y":120,"dir":"right"},{"name":"D18","x":120,"y":135,"dir":"right"},{"name":"D19","x":120,"y":150,"dir":"right"},{"name":"D21","x":120,"y":165,"dir":"right"},{"name":"RX0","x":120,"y":180,"dir":"right"},{"name":"TX0","x":120,"y":195,"dir":"right"},{"name":"D22","x":120,"y":210,"dir":"right"},{"name":"D23","x":120,"y":225,"dir":"right"}]',
'[{"type":"rect","x":10,"y":10,"w":100,"h":235,"fill":"#0f172a","stroke":"#334155"},{"type":"rect","x":25,"y":25,"w":70,"h":70,"fill":"#1e293b","stroke":"#475569"},{"type":"text","text":"ESP32","x":60,"y":55,"fill":"#94a3b8","font":"bold 9px sans-serif"},{"type":"text","text":"WROOM","x":60,"y":75,"fill":"#64748b","font":"7px sans-serif"}]',
'Espressif Systems', 'ESP32-DevKitC-32E', '$3.45', '#'),

('rp2040', 'mcu', 'RP2040 Pico', 'Raspberry Pi Pico', 120, 330,
'[{"name":"GP0","x":0,"y":15,"dir":"left"},{"name":"GP1","x":0,"y":30,"dir":"left"},{"name":"GND","x":0,"y":45,"dir":"left"},{"name":"GP2","x":0,"y":60,"dir":"left"},{"name":"GP3","x":0,"y":75,"dir":"left"},{"name":"GP4","x":0,"y":90,"dir":"left"},{"name":"GP5","x":0,"y":105,"dir":"left"},{"name":"GND","x":0,"y":120,"dir":"left"},{"name":"GP6","x":0,"y":135,"dir":"left"},{"name":"GP7","x":0,"y":150,"dir":"left"},{"name":"GP8","x":0,"y":165,"dir":"left"},{"name":"GP9","x":0,"y":180,"dir":"left"},{"name":"GND","x":0,"y":195,"dir":"left"},{"name":"GP10","x":0,"y":210,"dir":"left"},{"name":"GP11","x":0,"y":225,"dir":"left"},{"name":"GP12","x":0,"y":240,"dir":"left"},{"name":"GP13","x":0,"y":255,"dir":"left"},{"name":"GND","x":0,"y":270,"dir":"left"},{"name":"GP14","x":0,"y":285,"dir":"left"},{"name":"GP15","x":0,"y":300,"dir":"left"},{"name":"VBUS","x":120,"y":15,"dir":"right"},{"name":"VSYS","x":120,"y":30,"dir":"right"},{"name":"GND","x":120,"y":45,"dir":"right"},{"name":"3V3_EN","x":120,"y":60,"dir":"right"},{"name":"3V3","x":120,"y":75,"dir":"right"},{"name":"GP28","x":120,"y":90,"dir":"right"},{"name":"AGND","x":120,"y":105,"dir":"right"},{"name":"GP27","x":120,"y":120,"dir":"right"},{"name":"GP26","x":120,"y":135,"dir":"right"},{"name":"RUN","x":120,"y":150,"dir":"right"},{"name":"GP22","x":120,"y":165,"dir":"right"},{"name":"GND","x":120,"y":180,"dir":"right"},{"name":"GP21","x":120,"y":195,"dir":"right"},{"name":"GP20","x":120,"y":210,"dir":"right"},{"name":"GP19","x":120,"y":225,"dir":"right"},{"name":"GP18","x":120,"y":240,"dir":"right"},{"name":"GND","x":120,"y":255,"dir":"right"},{"name":"GP17","x":120,"y":270,"dir":"right"},{"name":"GP16","x":120,"y":285,"dir":"right"},{"name":"ADC_VREF","x":120,"y":300,"dir":"right"}]',
'[{"type":"rect","x":10,"y":10,"w":100,"h":310,"fill":"#065f46","stroke":"#10b981"},{"type":"rect","x":35,"y":20,"w":50,"h":40,"fill":"#047857","stroke":"#10b981"},{"type":"text","text":"RP2040","x":60,"y":40,"fill":"#ffffff","font":"bold 9px sans-serif"}]',
'Raspberry Pi', 'SC0915', '$4.00', '#'),

('stm32', 'mcu', 'STM32 BluePill', 'STM32F103C8T6', 120, 345,
'[{"name":"VBAT","x":0,"y":15,"dir":"left"},{"name":"PC13","x":0,"y":30,"dir":"left"},{"name":"PC14","x":0,"y":45,"dir":"left"},{"name":"PC15","x":0,"y":60,"dir":"left"},{"name":"PD0","x":0,"y":75,"dir":"left"},{"name":"PD1","x":0,"y":90,"dir":"left"},{"name":"NRST","x":0,"y":105,"dir":"left"},{"name":"VSSA","x":0,"y":120,"dir":"left"},{"name":"VDDA","x":0,"y":135,"dir":"left"},{"name":"PA0","x":0,"y":150,"dir":"left"},{"name":"PA1","x":0,"y":165,"dir":"left"},{"name":"PA2","x":0,"y":180,"dir":"left"},{"name":"PA3","x":0,"y":195,"dir":"left"},{"name":"PA4","x":0,"y":210,"dir":"left"},{"name":"PA5","x":0,"y":225,"dir":"left"},{"name":"PA6","x":0,"y":240,"dir":"left"},{"name":"PA7","x":0,"y":255,"dir":"left"},{"name":"PB0","x":0,"y":270,"dir":"left"},{"name":"PB1","x":0,"y":285,"dir":"left"},{"name":"PB10","x":0,"y":300,"dir":"left"},{"name":"PB11","x":0,"y":315,"dir":"left"},{"name":"PB12","x":120,"y":15,"dir":"right"},{"name":"PB13","x":120,"y":30,"dir":"right"},{"name":"PB14","x":120,"y":45,"dir":"right"},{"name":"PB15","x":120,"y":60,"dir":"right"},{"name":"PA8","x":120,"y":75,"dir":"right"},{"name":"PA9 (TX)","x":120,"y":90,"dir":"right"},{"name":"PA10 (RX)","x":120,"y":105,"dir":"right"},{"name":"PA11","x":120,"y":120,"dir":"right"},{"name":"PA12","x":120,"y":135,"dir":"right"},{"name":"PA15","x":120,"y":150,"dir":"right"},{"name":"PB3","x":120,"y":165,"dir":"right"},{"name":"PB4","x":120,"y":180,"dir":"right"},{"name":"PB5","x":120,"y":195,"dir":"right"},{"name":"PB6 (SCL)","x":120,"y":210,"dir":"right"},{"name":"PB7 (SDA)","x":120,"y":225,"dir":"right"},{"name":"BOOT0","x":120,"y":240,"dir":"right"},{"name":"PB8","x":120,"y":255,"dir":"right"},{"name":"PB9","x":120,"y":270,"dir":"right"},{"name":"5V","x":120,"y":285,"dir":"right"},{"name":"GND","x":120,"y":300,"dir":"right"},{"name":"3V3","x":120,"y":315,"dir":"right"}]',
'[{"type":"rect","x":10,"y":10,"w":100,"h":325,"fill":"#1e3a8a","stroke":"#3b82f6"},{"type":"text","text":"STM32F103","x":60,"y":40,"fill":"#93c5fd","font":"bold 9px sans-serif"}]',
'STMicroelectronics', 'STM32F103C8T6', '$2.50', '#'),

('atmega328p', 'mcu', 'ATmega328P', 'ATmega328P DIP-28', 105, 240,
'[{"name":"RESET","x":0,"y":15,"dir":"left"},{"name":"PD0 (RXD)","x":0,"y":30,"dir":"left"},{"name":"PD1 (TXD)","x":0,"y":45,"dir":"left"},{"name":"PD2 (INT0)","x":0,"y":60,"dir":"left"},{"name":"PD3 (INT1)","x":0,"y":75,"dir":"left"},{"name":"PD4 (T0)","x":0,"y":90,"dir":"left"},{"name":"VCC","x":0,"y":105,"dir":"left"},{"name":"GND","x":0,"y":120,"dir":"left"},{"name":"XTAL1","x":0,"y":135,"dir":"left"},{"name":"XTAL2","x":0,"y":150,"dir":"left"},{"name":"PD5","x":0,"y":165,"dir":"left"},{"name":"PD6","x":0,"y":180,"dir":"left"},{"name":"PD7","x":0,"y":195,"dir":"left"},{"name":"PB0","x":0,"y":210,"dir":"left"},{"name":"PC5","x":105,"y":15,"dir":"right"},{"name":"PC4","x":105,"y":30,"dir":"right"},{"name":"PC3","x":105,"y":45,"dir":"right"},{"name":"PC2","x":105,"y":60,"dir":"right"},{"name":"PC1","x":105,"y":75,"dir":"right"},{"name":"PC0","x":105,"y":90,"dir":"right"},{"name":"GND","x":105,"y":105,"dir":"right"},{"name":"AREF","x":105,"y":120,"dir":"right"},{"name":"AVCC","x":105,"y":135,"dir":"right"},{"name":"PB5 (SCK)","x":105,"y":150,"dir":"right"},{"name":"PB4 (MISO)","x":105,"y":165,"dir":"right"},{"name":"PB3 (MOSI)","x":105,"y":180,"dir":"right"},{"name":"PB2 (SS)","x":105,"y":195,"dir":"right"},{"name":"PB1","x":105,"y":210,"dir":"right"}]',
'[{"type":"rect","x":15,"y":10,"w":75,"h":220,"fill":"#111827","stroke":"#374151","strokeWidth":2},{"type":"circle","cx":52.5,"cy":12,"r":8,"fill":"#1f2937"},{"type":"text","text":"ATmega328P","x":52.5,"y":110,"fill":"#9ca3af","font":"bold 8px sans-serif"}]',
'Microchip Technology', 'ATmega328P-PU', '$2.10', '#'),

('attiny85', 'mcu', 'ATTiny85', 'ATTiny85 8-pin DIP', 90, 90,
'[{"name":"RESET","x":0,"y":15,"dir":"left"},{"name":"PB3","x":0,"y":30,"dir":"left"},{"name":"PB4","x":0,"y":45,"dir":"left"},{"name":"GND","x":0,"y":60,"dir":"left"},{"name":"VCC","x":90,"y":15,"dir":"right"},{"name":"PB2","x":90,"y":30,"dir":"right"},{"name":"PB1","x":90,"y":45,"dir":"right"},{"name":"PB0","x":90,"y":60,"dir":"right"}]',
'[{"type":"rect","x":15,"y":10,"w":60,"h":70,"fill":"#111827","stroke":"#374151","strokeWidth":1.5},{"type":"circle","cx":45,"cy":12,"r":5,"fill":"#1f2937"},{"type":"text","text":"ATTINY85","x":45,"y":45,"fill":"#9ca3af","font":"bold 7px sans-serif"}]',
'Microchip Technology', 'ATTINY85-20PU', '$1.25', '#'),

('esp12f', 'mcu', 'ESP-12F Module', 'ESP-12F WiFi Module', 105, 150,
'[{"name":"RESET","x":0,"y":15,"dir":"left"},{"name":"ADC","x":0,"y":30,"dir":"left"},{"name":"CH_PD","x":0,"y":45,"dir":"left"},{"name":"GPIO16","x":0,"y":60,"dir":"left"},{"name":"GPIO14","x":0,"y":75,"dir":"left"},{"name":"GPIO12","x":0,"y":90,"dir":"left"},{"name":"GPIO13","x":0,"y":105,"dir":"left"},{"name":"VCC","x":0,"y":120,"dir":"left"},{"name":"TXD","x":105,"y":15,"dir":"right"},{"name":"RXD","x":105,"y":30,"dir":"right"},{"name":"GPIO5","x":105,"y":45,"dir":"right"},{"name":"GPIO4","x":105,"y":60,"dir":"right"},{"name":"GPIO0","x":105,"y":75,"dir":"right"},{"name":"GPIO2","x":105,"y":90,"dir":"right"},{"name":"GPIO15","x":105,"y":105,"dir":"right"},{"name":"GND","x":105,"y":120,"dir":"right"}]',
'[{"type":"rect","x":15,"y":15,"w":75,"h":120,"fill":"#1e293b","stroke":"#475569"},{"type":"text","text":"ESP-12F","x":52.5,"y":60,"fill":"#e2e8f0","font":"bold 8px sans-serif"}]',
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
'[]', 'Generic', 'LED_RED_0805', '$0.05', '#'),

('battery_aa', 'battery', 'AA Battery', '1.5V AA', 75, 255,
'[{"name":"+","x":37.5,"y":0,"dir":"up"},{"name":"-","x":37.5,"y":255,"dir":"down"}]',
'[{"type":"rect","x":10,"y":30,"w":55,"h":195,"fill":"#d97706","stroke":"#78350f"},{"type":"rect","x":27.5,"y":15,"w":20,"h":15,"fill":"#f59e0b","stroke":"#78350f"},{"type":"rect","x":15,"y":225,"w":45,"h":10,"fill":"#94a3b8","stroke":"#475569"},{"type":"text","text":"AA CELL","x":37.5,"y":110,"fill":"#ffffff","font":"bold 12px sans-serif"},{"type":"text","text":"1.5V","x":37.5,"y":140,"fill":"#fcd34d","font":"10px sans-serif"}]',
'Generic', 'AA_CELL', '$0.50', '#'),

('battery_18650', 'battery', 'Li-ion 18650', '3.7V 18650', 90, 330,
'[{"name":"+","x":45,"y":0,"dir":"up"},{"name":"-","x":45,"y":330,"dir":"down"}]',
'[{"type":"rect","x":10,"y":30,"w":70,"h":270,"fill":"#0284c7","stroke":"#0369a1"},{"type":"rect","x":32.5,"y":15,"w":25,"h":15,"fill":"#e2e8f0","stroke":"#475569"},{"type":"rect","x":15,"y":300,"w":60,"h":15,"fill":"#94a3b8","stroke":"#475569"},{"type":"text","text":"18650 CELL","x":45,"y":140,"fill":"#ffffff","font":"bold 12px sans-serif"},{"type":"text","text":"3.7V 2500mAh","x":45,"y":170,"fill":"#e0f2fe","font":"9px sans-serif"}]',
'Samsung', 'INR18650-25R', '$4.50', '#'),

('battery_lipo_3s', 'battery', 'LiPo Battery Pack', '11.1V 3S Lipo', 150, 450,
'[{"name":"V+","x":45,"y":0,"dir":"up"},{"name":"GND","x":105,"y":0,"dir":"up"}]',
'[{"type":"rect","x":20,"y":40,"w":110,"h":370,"fill":"#475569","stroke":"#334155"},{"type":"rect","x":15,"y":30,"w":120,"h":10,"fill":"#1e293b","stroke":"#0f172a"},{"type":"rect","x":30,"y":70,"w":90,"h":110,"fill":"#ca8a04","stroke":"#a16207"},{"type":"text","text":"LIPO 3S","x":75,"y":110,"fill":"#ffffff","font":"bold 14px sans-serif"},{"type":"text","text":"11.1V 2200mAh","x":75,"y":140,"fill":"#ffffff","font":"bold 10px sans-serif"}]',
'Turnigy', 'LIPO-3S-2200', '$14.99', '#'),

('battery_sla_12v', 'battery', 'SLA Battery', '12V 7Ah SLA', 300, 600,
'[{"name":"+","x":75,"y":0,"dir":"up"},{"name":"-","x":225,"y":0,"dir":"up"}]',
'[{"type":"rect","x":20,"y":60,"w":260,"h":480,"fill":"#1e293b","stroke":"#0f172a"},{"type":"rect","x":55,"y":15,"w":40,"h":45,"fill":"#ef4444","stroke":"#b91c1c"},{"type":"rect","x":205,"y":15,"w":40,"h":45,"fill":"#3b82f6","stroke":"#1d4ed8"},{"type":"text","text":"SEALED LEAD ACID","x":150,"y":240,"fill":"#94a3b8","font":"bold 18px sans-serif"},{"type":"text","text":"12V 7.2Ah","x":150,"y":290,"fill":"#f1f5f9","font":"bold 20px sans-serif"},{"type":"text","text":"CYCLE USE: 14.4-15.0V","x":150,"y":340,"fill":"#64748b","font":"11px sans-serif"}]',
'Yuasa', 'NP7-12', '$22.00', '#'),

('wall_outlet', 'power_source', 'Wall Power Outlet', '120V AC Outlet', 240, 420,
'[{"name":"HOT","x":0,"y":150,"dir":"left"},{"name":"NEUT","x":0,"y":270,"dir":"left"},{"name":"EARTH","x":240,"y":210,"dir":"right"}]',
'[{"type":"rect","x":30,"y":30,"w":180,"h":360,"fill":"#f8fafc","stroke":"#cbd5e1"},{"type":"circle","cx":120,"cy":135,"r":52,"fill":"#e2e8f0"},{"type":"rect","x":85,"y":105,"w":10,"h":35,"fill":"#1e293b"},{"type":"rect","x":145,"y":100,"w":10,"h":45,"fill":"#1e293b"},{"type":"circle","cx":120,"cy":160,"r":11,"fill":"#1e293b"},{"type":"circle","cx":120,"cy":285,"r":52,"fill":"#e2e8f0"},{"type":"rect","x":85,"y":255,"w":10,"h":35,"fill":"#1e293b"},{"type":"rect","x":145,"y":250,"w":10,"h":45,"fill":"#1e293b"},{"type":"circle","cx":120,"cy":310,"r":11,"fill":"#1e293b"},{"type":"text","text":"120V AC","x":120,"y":370,"fill":"#64748b","font":"bold 12px sans-serif"}]',
'Leviton', '5320-W', '$1.20', '#'),

('power_adapter_12v', 'power_source', 'AC-DC Adapter', '12V 24W Adapter', 180, 300,
'[{"name":"AC_L","x":45,"y":0,"dir":"up"},{"name":"AC_N","x":135,"y":0,"dir":"up"},{"name":"DC_+","x":45,"y":300,"dir":"down"},{"name":"DC_-","x":135,"y":300,"dir":"down"}]',
'[{"type":"rect","x":20,"y":40,"w":140,"h":220,"fill":"#18181b","stroke":"#27272a"},{"type":"rect","x":37.5,"y":0,"w":15,"h":40,"fill":"#e4e4e7","stroke":"#a1a1aa"},{"type":"rect","x":127.5,"y":0,"w":15,"h":40,"fill":"#e4e4e7","stroke":"#a1a1aa"},{"type":"text","text":"AC-DC ADAPTER","x":90,"y":110,"fill":"#71717a","font":"bold 11px sans-serif"},{"type":"text","text":"OUTPUT: 12V 2.0A","x":90,"y":150,"fill":"#22c55e","font":"bold 13px sans-serif"},{"type":"text","text":"POWER: 24W MAX","x":90,"y":180,"fill":"#a855f7","font":"bold 11px sans-serif"}]',
'Mean Well', 'GST25U12-P1J', '$12.50', '#'),

('relay_spdt', 'relay', 'SPDT Relay', '5V SPDT Relay', 90, 90,
'[{"name":"COIL1","x":0,"y":15,"dir":"left"},{"name":"COIL2","x":0,"y":75,"dir":"left"},{"name":"COM","x":90,"y":45,"dir":"right"},{"name":"NO","x":45,"y":0,"dir":"up"},{"name":"NC","x":45,"y":90,"dir":"down"}]',
'[{"type":"rect","x":10,"y":10,"w":70,"h":70,"fill":"#1e3a8a","stroke":"#1d4ed8"},{"type":"circle","cx":25,"cy":45,"r":12,"fill":"#1e293b","stroke":"#ef4444"},{"type":"text","text":"RELAY","x":45,"y":45,"fill":"#ffffff","font":"bold 8px sans-serif"},{"type":"text","text":"5V COIL","x":45,"y":60,"fill":"#93c5fd","font":"6px sans-serif"}]',
'Omron', 'G5V-1-DC5', '$1.15', '#'),

('switch_spst', 'switch', 'SPST Switch', 'SPST Switch', 75, 45,
'[{"name":"1","x":0,"y":22.5,"dir":"left"},{"name":"2","x":75,"y":22.5,"dir":"right"}]',
'[{"type":"rect","x":10,"y":5,"w":55,"h":35,"fill":"#1e293b","stroke":"#475569"},{"type":"circle","cx":20,"cy":22.5,"r":4,"fill":"#e2e8f0"},{"type":"circle","cx":55,"cy":22.5,"r":4,"fill":"#e2e8f0"},{"type":"line","x1":20,"y1":22.5,"x2":50,"y2":10,"stroke":"#ffffff","strokeWidth":2},{"type":"text","text":"SWITCH","x":37.5,"y":32,"fill":"#cbd5e1","font":"bold 8px sans-serif"},{"type":"text","text":"STATE_TXT","x":37.5,"y":12,"fill":"#fbbf24","font":"7px sans-serif"}]',
'C&K', 'JS202011JCQN', '$0.35', '#'),

('gate_and', 'gate', 'AND Gate', '74HC08 Quad AND', 90, 75,
'[{"name":"A","x":0,"y":15,"dir":"left"},{"name":"B","x":0,"y":45,"dir":"left"},{"name":"OUT","x":90,"y":30,"dir":"right"},{"name":"VCC","x":45,"y":0,"dir":"up"},{"name":"GND","x":45,"y":75,"dir":"down"}]',
'[{"type":"rect","x":15,"y":10,"w":60,"h":55,"fill":"#0f172a","stroke":"#10b981"},{"type":"text","text":"AND GATE","x":45,"y":30,"fill":"#34d399","font":"bold 8px sans-serif"},{"type":"text","text":"74HC08","x":45,"y":45,"fill":"#059669","font":"6px sans-serif"}]',
'Texas Instruments', 'SN74HC08N', '$0.45', '#'),

('gate_or', 'gate', 'OR Gate', '74HC32 Quad OR', 90, 75,
'[{"name":"A","x":0,"y":15,"dir":"left"},{"name":"B","x":0,"y":45,"dir":"left"},{"name":"OUT","x":90,"y":30,"dir":"right"},{"name":"VCC","x":45,"y":0,"dir":"up"},{"name":"GND","x":45,"y":75,"dir":"down"}]',
'[{"type":"rect","x":15,"y":10,"w":60,"h":55,"fill":"#0f172a","stroke":"#6366f1"},{"type":"text","text":"OR GATE","x":45,"y":30,"fill":"#818cf8","font":"bold 8px sans-serif"},{"type":"text","text":"74HC32","x":45,"y":45,"fill":"#4f46e5","font":"6px sans-serif"}]',
'Texas Instruments', 'SN74HC32N', '$0.45', '#'),

('gate_not', 'gate', 'NOT Inverter', '74HC14 Hex NOT', 90, 60,
'[{"name":"IN","x":0,"y":30,"dir":"left"},{"name":"OUT","x":90,"y":30,"dir":"right"},{"name":"VCC","x":45,"y":0,"dir":"up"},{"name":"GND","x":45,"y":60,"dir":"down"}]',
'[{"type":"rect","x":15,"y":10,"w":60,"h":40,"fill":"#0f172a","stroke":"#ec4899"},{"type":"text","text":"NOT GATE","x":45,"y":25,"fill":"#f472b6","font":"bold 8px sans-serif"},{"type":"text","text":"74HC14","x":45,"y":38,"fill":"#db2777","font":"6px sans-serif"}]',
'Texas Instruments', 'SN74HC14N', '$0.40', '#');
