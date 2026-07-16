export const getBaseVoltage = (libId) => {
  if (libId === 'battery_aa') return 1.5;
  if (libId === 'battery_18650') return 3.7;
  if (libId === 'battery_lipo_3s') return 11.1;
  if (libId === 'battery_sla_12v') return 12.0;
  if (libId === 'power_adapter_12v') return 12.0;
  if (libId === 'buck_boost_mini') return 5.0;
  if (libId === 'buck_converter_mini') return 5.0;
  if (libId === 'boost_converter_mini') return 12.0;
  if (libId === 'capacitor_electrolytic') return 50.0;
  if (libId === 'diode_zener') return 5.1;
  if (libId === 'diode_1n4007') return 0.7;
  if (libId === 'diode_schottky') return 0.3;
  return 1.5;
};

export const getBaseCapacityOrPower = (libId) => {
  if (libId === 'battery_aa') return 2.5; // Ah
  if (libId === 'battery_18650') return 2.5; // Ah
  if (libId === 'battery_lipo_3s') return 2.2; // Ah
  if (libId === 'battery_sla_12v') return 7.2; // Ah
  if (libId === 'power_adapter_12v') return 24.0; // Watts
  if (libId === 'buck_boost_mini') return 15.0; // Watts
  if (libId === 'buck_converter_mini') return 15.0; // Watts
  if (libId === 'boost_converter_mini') return 15.0; // Watts
  if (libId === 'capacitor_electrolytic') return 10.0; // 10uF
  if (libId === 'potentiometer_10k') return 10000.0; // 10k ohms
  if (libId === 'photoresistor_ldr') return 10000.0; // 10k dark
  if (libId === 'thermistor_ntc') return 10000.0; // 10k nominal
  if (libId === 'diode_1n4007' || libId === 'diode_schottky' || libId === 'diode_zener') return 1.0; // 1 Amp max
  return 2.5;
};

export const calculateCustomizerSize = (libId, v, capOrPower) => {
  const isWattage = libId === 'power_adapter_12v' || libId === 'buck_boost_mini' || libId === 'buck_converter_mini' || libId === 'boost_converter_mini' || libId === 'diode_1n4007' || libId === 'diode_schottky' || libId === 'diode_zener';
  const whOrW = isWattage ? capOrPower : (libId === 'capacitor_electrolytic' ? (capOrPower * v * v) / 1000 : v * capOrPower);
  let baseWhOrW = 3.75;
  let baseW = 75;
  let baseH = 255;
  let minW = 45, maxW = 150;
  let minH = 150, maxH = 450;

  if (libId === 'power_adapter_12v') {
    baseWhOrW = 24.0; baseW = 180; baseH = 300;
    minW = 120; maxW = 360; minH = 180; maxH = 600;
  } else if (libId === 'buck_boost_mini' || libId === 'buck_converter_mini' || libId === 'boost_converter_mini') {
    baseWhOrW = 15.0; baseW = 150; baseH = 120;
    minW = 120; maxW = 300; minH = 90; maxH = 240;
  } else if (libId === 'capacitor_electrolytic') {
    baseWhOrW = 25.0; baseW = 60; baseH = 90;
    minW = 45; maxW = 120; minH = 60; maxH = 180;
  } else if (libId === 'diode_1n4007' || libId === 'diode_schottky' || libId === 'diode_zener') {
    baseWhOrW = 1.0; baseW = 60; baseH = 30;
    minW = 45; maxW = 150; minH = 20; maxH = 60;
  } else if (libId === 'potentiometer_10k') {
    return { width: 90, height: 60 };
  } else if (libId === 'photoresistor_ldr' || libId === 'thermistor_ntc') {
    return { width: 60, height: 30 };
  } else if (libId === 'battery_aa') {
    baseWhOrW = 3.75; baseW = 75; baseH = 255;
    minW = 45; maxW = 150; minH = 150; maxH = 450;
  } else if (libId === 'battery_18650') {
    baseWhOrW = 9.25; baseW = 90; baseH = 330;
    minW = 60; maxW = 180; minH = 180; maxH = 600;
  } else if (libId === 'battery_lipo_3s') {
    baseWhOrW = 24.42; baseW = 150; baseH = 450;
    minW = 90; maxW = 300; minH = 300; maxH = 900;
  } else if (libId === 'battery_sla_12v') {
    baseWhOrW = 86.4; baseW = 300; baseH = 600;
    minW = 150; maxW = 600; minH = 300; maxH = 1200;
  }

  const scaleFactor = Math.sqrt(whOrW / baseWhOrW);
  let width = Math.round((baseW * scaleFactor) / 15) * 15;
  let height = Math.round((baseH * scaleFactor) / 15) * 15;

  width = Math.max(minW, Math.min(maxW, width));
  height = Math.max(minH, Math.min(maxH, height));

  return { width, height };
};

export const getUpdatedCustomizerPins = (libId, w, h, currentPins) => {
  return currentPins.map(p => {
    if (libId === 'battery_aa' || libId === 'battery_18650') {
      if (p.name === '+') return { ...p, x: w / 2, y: 0 };
      if (p.name === '-') return { ...p, x: w / 2, y: h };
    } else if (libId === 'battery_lipo_3s') {
      if (p.name === 'V+') return { ...p, x: Math.round((w * 0.3) / 15) * 15, y: 0 };
      if (p.name === 'GND') return { ...p, x: Math.round((w * 0.7) / 15) * 15, y: 0 };
    } else if (libId === 'battery_sla_12v') {
      if (p.name === '+') return { ...p, x: Math.round((w * 0.25) / 15) * 15, y: 0 };
      if (p.name === '-') return { ...p, x: Math.round((w * 0.75) / 15) * 15, y: 0 };
    } else if (libId === 'power_adapter_12v') {
      if (p.name === 'AC_L') return { ...p, x: Math.round((w * 0.25) / 15) * 15, y: 0 };
      if (p.name === 'AC_N') return { ...p, x: Math.round((w * 0.75) / 15) * 15, y: 0 };
      if (p.name === 'DC_+') return { ...p, x: Math.round((w * 0.25) / 15) * 15, y: h };
      if (p.name === 'DC_-') return { ...p, x: Math.round((w * 0.75) / 15) * 15, y: h };
    } else if (libId === 'buck_boost_mini' || libId === 'buck_converter_mini' || libId === 'boost_converter_mini') {
      if (p.name === 'IN+') return { ...p, x: 0, y: Math.round((h * 0.25) / 15) * 15 };
      if (p.name === 'IN-') return { ...p, x: 0, y: Math.round((h * 0.75) / 15) * 15 };
      if (p.name === 'OUT+') return { ...p, x: w, y: Math.round((h * 0.25) / 15) * 15 };
      if (p.name === 'OUT-') return { ...p, x: w, y: Math.round((h * 0.75) / 15) * 15 };
    } else if (libId === 'potentiometer_10k') {
      if (p.name === '1') return { ...p, x: 0, y: Math.round((h * 0.5) / 15) * 15 };
      if (p.name === 'WIPER') return { ...p, x: Math.round((w * 0.5) / 15) * 15, y: h };
      if (p.name === '2') return { ...p, x: w, y: Math.round((h * 0.5) / 15) * 15 };
    } else if (libId === 'photoresistor_ldr' || libId === 'thermistor_ntc' || libId === 'diode_1n4007' || libId === 'diode_schottky' || libId === 'diode_zener') {
      const isDiode = p.name === 'A' || p.name === 'K';
      const firstPinName = isDiode ? 'A' : '1';
      if (p.name === firstPinName) return { ...p, x: 0, y: Math.round((h * 0.5) / 15) * 15 };
      else return { ...p, x: w, y: Math.round((h * 0.5) / 15) * 15 };
    } else if (libId === 'capacitor_electrolytic') {
      if (p.name === '+') return { ...p, x: Math.round((w * 0.25) / 15) * 15, y: h };
      if (p.name === '-') return { ...p, x: Math.round((w * 0.75) / 15) * 15, y: h };
    }
    return p;
  });
};

export const getUpdatedCustomizerShapes = (libId, w, h, v, capOrPower, extra = {}) => {
  let baseW = 75, baseH = 255;
  let shapes = [];
  
  if (libId === 'battery_aa') {
    baseW = 75; baseH = 255;
    shapes = [
      {"type":"rect","x":10,"y":30,"w":55,"h":195,"fill":"#d97706","stroke":"#78350f"},
      {"type":"rect","x":27.5,"y":15,"w":20,"h":15,"fill":"#f59e0b","stroke":"#78350f"},
      {"type":"rect","x":15,"y":225,"w":45,"h":10,"fill":"#94a3b8","stroke":"#475569"},
      {"type":"text","text":"AA CELL","x":37.5,"y":110,"fill":"#ffffff","font":"bold 12px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":37.5,"y":140,"fill":"#fcd34d","font":"10px sans-serif"}
    ];
  } else if (libId === 'battery_18650') {
    baseW = 90; baseH = 330;
    shapes = [
      {"type":"rect","x":10,"y":30,"w":70,"h":270,"fill":"#0284c7","stroke":"#0369a1"},
      {"type":"rect","x":32.5,"y":15,"w":25,"h":15,"fill":"#e2e8f0","stroke":"#475569"},
      {"type":"rect","x":15,"y":300,"w":60,"h":15,"fill":"#94a3b8","stroke":"#475569"},
      {"type":"text","text":"18650 CELL","x":45,"y":140,"fill":"#ffffff","font":"bold 12px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":45,"y":170,"fill":"#e0f2fe","font":"9px sans-serif"}
    ];
  } else if (libId === 'battery_lipo_3s') {
    baseW = 150; baseH = 450;
    shapes = [
      {"type":"rect","x":20,"y":40,"w":110,"h":370,"fill":"#475569","stroke":"#334155"},
      {"type":"rect","x":15,"y":30,"w":120,"h":10,"fill":"#1e293b","stroke":"#0f172a"},
      {"type":"rect","x":30,"y":70,"w":90,"h":110,"fill":"#ca8a04","stroke":"#a16207"},
      {"type":"text","text":"LIPO 3S","x":75,"y":110,"fill":"#ffffff","font":"bold 14px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":75,"y":140,"fill":"#ffffff","font":"bold 10px sans-serif"}
    ];
  } else if (libId === 'battery_sla_12v') {
    baseW = 300; baseH = 600;
    shapes = [
      {"type":"rect","x":20,"y":60,"w":260,"h":480,"fill":"#1e293b","stroke":"#0f172a"},
      {"type":"rect","x":55,"y":15,"w":40,"h":45,"fill":"#ef4444","stroke":"#b91c1c"},
      {"type":"rect","x":205,"y":15,"w":40,"h":45,"fill":"#3b82f6","stroke":"#1d4ed8"},
      {"type":"text","text":"SEALED LEAD ACID","x":150,"y":240,"fill":"#94a3b8","font":"bold 18px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":150,"y":290,"fill":"#f1f5f9","font":"bold 20px sans-serif"},
      {"type":"text","text":"CYCLE USE: 14.4-15.0V","x":150,"y":340,"fill":"#64748b","font":"11px sans-serif"}
    ];
  } else if (libId === 'power_adapter_12v') {
    baseW = 180; baseH = 300;
    shapes = [
      {"type":"rect","x":20,"y":40,"w":140,"h":220,"fill":"#18181b","stroke":"#27272a"},
      {"type":"rect","x":37.5,"y":0,"w":15,"h":40,"fill":"#e4e4e7","stroke":"#a1a1aa"},
      {"type":"rect","x":127.5,"y":0,"w":15,"h":40,"fill":"#e4e4e7","stroke":"#a1a1aa"},
      {"type":"text","text":"AC-DC ADAPTER","x":90,"y":110,"fill":"#71717a","font":"bold 11px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":90,"y":150,"fill":"#22c55e","font":"bold 13px sans-serif"},
      {"type":"text","text":"POWER_W","x":90,"y":180,"fill":"#a855f7","font":"bold 11px sans-serif"}
    ];
  } else if (libId === 'buck_boost_mini') {
    baseW = 150; baseH = 120;
    shapes = [
      {"type":"rect","x":10,"y":10,"w":130,"h":100,"fill":"#065f46","stroke":"#047857"},
      {"type":"rect","x":30,"y":30,"w":35,"h":30,"fill":"#1f2937","stroke":"#374151"},
      {"type":"circle","cx":90,"cy":45,"r":12,"fill":"#4b5563"},
      {"type":"rect","x":110,"y":35,"w":15,"h":15,"fill":"#ca8a04","stroke":"#a16207"},
      {"type":"text","text":"BUCK-BOOST","x":75,"y":75,"fill":"#a7f3d0","font":"bold 9px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":75,"y":95,"fill":"#34d399","font":"bold 10px sans-serif"}
    ];
  } else if (libId === 'buck_converter_mini') {
    baseW = 150; baseH = 120;
    shapes = [
      {"type":"rect","x":10,"y":10,"w":130,"h":100,"fill":"#1e3a8a","stroke":"#1d4ed8"},
      {"type":"rect","x":30,"y":30,"w":35,"h":30,"fill":"#1f2937","stroke":"#374151"},
      {"type":"circle","cx":90,"cy":45,"r":12,"fill":"#4b5563"},
      {"type":"rect","x":110,"y":35,"w":15,"h":15,"fill":"#ca8a04","stroke":"#a16207"},
      {"type":"text","text":"BUCK REGULATOR","x":75,"y":75,"fill":"#bfdbfe","font":"bold 9px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":75,"y":95,"fill":"#60a5fa","font":"bold 10px sans-serif"}
    ];
  } else if (libId === 'boost_converter_mini') {
    baseW = 150; baseH = 120;
    shapes = [
      {"type":"rect","x":10,"y":10,"w":130,"h":100,"fill":"#7f1d1d","stroke":"#b91c1c"},
      {"type":"rect","x":30,"y":30,"w":35,"h":30,"fill":"#1f2937","stroke":"#374151"},
      {"type":"circle","cx":90,"cy":45,"r":12,"fill":"#4b5563"},
      {"type":"rect","x":110,"y":35,"w":15,"h":15,"fill":"#ca8a04","stroke":"#a16207"},
      {"type":"text","text":"BOOST REGULATOR","x":75,"y":75,"fill":"#fecaca","font":"bold 9px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":75,"y":95,"fill":"#f87171","font":"bold 10px sans-serif"}
    ];
  } else if (libId === 'potentiometer_10k') {
    baseW = 90; baseH = 60;
    shapes = [
      {"type":"rect","x":10,"y":5,"w":70,"h":50,"fill":"#1e3a8a","stroke":"#172554"},
      {"type":"circle","cx":45,"cy":30,"r":18,"fill":"#3b82f6","stroke":"#1d4ed8"},
      {"type":"rect","x":43,"y":12,"w":4,"h":18,"fill":"#ffffff","stroke":"none"},
      {"type":"text","text":"VALUE_V_AH","x":45,"y":20,"fill":"#eff6ff","font":"bold 8px sans-serif"}
    ];
  } else if (libId === 'photoresistor_ldr') {
    baseW = 60; baseH = 30;
    shapes = [
      {"type":"rect","x":5,"y":5,"w":50,"h":20,"fill":"#f59e0b","stroke":"#d97706"},
      {"type":"rect","x":15,"y":10,"w":30,"h":10,"fill":"#fee2e2","stroke":"none"},
      {"type":"text","text":"LDR","x":30,"y":12,"fill":"#b91c1c","font":"bold 7px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":30,"y":20,"fill":"#7c2d12","font":"7px sans-serif"}
    ];
  } else if (libId === 'thermistor_ntc') {
    baseW = 60; baseH = 30;
    shapes = [
      {"type":"rect","x":5,"y":5,"w":50,"h":20,"fill":"#10b981","stroke":"#047857"},
      {"type":"rect","x":10,"y":10,"w":40,"h":10,"fill":"#ecfdf5","stroke":"none"},
      {"type":"text","text":"NTC","x":30,"y":12,"fill":"#065f46","font":"bold 7px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":30,"y":20,"fill":"#065f46","font":"7px sans-serif"}
    ];
  } else if (libId === 'capacitor_electrolytic') {
    baseW = 60; baseH = 90;
    shapes = [
      {"type":"rect","x":10,"y":10,"w":40,"h":70,"fill":"#1e293b","stroke":"#475569"},
      {"type":"rect","x":40,"y":10,"w":10,"h":70,"fill":"#e2e8f0","stroke":"none"},
      {"type":"text","text":"-","x":45,"y":30,"fill":"#475569","font":"bold 12px sans-serif"},
      {"type":"text","text":"+","x":20,"y":30,"fill":"#ffffff","font":"bold 12px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":25,"y":55,"fill":"#cbd5e1","font":"8px sans-serif"},
      {"type":"text","text":"POWER_W","x":25,"y":70,"fill":"#94a3b8","font":"7px sans-serif"}
    ];
  } else if (libId === 'diode_1n4007' || libId === 'diode_schottky' || libId === 'diode_zener') {
    baseW = 60; baseH = 30;
    const isSchottky = libId === 'diode_schottky';
    const isZener = libId === 'diode_zener';
    shapes = [
      {"type":"rect","x":10,"y":5,"w":40,"h":20,"fill":"#1e293b","stroke":"#0f172a"},
      {"type":"rect","x":40,"y":5,"w":6,"h":20,"fill":"#94a3b8","stroke":"none"},
      {"type":"text","text":isSchottky ? "SCHOTTKY" : (isZener ? "ZENER" : "DIODE"), "x":28, "y":12, "fill":"#ffffff", "font":"bold 6px sans-serif"},
      {"type":"text","text":"VALUE_V_AH","x":28,"y":20,"fill":"#cbd5e1","font":"6px sans-serif"}
    ];
  } else {
    return [];
  }

  const rx = w / baseW;
  const ry = h / baseH;

  return shapes.map(shape => {
    let scaled = { ...shape };
    if (shape.type === 'rect') {
      scaled.x = Math.round(shape.x * rx);
      scaled.y = Math.round(shape.y * ry);
      scaled.w = Math.round(shape.w * rx);
      scaled.h = Math.round(shape.h * ry);
    } else if (shape.type === 'circle') {
      scaled.cx = Math.round(shape.cx * rx);
      scaled.cy = Math.round(shape.cy * ry);
      scaled.r = Math.round(shape.r * Math.sqrt(rx * ry));
    } else if (shape.type === 'line') {
      scaled.x1 = Math.round(shape.x1 * rx);
      scaled.y1 = Math.round(shape.y1 * ry);
      if (libId === 'switch_spst') {
        const isClosed = (extra.closed === undefined || extra.closed);
        if (isClosed) {
          scaled.x2 = Math.round(55 * rx);
          scaled.y2 = Math.round(22.5 * ry);
        } else {
          scaled.x2 = Math.round(50 * rx);
          scaled.y2 = Math.round(10 * ry);
        }
      } else {
        scaled.x2 = Math.round(shape.x2 * rx);
        scaled.y2 = Math.round(shape.y2 * ry);
      }
    } else if (shape.type === 'text') {
      scaled.x = Math.round(shape.x * rx);
      scaled.y = Math.round(shape.y * ry);
      if (shape.text === 'VALUE_V_AH') {
        if (libId === 'power_adapter_12v') {
          scaled.text = `OUTPUT: ${v}V ${(capOrPower / v).toFixed(1)}A`;
        } else if (libId === 'buck_boost_mini' || libId === 'buck_converter_mini' || libId === 'boost_converter_mini') {
          scaled.text = `OUT: ${v}V`;
        } else if (libId === 'capacitor_electrolytic') {
          scaled.text = `${capOrPower}uF`;
        } else if (libId === 'potentiometer_10k') {
          scaled.text = `${extra.wiperPct !== undefined ? extra.wiperPct : 50}%`;
        } else if (libId === 'photoresistor_ldr') {
          scaled.text = `${extra.lux !== undefined ? extra.lux : 500} lx`;
        } else if (libId === 'thermistor_ntc') {
          scaled.text = `${extra.temperatureC !== undefined ? extra.temperatureC : 25}°C`;
        } else if (libId === 'diode_1n4007' || libId === 'diode_schottky' || libId === 'diode_zener') {
          scaled.text = `${capOrPower}A`;
        } else {
          scaled.text = `${v}V ${capOrPower >= 1 ? capOrPower : capOrPower * 1000}${capOrPower >= 1 ? 'Ah' : 'mAh'}`;
        }
      } else if (shape.text === 'POWER_W') {
        if (libId === 'capacitor_electrolytic') {
          scaled.text = `${v}V`;
        } else {
          scaled.text = `POWER: ${capOrPower}W MAX`;
        }
      } else if (shape.text === 'STATE_TXT') {
        scaled.text = (extra.closed === undefined || extra.closed) ? 'CLOSED' : 'OPEN';
      }
      // scale font size
      const fontMatch = shape.font?.match(/(\d+)px/);
      if (fontMatch) {
        const newSize = Math.round(parseInt(fontMatch[1], 10) * Math.sqrt(rx * ry));
        scaled.font = shape.font.replace(/\d+px/, `${newSize}px`);
      }
    }
    return scaled;
  });
};
