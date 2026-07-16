import React, { useState, useEffect } from 'react';
import { projectDb } from '../utils/projectDb';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Copy, 
  Edit3, 
  Grid, 
  List, 
  FileText, 
  Clock, 
  Cpu, 
  Layers, 
  TrendingUp,
  FolderOpen
} from 'lucide-react';

const TEMPLATES = [
  {
    id: 'blank',
    title: 'Blank Project',
    description: 'Start a new circuit design from scratch.',
    icon: Plus,
    color: 'from-blue-600 to-cyan-500',
    components: [],
    traces: []
  },
  {
    id: 'led_driver',
    title: 'LED Driver Blinker',
    description: 'MCU connected to red LED with a current-limiting resistor.',
    icon: Cpu,
    color: 'from-emerald-600 to-teal-500',
    components: [
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
        datasheet: '#',
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
        datasheet: '#',
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
        datasheet: '#',
        groupId: null
      }
    ],
    traces: [
      { id: 'trace_mcu_res', from: 'MCU1.IO2', to: 'R1.1', isLocked: false, path: [] },
      { id: 'trace_res_led', from: 'R1.2', to: 'D1.A', isLocked: false, path: [] },
      { id: 'trace_led_gnd', from: 'D1.K', to: 'MCU1.GND', isLocked: true, path: [] }
    ]
  },
  {
    id: 'lm7805_regulator',
    title: 'LM7805 Voltage Regulator',
    description: '12V Adapter step down to 5.0V output with input/output filters.',
    icon: Layers,
    color: 'from-purple-600 to-indigo-500',
    components: [
      {
        id: 'U1',
        name: 'U1',
        type: 'regulator',
        label: 'Linear Regulator',
        value: 'LM7805 (5V)',
        x: 240,
        y: 180,
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
        datasheet: '#',
        groupId: null
      },
      {
        id: 'C1',
        name: 'C1',
        type: 'capacitor',
        label: 'C_IN',
        value: '0.33µF',
        x: 120,
        y: 180,
        width: 30,
        height: 45,
        pins: [
          { name: '1', x: 15, y: 0, dir: 'up' },
          { name: '2', x: 15, y: 45, dir: 'down' }
        ],
        manufacturer: 'Murata Electronics',
        partNumber: 'GRM21BR71H104KA01L',
        cost: '$0.024',
        datasheet: '#',
        groupId: null
      },
      {
        id: 'C2',
        name: 'C2',
        type: 'capacitor',
        label: 'C_OUT',
        value: '0.1µF',
        x: 390,
        y: 180,
        width: 30,
        height: 45,
        pins: [
          { name: '1', x: 15, y: 0, dir: 'up' },
          { name: '2', x: 15, y: 45, dir: 'down' }
        ],
        manufacturer: 'KEMET',
        partNumber: 'T491A334K035AT',
        cost: '$0.28',
        datasheet: '#',
        groupId: null
      }
    ],
    traces: [
      { id: 'trace_c1_vin', from: 'C1.1', to: 'U1.IN', isLocked: false, path: [] },
      { id: 'trace_c2_vout', from: 'C2.1', to: 'U1.OUT', isLocked: false, path: [] }
    ]
  },
  {
    id: 'zener_regulator',
    title: 'Zener Diode Clamp',
    description: '12V Battery source clamped to 5.1V reverse Zener breakdown.',
    icon: TrendingUp,
    color: 'from-amber-600 to-red-500',
    components: [
      {
        id: 'BAT1',
        name: 'BAT1',
        type: 'battery',
        label: '12V SLA Battery',
        value: '12V Battery',
        x: 100,
        y: 150,
        width: 150,
        height: 120,
        pins: [
          { name: '+', x: 45, y: 0, dir: 'up' },
          { name: '-', x: 105, y: 0, dir: 'up' }
        ],
        manufacturer: 'Generic',
        partNumber: 'BAT_12V',
        cost: '$12.00',
        datasheet: '#',
        groupId: null
      },
      {
        id: 'R1',
        name: 'R1',
        type: 'resistor',
        label: 'R_LIMIT',
        value: '470Ω',
        x: 300,
        y: 150,
        width: 60,
        height: 30,
        pins: [
          { name: '1', x: 0, y: 15, dir: 'left' },
          { name: '2', x: 60, y: 15, dir: 'right' }
        ],
        manufacturer: 'Generic',
        partNumber: 'RES_470',
        cost: '$0.02',
        datasheet: '#',
        groupId: null
      },
      {
        id: 'D1',
        name: 'D1',
        type: 'diode',
        label: 'D_ZENER',
        value: '1N4733 (5.1V)',
        x: 420,
        y: 140,
        width: 60,
        height: 30,
        pins: [
          { name: 'A', x: 0, y: 15, dir: 'left' },
          { name: 'K', x: 60, y: 15, dir: 'right' }
        ],
        manufacturer: 'Generic',
        partNumber: '1N4733',
        cost: '$0.11',
        datasheet: '#',
        groupId: null
      }
    ],
    traces: [
      { id: 'trace_bat_res', from: 'BAT1.+', to: 'R1.1', isLocked: false, path: [] },
      { id: 'trace_res_zener', from: 'R1.2', to: 'D1.K', isLocked: false, path: [] },
      { id: 'trace_zener_gnd', from: 'D1.A', to: 'BAT1.-', isLocked: true, path: [] }
    ]
  }
];

export function DocsDashboard({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [activeMenuId, setActiveMenuId] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      let all = await projectDb.getAll();
      if (all.length === 0) {
        // Bootstrap standard demo documents on first run!
        const doc1 = {
          id: `doc_led_driver`,
          name: 'LED Driver Blinker Demo',
          components: JSON.parse(JSON.stringify(TEMPLATES[1].components)),
          traces: JSON.parse(JSON.stringify(TEMPLATES[1].traces)),
          customTexts: [],
          customShapes: [],
          gridSize: 15,
          lastModified: Date.now() - 60000
        };
        const doc2 = {
          id: `doc_lm7805_regulator`,
          name: 'LM7805 Regulator Circuit',
          components: JSON.parse(JSON.stringify(TEMPLATES[2].components)),
          traces: JSON.parse(JSON.stringify(TEMPLATES[2].traces)),
          customTexts: [],
          customShapes: [],
          gridSize: 15,
          lastModified: Date.now() - 120000
        };
        await projectDb.save(doc1);
        await projectDb.save(doc2);
        all = [doc1, doc2];
      }
      // Sort projects by last modified date desc
      all.sort((a, b) => b.lastModified - a.lastModified);
      setProjects(all);
    } catch (err) {
      console.error('Failed to load projects from IndexedDB:', err);
    }
  };

  const handleCreateProject = async (template) => {
    const newId = `doc_${Date.now()}`;
    const newProj = {
      id: newId,
      name: template.id === 'blank' ? 'Untitled Schematic' : `${template.title} Project`,
      components: JSON.parse(JSON.stringify(template.components)),
      traces: JSON.parse(JSON.stringify(template.traces)),
      customTexts: [],
      customShapes: [],
      gridSize: 15,
      lastModified: Date.now()
    };
    try {
      await projectDb.save(newProj);
      onSelectProject(newId);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this schematic project?')) return;
    try {
      await projectDb.delete(id);
      loadProjects();
      setActiveMenuId(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDuplicateProject = async (proj, e) => {
    e.stopPropagation();
    const newId = `doc_${Date.now()}`;
    const dupe = {
      ...proj,
      id: newId,
      name: `${proj.name} (Copy)`,
      lastModified: Date.now()
    };
    try {
      await projectDb.save(dupe);
      loadProjects();
      setActiveMenuId(null);
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  const handleRenameProject = async (proj, e) => {
    e.stopPropagation();
    const newName = prompt('Enter new project name:', proj.name);
    if (!newName || !newName.trim()) return;
    try {
      await projectDb.save({
        ...proj,
        name: newName.trim()
      });
      loadProjects();
      setActiveMenuId(null);
    } catch (err) {
      console.error('Rename failed:', err);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-white overflow-y-auto flex flex-col font-sans select-none min-h-screen text-slate-700">
      {/* HEADER SECTION */}
      <header className="h-[40px] bg-engineering-bg2 border-b border-engineering-border flex items-center justify-between px-5 select-none shrink-0 sticky top-0 z-20">
        <div className="flex items-center space-x-2 select-none group cursor-pointer">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h5l4 6h6v4h3" stroke="var(--color-signal-copper)" strokeWidth="2" />
            <path d="M3 10h5l4 6h6v4h3" stroke="var(--color-signal-copper)" strokeWidth="1.5" opacity="0.6" />
            <circle cx="3" cy="6" r="1.2" fill="var(--color-signal-copper)" />
            <circle cx="3" cy="10" r="1.2" fill="var(--color-signal-copper)" opacity="0.6" />
            <circle cx="21" cy="16" r="1.2" fill="var(--color-signal-copper)" />
            <circle cx="21" cy="20" r="1.2" fill="var(--color-signal-copper)" opacity="0.6" />
          </svg>
          <h1 className="text-[16px] font-bold tracking-tight text-engineering-charcoal leading-none lowercase" style={{ letterSpacing: '-0.5px' }}>wiretracks</h1>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-xl mx-4 relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-engineering-slate" />
          <input
            type="text"
            placeholder="Search recent projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-engineering-bg3 hover:bg-engineering-border focus:bg-engineering-bg2 text-engineering-charcoal text-[11px] px-8 py-1 rounded-[4px] border border-transparent focus:border-trace-blue transition outline-none"
          />
        </div>

        {/* Profile/Docs Hub */}
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-engineering-bg3 border border-engineering-border2 flex items-center justify-center font-bold text-engineering-slate text-[9px] font-mono">
            US
          </div>
        </div>
      </header>

      {/* TEMPLATE GALLERY BAR */}
      <section className="bg-engineering-bg border-b border-engineering-border py-4 px-5 shrink-0">
        <div className="max-w-5xl mx-auto">
          <h2 className="mono-header mb-3">Start a New Schematic Template</h2>
          <div className="grid grid-cols-4 gap-4">
            {TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleCreateProject(tpl)}
                  className="bg-engineering-bg2 border border-engineering-border hover:border-trace-blue rounded-[2px] p-3 cursor-pointer transition flex flex-col group"
                >
                  <div className="w-6 h-6 bg-engineering-bg3 text-engineering-slate border border-engineering-border2 flex items-center justify-center mb-3">
                    <Icon size={12} />
                  </div>
                  <h3 className="text-engineering-charcoal text-[11px] font-bold mb-1 leading-tight">{tpl.title}</h3>
                  <p className="text-engineering-slate text-[10px] leading-normal line-clamp-2">{tpl.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* RECENT DOCUMENTS AREA */}
      <section className="flex-1 py-3 px-5">
        <div className="max-w-5xl mx-auto">
          {/* Section Toolbar */}
          <div className="flex items-center justify-between mb-4 border-b border-engineering-border pb-2">
            <h2 className="mono-header">Recent schematic documents</h2>
            
            <div className="flex items-center space-x-2 text-engineering-slate">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded-[2px] transition ${viewMode === 'grid' ? 'bg-engineering-bg3 text-engineering-charcoal border border-engineering-border2' : 'hover:bg-engineering-bg3'}`}
                title="Grid View"
              >
                <Grid size={12} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded-[2px] transition ${viewMode === 'list' ? 'bg-engineering-bg3 text-engineering-charcoal border border-engineering-border2' : 'hover:bg-engineering-bg3'}`}
                title="List View"
              >
                <List size={12} />
              </button>
            </div>
          </div>

          {/* Grid Layout View */}
          {filteredProjects.length === 0 ? (
            <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center">
              <FolderOpen size={48} className="text-slate-300 mb-3" />
              <p className="text-xs italic font-medium">No recent documents or matching search results.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="flex flex-wrap gap-4">
              {filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className="w-44 bg-engineering-bg2 border border-engineering-border rounded-[2px] overflow-hidden hover:border-trace-blue cursor-pointer transition flex flex-col relative group"
                >
                  <div className="h-20 bg-engineering-bg3 flex items-center justify-center text-engineering-slate relative overflow-hidden select-none border-b border-engineering-border">
                    {proj.components && proj.components.length > 0 ? (
                      <svg viewBox="0 0 800 600" className="w-full h-full object-contain p-2 opacity-70">
                        {/* Render simple traces */}
                        {proj.traces?.map((t, idx) => {
                          const fromParts = t.from.split('.');
                          const toParts = t.to.split('.');
                          const fromComp = proj.components.find(c => c.id === fromParts[0]);
                          const toComp = proj.components.find(c => c.id === toParts[0]);
                          if (fromComp && toComp) {
                            return (
                              <line 
                                key={idx} 
                                x1={fromComp.x + (fromComp.width / 2)} 
                                y1={fromComp.y + (fromComp.height / 2)} 
                                x2={toComp.x + (toComp.width / 2)} 
                                y2={toComp.y + (toComp.height / 2)} 
                                stroke="var(--color-trace-blue)" 
                                strokeWidth="8" 
                              />
                            );
                          }
                          return null;
                        })}
                        {/* Render component rects */}
                        {proj.components.map((c, idx) => (
                          <rect 
                            key={idx} 
                            x={c.x} 
                            y={c.y} 
                            width={c.width} 
                            height={c.height} 
                            fill="var(--color-engineering-border2)" 
                            stroke="var(--color-engineering-slate)" 
                            strokeWidth="4" 
                          />
                        ))}
                      </svg>
                    ) : (
                      <FileText size={18} className="opacity-40" />
                    )}
                  </div>

                  {/* Document Metadata details */}
                  <div className="p-3 flex items-center justify-between relative bg-engineering-bg2">
                    <div className="flex flex-col min-w-0 pr-6">
                      <span className="text-engineering-charcoal text-[11px] font-bold truncate leading-tight mb-1">{proj.name}</span>
                      <div className="flex items-center text-[9px] text-engineering-slate space-x-1 font-mono uppercase">
                        <Clock size={8} />
                        <span>{new Date(proj.lastModified).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === proj.id ? null : proj.id);
                        }}
                        className="p-1 rounded-[2px] hover:bg-engineering-bg3 text-engineering-slate hover:text-engineering-charcoal transition"
                      >
                        <MoreVertical size={12} />
                      </button>

                      {activeMenuId === proj.id && (
                        <div 
                          className="absolute right-0 bottom-6 bg-engineering-bg2 border border-engineering-border rounded-[2px] shadow-sm w-32 py-1 z-30 text-left font-medium text-[10px]"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => handleRenameProject(proj, e)}
                            className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 transition"
                          >
                            <Edit3 size={11} />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={(e) => handleDuplicateProject(proj, e)}
                            className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center space-x-1.5 transition"
                          >
                            <Copy size={11} />
                            <span>Duplicate</span>
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(proj.id, e)}
                            className="w-full px-3 py-1.5 hover:bg-red-50 text-red-650 flex items-center space-x-1.5 transition"
                          >
                            <Trash2 size={11} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List Layout View */
            <div className="bg-engineering-bg2 border border-engineering-border rounded-[2px] overflow-hidden shadow-none divide-y divide-engineering-border">
              {filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className="flex items-center justify-between p-2 px-3.5 hover:bg-engineering-bg3 cursor-pointer transition text-xs relative group text-engineering-slate"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <FileText size={13} className="text-engineering-slate flex-shrink-0" />
                    <span className="text-engineering-charcoal font-bold truncate text-[11px]">{proj.name}</span>
                  </div>

                  <div className="flex items-center space-x-6 text-[10px] text-engineering-slate mr-12 flex-shrink-0">
                    <span className="flex items-center space-x-1 font-mono uppercase">
                      <Clock size={11} />
                      <span>{new Date(proj.lastModified).toLocaleDateString()}</span>
                    </span>
                  </div>

                  {/* Action dropdown button */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === proj.id ? null : proj.id);
                      }}
                      className="p-1 rounded-[2px] hover:bg-engineering-bg border border-transparent hover:border-engineering-border2 text-engineering-slate hover:text-engineering-charcoal transition"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {activeMenuId === proj.id && (
                      <div 
                        className="absolute right-0 bottom-6 bg-engineering-bg2 border border-engineering-border rounded-[2px] shadow-sm w-32 py-1 z-30 text-left font-medium text-[10px]"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleRenameProject(proj, e)}
                          className="w-full px-3 py-1.5 hover:bg-engineering-bg3 text-engineering-charcoal flex items-center space-x-1.5 transition"
                        >
                          <Edit3 size={11} />
                          <span>Rename</span>
                        </button>
                        <button
                          onClick={(e) => handleDuplicateProject(proj, e)}
                          className="w-full px-3 py-1.5 hover:bg-engineering-bg3 text-engineering-charcoal flex items-center space-x-1.5 transition"
                        >
                          <Copy size={11} />
                          <span>Duplicate</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteProject(proj.id, e)}
                          className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center space-x-1.5 transition"
                        >
                          <Trash2 size={11} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
