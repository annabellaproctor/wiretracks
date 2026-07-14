// Unified Client-Side SQLite Database Emulator for Wiretracks IDE
// Persists the entire SQLite DB state in 'wiretracks_sqlite_backing' in localStorage

const BOOTSTRAP_SQL = `
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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  val TEXT
);

CREATE TABLE IF NOT EXISTS session_data (
  id INTEGER PRIMARY KEY,
  components TEXT, -- JSON Array
  traces TEXT, -- JSON Array
  pcb_pads TEXT, -- JSON Array
  pcb_traces TEXT -- JSON Array
);

CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT,
  content TEXT,
  timestamp INTEGER
);

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('esp32', 'mcu', 'ESP32 DevKit', 'ESP32-DevKitC v4', 120, 315, '[{"name":"3V3","x":30,"y":0,"dir":"up"},{"name":"EN","x":60,"y":0,"dir":"up"},{"name":"5V","x":90,"y":0,"dir":"up"},{"name":"GND","x":40,"y":315,"dir":"down"},{"name":"GND2","x":80,"y":315,"dir":"down"},{"name":"IO36","x":0,"y":30,"dir":"left"},{"name":"IO39","x":0,"y":50,"dir":"left"},{"name":"IO34","x":0,"y":70,"dir":"left"},{"name":"IO35","x":0,"y":90,"dir":"left"},{"name":"IO32","x":0,"y":110,"dir":"left"},{"name":"IO33","x":0,"y":130,"dir":"left"},{"name":"IO25","x":0,"y":150,"dir":"left"},{"name":"IO26","x":0,"y":170,"dir":"left"},{"name":"IO27","x":0,"y":190,"dir":"left"},{"name":"IO14","x":0,"y":210,"dir":"left"},{"name":"IO12","x":0,"y":230,"dir":"left"},{"name":"IO13","x":0,"y":250,"dir":"left"},{"name":"TXD0","x":120,"y":30,"dir":"right"},{"name":"RXD0","x":120,"y":50,"dir":"right"},{"name":"IO22","x":120,"y":70,"dir":"right"},{"name":"IO21","x":120,"y":90,"dir":"right"},{"name":"IO19","x":120,"y":110,"dir":"right"},{"name":"IO18","x":120,"y":130,"dir":"right"},{"name":"IO5","x":120,"y":150,"dir":"right"},{"name":"IO17","x":120,"y":170,"dir":"right"},{"name":"IO16","x":120,"y":190,"dir":"right"},{"name":"IO4","x":120,"y":210,"dir":"right"},{"name":"IO2","x":120,"y":230,"dir":"right"},{"name":"IO15","x":120,"y":250,"dir":"right"}]', '[{"type":"rect","x":10,"y":10,"w":100,"h":295,"fill":"#0f172a","stroke":"#334155"},{"type":"rect","x":25,"y":25,"w":70,"h":90,"fill":"#1e293b","stroke":"#475569"},{"type":"text","text":"ESP32","x":60,"y":55,"fill":"#94a3b8","font":"bold 9px sans-serif"},{"type":"text","text":"WROOM","x":60,"y":75,"fill":"#64748b","font":"7px sans-serif"}]', 'Espressif Systems', 'ESP32-DevKitC-32E', '$3.45', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('rp2040', 'mcu', 'RP2040 Pico', 'Raspberry Pi Pico', 120, 330, '[{"name":"VBUS","x":24,"y":0,"dir":"up"},{"name":"VSYS","x":48,"y":0,"dir":"up"},{"name":"3V3_OUT","x":72,"y":0,"dir":"up"},{"name":"RUN","x":96,"y":0,"dir":"up"},{"name":"GND","x":15,"y":330,"dir":"down"},{"name":"GND2","x":35,"y":330,"dir":"down"},{"name":"GND3","x":55,"y":330,"dir":"down"},{"name":"GND4","x":75,"y":330,"dir":"down"},{"name":"GND_PWR","x":95,"y":330,"dir":"down"},{"name":"GND_ADC","x":105,"y":330,"dir":"down"},{"name":"GP0","x":0,"y":30,"dir":"left"},{"name":"GP1","x":0,"y":55,"dir":"left"},{"name":"GP2","x":0,"y":80,"dir":"left"},{"name":"GP3","x":0,"y":105,"dir":"left"},{"name":"GP4","x":0,"y":130,"dir":"left"},{"name":"GP5","x":0,"y":155,"dir":"left"},{"name":"GP6","x":0,"y":180,"dir":"left"},{"name":"GP7","x":0,"y":205,"dir":"left"},{"name":"GP8","x":0,"y":230,"dir":"left"},{"name":"GP9","x":0,"y":255,"dir":"left"},{"name":"GP28","x":120,"y":30,"dir":"right"},{"name":"GP27","x":120,"y":55,"dir":"right"},{"name":"GP26","x":120,"y":80,"dir":"right"},{"name":"GP22","x":120,"y":105,"dir":"right"},{"name":"GP21","x":120,"y":130,"dir":"right"},{"name":"GP20","x":120,"y":155,"dir":"right"}]', '[{"type":"rect","x":10,"y":10,"w":100,"h":310,"fill":"#065f46","stroke":"#10b981"},{"type":"rect","x":35,"y":20,"w":50,"h":40,"fill":"#047857","stroke":"#10b981"},{"type":"text","text":"RP2040","x":60,"y":40,"fill":"#ffffff","font":"bold 9px sans-serif"}]', 'Raspberry Pi', 'SC0915', '$4.00', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('stm32', 'mcu', 'STM32 BluePill', 'STM32F103C8T6', 120, 330, '[{"name":"5V","x":30,"y":0,"dir":"up"},{"name":"3V3","x":90,"y":0,"dir":"up"},{"name":"GND","x":40,"y":330,"dir":"down"},{"name":"GND2","x":80,"y":330,"dir":"down"},{"name":"PB9","x":0,"y":30,"dir":"left"},{"name":"PB8","x":0,"y":55,"dir":"left"},{"name":"PB7","x":0,"y":80,"dir":"left"},{"name":"PB6","x":0,"y":105,"dir":"left"},{"name":"PB5","x":0,"y":130,"dir":"left"},{"name":"PB4","x":0,"y":155,"dir":"left"},{"name":"PB3","x":0,"y":180,"dir":"left"},{"name":"PA15","x":0,"y":205,"dir":"left"},{"name":"PA12","x":0,"y":230,"dir":"left"},{"name":"PA11","x":0,"y":255,"dir":"left"},{"name":"PA10","x":0,"y":280,"dir":"left"},{"name":"PA9","x":0,"y":305,"dir":"left"},{"name":"PA0","x":120,"y":30,"dir":"right"},{"name":"PA1","x":120,"y":55,"dir":"right"},{"name":"PA2","x":120,"y":80,"dir":"right"},{"name":"PA3","x":120,"y":105,"dir":"right"},{"name":"PA4","x":120,"y":130,"dir":"right"},{"name":"PA5","x":120,"y":155,"dir":"right"},{"name":"PA6","x":120,"y":180,"dir":"right"},{"name":"PA7","x":120,"y":205,"dir":"right"},{"name":"PB0","x":120,"y":230,"dir":"right"},{"name":"PB1","x":120,"y":255,"dir":"right"}]', '[{"type":"rect","x":10,"y":10,"w":100,"h":310,"fill":"#1e3a8a","stroke":"#3b82f6"},{"type":"text","text":"STM32F103","x":60,"y":40,"fill":"#93c5fd","font":"bold 9px sans-serif"}]', 'STMicroelectronics', 'STM32F103C8T6', '$2.50', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('atmega328p', 'mcu', 'ATmega328P', 'ATmega328P DIP-28', 105, 240, '[{"name":"RESET","x":20,"y":0,"dir":"up"},{"name":"VCC","x":40,"y":0,"dir":"up"},{"name":"AVCC","x":60,"y":0,"dir":"up"},{"name":"AREF","x":80,"y":0,"dir":"up"},{"name":"GND","x":35,"y":240,"dir":"down"},{"name":"GND2","x":70,"y":240,"dir":"down"},{"name":"PD0 (RXD)","x":0,"y":30,"dir":"left"},{"name":"PD1 (TXD)","x":0,"y":50,"dir":"left"},{"name":"PD2","x":0,"y":70,"dir":"left"},{"name":"PD3","x":0,"y":90,"dir":"left"},{"name":"PD4","x":0,"y":110,"dir":"left"},{"name":"XTAL1","x":0,"y":130,"dir":"left"},{"name":"XTAL2","x":0,"y":150,"dir":"left"},{"name":"PD5","x":0,"y":170,"dir":"left"},{"name":"PC5 (SCL)","x":105,"y":30,"dir":"right"},{"name":"PC4 (SDA)","x":105,"y":50,"dir":"right"},{"name":"PC3","x":105,"y":45,"dir":"right"},{"name":"PC2","x":105,"y":60,"dir":"right"},{"name":"PC1","x":105,"y":75,"dir":"right"},{"name":"PC0","x":105,"y":90,"dir":"right"},{"name":"GND2","x":105,"y":105,"dir":"right"},{"name":"AREF","x":105,"y":120,"dir":"right"},{"name":"AVCC","x":105,"y":135,"dir":"right"},{"name":"PB5 (SCK)","x":105,"y":150,"dir":"right"},{"name":"PB4","x":105,"y":170,"dir":"right"}]', '[{"type":"rect","x":15,"y":10,"w":75,"h":220,"fill":"#111827","stroke":"#374151","strokeWidth":2},{"type":"circle","cx":52.5,"cy":12,"r":8,"fill":"#1f2937"},{"type":"text","text":"ATmega328P","x":52.5,"y":110,"fill":"#9ca3af","font":"bold 8px sans-serif"}]', 'Microchip Technology', 'ATmega328P-PU', '$2.10', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('attiny85', 'mcu', 'ATTiny85', 'ATTiny85 8-pin DIP', 90, 90, '[{"name":"RESET","x":30,"y":0,"dir":"up"},{"name":"VCC","x":60,"y":0,"dir":"up"},{"name":"GND","x":45,"y":90,"dir":"down"},{"name":"PB3","x":0,"y":30,"dir":"left"},{"name":"PB4","x":0,"y":60,"dir":"left"},{"name":"PB2","x":90,"y":22,"dir":"right"},{"name":"PB1","x":90,"y":44,"dir":"right"},{"name":"PB0","x":90,"y":66,"dir":"right"}]', '[{"type":"rect","x":15,"y":10,"w":60,"h":70,"fill":"#111827","stroke":"#374151","strokeWidth":1.5},{"type":"circle","cx":45,"cy":12,"r":5,"fill":"#1f2937"},{"type":"text","text":"ATTINY85","x":45,"y":45,"fill":"#9ca3af","font":"bold 7px sans-serif"}]', 'Microchip Technology', 'ATTINY85-20PU', '$1.25', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('esp12f', 'mcu', 'ESP-12F Module', 'ESP-12F WiFi Module', 105, 165, '[{"name":"RESET","x":25,"y":0,"dir":"up"},{"name":"CH_PD","x":50,"y":0,"dir":"up"},{"name":"VCC","x":75,"y":0,"dir":"up"},{"name":"GND","x":52.5,"y":165,"dir":"down"},{"name":"ADC","x":0,"y":25,"dir":"left"},{"name":"GPIO16","x":0,"y":50,"dir":"left"},{"name":"GPIO14","x":0,"y":75,"dir":"left"},{"name":"GPIO12","x":0,"y":100,"dir":"left"},{"name":"GPIO13","x":0,"y":125,"dir":"left"},{"name":"GPIO15","x":105,"y":25,"dir":"right"},{"name":"GPIO2","x":105,"y":50,"dir":"right"},{"name":"GPIO0","x":105,"y":75,"dir":"right"},{"name":"GPIO4","x":105,"y":100,"dir":"right"},{"name":"GPIO5","x":105,"y":125,"dir":"right"},{"name":"RXD","x":105,"y":140,"dir":"right"},{"name":"TXD","x":105,"y":120,"dir":"right"}]', '[{"type":"rect","x":15,"y":15,"w":75,"h":135,"fill":"#1e293b","stroke":"#475569"},{"type":"text","text":"ESP-12F","x":52.5,"y":60,"fill":"#e2e8f0","font":"bold 8px sans-serif"}]', 'AI-Thinker', 'ESP-12F', '$1.85', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('lm7805', 'regulator', 'Linear Regulator', 'LM7805 (5V)', 90, 60, '[{"name":"IN","x":0,"y":15,"dir":"left"},{"name":"GND","x":45,"y":60,"dir":"down"},{"name":"OUT","x":90,"y":15,"dir":"right"}]', '[]', 'STMicroelectronics', 'LM7805CT', '$0.45', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('resistor_10k', 'resistor', 'Resistor', '10kΩ', 60, 30, '[{"name":"1","x":0,"y":15,"dir":"left"},{"name":"2","x":60,"y":15,"dir":"right"}]', '[]', 'Generic', 'RES_10K_0805', '$0.02', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('capacitor_100n', 'capacitor', 'Capacitor', '100nF', 30, 45, '[{"name":"1","x":15,"y":0,"dir":"up"},{"name":"2","x":15,"y":45,"dir":"down"}]', '[]', 'Generic', 'CAP_100NF_0805', '$0.03', '#');

INSERT OR REPLACE INTO library (id, type, label, value, width, height, pins, customShapes, manufacturer, partNumber, cost, datasheet) VALUES ('led_red', 'led', 'GaAs LED', 'Red LED', 45, 60, '[{"name":"A","x":0,"y":30,"dir":"left"},{"name":"K","x":45,"y":30,"dir":"right"}]', '[]', 'Generic', 'LED_RED_0805', '$0.05', '#');
`;

class SQLiteDatabaseEmulator {
  constructor() {
    this.tables = {
      library: [],
      settings: [],
      session_data: [],
      chat_history: []
    };
    this.init();
  }

  init() {
    const saved = localStorage.getItem('wiretracks_sqlite_backing');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all tables are present and library is not empty
        if (parsed.library && parsed.library.length > 0 && parsed.settings && parsed.session_data && parsed.chat_history) {
          // If library contains NaN IDs (corrupt data from previous run), clear backing to force bootstrap rebuild
          const isCorrupted = parsed.library.some(item => typeof item.id === 'number' && isNaN(item.id)) || 
                              parsed.library.some(item => String(item.id) === 'NaN');
          if (isCorrupted) {
            console.warn("Detected corrupted library database with NaN IDs. Forcing bootstrap rebuild...");
            localStorage.removeItem('wiretracks_sqlite_backing');
          } else {
            // Ensure nested JSON arrays (pins, customShapes) are parsed objects rather than strings
            // and deduplicate by ID to clear any past duplicates in localStorage
            const uniqueMap = new Map();
            parsed.library.forEach(item => {
              if (typeof item.pins === 'string') {
                try { item.pins = JSON.parse(item.pins); } catch(e) {}
              }
              if (typeof item.customShapes === 'string') {
                try { item.customShapes = JSON.parse(item.customShapes); } catch(e) {}
              }
              if (item.id) {
                uniqueMap.set(item.id, item);
              }
            });
            parsed.library = Array.from(uniqueMap.values());
            this.tables = parsed;
            // Always refresh default presets to capture updated schema layouts or new fields
            this.refreshDefaultPresets();
            // Force save to persist deduplicated library back to localStorage
            this.save();
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to parse SQLite backing store, reinitializing...', e);
      }
    }

    // Run SQL bootstrap queries
    this.executeBulkSql(BOOTSTRAP_SQL);
  }

  refreshDefaultPresets() {
    const statements = BOOTSTRAP_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.toLowerCase().startsWith('insert'));

    statements.forEach(stmt => {
      try {
        this.executeSingleSql(stmt);
      } catch (err) {
        console.error('SQLite Emulator refresh error:', err);
      }
    });
  }

  save() {
    localStorage.setItem('wiretracks_sqlite_backing', JSON.stringify(this.tables));
    // Trigger global event for React view reactive re-rendering
    window.dispatchEvent(new Event('wiretracks_sqlite_db_update'));
  }

  executeBulkSql(bulkSql) {
    const statements = bulkSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let results = [];
    statements.forEach(stmt => {
      try {
        results.push(this.executeSingleSql(stmt));
      } catch (err) {
        console.error('SQLite Emulator execution error on statement:', stmt, err);
      }
    });
    return results;
  }

  executeSingleSql(sql) {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    const lower = cleanSql.toLowerCase();

    // 1. CREATE TABLE
    if (lower.startsWith('create table')) {
      return { success: true, message: "Table created (emulated)" };
    }

    // 2. INSERT OR REPLACE INTO / INSERT INTO
    if (lower.startsWith('insert')) {
      const match = cleanSql.match(/insert\s+(?:or\s+replace\s+)?into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([\s\S]+)\)/i);
      if (!match) throw new Error("Unsupported INSERT syntax");

      const tableName = match[1].toLowerCase();
      if (!this.tables[tableName]) throw new Error(`Table "${tableName}" does not exist`);

      const columns = match[2].split(',').map(c => c.trim().replace(/['"`]/g, ''));
      const rawValues = match[3];
      const values = this.parseValues(rawValues);

      if (columns.length !== values.length) {
        throw new Error(`Columns (${columns.length}) does not match values (${values.length})`);
      }

      const newRow = {};
      columns.forEach((col, index) => {
        let val = values[index];
        const colLower = col.toLowerCase();
        
        // Parse numerical columns
        if (colLower === 'width' || colLower === 'height' || colLower === 'timestamp') {
          newRow[col] = parseInt(val, 10);
        } else if (colLower === 'id') {
          newRow[col] = /^\d+$/.test(val) ? parseInt(val, 10) : val.replace(/['"`]/g, '');
        } else if (colLower === 'pins' || colLower === 'customshapes' || colLower === 'components' || colLower === 'traces' || colLower === 'pcb_pads' || colLower === 'pcb_traces') {
          // Normalize column casings
          const key = colLower === 'customshapes' ? 'customShapes' : (colLower === 'pcb_pads' ? 'pcb_pads' : (colLower === 'pcb_traces' ? 'pcb_traces' : colLower));
          try {
            newRow[key] = typeof val === 'string' ? JSON.parse(val) : val;
          } catch (e) {
            newRow[key] = val;
          }
        } else {
          newRow[col] = val;
        }
      });

      // Prevent duplicate entries by ID for tables with an 'id' column or 'key' column
      const pkField = (tableName === 'settings') ? 'key' : 'id';
      if (newRow[pkField] !== undefined) {
        const existingIdx = this.tables[tableName].findIndex(row => row[pkField] === newRow[pkField]);
        if (existingIdx !== -1) {
          this.tables[tableName][existingIdx] = { ...this.tables[tableName][existingIdx], ...newRow };
          this.save();
          return { success: true, changes: 1 };
        }
      }
      
      // Auto-increment ID if table is chat_history
      if (tableName === 'chat_history' && !newRow.id) {
        const maxId = this.tables.chat_history.reduce((max, row) => Math.max(max, row.id || 0), 0);
        newRow.id = maxId + 1;
      }

      const existingIdx = this.tables[tableName].findIndex(r => r[pkField] === newRow[pkField]);
      if (existingIdx !== -1) {
        this.tables[tableName][existingIdx] = { ...this.tables[tableName][existingIdx], ...newRow };
      } else {
        this.tables[tableName].push(newRow);
      }

      this.save();
      return { success: true, changes: 1 };
    }

    // 3. SELECT FROM
    if (lower.startsWith('select')) {
      const match = cleanSql.match(/select\s+([\s\S]+?)\s+from\s+(\w+)(?:\s+where\s+([\s\S]+?))?(?:\s+order\s+by\s+([\s\S]+?))?(?:\s+limit\s+(\d+))?$/i);
      if (!match) throw new Error("Unsupported SELECT syntax");

      const selectCols = match[1].trim();
      const tableName = match[2].toLowerCase();
      const whereClause = match[3] ? match[3].trim() : null;
      const orderByClause = match[4] ? match[4].trim() : null;
      const limitVal = match[5] ? parseInt(match[5].trim(), 10) : null;

      if (!this.tables[tableName]) throw new Error(`Table "${tableName}" does not exist`);

      let rows = [...this.tables[tableName]];

      // Filter WHERE
      if (whereClause) {
        rows = rows.filter(row => this.evaluateWhere(row, whereClause));
      }

      // Order BY
      if (orderByClause) {
        const orderParts = orderByClause.split(' ');
        const sortCol = orderParts[0].trim();
        const isDesc = orderParts[1] && orderParts[1].toLowerCase() === 'desc';
        rows.sort((a, b) => {
          const valA = a[sortCol];
          const valB = b[sortCol];
          if (valA < valB) return isDesc ? 1 : -1;
          if (valA > valB) return isDesc ? -1 : 1;
          return 0;
        });
      }

      // Limit
      if (limitVal !== null) {
        rows = rows.slice(0, limitVal);
      }

      // Mapped columns
      const results = rows.map(row => {
        if (selectCols === '*') return row;
        const mapped = {};
        selectCols.split(',').map(c => c.trim()).forEach(col => {
          mapped[col] = row[col];
        });
        return mapped;
      });

      return { success: true, rows: results, count: results.length };
    }

    // 4. UPDATE SET
    if (lower.startsWith('update')) {
      const match = cleanSql.match(/update\s+(\w+)\s+set\s+([\s\S]+?)(?:\s+where\s+([\s\S]+))?$/i);
      if (!match) throw new Error("Unsupported UPDATE syntax");

      const tableName = match[1].toLowerCase();
      const setClause = match[2].trim();
      const whereClause = match[3] ? match[3].trim() : null;

      if (!this.tables[tableName]) throw new Error(`Table "${tableName}" does not exist`);

      const updates = {};
      const pairs = setClause.split(/,(?=(?:[^']*'[^']*')*[^']*$)/);
      pairs.forEach(pair => {
        const parts = pair.split('=');
        if (parts.length < 2) return;
        const col = parts[0].trim().replace(/['"`]/g, '');
        let val = parts.slice(1).join('=').trim().replace(/^'|'$/g, '').replace(/\\'/g, "'");

        const finalCol = col === 'customshapes' ? 'customShapes' : col;

        if (finalCol === 'width' || finalCol === 'height' || finalCol === 'timestamp') {
          updates[finalCol] = parseInt(val, 10);
        } else if (finalCol === 'pins' || finalCol === 'customShapes' || finalCol === 'components' || finalCol === 'traces' || finalCol === 'pcb_pads' || finalCol === 'pcb_traces') {
          try {
            updates[finalCol] = JSON.parse(val);
          } catch (e) {
            updates[finalCol] = val;
          }
        } else {
          updates[finalCol] = val;
        }
      });

      let changedCount = 0;
      this.tables[tableName] = this.tables[tableName].map(row => {
        const matches = whereClause ? this.evaluateWhere(row, whereClause) : true;
        if (matches) {
          changedCount++;
          return { ...row, ...updates };
        }
        return row;
      });

      if (changedCount > 0) this.save();
      return { success: true, changes: changedCount };
    }

    // 5. DELETE
    if (lower.startsWith('delete')) {
      const match = cleanSql.match(/delete\s+from\s+(\w+)(?:\s+where\s+([\s\S]+))?$/i);
      if (!match) throw new Error("Unsupported DELETE syntax");

      const tableName = match[1].toLowerCase();
      const whereClause = match[2] ? match[2].trim() : null;

      if (!this.tables[tableName]) throw new Error(`Table "${tableName}" does not exist`);

      const prevCount = this.tables[tableName].length;
      if (whereClause) {
        this.tables[tableName] = this.tables[tableName].filter(row => !this.evaluateWhere(row, whereClause));
      } else {
        this.tables[tableName] = [];
      }

      const deletedCount = prevCount - this.tables[tableName].length;
      if (deletedCount > 0) this.save();
      return { success: true, changes: deletedCount };
    }

    throw new Error(`Unsupported SQL command: "${sql.slice(0, 20)}..."`);
  }

  evaluateWhere(row, whereStr) {
    const cleanWhere = whereStr.replace(/\s+/g, ' ');
    
    // LIKE match: col LIKE 'val'
    const likeMatch = cleanWhere.match(/(\w+)\s+like\s+'([^']+)'/i);
    if (likeMatch) {
      const col = likeMatch[1] === 'customshapes' ? 'customShapes' : likeMatch[1];
      const val = likeMatch[2].replace(/%/g, '').toLowerCase();
      const rowVal = String(row[col] || '').toLowerCase();
      return rowVal.includes(val);
    }

    // Equals match: col = 'val' or col = number
    const eqMatch = cleanWhere.match(/(\w+)\s*=\s*(?:'([^']+)'|(\d+))/i);
    if (eqMatch) {
      const col = eqMatch[1] === 'customshapes' ? 'customShapes' : eqMatch[1];
      const val = eqMatch[2] !== undefined ? eqMatch[2] : parseInt(eqMatch[3], 10);
      return row[col] === val;
    }

    return true;
  }

  parseValues(rawValues) {
    const results = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";
    let bracketDepth = 0;

    for (let i = 0; i < rawValues.length; i++) {
      const char = rawValues[i];

      if (inQuotes) {
        if (char === quoteChar && rawValues[i - 1] !== '\\') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if ((char === "'" || char === '"' || char === '`')) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === '[' || char === '{') {
          bracketDepth++;
          current += char;
        } else if (char === ']' || char === '}') {
          bracketDepth--;
          current += char;
        } else if (char === ',' && bracketDepth === 0) {
          results.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }
    results.push(current.trim());
    return results;
  }

  // -------------------------------------------------------------
  // ⚡ Helper APIs to match localStorage patterns with SQL queries
  // -------------------------------------------------------------
  
  getSetting(key, fallback = '') {
    const res = this.executeSingleSql(`SELECT val FROM settings WHERE key = '${key}'`);
    if (res.rows && res.rows.length > 0) {
      return res.rows[0].val;
    }
    return fallback;
  }

  setSetting(key, val) {
    const escapedVal = String(val).replace(/'/g, "''");
    this.executeSingleSql(`INSERT OR REPLACE INTO settings (key, val) VALUES ('${key}', '${escapedVal}')`);
  }

  getSession() {
    const res = this.executeSingleSql(`SELECT * FROM session_data WHERE id = 1`);
    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      return {
        components: typeof row.components === 'string' ? JSON.parse(row.components) : row.components,
        traces: typeof row.traces === 'string' ? JSON.parse(row.traces) : row.traces,
        customPcbPads: typeof row.pcb_pads === 'string' ? JSON.parse(row.pcb_pads) : row.pcb_pads,
        customPcbTraces: typeof row.pcb_traces === 'string' ? JSON.parse(row.pcb_traces) : row.pcb_traces
      };
    }
    return null;
  }

  setSession(session) {
    const compsStr = JSON.stringify(session.components || []);
    const tracesStr = JSON.stringify(session.traces || []);
    const padsStr = JSON.stringify(session.customPcbPads || []);
    const pcbTracesStr = JSON.stringify(session.customPcbTraces || []);

    const escapedComps = compsStr.replace(/'/g, "''");
    const escapedTraces = tracesStr.replace(/'/g, "''");
    const escapedPads = padsStr.replace(/'/g, "''");
    const escapedPcbTraces = pcbTracesStr.replace(/'/g, "''");

    this.executeSingleSql(`INSERT OR REPLACE INTO session_data (id, components, traces, pcb_pads, pcb_traces) VALUES (1, '${escapedComps}', '${escapedTraces}', '${escapedPads}', '${escapedPcbTraces}')`);
  }

  getChatHistory() {
    const res = this.executeSingleSql(`SELECT role, content FROM chat_history ORDER BY id ASC`);
    return res.rows || [];
  }

  saveChatMessage(role, content) {
    const escapedContent = String(content).replace(/'/g, "''");
    const timestamp = Date.now();
    this.executeSingleSql(`INSERT INTO chat_history (role, content, timestamp) VALUES ('${role}', '${escapedContent}', ${timestamp})`);
  }

  clearChatHistory() {
    this.executeSingleSql(`DELETE FROM chat_history`);
  }
}

export const sqliteDb = new SQLiteDatabaseEmulator();
