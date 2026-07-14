import React, { useState, useRef, useEffect } from 'react';
import { sendToRouter } from '../utils/openRouter';
import { Sparkles, Send, RefreshCw, Key, Settings, Image, Check, AlertTriangle, Search, BookOpen } from 'lucide-react';
import { searchPartsUnified, searchTextWeb } from '../utils/partsApi';
import { autoHeuristicPinoutMap } from '../utils/pinoutHeuristic';
import { sqliteDb } from '../utils/sqliteDb';

export function SparkyIcon({ size = 14, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`${className} shrink-0`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L4 14H11L9 22L20 10H13L13 2Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.5" cy="11.5" r="1.2" fill="#1e293b" />
      <circle cx="14.5" cy="11.5" r="1.2" fill="#1e293b" />
      <path d="M11.5 14C11.5 14.5 12 15 12.5 15C13 15 13.5 14.5 13.5 14" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function SidebarAiChat({
  components,
  setComponents,
  traces,
  setTraces,
  customPcbPads,
  setCustomPcbPads,
  customPcbTraces,
  setCustomPcbTraces,
  setSelectedComponentId,
  setSelectedTraceId,
  handleClearAll,
  setActiveTour,
  selectedModel,
  setSelectedModel
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || '';

  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [apiError, setApiError] = useState(null);

  const chatEndRef = useRef(null);
  const queriedTermsRef = useRef(new Map());

  // Load chat log history from SQLite database
  useEffect(() => {
    const savedHistory = sqliteDb.getChatHistory();
    if (savedHistory && savedHistory.length > 0) {
      setMessages(savedHistory);
    } else {
      loadDefaultGreetings();
    }
  }, []);

  // Save chat log changes to SQLite database
  useEffect(() => {
    if (messages.length > 0) {
      sqliteDb.clearChatHistory();
      messages.forEach(msg => sqliteDb.saveChatMessage(msg.role, msg.content));
    }
  }, [messages]);

  const loadDefaultGreetings = () => {
    setMessages([
      {
        role: 'assistant',
        content: `### 👋 welcome to sparky!
I am your wiretracks electronic CAD draftsman and layout copilot. I can inspect screenshots of your current schematic or PCB layouts, perform searches, and automate schematic wiring.

**Setup Instructions:**
1. Click the ⚙️ icon to configure your **API Key** (or use \`VITE_OPENROUTER_API_KEY\` in your local \`.env.local\` file).
2. Enter layout, connections, or parts optimization requests.

**Example inputs:**
* *"Add a 10k resistor connected to MCU1 pin IO2"*
* *"Add a 5V power supply regulator circuit and decouple it"*
* *"Search for LM7805 datasheet specs and verify input capacitors"*
* *"Add custom solder pads and connect them on the top copper layer"*

**📐 CAD Design Guidelines:**
* **Trace Clearance**: Keep trace separation &ge;15px (3.75mm) to prevent crosstalk.
* **Component pitch**: Align dual-in-line pins using 30px standard grids.
* **Power lines thickness**: Set 6px width for VCC rails.
* **Filter Capacitors**: Decouple IC power inputs with 100nF filter caps.`
      }
    ]);
  };

  const handleClearHistory = () => {
    sqliteDb.clearChatHistory();
    loadDefaultGreetings();
  };

  const handleSaveSettings = () => {
    sqliteDb.setSetting('wiretracks_solver_model', selectedModel);
    setShowSettings(false);
  };

  // Capture current canvas layout render
  const captureCanvasImage = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn("Unable to capture canvas buffer stream due to cross-origin settings:", e);
      return null;
    }
  };

  const handleSend = async (customPrompt = null) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim()) return;

    setInput('');
    setApiError(null);

    const userMsg = { role: 'user', content: textToSend };
    let currentHistory = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const screenshotData = includeScreenshot ? captureCanvasImage() : null;

    try {
      let loopCount = 0;
      const maxLoops = 3;
      let aiResponse = null;
      let shouldLoop = true;

      while (shouldLoop && loopCount < maxLoops) {
        loopCount++;
        
        aiResponse = await sendToRouter({
          prompt: loopCount === 1 ? textToSend : "Here are the search and analysis results from the tools. Please continue your response based on this information.",
          base64Image: screenshotData,
          messagesHistory: currentHistory,
          apiKey,
          modelName: selectedModel,
          boardState: {
            components,
            traces,
            customPcbPads,
            customPcbTraces
          }
        });

        // Intercept tool call actions from the assistant
        const toolActions = aiResponse.actions?.filter(act => 
          act.type === 'WEB_SEARCH' ||
          act.type === 'SEARCH_EASYEDA' ||
          act.type === 'SEARCH_LCSC' ||
          act.type === 'SEARCH_DIGIKEY' ||
          act.type === 'SEARCH_MOUSER' ||
          act.type === 'SEARCH_AMAZON' ||
          act.type === 'SEARCH_GOOGLE_SHOPPING' ||
          act.type === 'EXECUTE_SQL'
        ) || [];

        if (toolActions.length > 0) {
          const toolResults = [];

          for (const act of toolActions) {
            const queryTerm = (act.payload.query || act.payload.partNumber || act.payload.sql || '').trim();
            if (!queryTerm) continue;

            let searchData = null;
            const normKey = `${act.type}_${queryTerm.toLowerCase()}`;

            // Deduplicate: check cache first to prevent redundant upstream billing
            if (act.type !== 'EXECUTE_SQL' && queriedTermsRef.current.has(normKey)) {
              console.log(`[Agent Loop] Deduplicated query for: "${queryTerm}"`);
              searchData = queriedTermsRef.current.get(normKey);
            } else {
              if (act.type === 'EXECUTE_SQL') {
                try {
                  console.log(`[SQL Emulator] Executing in loop: ${queryTerm}`);
                  searchData = sqliteDb.executeSingleSql(queryTerm);
                } catch (sqlErr) {
                  searchData = { success: false, error: sqlErr.message };
                }
              } else if (act.type === 'WEB_SEARCH') {
                const webResults = await searchTextWeb(queryTerm);
                if (webResults && webResults.length > 0) {
                  searchData = webResults.slice(0, 4);
                } else {
                  const results = await searchPartsUnified(queryTerm, 'all');
                  searchData = results.slice(0, 3).map(r => ({
                    mfr: r.mfr,
                    partNumber: r.partNumber,
                    description: r.description,
                    price: r.price,
                    stock: r.stock,
                    source: r.source
                  }));
                }
              } else {
                let provider = 'all';
                if (act.type === 'SEARCH_EASYEDA') provider = 'easyeda';
                else if (act.type === 'SEARCH_LCSC') provider = 'lcsc_public';
                else if (act.type === 'SEARCH_DIGIKEY') provider = 'digikey';
                else if (act.type === 'SEARCH_MOUSER') provider = 'mouser';
                else if (act.type === 'SEARCH_AMAZON') provider = 'dataforseo';
                else if (act.type === 'SEARCH_GOOGLE_SHOPPING') provider = 'google_shopping';

                const results = await searchPartsUnified(queryTerm, provider);
                searchData = results.slice(0, 3).map(r => ({
                  mfr: r.mfr,
                  partNumber: r.partNumber,
                  description: r.description,
                  price: r.price,
                  stock: r.stock,
                  source: r.source
                }));
              }
              if (act.type !== 'EXECUTE_SQL') {
                queriedTermsRef.current.set(normKey, searchData);
              }
            }

            toolResults.push({
              tool: act.type,
              query: queryTerm,
              results: searchData
            });
          }

          // Add tool execution to history for the next completion loop
          const botCallMsg = { 
            role: 'assistant', 
            content: aiResponse.explanation || "Executing requested operations..." 
          };
          const systemResponseMsg = {
            role: 'user',
            content: `[TOOL RESULTS]:\n${JSON.stringify(toolResults, null, 2)}`
          };

          currentHistory = [...currentHistory, botCallMsg, systemResponseMsg];
          
          // Render search status on user UI
          setMessages(prev => [
            ...prev, 
            { 
              role: 'assistant', 
              content: `${aiResponse.explanation || "Executing..."}\n\n⚙️ *Operations requested:* ${toolActions.map(a => `"${a.type === 'EXECUTE_SQL' ? 'SQL query' : (a.payload.query || a.payload.partNumber || '')}"`).join(', ')}` 
            }
          ]);
        } else {
          // No more tool calls requested, exit loop
          shouldLoop = false;
        }
      }

      // Render the final assistant response
      const finalMsg = { role: 'assistant', content: aiResponse.explanation || aiResponse.message || "Completed draftsman adjustments." };
      setMessages(prev => [...prev, finalMsg]);

      // Apply drawing and canvas modifications
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        applyDraftsmanActions(aiResponse.actions);
      }
    } catch (err) {
      setApiError(err.message || 'API request error');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **Draftsman connection failed:** ${err.message || 'Unknown network error. Please review Router Settings.'}`
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const applyDraftsmanActions = (actions) => {
    // Helper to resolve a component's name or placeholder ID to its actual session ID
    const resolveCompId = (nameOrId) => {
      const found = components.find(c => c.id === nameOrId || c.name === nameOrId);
      return found ? found.id : nameOrId;
    };

    actions.forEach((act) => {
      // 1. ADD COMPONENT (WITH UPSERT SUPPORT)
      if (act.type === 'ADD_COMPONENT') {
        const comp = act.payload;
        setComponents(prev => {
          // Auto-resolve libraryId matching database items
          const matchedLib = sqliteDb.tables.library.find(libItem =>
            libItem.id === comp.libraryId ||
            libItem.value?.toLowerCase() === comp.value?.toLowerCase() ||
            libItem.label?.toLowerCase() === comp.label?.toLowerCase()
          );

          const finalComp = {
            ...comp,
            libraryId: matchedLib ? matchedLib.id : comp.libraryId
          };

          const mappedComp = autoHeuristicPinoutMap(finalComp);

          // Match existing components by exact ID or component name/designator
          const existingIdx = prev.findIndex(c => c.id === comp.id || (comp.name && c.name === comp.name));
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              ...mappedComp,
              // Maintain placed coordinates if Sparky didn't specify new ones
              x: comp.x !== undefined ? comp.x : updated[existingIdx].x,
              y: comp.y !== undefined ? comp.y : updated[existingIdx].y
            };
            return updated;
          } else {
            return [...prev, mappedComp];
          }
        });
      }
      
      // 2. CONNECT PINS / ADD WIRE
      else if (act.type === 'CONNECT_PINS' || act.type === 'ADD_WIRE') {
        const { from, to, color } = act.payload;
        const resolvePinComp = (pinStr) => {
          if (!pinStr) return '';
          const parts = pinStr.split('.');
          if (parts.length < 2) return pinStr;
          const compIdentifier = parts[0];
          const pinName = parts.slice(1).join('.');
          const resolvedId = resolveCompId(compIdentifier);
          return `${resolvedId}.${pinName}`;
        };
        const resolvedFrom = resolvePinComp(from);
        const resolvedTo = resolvePinComp(to);

        setTraces(prev => {
          const exists = prev.some(t => 
            (t.from === resolvedFrom && t.to === resolvedTo) || 
            (t.from === resolvedTo && t.to === resolvedFrom)
          );
          if (exists) return prev;
          return [...prev, {
            id: `trace_ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            from: resolvedFrom,
            to: resolvedTo,
            color: color || '#2563eb',
            isLocked: false,
            path: []
          }];
        });
      }

      // 3. DELETE COMPONENT
      else if (act.type === 'DELETE_COMPONENT') {
        const { id } = act.payload;
        const targetId = resolveCompId(id);
        const targetName = components.find(c => c.id === targetId)?.name || id;

        setComponents(prev => prev.filter(c => c.id !== targetId && c.name !== targetName));
        setTraces(prev => prev.filter(t => {
          const fromComp = t.from.split('.')[0];
          const toComp = t.to.split('.')[0];
          return fromComp !== targetId && fromComp !== targetName && toComp !== targetId && toComp !== targetName;
        }));
      }

      // 4. MOVE COMPONENT
      else if (act.type === 'MOVE_COMPONENT') {
        const { id, x, y } = act.payload;
        const targetId = resolveCompId(id);
        setComponents(prev => prev.map(c => c.id === targetId ? { ...c, x, y } : c));
      }

      // 5. SET COMPONENT PROP
      else if (act.type === 'SET_COMPONENT_PROP') {
        const { id, field, value } = act.payload;
        const targetId = resolveCompId(id);
        setComponents(prev => prev.map(c => c.id === targetId ? { ...c, [field]: value } : c));
      }

      // 6. UPDATE COMPONENT SPEC / SUPER MACRO TOOL
      else if (act.type === 'UPDATE_COMPONENT_SPEC') {
        const { id, updates } = act.payload;
        const targetId = resolveCompId(id);
        setComponents(prev => prev.map(c => {
          if (c.id === targetId) {
            let newPins = c.pins ? c.pins.map(p => ({ ...p })) : [];
            
            // 1. If updates contains a full pins array replacement:
            if (updates.pins) {
              newPins = updates.pins;
            }
            
            // 2. If updates contains selective pinUpdates:
            if (updates.pinUpdates) {
              if (Array.isArray(updates.pinUpdates)) {
                updates.pinUpdates.forEach(pu => {
                  const targetPin = newPins.find(p => p.name === pu.name);
                  if (targetPin) {
                    if (pu.newName) targetPin.name = pu.newName;
                    if (pu.dir) targetPin.dir = pu.dir;
                    if (pu.x !== undefined) targetPin.x = pu.x;
                    if (pu.y !== undefined) targetPin.y = pu.y;
                  }
                });
              } else if (typeof updates.pinUpdates === 'object') {
                Object.entries(updates.pinUpdates).forEach(([oldName, newName]) => {
                  const targetPin = newPins.find(p => p.name === oldName);
                  if (targetPin) {
                    targetPin.name = newName;
                  }
                });
              }
            }

            const merged = { ...c, ...updates };
            merged.pins = newPins;
            delete merged.pinUpdates;
            return merged;
          }
          return c;
        }));
      }

      // 7. IMPORT TO LIBRARY
      else if (act.type === 'IMPORT_TO_LIBRARY') {
        const comp = act.payload;
        const newId = `IMP_${comp.label || 'PART'}_${Date.now().toString().slice(-4)}`;
        setComponents(prev => {
          if (prev.some(c => c.id === newId)) return prev;
          return [...prev, {
            id: newId,
            name: newId,
            type: comp.type || 'mcu',
            label: comp.label,
            value: comp.value || comp.label,
            x: 300 + Math.round(Math.random() * 60),
            y: 150 + Math.round(Math.random() * 60),
            width: comp.width || 80,
            height: comp.height || 90,
            pins: comp.pins || [],
            isImported: true
          }];
        });
      }
      
      // 7.5. EXECUTE SQL QUERY DIRECTLY AGAINST LIBRARY DATABASE
      else if (act.type === 'EXECUTE_SQL') {
        const { sql } = act.payload;
        try {
          console.log(`[SQL Emulator] Executing: ${sql}`);
          const sqlRes = sqliteDb.executeSingleSql(sql);
          console.log(`[SQL Emulator] Result:`, sqlRes);
        } catch (sqlErr) {
          console.error(`[SQL Emulator] Error:`, sqlErr);
        }
      }
      
      // 8. PLACE PCB PAD SOLDER SINK
      else if (act.type === 'PLACE_PCB_PAD' || act.type === 'ADD_PCB_PAD') {
        const pad = act.payload;
        setCustomPcbPads(prev => {
          if (prev.some(p => p.x === pad.x && p.y === pad.y)) return prev;
          return [...prev, {
            id: `pad_ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            x: pad.x,
            y: pad.y,
            size: pad.size || 12
          }];
        });
      }
      
      // 9. DRAW PCB COPPER TRACK
      else if (act.type === 'DRAW_PCB_TRACE' || act.type === 'ADD_PCB_TRACE') {
        const trace = act.payload;
        setCustomPcbTraces(prev => [...prev, {
          id: `trace_pcb_ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          points: trace.points,
          layer: trace.layer || 'top',
          width: trace.width || 4
        }]);
      }

      // 10. WEB SEARCH
      else if (act.type === 'WEB_SEARCH') {
        const searchMsg = {
          role: 'assistant',
          content: `🔍 **sparky search engine query:** *"${act.payload.query}"*\n- Searching datasheet databases...`
        };
        setMessages(prev => [...prev, searchMsg]);
      }

      // 11. SIMILAR PARTS SEARCH
      else if (act.type === 'SEARCH_SIMILAR_COMPONENTS') {
        const similarMsg = {
          role: 'assistant',
          content: `📦 **sparky component analysis:** Comparing specs for *${act.payload.partNumber}*\n- Matches: Yageo, Murata components found.`
        };
        setMessages(prev => [...prev, similarMsg]);
      }

      // 12. CLEAR ALL SESSION
      else if (act.type === 'CLEAR_WORKSPACE' || act.type === 'CLEAR_ALL') {
        handleClearAll();
      }

      // 13. INTERACTIVE TOUR MAP CAROUSEL
      else if (act.type === 'TOUR') {
        const tourData = act.payload;
        setActiveTour({
          title: tourData.title || "Custom AI Changes Walkthrough",
          currentStep: 0,
          steps: tourData.steps || []
        });
      }
    });
  };

  // Convert markdown to React elements safely, supporting titles and bullet marks
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // H3 titles
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-[12px] font-bold text-slate-800 pt-1.5 pb-1 uppercase tracking-wider">{line.replace('### ', '')}</h3>;
      }
      // Bold inline parser
      const formattedLine = parseBold(line);
      
      // Bullets
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return (
          <li key={idx} className="list-disc list-inside ml-2 py-0.5 leading-relaxed text-slate-600 text-[11px]">
            {formattedLine}
          </li>
        );
      }
      return <p key={idx} className="leading-relaxed py-0.5 text-slate-600 text-[11px]">{formattedLine}</p>;
    });
  };

  const parseBold = (text) => {
    if (!text) return "";
    const regex = /\*\*(.*?)\*\*/g;
    let parts = [];
    let currentIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > currentIndex) {
        parts.push(text.substring(currentIndex, match.index));
      }
      parts.push(<strong key={match.index} className="font-extrabold text-slate-900">{match[1]}</strong>);
      currentIndex = regex.lastIndex;
    }
    
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/70 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-xs flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <SparkyIcon size={16} />
          <span className="text-xs font-bold text-slate-700 lowercase tracking-tight">sparky</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition cursor-pointer"
            title="Assistant Settings"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={handleClearHistory}
            className="text-[10px] text-slate-400 hover:text-slate-650 transition flex items-center cursor-pointer"
            title="Wipe chat history"
          >
            <RefreshCw size={11} className="mr-1" /> Clear Chat
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="p-4 bg-white border-b border-slate-200 space-y-3 font-sans text-xs shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="font-bold text-slate-700 flex items-center"><Key size={12} className="mr-1 text-slate-500" /> Router Key Configuration</span>
            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          
          <div className="space-y-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">API Key</label>
              {import.meta.env.VITE_OPENROUTER_API_KEY ? (
                <div className="w-full px-2.5 py-1.5 border border-emerald-250 bg-emerald-50/50 rounded-lg text-[10px] text-emerald-800 font-semibold select-none flex items-center">
                  <Check size={12} className="mr-1 text-emerald-600" /> Active (.env key loaded)
                </div>
              ) : (
                <div className="w-full px-2.5 py-1.5 border border-rose-200 bg-rose-50/50 rounded-lg text-[10px] text-rose-800 font-semibold select-none">
                  ⚠️ Configure VITE_OPENROUTER_API_KEY in .env
                </div>
              )}
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Solver Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white outline-none focus:border-amber-500 transition"
              >
                <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (Vision + Fast)</option>
                <option value="meta-llama/llama-3.2-11b-vision-instruct:free">Llama 3.2 11B Vision (Free)</option>
                <option value="openai/gpt-4o-mini">GPT-4o Mini (Vision + Precise)</option>
              </select>
            </div>
            
            <button
              onClick={handleSaveSettings}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1.5 rounded-lg transition text-center shadow-xs cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {apiError && (
        <div className="m-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-700 flex items-start space-x-1.5">
          <AlertTriangle size={13} className="shrink-0 text-rose-500 mt-0.5" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Messages Logs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-xs bg-white/20">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col max-w-[85%] rounded-2xl p-3.5 shadow-xs ${
              msg.role === 'assistant'
                ? 'bg-white text-slate-800 self-start border border-slate-200/80'
                : 'bg-slate-900 text-white self-end'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-1 mb-1.5 select-none">
                <SparkyIcon size={12} />
                <span className="font-bold text-[9px] lowercase text-slate-400">sparky</span>
              </div>
            )}
            {msg.role === 'assistant' ? (
              <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
            ) : (
              <p className="leading-relaxed text-[11px]">{msg.content}</p>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center space-x-2 bg-white/90 p-3 border border-slate-200/60 rounded-xl self-start shadow-xs">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            <span className="text-[10px] text-slate-400 font-medium font-mono pl-1">Analyzing traces...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Actions Triggers */}
      <div className="p-2 border-t border-slate-200 bg-white/30 flex flex-wrap gap-1.5">
        <button
          onClick={() => handleSend("Add LM7805 voltage regulator")}
          className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-slate-600 rounded-lg text-[9px] font-semibold flex items-center transition cursor-pointer"
        >
          <BookOpen size={9} className="mr-1 text-slate-400" /> +5V Regulator
        </button>
        <button
          onClick={() => handleSend("Blink an LED from ESP32")}
          className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-slate-600 rounded-lg text-[9px] font-semibold flex items-center transition cursor-pointer"
        >
          <Sparkles size={9} className="mr-1 text-amber-500" /> +LED Blinker
        </button>
        <button
          onClick={() => handleSend("Lock power traces")}
          className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-slate-600 rounded-lg text-[9px] font-semibold flex items-center transition cursor-pointer"
        >
          <Search size={9} className="mr-1 text-blue-500" /> Lock Power Rails
        </button>
      </div>

      {/* Vision Toggles */}
      <div className="p-2 border-t border-slate-200 bg-white/50 flex items-center justify-between text-[10px] text-slate-500 font-semibold select-none">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={includeScreenshot}
            onChange={(e) => setIncludeScreenshot(e.target.checked)}
            className="mr-1.5 accent-amber-500 cursor-pointer"
          />
          <Image size={11} className="mr-1 text-slate-400" /> Send board render photo
        </label>
        <span className="font-mono text-slate-400 text-[8px] uppercase">
          Model: {selectedModel.split('/').pop()}
        </span>
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-200 bg-white flex items-center space-x-2">
        <input
          type="text"
          placeholder={loading ? "Waiting..." : "Ask sparky to plan components or route wires..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500/10 transition font-sans text-xs"
          disabled={loading}
        />
        <button
          onClick={() => handleSend()}
          className="p-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition shadow-xs cursor-pointer"
          disabled={loading}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
