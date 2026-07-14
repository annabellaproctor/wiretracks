import React, { useState, useEffect } from 'react';
import { Cpu, RotateCw, Trash2, Edit2, Link } from 'lucide-react';
import { deduplicateComponents, auditDatabaseWithAI } from '../utils/componentMerger';
import { autoHeuristicPinoutMap } from '../utils/pinoutHeuristic';
import { sqliteDb } from '../utils/sqliteDb';

function SchematicPreview({ type }) {
  if (type === 'resistor') {
    return (
      <svg viewBox="0 0 40 20" className="w-12 h-6 stroke-slate-500 fill-none" strokeWidth="1.5">
        <path d="M 0 10 L 10 10 L 12 5 L 16 15 L 20 5 L 24 15 L 28 5 L 30 10 L 40 10" />
      </svg>
    );
  }
  if (type === 'capacitor') {
    return (
      <svg viewBox="0 0 40 20" className="w-12 h-6 stroke-slate-500 fill-none" strokeWidth="1.5">
        <path d="M 0 10 L 16 10 M 16 4 L 16 16 M 24 4 L 24 16 M 24 10 L 40 10" />
      </svg>
    );
  }
  if (type === 'led') {
    return (
      <svg viewBox="0 0 40 20" className="w-12 h-6 stroke-slate-500 fill-none" strokeWidth="1.5">
        <path d="M 0 10 L 14 10 M 14 4 L 24 10 L 14 16 Z M 24 4 L 24 16 M 24 10 L 40 10" />
        <path d="M 16 -1 L 12 -5 M 13 -5 L 12 -5 L 12 -4 M 21 -1 L 17 -5 M 18 -5 L 17 -5 L 17 -4" strokeWidth="1" />
      </svg>
    );
  }
  if (type === 'regulator') {
    return (
      <svg viewBox="0 0 40 20" className="w-12 h-6 stroke-slate-500 fill-none" strokeWidth="1.5">
        <rect x="12" y="3" width="16" height="14" rx="1" />
        <path d="M 0 10 L 12 10 M 28 10 L 40 10 M 20 17 L 20 20" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 20" className="w-12 h-6 stroke-slate-500 fill-none" strokeWidth="1.5">
      <rect x="10" y="2" width="20" height="16" rx="2" />
      <path d="M 5 6 L 10 6 M 5 10 L 10 10 M 5 14 L 10 14" />
      <path d="M 30 6 L 35 6 M 30 10 L 35 10 M 30 14 L 35 14" />
    </svg>
  );
}

function PhysicalPreview({ type }) {
  if (type === 'resistor') {
    return (
      <svg viewBox="0 0 40 20" className="w-12 h-6">
        <line x1="0" y1="10" x2="40" y2="10" stroke="#cbd5e1" strokeWidth="1.5" />
        <rect x="10" y="6" width="20" height="8" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
        <rect x="13" y="6" width="2" height="8" fill="#78350f" />
        <rect x="17" y="6" width="2" height="8" fill="#000000" />
        <rect x="21" y="6" width="2" height="8" fill="#ea580c" />
        <rect x="25" y="6" width="2" height="8" fill="#d97706" />
      </svg>
    );
  }
  if (type === 'capacitor') {
    return (
      <svg viewBox="0 0 40 20" className="w-12 h-6">
        <line x1="17" y1="10" x2="17" y2="20" stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1="23" y1="10" x2="23" y2="20" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx="20" cy="10" r="7" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
        <text x="20" y="12" fontFamily="monospace" fontSize="6" fontWeight="bold" fill="#78350f" textAnchor="middle">104</text>
      </svg>
    );
  }
  if (type === 'led') {
    return (
      <svg viewBox="0 0 40 20" className="w-12 h-6">
        <line x1="18" y1="12" x2="18" y2="20" stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1="22" y1="12" x2="22" y2="20" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 16 12 L 16 7 A 4 4 0 0 1 24 7 L 24 12 Z" fill="rgba(239, 68, 68, 0.85)" stroke="#dc2626" strokeWidth="1" />
        <rect x="15" y="11" width="10" height="1.5" rx="0.5" fill="#ef4444" />
        <path d="M 19 11 L 19 8 L 20 8 M 21 11 L 21 9 L 20 9" stroke="#cbd5e1" strokeWidth="0.8" fill="none" />
      </svg>
    );
  }
  if (type === 'regulator') {
    return (
      <svg viewBox="0 0 40 20" className="w-12 h-6">
        <line x1="16" y1="12" x2="16" y2="20" stroke="#cbd5e1" strokeWidth="1.2" />
        <line x1="20" y1="12" x2="20" y2="20" stroke="#cbd5e1" strokeWidth="1.2" />
        <line x1="24" y1="12" x2="24" y2="20" stroke="#cbd5e1" strokeWidth="1.2" />
        <rect x="15" y="1" width="10" height="4" fill="#94a3b8" rx="0.5" />
        <circle cx="20" cy="3" r="1" fill="#fff" />
        <rect x="14" y="5" width="12" height="8" fill="#1e293b" rx="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 20" className="w-12 h-6">
      <rect x="6" y="2" width="28" height="16" rx="1.5" fill="#111" />
      <rect x="6" y="3" width="1" height="14" fill="#d97706" />
      <rect x="33" y="3" width="1" height="14" fill="#d97706" />
      <rect x="13" y="5" width="14" height="10" rx="1" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
      <rect x="29" y="4" width="3" height="12" fill="#fbbf24" />
      <path d="M 29 4 L 32 4 L 32 6 L 29 6 L 29 8 L 32 8" stroke="#d97706" strokeWidth="0.8" fill="none" />
    </svg>
  );
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
    setComponents(prev => prev.map(c => 
      c.id === selectedComponentId ? { ...c, [field]: val } : c
    ));
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
      <div className="flex border-b border-slate-200 bg-white/80 backdrop-blur-xs select-none shrink-0">
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
            <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-xs">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parts Library</h3>
                <button
                  onClick={handleAuditLibrary}
                  className="text-[9px] font-bold text-slate-500 hover:text-amber-600 bg-white hover:bg-amber-50 border border-slate-200 rounded-lg px-2 py-1 transition flex items-center shadow-2xs cursor-pointer"
                >
                  🧹 Audit & Dedupe
                </button>
              </div>
              <div className="space-y-2">
                {libraryItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePlaceComponent(item)}
                    className="w-full flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-amber-500 hover:bg-amber-50/10 hover:shadow-xs active:bg-amber-100/10 transition text-left group cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="text-xs font-semibold text-slate-700 block truncate">{item.label}</span>
                      <span className="text-[9px] text-slate-400 font-mono block mt-0.5 truncate">{item.value}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition">
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
                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <div>
                      <span className="text-xs font-bold text-slate-800">{selectedComp.name}</span>
                      <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{selectedComp.type.toUpperCase()}</span>
                    </div>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={handleRotateComponent}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 shadow-xs transition cursor-pointer"
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

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Component Value</label>
                      <input
                        type="text"
                        value={selectedComp.value}
                        onChange={(e) => handleUpdateProp('value', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-slate-50 focus:bg-white transition text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Supplier Part Number</label>
                      <input
                        type="text"
                        value={selectedComp.partNumber || 'N/A'}
                        onChange={(e) => handleUpdateProp('partNumber', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 font-mono bg-slate-50 focus:bg-white transition text-[11px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Est. Cost</label>
                        <input
                          type="text"
                          value={selectedComp.cost || '$0.05'}
                          onChange={(e) => handleUpdateProp('cost', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 font-mono bg-slate-50 focus:bg-white transition text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Terminals</label>
                        <div className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-[11px]">
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

                  {/* Pins list detail */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pin Terminal Mapping</label>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-36 overflow-y-auto font-mono text-[10px]">
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
                <div className="flex flex-col items-center justify-center text-center h-48 border border-dashed border-slate-200 rounded-xl p-4 text-slate-400 bg-white shadow-xs">
                  <Edit2 size={20} className="mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">No component selected.</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] leading-normal mx-auto">Select a component on the canvas to inspect or edit properties here.</p>
                </div>
              )}

              {/* Collapsible Design Guidelines panel */}
              <div className="mt-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
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
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2 text-xs">
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
                <div className="flex flex-col items-center justify-center text-center h-48 border border-dashed border-slate-200 rounded-xl p-4 text-slate-400 bg-white">
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
