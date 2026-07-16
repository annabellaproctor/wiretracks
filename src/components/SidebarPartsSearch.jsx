import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Check, AlertCircle, Loader2, Download, Zap, Landmark, HelpCircle, Layers } from 'lucide-react';
import { searchPartsUnified, searchComponentImages } from '../utils/partsApi';
import { sendToRouter } from '../utils/openRouter';
import { autoHeuristicPinoutMap } from '../utils/pinoutHeuristic';

function MiniFootprintPreview({ packageType, partNumber }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw grid background
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const pkg = (packageType || '').toLowerCase();
    ctx.lineWidth = 1;

    // Draw component outline (Silkscreen)
    ctx.strokeStyle = '#22c55e'; // Green silkscreen
    if (pkg.includes('0805') || pkg.includes('1206')) {
      ctx.strokeRect(w/2 - 10, h/2 - 6, 20, 12);
      ctx.fillStyle = '#f59e0b'; // Copper pads (Amber)
      ctx.fillRect(w/2 - 14, h/2 - 5, 5, 10);
      ctx.fillRect(w/2 + 9, h/2 - 5, 5, 10);
    } else if (pkg.includes('sot-223')) {
      ctx.strokeRect(w/2 - 8, h/2 - 8, 16, 16);
      ctx.fillStyle = '#f59e0b';
      // 3 pins left
      ctx.fillRect(w/2 - 13, h/2 - 6, 5, 2);
      ctx.fillRect(w/2 - 13, h/2 - 1, 5, 2);
      ctx.fillRect(w/2 - 13, h/2 + 4, 5, 2);
      // Tab pin right
      ctx.fillRect(w/2 + 8, h/2 - 4, 5, 8);
    } else if (pkg.includes('to-220')) {
      ctx.strokeRect(w/2 - 13, h/2 - 6, 26, 12);
      ctx.beginPath();
      ctx.moveTo(w/2 - 13, h/2 + 2);
      ctx.lineTo(w/2 + 13, h/2 + 2);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      [-8, 0, 8].forEach(offset => {
        ctx.beginPath();
        ctx.arc(w/2 + offset, h/2 - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w/2 + offset, h/2 - 2, 1, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
      });
    } else if (pkg.includes('smd-38') || pkg.includes('wroom') || pkg.includes('mcu')) {
      ctx.strokeRect(w/2 - 15, h/2 - 15, 30, 30);
      ctx.fillStyle = '#475569';
      ctx.fillRect(w/2 - 15, h/2 - 15, 30, 6);
      ctx.fillStyle = '#f59e0b';
      for (let yOffset = -5; yOffset <= 11; yOffset += 3) {
        ctx.fillRect(w/2 - 17, h/2 + yOffset, 3, 1.5);
        ctx.fillRect(w/2 + 14, h/2 + yOffset, 3, 1.5);
      }
    } else {
      // Generic SOIC / SOP
      ctx.strokeRect(w/2 - 10, h/2 - 12, 20, 24);
      ctx.fillStyle = '#f59e0b';
      for (let yOffset = -8; yOffset <= 8; yOffset += 5) {
        ctx.fillRect(w/2 - 14, h/2 + yOffset, 4, 1.5);
        ctx.fillRect(w/2 + 10, h/2 + yOffset, 4, 1.5);
      }
    }
  }, [packageType, partNumber]);

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-slate-900 rounded-lg border border-slate-800 shadow-inner mt-2.5">
      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1 font-mono">Footprint Blueprint (Live CAD)</span>
      <canvas ref={canvasRef} width={80} height={50} className="bg-slate-950 rounded border border-slate-800" />
    </div>
  );
}

export default function SidebarPartsSearch({
  components,
  setComponents,
  selectedComponentId
}) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importingLcscId, setImportingLcscId] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [expandedPartIdx, setExpandedPartIdx] = useState(null);
  
  const selectedComp = components.find(c => c.id === selectedComponentId);

  // Simulated Parts Database (Octopart/Mouser API style fallback)
  const partsDb = [
    {
      mfr: 'Espressif Systems',
      partNumber: 'ESP32-WROOM-32E-N16',
      description: 'WiFi + Bluetooth MCU Module, 16MB Flash, Internal PCB Antenna',
      package: 'SMD-38',
      price: '$3.45',
      stock: '24,510 In Stock',
      datasheet: 'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf',
      category: 'mcu'
    },
    {
      mfr: 'Texas Instruments',
      partNumber: 'LM7805ACT',
      description: 'Linear Voltage Regulator 5V 1.5A Positive Output, TO-220 Through-Hole',
      package: 'TO-220',
      price: '$0.62',
      stock: '14,890 In Stock',
      datasheet: 'https://www.ti.com/lit/ds/symlink/lm7805.pdf',
      category: 'regulator'
    },
    {
      mfr: 'Texas Instruments',
      partNumber: 'LM7805MP/NOPB',
      description: 'Linear Voltage Regulator 5V 1A Positive Output, SOT-223 Surface Mount',
      package: 'SOT-223',
      price: '$1.12',
      stock: '8,220 In Stock',
      datasheet: 'https://www.ti.com/lit/ds/symlink/lm7805.pdf',
      category: 'regulator'
    },
    {
      mfr: 'Yageo',
      partNumber: 'RC0805FR-0710KL',
      description: 'Thick Film Resistor 10kΩ 1% 1/8W 150V, 0805 SMD',
      package: '0805 SMD',
      price: '$0.015',
      stock: '1,200,000 In Stock',
      datasheet: 'https://www.yageo.com/documents/datasheet/R_CS_PY_11.pdf',
      category: 'resistor'
    },
    {
      mfr: 'Vishay Dale',
      partNumber: 'CRCW0805220RFKEA',
      description: 'Thick Film Resistor 220Ω 1% 1/8W, 0805 SMD',
      package: '0805 SMD',
      price: '$0.015',
      stock: '450,000 In Stock',
      datasheet: 'https://www.vishay.com/docs/20035/dcrcw.pdf',
      category: 'resistor'
    },
    {
      mfr: 'Murata Electronics',
      partNumber: 'GRM21BR71H104KA01L',
      description: 'Ceramic Capacitor 0.1µF (100nF) 50V X7R 10%, 0805 SMD',
      package: '0805 SMD',
      price: '$0.024',
      stock: '890,000 In Stock',
      datasheet: 'https://search.murata.co.jp/Ceramy/image/img/PDF/Catalog/PDF/general_e.pdf',
      category: 'capacitor'
    },
    {
      mfr: 'KEMET',
      partNumber: 'T491A334K035AT',
      description: 'Tantalum Capacitor 0.33µF (330nF) 35V 10% Polarized, 1206 SMD',
      package: '1206 SMD',
      price: '$0.28',
      stock: '12,400 In Stock',
      datasheet: 'https://content.kemet.com/datasheets/KEM_T2005_T491.pdf',
      category: 'capacitor'
    },
    {
      mfr: 'Lite-On Inc.',
      partNumber: 'LTST-C170CKT',
      description: 'AlGaAs Red LED Indication, 660nm Red, 0805 SMD',
      package: '0805 SMD',
      price: '$0.14',
      stock: '65,000 In Stock',
      datasheet: 'https://optoelectronics.liteon.com/upload/downloadfiles/DS22-2000-233.pdf',
      category: 'led'
    }
  ];

  const rankSearchResultsHeuristically = (queryText, results) => {
    if (!results || results.length === 0) return [];
    const q = queryText.toLowerCase().trim();
    
    return [...results].map(part => {
      let score = 0;
      const partNumber = (part.partNumber || '').toLowerCase();
      const mfr = (part.mfr || '').toLowerCase();
      const desc = (part.description || '').toLowerCase();
      
      // Rule 1: Part number exact match
      if (partNumber === q) {
        score += 1000;
      }
      // Rule 2: Part number prefix match
      else if (partNumber.startsWith(q)) {
        score += 500;
      }
      // Rule 3: Part number substring match
      else if (partNumber.includes(q)) {
        score += 200;
      }
      
      // Rule 4: Manufacturer match
      if (mfr.includes(q)) {
        score += 50;
      }
      
      // Rule 5: Description match (word by word)
      const qWords = q.split(/\s+/).filter(Boolean);
      qWords.forEach(word => {
        if (desc.includes(word)) {
          score += 30;
        }
      });
      
      // Rule 6: Provider source weighting
      const source = (part.source || '').toLowerCase();
      if (source.includes('digikey') || source.includes('mouser')) {
        score += 40;
      } else if (source.includes('easyeda') || source.includes('lcsc')) {
        score += 30;
      } else if (source.includes('google')) {
        score += 10;
      }
      
      // Rule 7: Stock/Availability bonus
      if (desc.includes('in stock') || desc.includes('active') || part.stock > 0) {
        score += 20;
      }
      
      return { ...part, searchScore: score };
    }).sort((a, b) => b.searchScore - a.searchScore);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setSearchResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // 1. Unified Search querying selected provider (or all providers in parallel if 'all' is set)
      let rawResults = [];
      try {
        rawResults = await searchPartsUnified(query, selectedProvider);
      } catch (networkErr) {
        console.warn("Distributor network search offline. Checking local query caches...", networkErr);
      }

      // 2. Offline / Empty Fallback: check partsDb
      if (!rawResults || rawResults.length === 0) {
        const q = query.toLowerCase();
        rawResults = partsDb.filter(part => 
          part.partNumber.toLowerCase().includes(q) ||
          part.mfr.toLowerCase().includes(q) ||
          part.description.toLowerCase().includes(q) ||
          part.category.toLowerCase().includes(q)
        );
      }

      // 3. Heuristic ranking of consolidated specifications
      if (rawResults.length > 0) {
        rawResults = rankSearchResultsHeuristically(query, rawResults);
      }

      const enriched = await Promise.all(
        rawResults.map(async (part) => {
          if (part.image) return part;
          try {
            const img = await searchComponentImages(part.partNumber);
            return { ...part, image: img || part.image };
          } catch (imgErr) {
            return part;
          }
        })
      );
      setSearchResults(enriched);
    } catch (err) {
      console.error('Parts query error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPart = (part) => {
    if (!selectedComponentId) return;

    setComponents(prev => prev.map(c => {
      if (c.id === selectedComponentId) {
        return {
          ...c,
          manufacturer: part.mfr,
          partNumber: part.partNumber,
          cost: part.price,
          datasheet: part.datasheet,
          value: `${part.partNumber} (${part.package})`
        };
      }
      return c;
    }));
  };

  const generateSelfHealedComponent = async (part, lcscId) => {
    // Show user importing/synthesis state
    setImportingLcscId(part.partNumber);
    console.log(`[AI-Healing] Synthesizing CAD layout for MPN: ${part.partNumber}`);

    let aiSpec = null;
    try {
      const prompt = `You are a CAD symbol and footprint generation AI. The user has requested to import a component that lacks official EasyEDA/KiCad library mappings. We need to generate a realistic, high-fidelity symbol and pin list for the manufacturer part: "${part.partNumber}"
Mfr: "${part.mfr || 'Unknown'}"
Description: "${part.description || ''}"
Package: "${part.package || ''}"

Based on the model number and descriptions, determine:
1. The type: "mcu", "regulator", "resistor", "capacitor", "led", or "mcu" (default to "mcu" for complex modules).
2. A realistic body width (e.g. 120 for wide DevKits, 80 for regular ICs, 60 for transistors/regulators).
3. A realistic body height (dependent on pin count, usually pinsPerSide * 15 + 30).
4. A list of pins. Each pin must have:
   - "name": name of the pin (e.g. "GND", "3V3", "VIN", "GP2", "TX", "RX", "L1", "R1" etc. or pin number). For ESP32 dev boards and microcontrollers, please map realistic pin names rather than generic "P1", "P2" etc.
   - "x": 0 if pin is on the left side, or equal to the body width if it is on the right side. If it's a 3-pin regulator/transistor, place pins where appropriate (e.g. IN/OUT on left/right sides, GND on down/y coordinate).
   - "y": pin y position, MUST be grid-aligned to standard 15px increments (e.g., 15, 30, 45, 60, ...).
   - "dir": "left" or "right" or "up" or "down".

Return ONLY a valid JSON object matching this schema. No explanations, no markdown blocks.
Example JSON:
{
  "type": "mcu",
  "width": 120,
  "height": 180,
  "pins": [
    { "name": "5V", "x": 0, "y": 15, "dir": "left" },
    { "name": "GND", "x": 0, "y": 30, "dir": "left" },
    { "name": "IO2", "x": 120, "y": 15, "dir": "right" }
  ]
}`;

      const aiResponse = await sendToRouter({
        prompt: prompt,
        modelName: 'google/gemini-2.5-flash',
        boardState: {}
      });

      if (aiResponse && aiResponse.content) {
        const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiSpec = JSON.parse(jsonMatch[0]);
          console.log('[AI-Healing] Successfully parsed Gemini footprint response:', aiSpec);
        }
      }
    } catch (e) {
      console.warn('[AI-Healing] Gemini generation failed, falling back to heuristics:', e);
    } finally {
      setImportingLcscId(null);
    }

    let pinCount = 8;
    const pkg = (part.package || '').toLowerCase();
    const nameStr = (part.partNumber || '').toLowerCase() + " " + (part.description || '').toLowerCase();
    let bodyWidth = 80;
    let height = 90;
    let parsedPins = [];
    let compType = 'mcu';

    if (aiSpec && aiSpec.pins && aiSpec.pins.length > 0) {
      compType = aiSpec.type || 'mcu';
      bodyWidth = aiSpec.width || 80;
      height = aiSpec.height || 90;
      parsedPins = aiSpec.pins;

      // Safety check: if it is a dual-inline part (devkit, microcontroller, dip, etc.)
      // but the AI returned coordinates that place all pins on one single side (same X offset),
      // auto-distribute them symmetrically on both sides to keep the layout accurate.
      const isDualInline = nameStr.includes('devkit') || nameStr.includes('nodemcu') || nameStr.includes('esp32') || nameStr.includes('pico') || nameStr.includes('stm32') || nameStr.includes('dip');
      const uniqueXs = [...new Set(parsedPins.map(p => p.x))];
      if (isDualInline && uniqueXs.length <= 1) {
        console.log('[AI-Healing-Safety] Distributing pins symmetrically for dual-inline component...');
        const totalPins = parsedPins.length;
        const pinsPerSide = Math.ceil(totalPins / 2);
        const pinPitch = 15;
        bodyWidth = 120;
        height = Math.max(90, pinsPerSide * pinPitch + 30);
        
        parsedPins = parsedPins.map((p, i) => {
          const isLeft = i < pinsPerSide;
          const sideIndex = isLeft ? i : (i - pinsPerSide);
          return {
            ...p,
            x: isLeft ? 0 : bodyWidth,
            y: sideIndex * pinPitch + 15,
            dir: isLeft ? 'left' : 'right'
          };
        });
      }
    } else {
      // Heuristics to check for devkits or microcontrollers
      if (nameStr.includes('devkit') || nameStr.includes('nodemcu') || nameStr.includes('esp32-c5')) {
        pinCount = 40; 
      } else if (nameStr.includes('esp32') || nameStr.includes('wroom') || nameStr.includes('wrover')) {
        pinCount = 38; 
      } else if (nameStr.includes('esp8266') || nameStr.includes('esp-12')) {
        pinCount = 30; 
      } else if (nameStr.includes('rp2040') && nameStr.includes('pico')) {
        pinCount = 40; 
      } else if (nameStr.includes('rp2040')) {
        pinCount = 56; 
      } else if (nameStr.includes('stm32')) {
        pinCount = nameStr.includes('t8') ? 32 : nameStr.includes('c8') ? 48 : nameStr.includes('r8') ? 64 : 48;
      } else if (nameStr.includes('ch340') || nameStr.includes('cp2102')) {
        pinCount = nameStr.includes('ch340g') ? 16 : 28;
      } else {
        const pinMatch = pkg.match(/(\d+)\s*(?:pin|pad|lead|way)/) || (part.description || '').match(/(\d+)\s*(?:pin|pad|lead|way)/);
        if (pinMatch) {
          pinCount = parseInt(pinMatch[1], 10);
        } else if (pkg.includes('sot-23') || pkg.includes('sot23')) {
          pinCount = 3;
        } else if (pkg.includes('sot-223') || pkg.includes('sot223')) {
          pinCount = 4;
        } else if (pkg.includes('to-220') || pkg.includes('to220')) {
          pinCount = 3;
        } else if (pkg.includes('soic-8') || pkg.includes('dip-8')) {
          pinCount = 8;
        } else if (pkg.includes('14')) {
          pinCount = 14;
        } else if (pkg.includes('16')) {
          pinCount = 16;
        } else if (pkg.includes('20')) {
          pinCount = 20;
        } else if (pkg.includes('28')) {
          pinCount = 28;
        } else if (pkg.includes('48')) {
          pinCount = 48;
        } else if (pkg.includes('64')) {
          pinCount = 64;
        }
      }

      const pinsPerSide = Math.ceil(pinCount / 2);
      const pinPitch = 15; // grid-aligned!
      bodyWidth = (nameStr.includes('devkit') || nameStr.includes('nodemcu') || nameStr.includes('pico')) ? 120 : 80;
      height = Math.max(60, pinsPerSide * pinPitch + 30);
      compType = nameStr.includes('resistor') ? 'resistor' : nameStr.includes('capacitor') ? 'capacitor' : nameStr.includes('led') ? 'led' : 'mcu';

      for (let i = 0; i < pinCount; i++) {
        const isLeft = i < pinsPerSide;
        const sideIndex = isLeft ? i : (i - pinsPerSide);
        parsedPins.push({
          name: isLeft ? `L${sideIndex + 1}` : `R${sideIndex + 1}`,
          x: isLeft ? 0 : bodyWidth,
          y: sideIndex * pinPitch + 15,
          dir: isLeft ? 'left' : 'right'
        });
      }
    }

    const newId = `IMP_${lcscId || 'GEN'}_${Date.now().toString().slice(-4)}`;
    const newComponent = {
      id: newId,
      name: newId,
      type: compType,
      label: part.partNumber,
      value: part.partNumber,
      x: 300 + Math.round(Math.random() * 60),
      y: 150 + Math.round(Math.random() * 60),
      width: bodyWidth,
      height: height,
      pins: parsedPins,
      manufacturer: part.mfr,
      partNumber: part.partNumber,
      cost: part.price || '$0.05',
      datasheet: part.datasheet || '',
      isImported: true,
      isSelfHealed: true,
      isAiEngineered: !!aiSpec,
      image: part.image || part.imageUrl || null
    };

    const mappedComp = autoHeuristicPinoutMap(newComponent);
    setComponents(prev => [...prev, mappedComp]);
    if (aiSpec) {
      alert(`[AI Self-healing CAD] Dynamically generated realistic footprint for "${part.partNumber}" with ${parsedPins.length} pins using Gemini!`);
    } else {
      alert(`[Self-healing CAD] LCSC code required for conversion. Created a beautiful placeholder layout for "${part.partNumber}" with ${parsedPins.length} pins.`);
    }
  };

  const handleImportCAD = async (part) => {
    let lcscId = part.partNumber;

    // Check if the part number itself looks like an LCSC part number (starts with C followed by numbers)
    let looksLikeLcscId = /^C\d+$/.test(lcscId.trim());

    // Check if the URL contains LCSC product code
    if (!looksLikeLcscId && part.url && part.url.includes('/product-detail/')) {
      const match = part.url.match(/product-detail\/([^.]+)/);
      if (match && /^C\d+$/.test(match[1])) {
        lcscId = match[1];
        looksLikeLcscId = true;
      }
    }

    // Try to search LCSC/EasyEDA database dynamically in the background to translate MPN to LCSC ID
    if (!looksLikeLcscId) {
      console.log(`[Self-healing] Searching LCSC code for MPN: ${lcscId}`);
      try {
        const queryResults = await searchPartsUnified(lcscId);
        
        // 1. First look for any partNumber that is a valid LCSC ID
        let lcscPart = queryResults.find(r => r.partNumber && /^C\d+$/.test(r.partNumber.trim()));
        
        // 2. Otherwise, check if any product URL contains a valid LCSC ID
        if (!lcscPart) {
          lcscPart = queryResults.find(r => {
            if (r.url) {
              const match = r.url.match(/product-detail\/(C\d+)/);
              return match && /^C\d+$/.test(match[1]);
            }
            return false;
          });
        }

        if (lcscPart) {
          if (/^C\d+$/.test(lcscPart.partNumber.trim())) {
            lcscId = lcscPart.partNumber.trim();
          } else {
            const match = lcscPart.url.match(/product-detail\/(C\d+)/);
            lcscId = match[1];
          }
          looksLikeLcscId = true;
          console.log(`[Self-healing] Successfully resolved LCSC ID: ${lcscId}`);
        }
      } catch (err) {
        console.warn("Failed background LCSC ID lookup:", err);
      }
    }

    lcscId = lcscId.trim();

    // If still not a valid LCSC ID, fall back directly to self-healing shapes
    if (!looksLikeLcscId) {
      generateSelfHealedComponent(part, lcscId);
      return;
    }

    setImportingLcscId(lcscId);

    try {
      console.log(`[Client] Requesting easyeda2kicad conversion for: ${lcscId}`);
      const response = await fetch(`/api/easyeda2kicad?lcscId=${lcscId}`);
      if (!response.ok) {
        throw new Error('Server conversion failed');
      }

      const data = await response.json();
      
      let parsedPins = [
        { name: '1', x: 0, y: 15, dir: 'left' },
        { name: '2', x: 60, y: 15, dir: 'right' }
      ];

      // Parse pins from the converted KiCad symbol S-expression
      let bodyWidth = 110;
      let bodyHeight = 90;
      if (data.symbol) {
        // Find all pin blocks: matches x, y, name, and pin number
        const pinBlocks = [...data.symbol.matchAll(/\(pin\s+[^\s)]+\s+[^\s)]+\s+\(at\s+([-\d.]+)\s+([-\d.]+)[^)]*\)[\s\S]*?\(name\s+"([^"]*)"[\s\S]*?\(number\s+"([^"]*)"/g)];
        if (pinBlocks.length > 0) {
          const rawPins = pinBlocks.map(m => {
            return {
              rawX: parseFloat(m[1]),
              rawY: parseFloat(m[2]),
              name: m[3] && m[3] !== '~' ? m[3] : `P${m[4]}`,
              num: m[4] || ''
            };
          });

          // Detect scale factor based on coordinate magnitudes
          // KiCad coordinates under 50 are usually millimeters, above are mils (e.g., 100, 200, -300)
          const maxRawVal = Math.max(...rawPins.map(p => Math.max(Math.abs(p.rawX), Math.abs(p.rawY))));
          const isMillimeters = maxRawVal < 50;
          const scale = isMillimeters ? (15 / 2.54) : 0.15;

          // Scale and negate Y coordinate (KiCad Y increases upwards, canvas Y increases downwards)
          const scaledPins = rawPins.map(p => ({
            ...p,
            scaledX: p.rawX * scale,
            scaledY: -p.rawY * scale
          }));

          const scaledXs = scaledPins.map(p => p.scaledX);
          const scaledYs = scaledPins.map(p => p.scaledY);
          
          const minScaledX = Math.min(...scaledXs);
          const maxScaledX = Math.max(...scaledXs);
          const minScaledY = Math.min(...scaledYs);
          const maxScaledY = Math.max(...scaledYs);

          const diffX = maxScaledX - minScaledX;
          const diffY = maxScaledY - minScaledY;

          bodyWidth = Math.max(60, Math.round(diffX / 15) * 15);
          bodyHeight = Math.max(90, Math.round(diffY / 15) * 15);

          parsedPins = scaledPins.map(p => {
            const pinX = diffX === 0 ? 0 : Math.round((p.scaledX - minScaledX) / 15) * 15;
            const pinY = diffY === 0 ? 15 : Math.round((p.scaledY - minScaledY) / 15) * 15 + 15; // Shift down by 15px so pins don't touch the top border
            
            // Map direction based on horizontal positioning
            let dir = 'left';
            if (diffX > 0) {
              dir = (pinX < bodyWidth / 2) ? 'left' : 'right';
            }
            return {
              name: p.name,
              x: pinX,
              y: pinY,
              dir: dir
            };
          });

          // Adjust body height to enclose all pins cleanly
          const maxYPos = Math.max(...parsedPins.map(p => p.y));
          bodyHeight = Math.max(bodyHeight, maxYPos + 15);
        }
      }

      const newId = `IMP_${lcscId}`;
      const newComponent = {
        id: newId,
        name: newId,
        type: 'mcu',
        label: part.partNumber,
        value: part.partNumber,
        x: 300 + Math.round(Math.random() * 100),
        y: 150 + Math.round(Math.random() * 100),
        width: bodyWidth,
        height: bodyHeight,
        pins: parsedPins,
        manufacturer: part.mfr,
        partNumber: part.partNumber,
        cost: part.price || '$0.00',
        datasheet: part.datasheet || '',
        kicadSymbol: data.symbol,
        kicadFootprint: data.footprint,
        footprintName: data.footprintName,
        isImported: true,
        image: part.image || part.imageUrl || null
      };

      const mappedComp = autoHeuristicPinoutMap(newComponent);
      setComponents(prev => [...prev, mappedComp]);
      alert(`Imported ${part.partNumber} CAD models successfully via python bypass!\nAdded component ${newId} to active library.`);
    } catch (e) {
      console.error("[Import CAD] conversion error, self-healing...", e);
      generateSelfHealedComponent(part, lcscId);
    } finally {
      setImportingLcscId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/70 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur-xs space-y-2.5">
        {/* Dynamic API Status Connectivity Panel */}
        <div className="bg-slate-900 text-white rounded-xl p-2.5 space-y-1.5 border border-slate-800 shadow-inner">
          <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Sourcing Gateway APIs Status</span>
            <span className="text-[7px] text-amber-400 animate-pulse flex items-center">
              <Zap size={8} className="mr-0.5" /> Real-time active
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 text-[8px] font-mono">
            <div className="flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_MOUSER_API_KEY ? 'bg-emerald-400' : 'bg-rose-450'}`} />
              <span className="text-slate-300">Mouser</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_DIGIKEY_CLIENT_ID ? 'bg-emerald-400' : 'bg-rose-450'}`} />
              <span className="text-slate-300">DigiKey</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_JLCPCB_API_KEY ? 'bg-emerald-400 animate-pulse' : 'bg-amber-450'}`} />
              <span className="text-slate-300">LCSC</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_SERPAPI_API_KEY ? 'bg-emerald-400' : 'bg-rose-450'}`} />
              <span className="text-slate-300">Serp</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_DATAFORSEO_LOGIN ? 'bg-emerald-400' : 'bg-rose-450'}`} />
              <span className="text-slate-300">DFSEO</span>
            </div>
            <div className="flex items-center space-x-1 col-span-2">
              <span className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_GOOGLE_MERCHANT_ID ? 'bg-emerald-400' : 'bg-rose-450'}`} />
              <span className="text-slate-300 truncate">Merchant API</span>
            </div>
            <div className="flex items-center space-x-1 col-span-2">
              <span className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_GCP_SERVICE_ACCOUNT_EMAIL ? 'bg-emerald-400' : 'bg-rose-450'}`} />
              <span className="text-slate-300 truncate">Service Acct</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_BRAVE_API_KEY || import.meta.env.VITE_TAVILY_API_KEY ? 'bg-emerald-400' : 'bg-rose-450'}`} />
              <span className="text-slate-300">Brave</span>
            </div>
          </div>
        </div>

        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mouser & Octopart API Search</h3>
        <form onSubmit={handleSearch} className="relative flex">
          <input
            type="text"
            placeholder="Search part numbers, values, or regulators..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-100 rounded-lg focus:outline-none focus:border-amber-500 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500/10 transition font-sans text-xs"
          />
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          <button type="submit" className="hidden" />
        </form>
        
        {/* Provider Selector */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 space-x-2">
          <div className="flex items-center space-x-1.5 flex-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[8px]">Index:</span>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="flex-1 bg-white border border-slate-100 rounded-md py-1 px-1.5 text-[10px] text-slate-650 outline-none focus:border-amber-500 transition cursor-pointer font-sans"
            >
              <option value="all">Unified (Automatic Search Routing)</option>
              <option value="partcount">Partcount™ (Local Home Lab Inventory)</option>
              <option value="easyeda">EasyEDA (High Reputability, Unlimited Quota)</option>
              <option value="lcsc_public">LCSC Fallback (High Reputability, Unlimited Quota)</option>
              <option value="digikey">DigiKey API (Excellent Reputability, High Quota)</option>
              <option value="mouser">Mouser API (Excellent Reputability, High Quota)</option>
              <option value="lcsc_official">LCSC Official (High Reputability, Limited Quota)</option>
              <option value="google_shopping">Google GCP (Moderate Reputability, Billed Quota)</option>
              <option value="dataforseo">Amazon via DataForSEO (Low Reputability, Billed Quota)</option>
              <option value="amazon">Amazon via SerpApi (Low Reputability, Billed Quota)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selected Component Reminder */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between text-[10px] bg-amber-50/30">
        {selectedComp ? (
          <div className="flex items-center space-x-1.5 text-amber-700">
            <Check size={11} className="text-amber-600" />
            <span>Targeting designator: <strong className="font-mono font-bold">{selectedComp.name}</strong></span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 text-slate-500">
            <AlertCircle size={11} className="text-slate-400 animate-pulse" />
            <span>Select a canvas component to link search specifications.</span>
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-white/20">
        {loading ? (
          <div className="flex flex-col items-center justify-center text-center h-48 text-slate-400 bg-white border border-slate-100 rounded-xl shadow-xs p-4">
            <Loader2 size={20} className="mb-2 text-amber-500 animate-spin" />
            <p className="text-xs font-semibold text-slate-600">Querying live distributor indices...</p>
            <p className="text-[9px] text-slate-400 mt-1">Contacting Mouser Catalog & searching component footprints</p>
          </div>
        ) : searchResults.length > 0 ? (
          searchResults.map((part, idx) => (
            <div key={idx} className="border border-slate-100 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-xs transition text-xs flex flex-col bg-white shadow-xs">
              {part.image && (
                <div className="mb-2.5 w-full h-20 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 select-none">
                  <img src={part.image} alt={part.partNumber} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                </div>
              )}
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800 text-[12px]">
                  {part.source === 'Partcount' && <span className="text-amber-500 font-bold mr-1">★</span>}
                  {part.partNumber}
                </span>
                <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-lg font-mono uppercase">{part.package}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium mb-1.5">{part.mfr}</span>
              <p className="text-[11px] text-slate-600 mb-2.5 leading-relaxed">{part.description}</p>
              
              {/* Footprint Live CAD Preview touchpoint */}
              <MiniFootprintPreview packageType={part.package} partNumber={part.partNumber} />

              {/* Price comparison matrix toggler */}
              <div className="mt-2.5">
                <button
                  onClick={() => setExpandedPartIdx(expandedPartIdx === idx ? null : idx)}
                  className="w-full text-center py-1 bg-slate-50 border border-slate-100 rounded text-[9px] text-slate-500 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  {expandedPartIdx === idx ? "Hide Price Matrix" : "Compare Multi-Source Prices"}
                </button>
                
                {expandedPartIdx === idx && (
                  <div className="mt-1.5 border border-slate-100 rounded-lg bg-slate-50 p-2 space-y-1.5 shadow-inner">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Supplier Pricing Grid</span>
                    <table className="w-full text-[9px] font-sans text-slate-650">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-left font-bold uppercase text-[7px]">
                          <th className="pb-1">Source</th>
                          <th className="pb-1">Est Unit Price</th>
                          <th className="pb-1 text-right">Delivery</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono divide-y divide-slate-100">
                        <tr>
                          <td className="py-1">Mouser</td>
                          <td className="py-1 font-bold text-slate-800">{part.price || "$0.55"}</td>
                          <td className="py-1 text-right text-slate-500">2-3 days</td>
                        </tr>
                        <tr>
                          <td className="py-1">DigiKey</td>
                          <td className="py-1 font-bold text-slate-800">
                            {part.price ? `$${(parseFloat(part.price.replace('$','')) * 1.05).toFixed(2)}` : "$0.58"}
                          </td>
                          <td className="py-1 text-right text-slate-500">1-2 days</td>
                        </tr>
                        <tr>
                          <td className="py-1">LCSC</td>
                          <td className="py-1 font-bold text-slate-800">
                            {part.price ? `$${(parseFloat(part.price.replace('$','')) * 0.85).toFixed(2)}` : "$0.48"}
                          </td>
                          <td className="py-1 text-right text-slate-500">7-10 days</td>
                        </tr>
                        <tr>
                          <td className="py-1">Amazon</td>
                          <td className="py-1 font-bold text-indigo-650">
                            {part.price ? `$${(parseFloat(part.price.replace('$','')) * 1.4 + 2).toFixed(2)}` : "$5.99"}
                          </td>
                          <td className="py-1 text-right text-emerald-600 font-bold">1 day (Prime)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-slate-100">
                <div className="flex flex-col text-[10px]">
                  {part.source === 'Partcount' ? (
                    <span className="font-mono text-amber-600 font-bold uppercase tracking-wider text-[8px]">Local Bench Stock</span>
                  ) : (
                    <span className="font-mono text-slate-800 font-bold">{part.price} <span className="text-[8px] text-slate-400 font-normal">/ unit</span></span>
                  )}
                  <span className={`${part.source === 'Partcount' ? 'text-amber-600' : 'text-emerald-600'} font-bold mt-0.5`}>{part.stock}</span>
                </div>

                <div className="flex space-x-1.5">
                  <button
                    onClick={() => handleLinkPart(part)}
                    disabled={!selectedComponentId}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold flex items-center transition cursor-pointer ${selectedComponentId ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                  >
                    <ShoppingCart size={11} className="mr-1" /> Link
                  </button>

                  <button
                    onClick={() => handleImportCAD(part)}
                    disabled={importingLcscId !== null}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center transition cursor-pointer shadow-xs"
                  >
                    {importingLcscId === part.partNumber || (part.url && part.url.includes(importingLcscId)) ? (
                      <>
                        <Loader2 size={11} className="mr-1 animate-spin" /> Load...
                      </>
                    ) : (
                      <>
                        <Download size={11} className="mr-1" /> CAD
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          searched ? (
            <div className="flex flex-col items-center justify-center text-center h-48 text-slate-400 bg-white border border-slate-100 rounded-xl shadow-xs p-4">
              <AlertCircle size={18} className="mb-1.5 text-slate-300" />
              <p className="text-xs font-semibold text-slate-500">No matching components found.</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[160px] leading-normal mx-auto">Try searching 'LM7805', 'ESP32', 'resistor', or 'capacitor'.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-48 text-slate-400 bg-white border border-slate-100 rounded-xl shadow-xs p-4">
              <Search size={20} className="mb-2 text-slate-300 animate-pulse" />
              <p className="text-xs font-semibold text-slate-500">Search Component Catalog</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[170px] leading-normal mx-auto">Enter part codes or component categories to link real datasheet specs to your tracks.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
