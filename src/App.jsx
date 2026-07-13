import React, { useState, useEffect, useRef } from 'react';
import SchematicCanvas from './components/SchematicCanvas';
import BreadboardCanvas from './components/BreadboardCanvas';
import PcbCanvas from './components/PcbCanvas';
import SidebarLibrary from './components/SidebarLibrary';
import SidebarAiChat, { SparkyIcon } from './components/SidebarAiChat';
import SidebarPartsSearch from './components/SidebarPartsSearch';
import SidebarJlcpcb from './components/SidebarJlcpcb';
import { Cpu, Layers, GitFork, Download, Sparkles, Sliders, Search, ExternalLink, RefreshCw, X, ArrowLeft, ArrowRight, Eye, EyeOff, Ruler, ShoppingCart } from 'lucide-react';

const INITIAL_COMPONENTS = [
  {
    id: 'MCU1',
    name: 'MCU1',
    type: 'mcu',
    label: 'ESP32 Module',
    value: 'ESP32 NodeMCU',
    x: 380,
    y: 200,
    width: 105,
    height: 120,
    pins: [
      { name: '5V', x: 0, y: 15, dir: 'left' },
      { name: '3V3', x: 0, y: 30, dir: 'left' },
      { name: 'GND', x: 0, y: 105, dir: 'left' },
      { name: 'IO2', x: 105, y: 45, dir: 'right' },
      { name: 'IO4', x: 105, y: 60, dir: 'right' },
      { name: 'RX2', x: 105, y: 90, dir: 'right' },
      { name: 'TX2', x: 105, y: 105, dir: 'right' }
    ],
    manufacturer: 'Espressif Systems',
    partNumber: 'ESP32-WROOM-32E-N16',
    cost: '$3.45',
    datasheet: 'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf',
    groupId: null
  },
  {
    id: 'R1',
    name: 'R1',
    type: 'resistor',
    label: 'R_LED',
    value: '220Ω',
    x: 520,
    y: 230,
    width: 60,
    height: 30,
    pins: [
      { name: '1', x: 0, y: 15, dir: 'left' },
      { name: '2', x: 60, y: 15, dir: 'right' }
    ],
    manufacturer: 'Vishay Dale',
    partNumber: 'CRCW0805220RFKEA',
    cost: '$0.015',
    datasheet: 'https://www.vishay.com/docs/20035/dcrcw.pdf',
    groupId: null
  },
  {
    id: 'D1',
    name: 'D1',
    type: 'led',
    label: 'LED_RED',
    value: 'GaAs Red LED',
    x: 620,
    y: 215,
    width: 45,
    height: 60,
    pins: [
      { name: 'A', x: 0, y: 30, dir: 'left' },
      { name: 'K', x: 45, y: 30, dir: 'right' }
    ],
    manufacturer: 'Lite-On Inc.',
    partNumber: 'LTST-C170CKT',
    cost: '$0.14',
    datasheet: 'https://optoelectronics.liteon.com/upload/downloadfiles/DS22-2000-233.pdf',
    groupId: null
  },
  {
    id: 'U1',
    name: 'U1',
    type: 'regulator',
    label: 'Linear Regulator',
    value: 'LM7805 (5V)',
    x: 170,
    y: 240,
    width: 90,
    height: 60,
    pins: [
      { name: 'IN', x: 0, y: 15, dir: 'left' },
      { name: 'GND', x: 45, y: 60, dir: 'down' },
      { name: 'OUT', x: 90, y: 15, dir: 'right' }
    ],
    manufacturer: 'Texas Instruments',
    partNumber: 'LM7805ACT',
    cost: '$0.62',
    datasheet: 'https://www.ti.com/lit/ds/symlink/lm7805.pdf',
    groupId: null
  },
  {
    id: 'C1',
    name: 'C1',
    type: 'capacitor',
    label: 'C_IN',
    value: '0.33µF',
    x: 80,
    y: 240,
    width: 30,
    height: 45,
    pins: [
      { name: '1', x: 15, y: 0, dir: 'up' },
      { name: '2', x: 15, y: 45, dir: 'down' }
    ],
    manufacturer: 'Murata Electronics',
    partNumber: 'GRM21BR71H104KA01L',
    cost: '$0.024',
    datasheet: 'https://search.murata.co.jp/Ceramy/image/img/PDF/Catalog/PDF/general_e.pdf',
    groupId: null
  },
  {
    id: 'C2',
    name: 'C2',
    type: 'capacitor',
    label: 'C_OUT',
    value: '0.1µF',
    x: 290,
    y: 240,
    width: 30,
    height: 45,
    pins: [
      { name: '1', x: 15, y: 0, dir: 'up' },
      { name: '2', x: 15, y: 45, dir: 'down' }
    ],
    manufacturer: 'KEMET',
    partNumber: 'T491A334K035AT',
    cost: '$0.28',
    datasheet: 'https://content.kemet.com/datasheets/KEM_T2005_T491.pdf',
    groupId: null
  },
  {
    id: 'R2',
    name: 'R2',
    type: 'resistor',
    label: 'R_PULLUP',
    value: '10kΩ',
    x: 350,
    y: 80,
    width: 60,
    height: 30,
    pins: [
      { name: '1', x: 0, y: 15, dir: 'left' },
      { name: '2', x: 60, y: 15, dir: 'right' }
    ],
    manufacturer: 'Yageo',
    partNumber: 'RC0805FR-0710KL',
    cost: '$0.015',
    datasheet: 'https://www.yageo.com/documents/datasheet/R_CS_PY_11.pdf',
    groupId: null
  }
];

const INITIAL_TRACES = [
  {
    id: 'trace_mcu_res',
    from: 'MCU1.IO2',
    to: 'R1.1',
    isLocked: false,
    path: []
  },
  {
    id: 'trace_res_led',
    from: 'R1.2',
    to: 'D1.A',
    isLocked: false,
    path: []
  },
  {
    id: 'trace_led_gnd',
    from: 'D1.K',
    to: 'MCU1.GND',
    isLocked: true,
    path: []
  },
  {
    id: 'trace_c1_vin',
    from: 'C1.1',
    to: 'U1.IN',
    isLocked: false,
    path: []
  },
  {
    id: 'trace_c2_vout',
    from: 'C2.1',
    to: 'U1.OUT',
    isLocked: false,
    path: []
  },
  {
    id: 'trace_c1_gnd',
    from: 'C1.2',
    to: 'U1.GND',
    isLocked: false,
    path: []
  },
  {
    id: 'trace_c2_gnd',
    from: 'C2.2',
    to: 'U1.GND',
    isLocked: false,
    path: []
  },
  {
    id: 'trace_u1_gnd_mcu',
    from: 'U1.GND',
    to: 'MCU1.GND',
    isLocked: false,
    path: []
  },
  {
    id: 'trace_pullup_mcu_5v',
    from: 'R2.1',
    to: 'MCU1.5V',
    isLocked: false,
    path: []
  },
  {
    id: 'trace_pullup_mcu_io4',
    from: 'R2.2',
    to: 'MCU1.IO4',
    isLocked: false,
    path: []
  }
];

export default function App() {
  const [activeView, setActiveView] = useState('schematic'); 
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('wiretracks_solver_model') || 'google/gemini-2.5-flash'); 
  
  // VSCode-style Windowization properties
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState('ai'); // 'ai', 'library', 'search'
  
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const cached = localStorage.getItem('wiretracks_sidebar_width');
    return cached ? parseInt(cached, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Core project state
  const [components, setComponents] = useState([]);
  const [traces, setTraces] = useState([]);

  // Custom PCB state
  const [customPcbPads, setCustomPcbPads] = useState([]);
  const [customPcbTraces, setCustomPcbTraces] = useState([]);

  // Custom drawings
  const [customTexts, setCustomTexts] = useState([]);
  const [customShapes, setCustomShapes] = useState([]);

  const [selectedComponentId, setSelectedComponentId] = useState(null);
  const [selectedTraceId, setSelectedTraceId] = useState(null);
  
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(true);

  const [gridSize, setGridSize] = useState(15); 

  // Photoshop-style Layer Visibility
  const [layersVisibility, setLayersVisibility] = useState({
    grid: true,
    components: true,
    traces: true,
    lockedTraces: true,
    text: true,
    shapes: true,
    measurements: true
  });

  // Tour properties
  const [activeTour, setActiveTour] = useState(null); 
  const [cameraTarget, setCameraTarget] = useState(null); 

  // Mouse drag handles for resizable sidebar
  const startResize = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;
    const doResize = (e) => {
      // Sidebar is on the right, so width is computed from screen right edge
      const newWidth = window.innerWidth - e.clientX - 48; // offset VSCode Activity bar
      const constrained = Math.max(220, Math.min(600, newWidth));
      setSidebarWidth(constrained);
      localStorage.setItem('wiretracks_sidebar_width', constrained.toString());
    };
    const stopResize = () => {
      setIsResizing(false);
    };
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
    return () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing]);

  // Load state from local storage
  useEffect(() => {
    const cached = localStorage.getItem('wiretracks_session_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setComponents(parsed.components || []);
        setTraces(parsed.traces || []);
        setCustomPcbPads(parsed.customPcbPads || []);
        setCustomPcbTraces(parsed.customPcbTraces || []);
        setCustomTexts(parsed.customTexts || []);
        setCustomShapes(parsed.customShapes || []);
        if (parsed.gridSize) setGridSize(parsed.gridSize);
      } catch (e) {
        console.error("Failed to parse cached session data:", e);
        loadDefaultPreset();
      }
    } else {
      loadDefaultPreset();
    }
  }, []);

  // Save changes to local storage
  useEffect(() => {
    if (components.length === 0 && customPcbPads.length === 0) return;
    const sessionData = {
      components,
      traces,
      customPcbPads,
      customPcbTraces,
      customTexts,
      customShapes,
      gridSize
    };
    localStorage.setItem('wiretracks_session_data', JSON.stringify(sessionData));
  }, [components, traces, customPcbPads, customPcbTraces, customTexts, customShapes, gridSize]);

  // Center camera target step during tour navigation
  useEffect(() => {
    if (activeTour && activeTour.steps && activeTour.steps[activeTour.currentStep]) {
      const step = activeTour.steps[activeTour.currentStep];
      setCameraTarget({
        x: step.x,
        y: step.y,
        zoom: step.zoom || 1.3
      });
    }
  }, [activeTour]);

  const loadDefaultPreset = () => {
    setComponents(INITIAL_COMPONENTS);
    setTraces(INITIAL_TRACES);
    setCustomPcbPads([]);
    setCustomPcbTraces([]);
    setCustomTexts([]);
    setCustomShapes([]);
    setGridSize(15);
  };

  const handleClearAll = () => {
    setComponents([]);
    setTraces([]);
    setCustomPcbPads([]);
    setCustomPcbTraces([]);
    setCustomTexts([]);
    setCustomShapes([]);
    setSelectedComponentId(null);
    setSelectedTraceId(null);
    setActiveTour(null);
    setCameraTarget(null);
    localStorage.removeItem('wiretracks_session_data');
  };

  const handleTourNext = () => {
    if (!activeTour) return;
    const nextStep = Math.min(activeTour.steps.length - 1, activeTour.currentStep + 1);
    setActiveTour(prev => ({ ...prev, currentStep: nextStep }));
  };

  const handleTourBack = () => {
    if (!activeTour) return;
    const prevStep = Math.max(0, activeTour.currentStep - 1);
    setActiveTour(prev => ({ ...prev, currentStep: prevStep }));
  };

  const toggleLayerVisibility = (layerKey) => {
    setLayersVisibility(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Switch sidebar active tab VSCode-style
  const handleActivityBarClick = (tabName) => {
    if (activeSidebarTab === tabName && sidebarOpen) {
      // Toggle close
      setSidebarOpen(false);
    } else {
      setActiveSidebarTab(tabName);
      setSidebarOpen(true);
    }
  };

  // Export schematic as JSON netlist file
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ 
      components, 
      traces, 
      customPcbPads, 
      customPcbTraces,
      customTexts,
      customShapes
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wiretracks_pcb_project_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setExportDropdownOpen(false);
  };

  // Export schematic layout as raw Illustrator/AutoCAD compatible SVG file
  const handleExportSvg = () => {
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" style="background-color: #fbf9f5;">`;
    
    svgContent += `
      <defs>
        <pattern id="gridMinor" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
          <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#f1ebde" stroke-width="0.5"/>
        </pattern>
        <pattern id="gridMajor" width="${gridSize * 5}" height="${gridSize * 5}" patternUnits="userSpaceOnUse">
          <rect width="${gridSize * 5}" height="${gridSize * 5}" fill="url(#gridMinor)"/>
          <path d="M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}" fill="none" stroke="#e3d9c5" stroke-width="1.2"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gridMajor)"/>
    `;

    traces.forEach(trace => {
      if (!trace.path || trace.path.length < 2) return;
      const strokeColor = trace.isLocked ? '#d97706' : '#2563eb';
      const strokeWidth = trace.isLocked ? 3.5 : 2;
      let pathD = `M ${trace.path[0].x} ${trace.path[0].y}`;
      for (let i = 1; i < trace.path.length; i++) {
        pathD += ` L ${trace.path[i].x} ${trace.path[i].y}`;
      }
      svgContent += `<path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
    });

    components.forEach(comp => {
      svgContent += `<rect x="${comp.x}" y="${comp.y}" width="${comp.width}" height="${comp.height}" fill="#ffffff" stroke="#1e293b" stroke-width="2" />`;
      svgContent += `
        <text x="${comp.x + comp.width / 2}" y="${comp.y - 6}" font-family="Inter, sans-serif" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle">${comp.name}</text>
        <text x="${comp.x + comp.width / 2}" y="${comp.y + comp.height + 12}" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">${comp.value}</text>
      `;

      comp.pins.forEach(pin => {
        const px = comp.x + pin.x;
        const py = comp.y + pin.y;
        let tx = px;
        let ty = py;
        const pinLen = 8;
        if (pin.dir === 'left') tx -= pinLen;
        else if (pin.dir === 'right') tx += pinLen;
        else if (pin.dir === 'up') ty -= pinLen;
        else if (pin.dir === 'down') ty += pinLen;

        svgContent += `
          <line x1="${px}" y1="${py}" x2="${tx}" y2="${ty}" stroke="#1e293b" stroke-width="1.5" />
          <circle cx="${tx}" cy="${ty}" r="2.5" fill="#f8fafc" stroke="#1e293b" stroke-width="1.2" />
        `;
      });
    });

    customTexts.forEach(t => {
      svgContent += `<text x="${t.x}" y="${t.y}" font-family="Inter, sans-serif" font-size="12" fill="#334155">${t.text}</text>`;
    });

    customShapes.forEach(s => {
      svgContent += `<rect x="${s.x1}" y="${s.y1}" width="${Math.abs(s.x2 - s.x1)}" height="${Math.abs(s.y2 - s.y1)}" fill="none" stroke="${s.color || '#3b82f6'}" stroke-width="1.5" stroke-dasharray="4,4" />`;
    });

    svgContent += `</svg>`;

    const dataStr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wiretracks_vector_${Date.now()}.svg`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setExportDropdownOpen(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 font-sans overflow-hidden">
      {/* TOP HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 select-none z-20 shrink-0 shadow-xs">
        {/* Gold & Yellow parallel trace logo */}
        <div className="flex items-center space-x-2 select-none group cursor-pointer">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none transition-transform duration-200 group-hover:scale-105" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h5l4 6h6v4h3" stroke="#d97706" strokeWidth="2.5" />
            <path d="M3 10h5l4 6h6v4h3" stroke="#fbbf24" strokeWidth="1.8" />
            <circle cx="3" cy="6" r="1.2" fill="#d97706" />
            <circle cx="3" cy="10" r="1.2" fill="#fbbf24" />
            <circle cx="21" cy="16" r="1.2" fill="#d97706" />
            <circle cx="21" cy="20" r="1.2" fill="#fbbf24" />
          </svg>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-none lowercase">wiretracks</h1>
        </div>

        {/* View Selection Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => { setActiveView('schematic'); setSelectedComponentId(null); setSelectedTraceId(null); }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center transition ${activeView === 'schematic' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <GitFork size={13} className="mr-1.5" /> Circuit Schematic
          </button>
          <button
            onClick={() => { setActiveView('breadboard'); setSelectedComponentId(null); setSelectedTraceId(null); }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center transition ${activeView === 'breadboard' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Cpu size={13} className="mr-1.5" /> Prototype Board
          </button>
          <button
            onClick={() => { setActiveView('pcb'); setSelectedComponentId(null); setSelectedTraceId(null); }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center transition ${activeView === 'pcb' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Layers size={13} className="mr-1.5" /> Custom PCB
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 relative">
          <button
            onClick={loadDefaultPreset}
            className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg transition"
            title="Load Default Preset Blinker"
          >
            <RefreshCw size={13} />
          </button>
          
          <button
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center transition shadow-sm border border-slate-700"
          >
            <Download size={13} className="mr-1.5" /> CAD Export
          </button>
          
          {exportDropdownOpen && (
            <div className="absolute top-10 right-0 w-52 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-30 text-left font-sans text-xs">
              <button
                onClick={handleExportSvg}
                className="w-full px-4 py-2 hover:bg-slate-50 text-slate-700 flex flex-col font-medium border-b border-slate-100"
              >
                <span>Illustrator Vector (.svg)</span>
                <span className="text-[9px] text-slate-400 font-normal">Compatible with vector drawing apps</span>
              </button>
              <button
                onClick={handleExportJson}
                className="w-full px-4 py-2 hover:bg-slate-50 text-slate-700 flex flex-col font-medium border-b border-slate-100"
              >
                <span>JSON Netlist Schema (.json)</span>
                <span className="text-[9px] text-slate-400 font-normal">Raw components and wire coordinate data</span>
              </button>
              <button
                onClick={() => { alert("Exporting mock KiCad schematic payload..."); setExportDropdownOpen(false); }}
                className="w-full px-4 py-2 hover:bg-slate-50 text-slate-400 flex flex-col font-medium cursor-not-allowed"
                disabled
              >
                <span className="flex items-center">KiCad Schematic (.kicad_sch) <ExternalLink size={10} className="ml-1 text-slate-300" /></span>
                <span className="text-[9px] text-slate-400 font-normal">Export to CAD software (unavailable)</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN LAYOUT BODY */}
      <div className="flex-1 flex w-full overflow-hidden bg-slate-950">
        
        {/* Workspace Canvas Panel */}
        <main className="flex-1 h-full relative overflow-hidden bg-slate-900 border-r border-slate-800">
          
          {activeView === 'schematic' && (
            <SchematicCanvas
              components={components}
              setComponents={setComponents}
              traces={traces}
              setTraces={setTraces}
              customTexts={customTexts}
              setCustomTexts={setCustomTexts}
              customShapes={customShapes}
              setCustomShapes={setCustomShapes}
              selectedComponentId={selectedComponentId}
              setSelectedComponentId={setSelectedComponentId}
              selectedTraceId={selectedTraceId}
              setSelectedTraceId={setSelectedTraceId}
              cameraTarget={cameraTarget}
              setCameraTarget={setCameraTarget}
              gridSize={gridSize}
              layersVisibility={layersVisibility}
            />
          )}

          {activeView === 'breadboard' && (
            <BreadboardCanvas
              components={components}
              traces={traces}
            />
          )}

          {activeView === 'pcb' && (
            <PcbCanvas
              components={components}
              setComponents={setComponents}
              traces={traces}
              setTraces={setTraces}
              customPcbPads={customPcbPads}
              setCustomPcbPads={setCustomPcbPads}
              customPcbTraces={customPcbTraces}
              setCustomPcbTraces={setCustomPcbTraces}
              customTexts={customTexts}
              setCustomTexts={setCustomTexts}
              customShapes={customShapes}
              setCustomShapes={setCustomShapes}
              cameraTarget={cameraTarget}
              setCameraTarget={setCameraTarget}
              gridSize={gridSize}
              layersVisibility={layersVisibility}
            />
          )}



          {/* Floating sparky button in bottom-right corner to toggle chat */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute bottom-5 right-5 z-20 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 rounded-full flex items-center space-x-2 shadow-lg border border-amber-600 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer font-sans font-bold text-xs text-slate-950 hover:shadow-xl"
            title="Toggle sparky copilot chat panel"
          >
            <SparkyIcon size={16} />
            <span className="lowercase">ask sparky</span>
          </button>

          {/* Photoshop-style Layers Visibility Manager */}
          {layersPanelOpen ? (
            <div className="absolute right-3 top-3 z-10 glass-panel bg-white/95 border border-slate-200/90 rounded-xl shadow-md w-52 overflow-hidden flex flex-col font-sans select-none text-[11px]">
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between font-bold text-slate-700">
                <span className="flex items-center"><Layers size={13} className="mr-1.5 text-blue-500" /> CAD Layer Manager</span>
                <button onClick={() => setLayersPanelOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="p-2 space-y-1.5 divide-y divide-slate-100">
                <div className="space-y-1 pb-1.5">
                  {Object.keys(layersVisibility).map((key) => (
                    <button
                      key={key}
                      onClick={() => toggleLayerVisibility(key)}
                      className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-slate-100 transition text-left"
                    >
                      <span className="capitalize text-slate-600 font-medium">{key.replace('Traces', ' Traces')}</span>
                      <span className="text-slate-400 hover:text-blue-500">
                        {layersVisibility[key] ? <Eye size={12} className="text-blue-500" /> : <EyeOff size={12} className="text-slate-300" />}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 px-2 pb-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase mb-1.5">
                    <span>Grid Sizing</span>
                  </div>
                  <select
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="w-full bg-slate-100 border border-slate-200 rounded px-1.5 py-1 text-[10px] font-mono text-slate-700 outline-none"
                  >
                    <option value={10}>10px (Fine Grid)</option>
                    <option value={15}>15px (Standard)</option>
                    <option value={20}>20px (Medium Grid)</option>
                    <option value={30}>30px (Coarse Grid)</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLayersPanelOpen(true)}
              className="absolute right-3 top-3 z-10 p-2 bg-white/95 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition"
              title="Show Layer Manager"
            >
              <Layers size={15} className="text-slate-600" />
            </button>
          )}

          {/* Camera layout Tour Overlay */}
          {activeTour && activeTour.steps && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 glass-panel bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-xl border border-slate-200/80 shadow-lg flex items-center space-x-6 max-w-lg min-w-[340px]">
              <div className="flex-1 text-xs">
                <div className="flex items-center space-x-1 text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">
                  <Eye size={12} />
                  <span>Layout Tour: step {activeTour.currentStep + 1} of {activeTour.steps.length}</span>
                </div>
                <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">{activeTour.steps[activeTour.currentStep]?.title}</h4>
                <p className="text-slate-600 leading-normal text-[11px]">{activeTour.steps[activeTour.currentStep]?.description}</p>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={handleTourBack}
                  disabled={activeTour.currentStep === 0}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Previous Step"
                >
                  <ArrowLeft size={13} />
                </button>
                <button
                  onClick={handleTourNext}
                  disabled={activeTour.currentStep === activeTour.steps.length - 1}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Next Step"
                >
                  <ArrowRight size={13} />
                </button>
                <button
                  onClick={() => setActiveTour(null)}
                  className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 transition text-slate-500"
                  title="Exit Tour"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Resizable Sidebar Container */}
        {sidebarOpen && (
          <aside 
            className="relative h-full bg-white flex flex-col shrink-0 z-10 border-l border-slate-800 shadow-lg"
            style={{ width: `${sidebarWidth}px` }}
          >
            {/* Draggable resize handle */}
            <div
              onMouseDown={startResize}
              className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize hover:bg-blue-500/50 transition-all z-35"
              style={{ transform: 'translateX(-50%)' }}
            />

            <div className="flex-1 overflow-hidden flex flex-col">
              {activeSidebarTab === 'ai' && (
                <SidebarAiChat
                  components={components}
                  setComponents={setComponents}
                  traces={traces}
                  setTraces={setTraces}
                  customPcbPads={customPcbPads}
                  setCustomPcbPads={setCustomPcbPads}
                  customPcbTraces={customPcbTraces}
                  setCustomPcbTraces={setCustomPcbTraces}
                  setSelectedComponentId={setSelectedComponentId}
                  setSelectedTraceId={setSelectedTraceId}
                  handleClearAll={handleClearAll}
                  setActiveTour={setActiveTour}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                />
              )}
              
              {activeSidebarTab === 'library' && (
                <SidebarLibrary
                  components={components}
                  setComponents={setComponents}
                  traces={traces}
                  setTraces={setTraces}
                  selectedComponentId={selectedComponentId}
                  setSelectedComponentId={setSelectedComponentId}
                />
              )}

              {activeSidebarTab === 'search' && (
                <SidebarPartsSearch
                  components={components}
                  setComponents={setComponents}
                  selectedComponentId={selectedComponentId}
                />
              )}

              {activeSidebarTab === 'jlcpcb' && (
                <SidebarJlcpcb
                  components={components}
                  customPcbTraces={customPcbTraces}
                />
              )}
            </div>
          </aside>
        )}

        {/* VSCODE STYLE ACTIVITY BAR (Vertical selector on far right) */}
        <div className="w-12 bg-slate-900 border-l border-slate-800 flex flex-col items-center py-4 space-y-4 shrink-0 select-none z-10">
          <button
            onClick={() => handleActivityBarClick('ai')}
            className={`p-2.5 rounded-lg transition-all ${activeSidebarTab === 'ai' && sidebarOpen ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-inner scale-105' : 'text-slate-400 hover:text-slate-200'}`}
            title="sparky copilot chat"
          >
            <SparkyIcon size={20} />
          </button>
          
          <button
            onClick={() => handleActivityBarClick('library')}
            className={`p-2.5 rounded-lg transition-all ${activeSidebarTab === 'library' && sidebarOpen ? 'bg-slate-800 text-blue-400 border border-slate-700 shadow-inner scale-105' : 'text-slate-400 hover:text-slate-200'}`}
            title="Workspace Component Library"
          >
            <Sliders size={20} />
          </button>

          <button
            onClick={() => handleActivityBarClick('search')}
            className={`p-2.5 rounded-lg transition-all ${activeSidebarTab === 'search' && sidebarOpen ? 'bg-slate-800 text-green-400 border border-slate-700 shadow-inner scale-105' : 'text-slate-400 hover:text-slate-200'}`}
            title="Database Parts Index APIs"
          >
            <Search size={20} />
          </button>

          <button
            onClick={() => handleActivityBarClick('jlcpcb')}
            className={`p-2.5 rounded-lg transition-all ${activeSidebarTab === 'jlcpcb' && sidebarOpen ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-inner scale-105' : 'text-slate-400 hover:text-slate-200'}`}
            title="JLCPCB Fab Quotes & Balance"
          >
            <ShoppingCart size={20} />
          </button>
        </div>

      </div>

      {/* SOLID IDE STATUS BAR FOOTER */}
      <footer className="h-6.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 text-[10px] text-slate-400 font-mono select-none shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <span className="text-emerald-400 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
            sparky online
          </span>
          <span className="text-slate-700">|</span>
          <span>snap: {gridSize}px</span>
          <span className="text-slate-700">|</span>
          <span>nets: {traces.length} configured</span>
        </div>
        <div className="flex items-center space-x-3">
          <span>view: <strong className="text-slate-200 capitalize">{activeView}</strong></span>
          <span className="text-slate-700">|</span>
          <span>model: <span className="text-amber-400">{selectedModel.split('/').pop()}</span></span>
          <span className="text-slate-700">|</span>
          <span>© 2026 wiretracks</span>
        </div>
      </footer>
    </div>
  );
}
