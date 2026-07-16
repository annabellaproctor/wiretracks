import React, { useState, useEffect } from 'react';
import { Cpu, RotateCw, Trash2, Edit2, Link, Activity, Pause, Lightbulb, Battery, Box } from 'lucide-react';
import { deduplicateComponents, auditDatabaseWithAI } from '../utils/componentMerger';
import { autoHeuristicPinoutMap } from '../utils/pinoutHeuristic';
import { sqliteDb } from '../utils/sqliteDb';
import { getBaseVoltage, getBaseCapacityOrPower, calculateCustomizerSize, getUpdatedCustomizerPins, getUpdatedCustomizerShapes } from '../utils/batteryCustomizer';

function SchematicPreview({ type }) {
  if (type === 'resistor') {
    return <Activity className="w-12 h-6 text-slate-500" strokeWidth={1.5} />;
  }
  if (type === 'capacitor') {
    return <Pause className="w-12 h-6 text-slate-500" strokeWidth={1.5} />;
  }
  if (type === 'led') {
    return <Lightbulb className="w-12 h-6 text-slate-500" strokeWidth={1.5} />;
  }
  if (type === 'regulator') {
    return <Battery className="w-12 h-6 text-slate-500" strokeWidth={1.5} />;
  }
  return <Cpu className="w-12 h-6 text-slate-500" strokeWidth={1.5} />;
}

function PhysicalPreview({ type }) {
  if (type === 'resistor') {
    return <Activity className="w-12 h-6 text-slate-400" strokeWidth={2} />;
  }
  if (type === 'capacitor') {
    return <Pause className="w-12 h-6 text-amber-500" strokeWidth={2} />;
  }
  if (type === 'led') {
    return <Lightbulb className="w-12 h-6 text-red-500" strokeWidth={2} />;
  }
  if (type === 'regulator') {
    return <Battery className="w-12 h-6 text-slate-600" strokeWidth={2} />;
  }
  return <Cpu className="w-12 h-6 text-slate-800" strokeWidth={2} />;
}

export default function SidebarLibrary({
  components,
  setComponents,
  traces,
  setTraces,
  selectedComponentId,
  setSelectedComponentId
}) {
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('library');
  const selectedComp = components.find(c => c.id === selectedComponentId);

  // Grouped parts builder for BOM Exporter
  const getGroupedComponents = () => {
    const groups = {};
    components.forEach(c => {
      const key = `${c.type}_${c.value}_${c.package || 'SMD'}`;
      if (!groups[key]) {
        groups[key] = {
          type: c.type,
          value: c.value,
          package: c.package || 'SMD',
          mfr: c.mfr || 'Generic',
          partNumber: c.partNumber || `C_${c.type.toUpperCase()}_${c.value.replace(/[^a-zA-Z0-9]/g, '')}`,
          cost: c.cost || '$0.05',
          designators: [],
          items: []
        };
      }
      groups[key].designators.push(c.name);
      groups[key].items.push(c);
    });
    return Object.values(groups);
  };

  const getBOMTotalCost = () => {
    return components.reduce((sum, c) => {
      const priceVal = parseFloat((c.cost || '$0.05').replace(/[^\d.]/g, ''));
      return sum + (isNaN(priceVal) ? 0.05 : priceVal);
    }, 0).toFixed(2);
  };

  const downloadBOMCSV = () => {
    const grouped = getGroupedComponents();
    let csvContent = "Designator,Comment/Value,Package,LCSC Part Number,Manufacturer,Quantity,Unit Cost,Supplier URL\n";
    grouped.forEach(g => {
      const designators = g.designators.join("; ");
      const lcscPart = g.partNumber;
      const comment = g.value;
      const pkg = g.package;
      const mfr = g.mfr;
      const qty = g.items.length;
      const costStr = g.cost.replace('$', '');
      const urlStr = g.items[0]?.datasheet || "N/A";
      csvContent += `"${designators}","${comment}","${pkg}","${lcscPart}","${mfr}",${qty},"$${costStr}","${urlStr}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `BOM_Wiretracks_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCPLCSV = () => {
    let csvContent = "Designator,Mid X,Mid Y,Layer,Rotation\n";
    components.forEach(c => {
      const designator = c.name;
      const midX = c.x + (c.width || 45) / 2;
      const midY = c.y + (c.height || 30) / 2;
      const layer = "Top"; 
      const rotation = c.pins[0]?.dir === 'up' ? 90 : c.pins[0]?.dir === 'right' ? 180 : c.pins[0]?.dir === 'down' ? 270 : 0;
      csvContent += `"${designator}",${midX.toFixed(2)},${midY.toFixed(2)},"${layer}",${rotation}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `CPL_Wiretracks_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pre-configured components for library
  const [libraryItems, setLibraryItems] = useState(() => sqliteDb.tables.library);

  useEffect(() => {
    const handleUpdate = () => {
      setLibraryItems([...sqliteDb.tables.library]);
    };
    window.addEventListener('wiretracks_sqlite_db_update', handleUpdate);
    return () => window.removeEventListener('wiretracks_sqlite_db_update', handleUpdate);
  }, []);

  // Placer
  const handlePlaceComponent = (item) => {
    const newId = `${item.type}_${Date.now()}`;
    const newName = `${item.type.toUpperCase()}${components.filter(c => c.type === item.type).length + 1}`;
    const newComp = {
      id: newId,
      name: newName,
      type: item.type,
      value: item.value,
      x: 100,
      y: 100,
      width: item.width,
      height: item.height,
      pins: item.pins,
      customShapes: item.customShapes || [],
      partNumber: item.partNumber || 'N/A',
      cost: item.cost || '$0.05',
      datasheet: item.datasheet || '#',
      libraryId: item.id
    };

    const mappedComp = autoHeuristicPinoutMap(newComp);
    setComponents(prev => [...prev, mappedComp]);
    setSelectedComponentId(newId);
  };

  const handleUpdateProp = (field, val) => {
    setComponents(prev => prev.map(c => {
      if (c.id !== selectedComponentId) return c;

      let updated = { ...c, [field]: val };

      // Handle custom battery / adapter / regulators / capacitors / sensors resizing
      const isCustomizable = c.type === 'battery' || c.libraryId === 'power_adapter_12v' || c.libraryId === 'buck_boost_mini' || c.libraryId === 'buck_converter_mini' || c.libraryId === 'boost_converter_mini' || c.libraryId === 'capacitor_electrolytic' || c.libraryId === 'diode_1n4007' || c.libraryId === 'diode_schottky' || c.libraryId === 'diode_zener' || c.libraryId === 'potentiometer_10k' || c.libraryId === 'photoresistor_ldr' || c.libraryId === 'thermistor_ntc' || c.libraryId === 'switch_spst';
      if (isCustomizable && (field === 'voltageV' || field === 'capacityAh' || field === 'powerW' || field === 'wiperPct' || field === 'lux' || field === 'temperatureC' || field === 'closed')) {
        const v = parseFloat(field === 'voltageV' ? val : (c.voltageV !== undefined ? c.voltageV : getBaseVoltage(c.libraryId)));
        
        let capOrPower;
        const isWattage = c.libraryId === 'power_adapter_12v' || c.libraryId === 'buck_boost_mini' || c.libraryId === 'buck_converter_mini' || c.libraryId === 'boost_converter_mini' || c.libraryId === 'potentiometer_10k' || c.libraryId === 'photoresistor_ldr' || c.libraryId === 'thermistor_ntc' || c.libraryId === 'capacitor_electrolytic' || c.libraryId === 'diode_1n4007' || c.libraryId === 'diode_schottky' || c.libraryId === 'diode_zener' || c.libraryId === 'switch_spst';
        if (isWattage) {
          capOrPower = parseFloat(field === 'powerW' ? val : (c.powerW !== undefined ? c.powerW : getBaseCapacityOrPower(c.libraryId)));
        } else {
          capOrPower = parseFloat(field === 'capacityAh' ? val : (c.capacityAh !== undefined ? c.capacityAh : getBaseCapacityOrPower(c.libraryId)));
        }
        
        if (!isNaN(v) && !isNaN(capOrPower) && v > 0 && capOrPower > 0) {
          const { width: newWidth, height: newHeight } = calculateCustomizerSize(c.libraryId, v, capOrPower);
          const updatedPins = getUpdatedCustomizerPins(c.libraryId, newWidth, newHeight, c.pins);
          
          const extra = {
            wiperPct: field === 'wiperPct' ? parseFloat(val) : (c.wiperPct !== undefined ? c.wiperPct : 50),
            lux: field === 'lux' ? parseFloat(val) : (c.lux !== undefined ? c.lux : 500),
            temperatureC: field === 'temperatureC' ? parseFloat(val) : (c.temperatureC !== undefined ? c.temperatureC : 25),
            closed: field === 'closed' ? !!val : (c.closed !== undefined ? c.closed : true)
          };
          const updatedShapes = getUpdatedCustomizerShapes(c.libraryId, newWidth, newHeight, v, capOrPower, extra);
          
          updated = {
            ...updated,
            voltageV: v,
            [isWattage ? 'powerW' : 'capacityAh']: capOrPower,
            width: newWidth,
            height: newHeight,
            pins: updatedPins,
            customShapes: updatedShapes
          };
        }
      }
      return updated;
    }));
  };

  const handleRotateComponent = () => {
    if (!selectedComp) return;
    const newWidth = selectedComp.height;
    const newHeight = selectedComp.width;

    const rotatedPins = selectedComp.pins.map(pin => {
      const oldCx = selectedComp.width / 2;
      const oldCy = selectedComp.height / 2;
      const newCx = newWidth / 2;
      const newCy = newHeight / 2;

      const rx = pin.x - oldCx;
      const ry = pin.y - oldCy;

      const nx = -ry + newCx;
      const ny = rx + newCy;

      let ndir = pin.dir;
      if (pin.dir === 'left') ndir = 'up';
      else if (pin.dir === 'up') ndir = 'right';
      else if (pin.dir === 'right') ndir = 'down';
      else if (pin.dir === 'down') ndir = 'left';

      return {
        ...pin,
        x: Math.round(nx),
        y: Math.round(ny),
        dir: ndir
      };
    });

    setComponents(prev => prev.map(c => 
      c.id === selectedComponentId 
        ? { ...c, width: newWidth, height: newHeight, pins: rotatedPins } 
        : c
    ));
  };

  const handleDeleteSelected = () => {
    if (!selectedComponentId) return;
    setComponents(prev => prev.filter(c => c.id !== selectedComponentId));
    setTraces(prev => prev.filter(t => 
      !t.from.startsWith(`${selectedComponentId}.`) && 
      !t.to.startsWith(`${selectedComponentId}.`)
    ));
    setSelectedComponentId(null);
  };

  const handleAuditLibrary = async () => {
    if (components.length === 0) {
      alert("No components placed in the workspace yet. Add some components to audit the database!");
      return;
    }

    const confirmAudit = window.confirm("This will programmatically deduplicate and merge matching component profiles in your workspace (combining stocks, resolving price conflicts, and merging pins). Continue?");
    if (!confirmAudit) return;

    const programmaticallyDeduped = deduplicateComponents(components);
    const diffCount = components.length - programmaticallyDeduped.length;

    const geminiKey = import.meta.env.VITE_GEMINI_FALLBACK_API_KEY || import.meta.env.VITE_GEMINI_FAgreLLBACK_API_KEY || '';
    if (geminiKey) {
      if (window.confirm("Found Gemini Fallback API Key! Would you like to also run a background AI normalization check (correcting standard package sizes, checking pin styles) for free?")) {
        try {
          const audited = await auditDatabaseWithAI(programmaticallyDeduped, geminiKey);
          setComponents(audited);
          alert(`Successfully audited database!\n- Programmatic deduplication consolidated ${diffCount} duplicate entries.\n- AI Audit normalized package names & pin styles successfully.`);
          return;
        } catch (e) {
          console.error("AI Audit failed:", e);
        }
      }
    }

    setComponents(programmaticallyDeduped);
    alert(`Successfully consolidated database!\n- Programmatic deduplication resolved ${diffCount} duplicate profiles.`);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/70 overflow-hidden font-sans">
      {/* Sidebar Tab Switcher */}
      <div className="flex border-b border-slate-100 bg-white/80 backdrop-blur-xs select-none shrink-0">
        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${activeTab === 'library' ? 'border-b-2 border-amber-500 text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Library
        </button>
        <button
          onClick={() => setActiveTab('bom_cpl')}
          className={`flex-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${activeTab === 'bom_cpl' ? 'border-b-2 border-amber-500 text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          BOM / CPL
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'library' ? (
          <>
            <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur-xs">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parts Library</h3>
                <button
                  onClick={handleAuditLibrary}
                  className="text-[9px] font-bold text-slate-500 hover:text-amber-600 bg-white hover:bg-amber-50 border border-slate-100 rounded-lg px-2 py-1 transition flex items-center shadow-2xs cursor-pointer"
                >
                  🧹 Audit & Dedupe
                </button>
              </div>
              <div className="space-y-2">
                {libraryItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePlaceComponent(item)}
                    className="w-full flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl hover:border-amber-500 hover:bg-amber-50/10 hover:shadow-xs active:bg-amber-100/10 transition text-left group cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="text-xs font-semibold text-slate-700 block truncate">{item.label}</span>
                      <span className="text-[9px] text-slate-400 font-mono block mt-0.5 truncate">{item.value}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100 group-hover:bg-white group-hover:border-slate-100 transition">
                      <div className="flex flex-col items-center">
                        <span className="text-[6px] text-slate-400 font-bold uppercase mb-0.5 tracking-wider font-mono">SCH</span>
                        <SchematicPreview type={item.type} />
                      </div>
                      <span className="h-6 w-px bg-slate-200"></span>
                      <div className="flex flex-col items-center">
                        <span className="text-[6px] text-slate-400 font-bold uppercase mb-0.5 tracking-wider font-mono">REAL</span>
                        <PhysicalPreview type={item.type} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* PROPERTIES EDITOR */}
            <div className="p-4 bg-white/20">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Properties Inspector</h3>
              
              {selectedComp ? (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                    <div>
                      <span className="text-xs font-bold text-slate-800">{selectedComp.name}</span>
                      <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{selectedComp.type.toUpperCase()}</span>
                    </div>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={handleRotateComponent}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-100 text-slate-600 shadow-xs transition cursor-pointer"
                        title="Rotate Component 90°"
                      >
                        <RotateCw size={13} />
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 shadow-xs transition cursor-pointer"
                        title="Delete Component"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
                    {(selectedComp.type === 'battery' || selectedComp.libraryId === 'power_adapter_12v' || selectedComp.libraryId === 'buck_boost_mini' || selectedComp.libraryId === 'buck_converter_mini' || selectedComp.libraryId === 'boost_converter_mini') && (
                      <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-amber-700/80 uppercase tracking-wider mb-1">
                              {selectedComp.libraryId === 'buck_boost_mini' || selectedComp.libraryId === 'buck_converter_mini' || selectedComp.libraryId === 'boost_converter_mini' ? 'Output Voltage (V)' : 'Voltage (V)'}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={selectedComp.voltageV !== undefined ? selectedComp.voltageV : getBaseVoltage(selectedComp.libraryId)}
                              onChange={(e) => handleUpdateProp('voltageV', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-amber-700/80 uppercase tracking-wider mb-1">
                              {selectedComp.libraryId === 'power_adapter_12v' || selectedComp.libraryId === 'buck_boost_mini' || selectedComp.libraryId === 'buck_converter_mini' || selectedComp.libraryId === 'boost_converter_mini' ? 'Power (Watts)' : 'Capacity (Ah)'}
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={
                                selectedComp.libraryId === 'power_adapter_12v' || selectedComp.libraryId === 'buck_boost_mini' || selectedComp.libraryId === 'buck_converter_mini' || selectedComp.libraryId === 'boost_converter_mini'
                                  ? (selectedComp.powerW !== undefined ? selectedComp.powerW : getBaseCapacityOrPower(selectedComp.libraryId))
                                  : (selectedComp.capacityAh !== undefined ? selectedComp.capacityAh : getBaseCapacityOrPower(selectedComp.libraryId))
                              }
                              onChange={(e) => {
                                const field = selectedComp.libraryId === 'power_adapter_12v' || selectedComp.libraryId === 'buck_boost_mini' || selectedComp.libraryId === 'buck_converter_mini' || selectedComp.libraryId === 'boost_converter_mini' ? 'powerW' : 'capacityAh';
                                handleUpdateProp(field, e.target.value);
                              }}
                              className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white font-mono text-[11px]"
                            />
                          </div>
                        </div>

                        {(selectedComp.libraryId === 'buck_boost_mini' || selectedComp.libraryId === 'buck_converter_mini' || selectedComp.libraryId === 'boost_converter_mini') && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[9px] font-bold text-amber-700/80 uppercase tracking-wider mb-1">Min Input (V)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={selectedComp.inputVoltageMinV !== undefined ? selectedComp.inputVoltageMinV : 3.0}
                                  onChange={(e) => handleUpdateProp('inputVoltageMinV', parseFloat(e.target.value))}
                                  className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white font-mono text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-amber-700/80 uppercase tracking-wider mb-1">Max Input (V)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={selectedComp.inputVoltageMaxV !== undefined ? selectedComp.inputVoltageMaxV : 35.0}
                                  onChange={(e) => handleUpdateProp('inputVoltageMaxV', parseFloat(e.target.value))}
                                  className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white font-mono text-[11px]"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-amber-700/80 uppercase tracking-wider mb-1">Efficiency (%)</label>
                              <input
                                type="number"
                                step="1"
                                value={selectedComp.efficiencyPct !== undefined ? selectedComp.efficiencyPct : 85}
                                onChange={(e) => handleUpdateProp('efficiencyPct', parseFloat(e.target.value))}
                                className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white font-mono text-[11px]"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {selectedComp.libraryId === 'potentiometer_10k' && (
                      <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 space-y-2.5">
                        <div>
                          <label className="block text-[9px] font-bold text-blue-700/80 uppercase tracking-wider mb-1">Total Resistance (Ω)</label>
                          <input
                            type="number"
                            step="100"
                            value={selectedComp.powerW !== undefined ? selectedComp.powerW : getBaseCapacityOrPower(selectedComp.libraryId)}
                            onChange={(e) => handleUpdateProp('powerW', parseFloat(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-blue-700/80 uppercase tracking-wider mb-1">Wiper Position: {selectedComp.wiperPct !== undefined ? selectedComp.wiperPct : 50}%</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={selectedComp.wiperPct !== undefined ? selectedComp.wiperPct : 50}
                            onChange={(e) => handleUpdateProp('wiperPct', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {selectedComp.libraryId === 'photoresistor_ldr' && (
                      <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-2.5">
                        <div>
                          <label className="block text-[9px] font-bold text-amber-700/80 uppercase tracking-wider mb-1">Dark Resistance (Ω)</label>
                          <input
                            type="number"
                            step="100"
                            value={selectedComp.powerW !== undefined ? selectedComp.powerW : getBaseCapacityOrPower(selectedComp.libraryId)}
                            onChange={(e) => handleUpdateProp('powerW', parseFloat(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-amber-700/80 uppercase tracking-wider mb-1">Ambient Light: {selectedComp.lux !== undefined ? selectedComp.lux : 500} lux</label>
                          <input
                            type="range"
                            min="0"
                            max="10000"
                            step="10"
                            value={selectedComp.lux !== undefined ? selectedComp.lux : 500}
                            onChange={(e) => handleUpdateProp('lux', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-amber-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {selectedComp.libraryId === 'thermistor_ntc' && (
                      <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 space-y-2.5">
                        <div>
                          <label className="block text-[9px] font-bold text-emerald-700/80 uppercase tracking-wider mb-1">Nominal Resistance @25°C (Ω)</label>
                          <input
                            type="number"
                            step="100"
                            value={selectedComp.powerW !== undefined ? selectedComp.powerW : getBaseCapacityOrPower(selectedComp.libraryId)}
                            onChange={(e) => handleUpdateProp('powerW', parseFloat(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-emerald-700/80 uppercase tracking-wider mb-1">Temperature: {selectedComp.temperatureC !== undefined ? selectedComp.temperatureC : 25}°C</label>
                          <input
                            type="range"
                            min="-40"
                            max="125"
                            value={selectedComp.temperatureC !== undefined ? selectedComp.temperatureC : 25}
                            onChange={(e) => handleUpdateProp('temperatureC', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-emerald-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {selectedComp.libraryId === 'capacitor_electrolytic' && (
                      <div className="p-3 bg-violet-500/5 rounded-xl border border-violet-500/10 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-violet-700/80 uppercase tracking-wider mb-1">Capacitance (μF)</label>
                            <input
                              type="number"
                              step="1"
                              value={selectedComp.powerW !== undefined ? selectedComp.powerW : getBaseCapacityOrPower(selectedComp.libraryId)}
                              onChange={(e) => handleUpdateProp('powerW', parseFloat(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-violet-200 rounded-lg focus:outline-none focus:border-violet-500 bg-white font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-violet-700/80 uppercase tracking-wider mb-1">Voltage Rating (V)</label>
                            <input
                              type="number"
                              step="5"
                              value={selectedComp.voltageV !== undefined ? selectedComp.voltageV : getBaseVoltage(selectedComp.libraryId)}
                              onChange={(e) => handleUpdateProp('voltageV', parseFloat(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-violet-200 rounded-lg focus:outline-none focus:border-violet-500 bg-white font-mono text-[11px]"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {(selectedComp.libraryId === 'diode_1n4007' || selectedComp.libraryId === 'diode_schottky' || selectedComp.libraryId === 'diode_zener') && (
                      <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-rose-700/80 uppercase tracking-wider mb-1">Forward Drop (V)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={selectedComp.voltageV !== undefined ? selectedComp.voltageV : getBaseVoltage(selectedComp.libraryId)}
                              onChange={(e) => handleUpdateProp('voltageV', parseFloat(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-rose-200 rounded-lg focus:outline-none focus:border-rose-500 bg-white font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-rose-700/80 uppercase tracking-wider mb-1">Max Current (A)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={selectedComp.powerW !== undefined ? selectedComp.powerW : getBaseCapacityOrPower(selectedComp.libraryId)}
                              onChange={(e) => handleUpdateProp('powerW', parseFloat(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-rose-200 rounded-lg focus:outline-none focus:border-rose-500 bg-white font-mono text-[11px]"
                            />
                          </div>
                        </div>
                        {selectedComp.libraryId === 'diode_zener' && (
                          <div>
                            <label className="block text-[9px] font-bold text-rose-700/80 uppercase tracking-wider mb-1">Zener Voltage (V)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={selectedComp.zenerV !== undefined ? selectedComp.zenerV : 5.1}
                              onChange={(e) => handleUpdateProp('zenerV', parseFloat(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-rose-200 rounded-lg focus:outline-none focus:border-rose-500 bg-white font-mono text-[11px]"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {selectedComp.libraryId === 'switch_spst' && (
                      <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Switch State</label>
                          <button
                            onClick={() => handleUpdateProp('closed', !(selectedComp.closed === undefined ? true : selectedComp.closed))}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition ${
                              (selectedComp.closed === undefined ? true : selectedComp.closed)
                                ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {(selectedComp.closed === undefined ? true : selectedComp.closed) ? 'CLOSED (ON)' : 'OPEN (OFF)'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Component Value</label>
                      <input
                        type="text"
                        value={selectedComp.value}
                        onChange={(e) => handleUpdateProp('value', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-100 rounded-lg focus:outline-none focus:border-amber-500 bg-slate-50 focus:bg-white transition text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Supplier Part Number</label>
                      <input
                        type="text"
                        value={selectedComp.partNumber || 'N/A'}
                        onChange={(e) => handleUpdateProp('partNumber', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-100 rounded-lg focus:outline-none focus:border-amber-500 font-mono bg-slate-50 focus:bg-white transition text-[11px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Est. Cost</label>
                        <input
                          type="text"
                          value={selectedComp.cost || '$0.05'}
                          onChange={(e) => handleUpdateProp('cost', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-100 rounded-lg focus:outline-none focus:border-amber-500 font-mono bg-slate-50 focus:bg-white transition text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Terminals</label>
                        <div className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 font-mono text-[11px]">
                          {selectedComp.pins.length} Pins
                        </div>
                      </div>
                    </div>

                    {selectedComp.datasheet && selectedComp.datasheet !== '#' && (
                      <div className="pt-2 border-t border-slate-100 flex">
                        <a
                          href={selectedComp.datasheet}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold hover:underline text-[10px]"
                        >
                          <Link size={11} className="mr-1" /> View Official Datasheet
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Live Simulation Diagnostic Widget */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-md space-y-3.5">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">⚡ Electrical Diagnostics</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                        selectedComp.isFried 
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' 
                          : (selectedComp.health && selectedComp.health < 100 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')
                      }`}>
                        {selectedComp.isFried 
                          ? '🔥 FRIED / FAILURE' 
                          : (selectedComp.health && selectedComp.health < 100 ? '⚠️ DEGRADED' : '✅ OPERATIONAL')}
                      </span>
                    </div>

                    {/* Health Status Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>COMPONENT HEALTH</span>
                        <span className="font-mono">{selectedComp.health !== undefined ? Math.round(selectedComp.health) : 100}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            selectedComp.isFried 
                              ? 'bg-rose-600' 
                              : (selectedComp.health && selectedComp.health < 50 ? 'bg-amber-500' : 'bg-emerald-500')
                          }`} 
                          style={{ width: `${selectedComp.health !== undefined ? selectedComp.health : 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Battery status specific widgets */}
                    {selectedComp.type === 'battery' && (
                      <div className="p-3 bg-slate-850 rounded-lg border border-slate-800 space-y-2 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">State of Charge:</span>
                          <span className="font-mono text-emerald-400 font-bold">{Math.round((selectedComp.chargePct !== undefined ? selectedComp.chargePct : 1.0) * 100)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Voltage (Actual):</span>
                          <span className="font-mono text-slate-200 font-bold">{selectedComp.voltageVActual !== undefined ? selectedComp.voltageVActual : selectedComp.voltageV || getBaseVoltage(selectedComp.libraryId)}V</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Net Current:</span>
                          <span className={`font-mono font-bold ${
                            selectedComp.batteryStatus === 'charging' 
                              ? 'text-emerald-400' 
                              : (selectedComp.batteryStatus === 'discharging' ? 'text-amber-400' : 'text-slate-400')
                          }`}>
                            {selectedComp.batteryStatus === 'charging' ? '+' : selectedComp.batteryStatus === 'discharging' ? '-' : ''}
                            {selectedComp.batteryCurrentMA !== undefined ? selectedComp.batteryCurrentMA : 0} mA
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-slate-400">Status:</span>
                          <span className="font-bold uppercase text-[9px] tracking-wider text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                            {selectedComp.batteryStatus || 'IDLE'}
                          </span>
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              setComponents(prev => prev.map(c => 
                                c.id === selectedComp.id 
                                  ? { 
                                      ...c, 
                                      chargePct: 1.0, 
                                      capacityRemainingAh: c.capacityAh || getBaseCapacityOrPower(c.libraryId), 
                                      health: 100, 
                                      isFried: false 
                                    } 
                                  : c
                              ));
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 rounded text-[10px] text-center uppercase tracking-wider transition cursor-pointer"
                          >
                            🔋 INSTANT RECHARGE
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Live Pin Voltages diagnostic matrix */}
                    {selectedComp.pinVoltages && (
                      <div className="space-y-1.5">
                        <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">Pin Diagnostics</label>
                        <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px] max-h-32 overflow-y-auto pr-1">
                          {Object.entries(selectedComp.pinVoltages).map(([pName, v]) => (
                            <div key={pName} className="flex justify-between bg-slate-850 px-2 py-1 rounded">
                              <span className="text-slate-400 font-bold">{pName}</span>
                              <span className={v > 0.05 ? 'text-cyan-400 font-bold' : 'text-slate-500'}>{v.toFixed(2)}V</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pins list detail */}
                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pin Terminal Mapping</label>
                    <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-36 overflow-y-auto font-mono text-[10px]">
                      {selectedComp.pins.map((pin, pidx) => (
                        <div key={pidx} className="flex justify-between px-2.5 py-1 bg-white hover:bg-slate-50">
                          <span className="text-slate-700 font-bold">{pin.name}</span>
                          <span className="text-slate-400">Dir: {pin.dir.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-48 border border-dashed border-slate-100 rounded-xl p-4 text-slate-400 bg-white shadow-xs">
                  <Edit2 size={20} className="mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">No component selected.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] leading-normal mx-auto">Select a component on the canvas to inspect or edit properties here.</p>
                </div>
              )}

              {/* Collapsible Design Guidelines panel */}
              <div className="mt-4 bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <button 
                  onClick={() => setGuidelinesOpen(!guidelinesOpen)}
                  className="w-full flex items-center justify-between text-left font-bold text-slate-700 text-[10px] uppercase tracking-wider focus:outline-none cursor-pointer"
                >
                  <span>📐 CAD Design Guidelines</span>
                  <span className="text-[9px] text-slate-400 font-mono">{guidelinesOpen ? 'COLLAPSE' : 'EXPAND'}</span>
                </button>
                {guidelinesOpen && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[10px] text-slate-500 space-y-2 font-sans leading-relaxed">
                    <div className="flex items-start space-x-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span><strong>Trace Separation</strong>: Maintain &ge;15px (3.75mm) clearance distance between trace rails to avoid cross-talk.</span>
                    </div>
                    <div className="flex items-start space-x-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span><strong>Standard pitch snap</strong>: Align passive terminals using the 30px standard snap options.</span>
                    </div>
                    <div className="flex items-start space-x-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span><strong>Power Rail thickness</strong>: Route high-current rails with at least 6px thickness on Top copper layer.</span>
                    </div>
                    <div className="flex items-start space-x-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span><strong>Ground Decoupling</strong>: Decouple sensitive IC inputs using 100nF filter caps placed nearby.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 space-y-4">
            {/* BOM Table cost / exporters summary card */}
            <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 shadow-lg space-y-3">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Ordering BOM Package</span>
                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono uppercase text-[8px] font-bold">
                  {components.length} components
                </span>
              </div>
              
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-[11px] text-slate-300">Est. Total Hardware Cost:</span>
                <span className="text-xl font-bold font-mono text-emerald-400">${getBOMTotalCost()}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={downloadBOMCSV}
                  disabled={components.length === 0}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Download BOM CSV
                </button>
                <button
                  onClick={downloadCPLCSV}
                  disabled={components.length === 0}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider border border-slate-700 transition cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Download CPL CSV
                </button>
              </div>
            </div>

            {/* List of Grouped BOM items */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Placed Components Matrix</h3>
              {components.length > 0 ? (
                getGroupedComponents().map((g, idx) => (
                  <div key={idx} className="bg-white border border-slate-100 rounded-xl p-3.5 shadow-xs space-y-2 text-xs">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-800 font-mono text-[11px]">{g.designators.join(", ")}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-500">Qty: {g.items.length}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Value: <span className="text-slate-700 font-bold">{g.value}</span> | Pkg: <span className="text-slate-700 font-mono font-bold uppercase">{g.package}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-slate-100 font-mono">
                      <span>LCSC ID: <strong className="text-slate-700 font-bold">{g.partNumber}</strong></span>
                      <span className="text-slate-800 font-bold">Unit: {g.cost}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-48 border border-dashed border-slate-100 rounded-xl p-4 text-slate-400 bg-white">
                  <p className="text-xs font-semibold text-slate-500">BOM list is empty.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Place components on your schematic/PCB sheet first to compile ordering csv files.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
