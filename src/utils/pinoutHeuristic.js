/**
 * Automatically maps pin directions and coordinates for a component based on its metadata and pin names.
 */
export function autoHeuristicPinoutMap(component) {
  if (!component || !component.pins || component.pins.length <= 2) {
    // Passive components (resistors, capacitors, LEDs) with 2 pins don't need layout mapping
    return component;
  }

  // If the pins already have non-zero coordinates or defined layouts, preserve them!
  const hasCoordinates = component.pins.some(p => (p.x !== undefined && p.x !== 0) || (p.y !== undefined && p.y !== 0));
  if (hasCoordinates) {
    return component;
  }

  const pinNames = component.pins.map(p => p.name);
  
  const sidesMap = {};
  const pinOffsets = {};
  const pitch = 15;

  // 1. Try to guess/map sides using keywords in pin names
  pinNames.forEach(pinName => {
    const pinLower = pinName.toLowerCase();
    
    // Default assignment based on electrical role
    if (pinLower.includes('gnd') || pinLower.includes('vss')) {
      sidesMap[pinName] = 'bottom';
    } else if (pinLower.match(/(3v3|5v|vcc|vdd|vin|vbat|vpp|power)/)) {
      sidesMap[pinName] = 'top';
    } else {
      // Default to left or right sequentially
      sidesMap[pinName] = 'left';
    }
  });

  // Distribute remaining non-power signal pins sequentially between left and right sides
  const signalPins = pinNames.filter(name => sidesMap[name] === 'left');
  signalPins.forEach((pinName, idx) => {
    if (idx < signalPins.length / 2) {
      sidesMap[pinName] = 'left';
    } else {
      sidesMap[pinName] = 'right';
    }
  });

  // Calculate side counts
  const leftCount = Object.values(sidesMap).filter(s => s === 'left').length;
  const rightCount = Object.values(sidesMap).filter(s => s === 'right').length;
  const topCount = Object.values(sidesMap).filter(s => s === 'top').length;
  const bottomCount = Object.values(sidesMap).filter(s => s === 'bottom').length;

  const width = Math.max(component.width || 120, Math.max(topCount, bottomCount) * pitch + 30);
  const height = Math.max(component.height || 180, Math.max(leftCount, rightCount) * pitch + 30);

  // Position offsets on each side
  const sides = ['left', 'right', 'top', 'bottom'];
  sides.forEach(side => {
    const sidePins = pinNames.filter(p => sidesMap[p] === side);
    // Sort them by original index
    sidePins.sort((a, b) => pinNames.indexOf(a) - pinNames.indexOf(b));
    sidePins.forEach((p, index) => {
      pinOffsets[p] = index * pitch + 15;
    });
  });

  // Generate coordinates using distributePinsBySides layout logic
  const leftPins = component.pins.filter(p => sidesMap[p.name] === 'left');
  const rightPins = component.pins.filter(p => sidesMap[p.name] === 'right');
  const topPins = component.pins.filter(p => sidesMap[p.name] === 'top');
  const bottomPins = component.pins.filter(p => sidesMap[p.name] === 'bottom');
  
  const mappedPins = [];
  
  leftPins.forEach((p, i) => {
    const py = pinOffsets[p.name];
    mappedPins.push({ ...p, x: 0, y: py, dir: 'left' });
  });
  
  rightPins.forEach((p, i) => {
    const py = pinOffsets[p.name];
    mappedPins.push({ ...p, x: width, y: py, dir: 'right' });
  });
  
  topPins.forEach((p, i) => {
    const px = pinOffsets[p.name];
    mappedPins.push({ ...p, x: px, y: 0, dir: 'up' });
  });
  
  bottomPins.forEach((p, i) => {
    const px = pinOffsets[p.name];
    mappedPins.push({ ...p, x: px, y: height, dir: 'down' });
  });

  return {
    ...component,
    width,
    height,
    pins: mappedPins,
    pinoutReference: component.description || component.value || ''
  };
}
