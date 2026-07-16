/**
 * Electrical Physics Engine for Wiretracks
 * Performs graph netlist building, Jacobi relaxation node voltage solving,
 * battery state-of-charge calculation, float charging, and component damage.
 */

// Helper to parse resistor value strings to float ohms
const parseResistorValue = (valStr) => {
  if (!valStr) return 100;
  const match = valStr.toString().match(/^([\d.]+)\s*([kMGT]?)\s*(?:[Ω\s]*)$/i);
  if (!match) return 100;
  const val = parseFloat(match[1]);
  const mult = match[2].toLowerCase();
  if (mult === 'k') return val * 1000;
  if (mult === 'm') return val * 1000000;
  return val;
};

/**
 * Executes a single physics simulation tick.
 * 
 * @param {Array} components - Current components state
 * @param {Array} traces - Current schematic traces
 * @param {number} dt - Tick time step in seconds
 * @returns {Object} Updated components and trace current flows
 */
export function runSimulationTick(components, traces, dt = 0.1) {
  // 1. Group connected pins into Nets using DSU (Disjoint Set Union)
  const pinToNetMap = {}; // "compId.pinName" -> netId
  const netMembers = {};  // netId -> Set("compId.pinName")

  // Gather all unique pins
  components.forEach(c => {
    c.pins.forEach(p => {
      const pinKey = `${c.id}.${p.name}`;
      pinToNetMap[pinKey] = pinKey;
      netMembers[pinKey] = new Set([pinKey]);
    });
  });

  // Find helper
  const findNet = (pinKey) => {
    let curr = pinKey;
    while (pinToNetMap[curr] !== curr) {
      curr = pinToNetMap[curr];
    }
    return curr;
  };

  // Union helper
  const unionNets = (pin1, pin2) => {
    const net1 = findNet(pin1);
    const net2 = findNet(pin2);
    if (net1 !== net2) {
      pinToNetMap[net1] = net2;
      netMembers[net2] = new Set([...netMembers[net2], ...netMembers[net1]]);
      delete netMembers[net1];
    }
  };

  // Union pins connected by traces
  traces.forEach(trace => {
    if (trace.from && trace.to) {
      unionNets(trace.from, trace.to);
    }
  });

  // Flatten nets
  const nets = {}; // netId -> Array of pins
  Object.keys(netMembers).forEach(root => {
    const members = Array.from(netMembers[root]);
    nets[root] = members;
  });

  // Helper to check if a pin is connected to a net
  const getPinNetId = (compId, pinName) => {
    return findNet(`${compId}.${pinName}`);
  };

  // 2. Identify fixed voltage sources & GND references
  const fixedVoltages = {}; // netId -> voltage value
  const isGndNet = {};      // netId -> boolean
  const isAcLiveNet = {};   // netId -> boolean
  const isAcNeutNet = {};   // netId -> boolean
  const isAcEarthNet = {};  // netId -> boolean

  // Define battery actual/internal voltages based on dynamic state
  const batteryVoltages = {};
  components.forEach(c => {
    if (c.health === undefined) c.health = 100;
    if (c.isFried === undefined) c.isFried = false;

    if (c.type === 'battery' && !c.isFried) {
      const vNom = c.voltageV || 1.5;
      const ahNom = c.capacityAh || 2.5;
      
      // Initialize battery level state if not present
      if (c.chargePct === undefined) c.chargePct = 1.0; // 100% full
      if (c.capacityRemainingAh === undefined) c.capacityRemainingAh = ahNom;

      // Volts fluctuate based on chargePct
      let vBatt = vNom;
      if (c.libraryId === 'battery_sla_12v') {
        vBatt = 10.5 + 3.3 * c.chargePct; // SLA empty is 10.5V, full is 13.8V
      } else if (c.libraryId === 'battery_18650') {
        vBatt = 3.0 + 1.2 * c.chargePct;  // 18650 empty is 3.0V, full is 4.2V
      } else if (c.libraryId === 'battery_lipo_3s') {
        vBatt = 9.0 + 3.6 * c.chargePct;  // 3S empty is 9.0V, full is 12.6V
      } else if (c.libraryId === 'battery_aa') {
        vBatt = 0.9 + 0.7 * c.chargePct;  // AA empty is 0.9V, full is 1.6V
      }
      batteryVoltages[c.id] = vBatt;
    }
  });

  // Find if AC adapter input AC_L/AC_N has AC power from wall outlet
  const adapterPowered = {};
  components.forEach(c => {
    if (c.libraryId === 'power_adapter_12v' && !c.isFried) {
      const netL = getPinNetId(c.id, 'AC_L');
      const netN = getPinNetId(c.id, 'AC_N');

      // Check if outlet pins are in the same nets
      let hasL = false;
      let hasN = false;
      components.forEach(outlet => {
        if (outlet.libraryId === 'wall_outlet') {
          const outL = getPinNetId(outlet.id, 'HOT');
          const outN = getPinNetId(outlet.id, 'NEUT');
          if (netL === outL) hasL = true;
          if (netN === outN) hasN = true;
        }
      });
      adapterPowered[c.id] = hasL && hasN;
    }
  });

  // Assign fixed voltages to nets
  components.forEach(c => {
    if (c.isFried) return; // Fried items output/connect nothing

    if (c.libraryId === 'wall_outlet') {
      const netHot = getPinNetId(c.id, 'HOT');
      const netNeut = getPinNetId(c.id, 'NEUT');
      const netEarth = getPinNetId(c.id, 'EARTH');

      fixedVoltages[netHot] = 120.0;
      fixedVoltages[netNeut] = 0.0;
      fixedVoltages[netEarth] = 0.0;

      isAcLiveNet[netHot] = true;
      isAcNeutNet[netNeut] = true;
      isAcEarthNet[netEarth] = true;

      // Keep in isGndNet for simulation solver ground reference consistency
      isGndNet[netNeut] = true;
      isGndNet[netEarth] = true;
    }

    if (c.type === 'battery') {
      const vBatt = batteryVoltages[c.id];
      const gndPin = c.libraryId === 'battery_lipo_3s' ? 'GND' : '-';
      const posPin = c.libraryId === 'battery_lipo_3s' ? 'V+' : '+';

      const netGnd = getPinNetId(c.id, gndPin);
      const netPos = getPinNetId(c.id, posPin);

      isGndNet[netGnd] = true;
      fixedVoltages[netGnd] = 0.0;
      
      // Battery acts as a fixed voltage source on positive net relative to GND net
      fixedVoltages[netPos] = vBatt;
    }

    if (c.libraryId === 'power_adapter_12v') {
      const netDCGnd = getPinNetId(c.id, 'DC_-');
      const netDCPos = getPinNetId(c.id, 'DC_+');
      const netAcL = getPinNetId(c.id, 'AC_L');
      const netAcN = getPinNetId(c.id, 'AC_N');

      isAcLiveNet[netAcL] = true;
      isAcNeutNet[netAcN] = true;

      isGndNet[netDCGnd] = true;
      fixedVoltages[netDCGnd] = 0.0;

      if (adapterPowered[c.id]) {
        fixedVoltages[netDCPos] = c.voltageV || 12.0;
      } else {
        fixedVoltages[netDCPos] = 0.0;
      }
    }

    if (c.libraryId === 'lm7805') {
      const netGnd = getPinNetId(c.id, 'GND');
      const netIn = getPinNetId(c.id, 'IN');
      const netOut = getPinNetId(c.id, 'OUT');

      isGndNet[netGnd] = true;
      fixedVoltages[netGnd] = 0.0;

      const prevVIn = c.pinVoltages?.['IN'] || 0;
      const prevVGnd = c.pinVoltages?.['GND'] || 0;
      const vIn = prevVIn - prevVGnd;

      if (vIn > 7.0) {
        fixedVoltages[netOut] = 5.0;
      } else {
        fixedVoltages[netOut] = Math.max(0.0, vIn - 2.0); // Dropout degradation
      }
    }

    if (c.libraryId === 'buck_boost_mini') {
      const netInPos = getPinNetId(c.id, 'IN+');
      const netInNeg = getPinNetId(c.id, 'IN-');
      const netOutPos = getPinNetId(c.id, 'OUT+');
      const netOutNeg = getPinNetId(c.id, 'OUT-');

      isGndNet[netOutNeg] = true;
      fixedVoltages[netOutNeg] = 0.0;

      const prevVInPos = c.pinVoltages?.['IN+'] || 0;
      const prevVInNeg = c.pinVoltages?.['IN-'] || 0;
      const vIn = Math.abs(prevVInPos - prevVInNeg);

      const minIn = c.inputVoltageMinV !== undefined ? c.inputVoltageMinV : 3.0;
      const maxIn = c.inputVoltageMaxV !== undefined ? c.inputVoltageMaxV : 35.0;

      if (vIn >= minIn && vIn <= maxIn) {
        fixedVoltages[netOutPos] = c.voltageV !== undefined ? c.voltageV : 5.0;
      } else {
        fixedVoltages[netOutPos] = 0.0;
      }
    }

    if (c.libraryId === 'buck_converter_mini') {
      const netInPos = getPinNetId(c.id, 'IN+');
      const netInNeg = getPinNetId(c.id, 'IN-');
      const netOutPos = getPinNetId(c.id, 'OUT+');
      const netOutNeg = getPinNetId(c.id, 'OUT-');

      isGndNet[netOutNeg] = true;
      fixedVoltages[netOutNeg] = 0.0;

      const prevVInPos = c.pinVoltages?.['IN+'] || 0;
      const prevVInNeg = c.pinVoltages?.['IN-'] || 0;
      const vIn = Math.abs(prevVInPos - prevVInNeg);

      const targetV = c.voltageV !== undefined ? c.voltageV : 5.0;
      const minIn = c.inputVoltageMinV !== undefined ? c.inputVoltageMinV : 3.0;
      const maxIn = c.inputVoltageMaxV !== undefined ? c.inputVoltageMaxV : 35.0;

      if (vIn >= minIn && vIn <= maxIn) {
        // Requires V_in to be at least targetV + 1.0V to regulate properly
        if (vIn >= targetV + 1.0) {
          fixedVoltages[netOutPos] = targetV;
        } else {
          fixedVoltages[netOutPos] = Math.max(0.0, vIn - 1.0); // Dropout mode
        }
      } else {
        fixedVoltages[netOutPos] = 0.0;
      }
    }

    if (c.libraryId === 'boost_converter_mini') {
      const netInPos = getPinNetId(c.id, 'IN+');
      const netInNeg = getPinNetId(c.id, 'IN-');
      const netOutPos = getPinNetId(c.id, 'OUT+');
      const netOutNeg = getPinNetId(c.id, 'OUT-');

      isGndNet[netOutNeg] = true;
      fixedVoltages[netOutNeg] = 0.0;

      const prevVInPos = c.pinVoltages?.['IN+'] || 0;
      const prevVInNeg = c.pinVoltages?.['IN-'] || 0;
      const vIn = Math.abs(prevVInPos - prevVInNeg);

      const targetV = c.voltageV !== undefined ? c.voltageV : 12.0;
      const minIn = c.inputVoltageMinV !== undefined ? c.inputVoltageMinV : 3.0;
      const maxIn = c.inputVoltageMaxV !== undefined ? c.inputVoltageMaxV : 35.0;

      if (vIn >= minIn && vIn <= maxIn) {
        if (vIn <= targetV) {
          fixedVoltages[netOutPos] = targetV; // Boost mode
        } else {
          fixedVoltages[netOutPos] = Math.max(0.0, vIn - 0.5); // Pass-through diode drop mode
        }
      } else {
        fixedVoltages[netOutPos] = 0.0;
      }
    }
  });

  // 3. Define Resistor Links (Components acting as load connections between nets)
  const links = []; // Array of { netA, netB, R, compId }
  
  components.forEach(c => {
    if (c.isFried) return; // Fried items disconnect (infinite resistance)

    if (c.type === 'resistor') {
      if (c.libraryId === 'potentiometer_10k') {
        const net1 = getPinNetId(c.id, '1');
        const netWiper = getPinNetId(c.id, 'WIPER');
        const net2 = getPinNetId(c.id, '2');
        const rTotal = c.powerW !== undefined ? c.powerW : 10000.0;
        const wiperPct = (c.wiperPct !== undefined ? c.wiperPct : 50.0) / 100.0;
        const R1 = Math.max(0.1, rTotal * wiperPct);
        const R2 = Math.max(0.1, rTotal * (1.0 - wiperPct));
        links.push({ netA: net1, netB: netWiper, R: R1, compId: c.id });
        links.push({ netA: netWiper, netB: net2, R: R2, compId: c.id });
      } else if (c.libraryId === 'photoresistor_ldr') {
        const net1 = getPinNetId(c.id, '1');
        const net2 = getPinNetId(c.id, '2');
        const rDark = c.powerW !== undefined ? c.powerW : 10000.0;
        const lux = c.lux !== undefined ? c.lux : 500.0;
        // Resistance drops as light lux increases
        const R = Math.max(10.0, rDark / (1.0 + lux / 10.0));
        links.push({ netA: net1, netB: net2, R, compId: c.id });
      } else if (c.libraryId === 'thermistor_ntc') {
        const net1 = getPinNetId(c.id, '1');
        const net2 = getPinNetId(c.id, '2');
        const rNominal = c.powerW !== undefined ? c.powerW : 10000.0;
        const temp = c.temperatureC !== undefined ? c.temperatureC : 25.0;
        // NTC thermistor nominal equation
        const R = Math.max(10.0, rNominal * Math.exp(3950.0 * (1.0 / (temp + 273.15) - 1.0 / 298.15)));
        links.push({ netA: net1, netB: net2, R, compId: c.id });
      } else {
        const netA = getPinNetId(c.id, '1');
        const netB = getPinNetId(c.id, '2');
        const R = parseResistorValue(c.value);
        links.push({ netA, netB, R, compId: c.id });
      }
    }

    if (c.libraryId === 'lm7805') {
      const netIn = getPinNetId(c.id, 'IN');
      const netGnd = getPinNetId(c.id, 'GND');
      const iOutA = c.lastOutputCurrentA || 0.0;
      const iInA = iOutA + 0.005; // 5mA quiescent current
      
      const prevVIn = c.pinVoltages?.['IN'] || 0;
      const prevVGnd = c.pinVoltages?.['GND'] || 0;
      const vIn = Math.max(0.1, prevVIn - prevVGnd);

      const R = Math.max(10.0, Math.min(100000.0, vIn / iInA));
      links.push({ netA: netIn, netB: netGnd, R, compId: c.id });
    }

    if (c.libraryId === 'buck_boost_mini') {
      const netInPos = getPinNetId(c.id, 'IN+');
      const netInNeg = getPinNetId(c.id, 'IN-');
      const iOutA = c.lastOutputCurrentA || 0.0;
      
      const vOut = c.voltageV !== undefined ? c.voltageV : 5.0;
      const pOut = vOut * iOutA;
      const eff = (c.efficiencyPct !== undefined ? c.efficiencyPct : 85.0) / 100.0;
      const pIn = pOut / eff;

      const prevVInPos = c.pinVoltages?.['IN+'] || 0;
      const prevVInNeg = c.pinVoltages?.['IN-'] || 0;
      const vIn = Math.max(0.1, Math.abs(prevVInPos - prevVInNeg));

      const iInA = pIn / vIn;
      const R = Math.max(10.0, Math.min(100000.0, vIn / (iInA + 1e-4)));
      links.push({ netA: netInPos, netB: netInNeg, R, compId: c.id });
    }

    if (c.libraryId === 'buck_converter_mini') {
      const netInPos = getPinNetId(c.id, 'IN+');
      const netInNeg = getPinNetId(c.id, 'IN-');
      const iOutA = c.lastOutputCurrentA || 0.0;
      
      const vOut = c.voltageV !== undefined ? c.voltageV : 5.0;
      const pOut = vOut * iOutA;
      const eff = (c.efficiencyPct !== undefined ? c.efficiencyPct : 85.0) / 100.0;
      const pIn = pOut / eff;

      const prevVInPos = c.pinVoltages?.['IN+'] || 0;
      const prevVInNeg = c.pinVoltages?.['IN-'] || 0;
      const vIn = Math.max(0.1, Math.abs(prevVInPos - prevVInNeg));

      const iInA = pIn / vIn;
      const R = Math.max(10.0, Math.min(100000.0, vIn / (iInA + 1e-4)));
      links.push({ netA: netInPos, netB: netInNeg, R, compId: c.id });
    }

    if (c.libraryId === 'boost_converter_mini') {
      const netInPos = getPinNetId(c.id, 'IN+');
      const netInNeg = getPinNetId(c.id, 'IN-');
      const iOutA = c.lastOutputCurrentA || 0.0;
      
      const vOut = c.voltageV !== undefined ? c.voltageV : 12.0;
      const pOut = vOut * iOutA;
      const eff = (c.efficiencyPct !== undefined ? c.efficiencyPct : 85.0) / 100.0;
      const pIn = pOut / eff;

      const prevVInPos = c.pinVoltages?.['IN+'] || 0;
      const prevVInNeg = c.pinVoltages?.['IN-'] || 0;
      const vIn = Math.max(0.1, Math.abs(prevVInPos - prevVInNeg));

      const iInA = pIn / vIn;
      const R = Math.max(10.0, Math.min(100000.0, vIn / (iInA + 1e-4)));
      links.push({ netA: netInPos, netB: netInNeg, R, compId: c.id });
    }

    // Microcontrollers draw active power loads
    if (c.type === 'mcu') {
      // Typically has VCC/Vin and GND pins
      const netGnd = getPinNetId(c.id, 'GND') || getPinNetId(c.id, 'GND2') || getPinNetId(c.id, 'GND3') || getPinNetId(c.id, 'VSS') || getPinNetId(c.id, 'VSSA') || getPinNetId(c.id, 'AGND');
      
      const vccPin = c.pins.find(p => p.name === '3V3' || p.name === '3.3V' || p.name === 'VCC' || p.name === 'VDD' || p.name === 'VDDA' || p.name === 'AVCC');
      const vinPin = c.pins.find(p => p.name === '5V' || p.name === 'VIN' || p.name === 'VBUS' || p.name === 'VSYS');

      // RP2040/ESP32 equivalent resistive loads to GND
      if (vccPin && netGnd) {
        const netVcc = getPinNetId(c.id, vccPin.name);
        const R = c.value?.includes('ESP32') ? 41.25 : 66.0; // ESP32 draws ~80mA, RP2040 draws ~50mA
        links.push({ netA: netVcc, netB: netGnd, R, compId: c.id });
      }
      if (vinPin && netGnd) {
        const netVin = getPinNetId(c.id, vinPin.name);
        const R = c.value?.includes('ESP32') ? 50.0 : 100.0; // Vin 5V load
        links.push({ netA: netVin, netB: netGnd, R, compId: c.id });
      }
    }

    if (c.type === 'diode' || c.libraryId === 'diode_1n4007' || c.libraryId === 'diode_schottky' || c.libraryId === 'diode_zener') {
      const netA = getPinNetId(c.id, 'A');
      const netK = getPinNetId(c.id, 'K');
      const vA = c.pinVoltages?.['A'] || 0.0;
      const vK = c.pinVoltages?.['K'] || 0.0;
      const vDiff = vA - vK;

      const vF = c.voltageV !== undefined ? c.voltageV : (c.libraryId === 'diode_schottky' ? 0.3 : 0.7);
      const vZ = c.zenerV !== undefined ? c.zenerV : 5.1;

      let R = 10000000.0; // Off state (10M)
      let vOffset = 0.0;
      if (vDiff > vF) {
        R = 0.5; // Forward conducting
        vOffset = vF;
      } else if (c.libraryId === 'diode_zener' && vDiff < -vZ) {
        R = 0.5; // Zener breakdown conducting in reverse
        vOffset = -vZ;
      }
      links.push({ netA, netB: netK, R, vOffset, compId: c.id });
    }

    if (c.type === 'capacitor' || c.libraryId === 'capacitor_electrolytic' || c.libraryId === 'capacitor_100n') {
      const isElectrolytic = c.libraryId === 'capacitor_electrolytic';
      const netA = getPinNetId(c.id, isElectrolytic ? '+' : '1');
      const netB = getPinNetId(c.id, isElectrolytic ? '-' : '2');
      links.push({ netA, netB, R: 10000000.0, compId: c.id }); // Blocking at DC (10M)
    }

    if (c.type === 'switch' || c.libraryId === 'switch_spst') {
      const net1 = getPinNetId(c.id, '1');
      const net2 = getPinNetId(c.id, '2');
      const isClosed = c.closed === undefined || c.closed;
      links.push({ netA: net1, netB: net2, R: isClosed ? 0.1 : 10000000.0, compId: c.id });
    }

    if (c.type === 'relay' || c.libraryId === 'relay_spdt') {
      const netCoil1 = getPinNetId(c.id, 'COIL1');
      const netCoil2 = getPinNetId(c.id, 'COIL2');
      const netCom = getPinNetId(c.id, 'COM');
      const netNo = getPinNetId(c.id, 'NO');
      const netNc = getPinNetId(c.id, 'NC');

      links.push({ netA: netCoil1, netB: netCoil2, R: 100.0, compId: c.id }); // Coil resistance

      const prevV1 = c.pinVoltages?.['COIL1'] || 0;
      const prevV2 = c.pinVoltages?.['COIL2'] || 0;
      const vCoil = Math.abs(prevV1 - prevV2);

      const energized = vCoil > 3.0; // Trigger voltage
      if (energized) {
        links.push({ netA: netCom, netB: netNo, R: 0.1, compId: c.id });
        links.push({ netA: netCom, netB: netNc, R: 10000000.0, compId: c.id });
      } else {
        links.push({ netA: netCom, netB: netNo, R: 10000000.0, compId: c.id });
        links.push({ netA: netCom, netB: netNc, R: 0.1, compId: c.id });
      }
    }

    if (c.type === 'gate' || c.libraryId === 'gate_and' || c.libraryId === 'gate_or' || c.libraryId === 'gate_not') {
      const netVcc = getPinNetId(c.id, 'VCC');
      const netGnd = getPinNetId(c.id, 'GND');
      const netOut = getPinNetId(c.id, 'OUT');

      if (c.libraryId === 'gate_and' || c.libraryId === 'gate_or') {
        const netA = getPinNetId(c.id, 'A');
        const netB = getPinNetId(c.id, 'B');
        links.push({ netA, netB: netGnd, R: 100000.0, compId: c.id });
        links.push({ netA: netB, netB: netGnd, R: 100000.0, compId: c.id });
      } else if (c.libraryId === 'gate_not') {
        const netIn = getPinNetId(c.id, 'IN');
        links.push({ netA: netIn, netB: netGnd, R: 100000.0, compId: c.id });
      }

      links.push({ netA: netVcc, netB: netGnd, R: 5000.0, compId: c.id }); // Quiescent draw

      const prevVVcc = c.pinVoltages?.['VCC'] || 0;
      const prevVGnd = c.pinVoltages?.['GND'] || 0;
      const isPowered = (prevVVcc - prevVGnd) > 2.0;

      let gateOutputHigh = false;
      if (isPowered) {
        if (c.libraryId === 'gate_and') {
          const prevVA = c.pinVoltages?.['A'] || 0;
          const prevVB = c.pinVoltages?.['B'] || 0;
          gateOutputHigh = prevVA > 2.0 && prevVB > 2.0;
        } else if (c.libraryId === 'gate_or') {
          const prevVA = c.pinVoltages?.['A'] || 0;
          const prevVB = c.pinVoltages?.['B'] || 0;
          gateOutputHigh = prevVA > 2.0 || prevVB > 2.0;
        } else if (c.libraryId === 'gate_not') {
          const prevVIn = c.pinVoltages?.['IN'] || 0;
          gateOutputHigh = prevVIn < 0.8;
        }
      }

      if (isPowered) {
        if (gateOutputHigh) {
          links.push({ netA: netOut, netB: netVcc, R: 50.0, compId: c.id });
        } else {
          links.push({ netA: netOut, netB: netGnd, R: 50.0, compId: c.id });
        }
      }
    }
  });

  // 4. Solve Voltages of Nets using Jacobi Relaxation Solver
  const netIds = Object.keys(nets);
  const voltages = {}; // netId -> V

  // Initialize voltage values
  netIds.forEach(id => {
    if (fixedVoltages[id] !== undefined) {
      voltages[id] = fixedVoltages[id];
    } else {
      voltages[id] = 0.0;
    }
  });

  // Run Jacobi iterations
  const iterations = 60;
  for (let iter = 0; iter < iterations; iter++) {
    const nextVoltages = { ...voltages };

    netIds.forEach(id => {
      // If it's a fixed source net, keep its voltage constant
      if (fixedVoltages[id] !== undefined) return;

      let weightedSum = 0;
      let conductSum = 0;

      // Check all links connected to this net
      links.forEach(l => {
        if (l.netA === id) {
          weightedSum += (voltages[l.netB] + (l.vOffset || 0.0)) / l.R;
          conductSum += 1.0 / l.R;
        } else if (l.netB === id) {
          weightedSum += (voltages[l.netA] - (l.vOffset || 0.0)) / l.R;
          conductSum += 1.0 / l.R;
        }
      });

      if (conductSum > 0) {
        nextVoltages[id] = weightedSum / conductSum;
      } else {
        nextVoltages[id] = 0.0; // Floating unconnected net drops to 0V
      }
    });

    Object.assign(voltages, nextVoltages);
  }

  // 5. Calculate currents flowing through links
  const compCurrents = {}; // compId -> mA
  const netCurrentDraw = {}; // netId -> total current flowing out of fixed source

  links.forEach(l => {
    const vDiff = voltages[l.netA] - voltages[l.netB] - (l.vOffset || 0.0);
    const currentA = Math.abs(vDiff) / l.R; // Amps
    compCurrents[l.compId] = currentA * 1000; // mA

    // Attribute current to sources
    if (fixedVoltages[l.netA] !== undefined) {
      netCurrentDraw[l.netA] = (netCurrentDraw[l.netA] || 0) + currentA;
    }
    if (fixedVoltages[l.netB] !== undefined) {
      netCurrentDraw[l.netB] = (netCurrentDraw[l.netB] || 0) + currentA;
    }
  });

  // Calculate current flow direction, rate, and netType (VCC/GND/Signal) for each trace
  const traceCurrents = {}; // trace.id -> { currentMA: number, direction: 'forward'|'backward'|'none', netType: 'vcc'|'gnd'|'signal' }
  traces.forEach(trace => {
    if (!trace.from || !trace.to) return;
    const fromCompId = trace.from.split('.')[0];
    const fromPinName = trace.from.split('.')[1];
    const toCompId = trace.to.split('.')[0];
    const toPinName = trace.to.split('.')[1];

    const netIdFrom = getPinNetId(fromCompId, fromPinName);
    const netIdTo = getPinNetId(toCompId, toPinName);

    const vFrom = voltages[netIdFrom] || 0;
    const vTo = voltages[netIdTo] || 0;
    const maxV = Math.max(vFrom, vTo);

    const isAcLive = isAcLiveNet[netIdFrom] || isAcLiveNet[netIdTo];
    const isAcNeut = isAcNeutNet[netIdFrom] || isAcNeutNet[netIdTo];
    const isAcEarth = isAcEarthNet[netIdFrom] || isAcEarthNet[netIdTo];
    const isGnd = isGndNet[netIdFrom] || isGndNet[netIdTo];

    let netType = 'signal';
    if (isAcLive) {
      netType = 'ac_live';
    } else if (isAcNeut) {
      netType = 'ac_neutral';
    } else if (isAcEarth) {
      netType = 'ac_earth';
    } else if (isGnd) {
      netType = 'gnd';
    } else if (maxV > 0.5) {
      netType = 'vcc';
    }

    const netId = netIdFrom;
    let activeCurrent = 0;
    links.forEach(l => {
      if (l.netA === netId || l.netB === netId) {
        const vDiff = voltages[l.netA] - voltages[l.netB] - (l.vOffset || 0.0);
        activeCurrent += Math.abs(vDiff) / l.R;
      }
    });

    const isCurrentFlowing = Math.abs(vFrom - vTo) > 0.01 || activeCurrent > 0.00001;
    const currentMA = isCurrentFlowing ? Math.max(0.1, Math.min(1000, activeCurrent * 1000)) : 0;
    
    let direction = 'none';
    if (vFrom > vTo + 0.001) direction = 'forward';
    else if (vTo > vFrom + 0.001) direction = 'backward';

    traceCurrents[trace.id] = { currentMA, direction, netType };
  });

  // 6. Update Battery charge state (Float charging vs discharging)
  const updatedComponents = components.map(c => {
    let updated = { ...c };
    if (c.isFried) return updated;

    if (c.type === 'battery') {
      const posPin = c.libraryId === 'battery_lipo_3s' ? 'V+' : '+';
      const gndPin = c.libraryId === 'battery_lipo_3s' ? 'GND' : '-';
      const netPos = getPinNetId(c.id, posPin);
      const netGnd = getPinNetId(c.id, gndPin);
      
      const vTerminal = voltages[netPos] - voltages[netGnd];
      const vInternal = batteryVoltages[c.id];

      // Internal resistance of battery
      const rInternal = 0.5; // Ohms

      let status = 'idle';
      let currentMA = 0;

      if (vTerminal > vInternal + 0.05) {
        // 1. Float Charging: higher potential is connected, forcing current IN
        const iCharge = (vTerminal - vInternal) / rInternal; // Amps
        currentMA = iCharge * 1000;
        status = 'charging';
        
        // Increase capacity
        const capacityGained = iCharge * (dt / 3600); // Ah
        updated.capacityRemainingAh = Math.min(c.capacityAh, (c.capacityRemainingAh || 0) + capacityGained);
        updated.chargePct = updated.capacityRemainingAh / c.capacityAh;
      } else {
        // 2. Discharging: draining current to support load components
        const iOut = netCurrentDraw[netPos] || 0; // Amps
        currentMA = iOut * 1000;

        if (iOut > 0.001) {
          status = 'discharging';
          const capacityLost = iOut * (dt / 3600); // Ah
          updated.capacityRemainingAh = Math.max(0, (c.capacityRemainingAh || 0) - capacityLost);
          updated.chargePct = updated.capacityRemainingAh / c.capacityAh;
        }
      }

      updated.voltageVActual = parseFloat(vInternal.toFixed(2));
      updated.batteryStatus = status;
      updated.batteryCurrentMA = parseFloat(currentMA.toFixed(1));
    }

    if (c.libraryId === 'lm7805') {
      const netOut = getPinNetId(c.id, 'OUT');
      const iOutA = netCurrentDraw[netOut] || 0;
      updated.lastOutputCurrentA = iOutA;
      updated.regulatorCurrentMA = parseFloat((iOutA * 1000).toFixed(1));
    }

    if (c.libraryId === 'buck_boost_mini' || c.libraryId === 'buck_converter_mini' || c.libraryId === 'boost_converter_mini') {
      const netOutPos = getPinNetId(c.id, 'OUT+');
      const iOutA = netCurrentDraw[netOutPos] || 0;
      updated.lastOutputCurrentA = iOutA;
      updated.regulatorCurrentMA = parseFloat((iOutA * 1000).toFixed(1));
    }

    // 7. Check electrical tolerances and apply damage
    if (c.type === 'mcu') {
      const vccPin = c.pins.find(p => p.name === '3V3' || p.name === '3.3V' || p.name === 'VCC');
      const vinPin = c.pins.find(p => p.name === '5V' || p.name === 'VIN' || p.name === 'VSYS' || p.name === 'VBUS');

      let overvolt = 0.0;
      if (vccPin) {
        const vVcc = voltages[getPinNetId(c.id, vccPin.name)] || 0;
        if (vVcc > 3.6) overvolt += (vVcc - 3.6) * 15.0; // rapid damage scaling
      }
      if (vinPin) {
        const vVin = voltages[getPinNetId(c.id, vinPin.name)] || 0;
        if (vVin > 6.0) overvolt += (vVin - 6.0) * 8.0;
      }

      if (overvolt > 0.05) {
        updated.health = Math.max(0, (c.health || 100) - overvolt * dt);
        if (updated.health <= 0) {
          updated.isFried = true;
          updated.friedTime = Date.now();
        }
      }
    }

    if (c.type === 'resistor') {
      const iMA = compCurrents[c.id] || 0;
      const R = parseResistorValue(c.value);
      const powerW = Math.pow(iMA / 1000, 2) * R; // P = I^2 * R

      // Resistors have 1/4 Watt tolerance (0.25W)
      if (powerW > 0.25) {
        const burnRate = (powerW - 0.25) * 10;
        updated.health = Math.max(0, (c.health || 100) - burnRate * dt);
        if (updated.health <= 0) {
          updated.isFried = true;
          updated.friedTime = Date.now();
        }
      }
    }

    if (c.libraryId === 'lm7805') {
      const prevVIn = c.pinVoltages?.['IN'] || 0;
      const prevVGnd = c.pinVoltages?.['GND'] || 0;
      const vIn = prevVIn - prevVGnd;
      const vOut = 5.0;
      const iOutA = c.lastOutputCurrentA || 0;
      
      const pDiss = Math.max(0, (vIn - vOut) * iOutA);
      
      let damageRate = 0.0;
      if (pDiss > 2.0) { // 2W linear regulation thermal limit
        damageRate += (pDiss - 2.0) * 15.0;
      }
      if (vIn > 35.0) { // Max input voltage
        damageRate += (vIn - 35.0) * 20.0;
      }
      
      if (damageRate > 0.05) {
        updated.health = Math.max(0, (c.health || 100) - damageRate * dt);
        if (updated.health <= 0) {
          updated.isFried = true;
          updated.friedTime = Date.now();
        }
      }
    }

    if (c.libraryId === 'buck_boost_mini' || c.libraryId === 'buck_converter_mini' || c.libraryId === 'boost_converter_mini') {
      const prevVInPos = c.pinVoltages?.['IN+'] || 0;
      const prevVInNeg = c.pinVoltages?.['IN-'] || 0;
      const vIn = Math.abs(prevVInPos - prevVInNeg);

      const vOut = c.voltageV !== undefined ? c.voltageV : 5.0;
      const iOutA = c.lastOutputCurrentA || 0;
      const pOut = vOut * iOutA;

      const maxIn = c.inputVoltageMaxV !== undefined ? c.inputVoltageMaxV : 35.0;
      const maxW = c.powerW !== undefined ? c.powerW : 15.0;

      let damageRate = 0.0;
      if (vIn > maxIn) {
        damageRate += (vIn - maxIn) * 12.0;
      }
      if (pOut > maxW) {
        damageRate += (pOut - maxW) * 8.0;
      }

      if (damageRate > 0.05) {
        updated.health = Math.max(0, (c.health || 100) - damageRate * dt);
        if (updated.health <= 0) {
          updated.isFried = true;
          updated.friedTime = Date.now();
        }
      }
    }

    if (c.libraryId === 'capacitor_electrolytic') {
      const netPos = getPinNetId(c.id, '+');
      const netNeg = getPinNetId(c.id, '-');
      const vPos = voltages[netPos] || 0.0;
      const vNeg = voltages[netNeg] || 0.0;
      const vDiff = vPos - vNeg;

      const vRating = c.voltageV !== undefined ? c.voltageV : 50.0;

      if (vNeg > vPos + 0.5 || vDiff > vRating) {
        updated.health = 0;
        updated.isFried = true;
        updated.friedTime = Date.now();
      }
    }

    if (c.libraryId === 'diode_1n4007' || c.libraryId === 'diode_schottky' || c.libraryId === 'diode_zener') {
      const iMA = compCurrents[c.id] || 0;
      const iA = iMA / 1000.0;
      const maxI = c.powerW !== undefined ? c.powerW : 1.0;

      if (iA > maxI) {
        const overloadRate = (iA - maxI) * 10.0;
        updated.health = Math.max(0, (c.health || 100) - overloadRate * dt);
        if (updated.health <= 0) {
          updated.isFried = true;
          updated.friedTime = Date.now();
        }
      }
    }

    // MCU / logic gate data pin overvoltage limit check
    if (c.type === 'mcu') {
      const is5VMCU = c.libraryId === 'atmega328p' || c.libraryId === 'attiny85';
      const maxDataV = is5VMCU ? 5.5 : 3.6;

      // Check all GPIO/data pins
      c.pins.forEach(p => {
        const isPowerOrGnd = p.name === '3V3' || p.name === '3.3V' || p.name === 'VCC' || p.name === 'VDD' || p.name === 'VDDA' || p.name === 'AVCC' || p.name === '5V' || p.name === 'VIN' || p.name === 'VSYS' || p.name === 'VBUS' || p.name === 'GND' || p.name === 'GND2' || p.name === 'GND3' || p.name === 'VSS' || p.name === 'VSSA' || p.name === 'AGND' || p.name === 'AREF';
        if (!isPowerOrGnd) {
          const pinV = voltages[getPinNetId(c.id, p.name)] || 0;
          if (pinV > maxDataV || pinV < -0.5) {
            // Overvoltage damage is instant and catastrophic for MCU silicon data lines
            updated.health = 0;
            updated.isFried = true;
            updated.friedTime = Date.now();
          }
        }
      });
    }

    // Logic gate overvoltage limit check and output short-circuit check
    if (c.type === 'gate' || c.libraryId === 'gate_and' || c.libraryId === 'gate_or' || c.libraryId === 'gate_not') {
      // 5V logic absolute maximum ratings
      c.pins.forEach(p => {
        const isPower = p.name === 'VCC' || p.name === 'GND';
        if (!isPower) {
          const pinV = voltages[getPinNetId(c.id, p.name)] || 0;
          if (pinV > 5.5 || pinV < -0.5) {
            updated.health = 0;
            updated.isFried = true;
            updated.friedTime = Date.now();
          }
        }
      });

      // Output short-circuit current check (exceeding 40mA will blow the output stage)
      const outCurrentMA = compCurrents[c.id] || 0;
      if (outCurrentMA > 40.0) {
        updated.health = 0;
        updated.isFried = true;
        updated.friedTime = Date.now();
      }
    }

    // Relay coil overload check
    if (c.type === 'relay' || c.libraryId === 'relay_spdt') {
      const prevV1 = c.pinVoltages?.['COIL1'] || 0;
      const prevV2 = c.pinVoltages?.['COIL2'] || 0;
      const vCoil = Math.abs(prevV1 - prevV2);
      if (vCoil > 7.5) { // 5V relay coil thermal limit
        updated.health = 0;
        updated.isFried = true;
        updated.friedTime = Date.now();
      }
    }

    // Expose dynamic simulation telemetry values to component
    if (c.pins && c.pins.length > 0) {
      updated.pinVoltages = {};
      c.pins.forEach(p => {
        updated.pinVoltages[p.name] = parseFloat((voltages[getPinNetId(c.id, p.name)] || 0).toFixed(2));
      });
    }

    return updated;
  });

  return {
    components: updatedComponents,
    traceCurrents
  };
}
