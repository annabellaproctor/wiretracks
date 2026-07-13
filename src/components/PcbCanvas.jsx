import React, { useRef, useEffect, useState } from 'react';
import { Circle, Flame, Trash2, Navigation, Move, HelpCircle } from 'lucide-react';

export default function PcbCanvas({
  components,
  setComponents,
  traces,
  setTraces,
  customPcbPads,
  setCustomPcbPads,
  customPcbTraces,
  setCustomPcbTraces,
  customTexts,
  setCustomTexts,
  customShapes,
  setCustomShapes,
  cameraTarget,
  setCameraTarget,
  gridSize = 15,
  layersVisibility
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Transform and size settings
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(0.85);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Toolbelt: 'select', 'pan', 'pad', 'trace', 'eraser'
  const [activeTool, setActiveTool] = useState('select'); 
  const [activeLayer, setActiveLayer] = useState('top'); 
  const [spacePressed, setSpacePressed] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); 

  // macOS Slide-out options states
  const [pcbPadSize, setPcbPadSize] = useState(12); // 8, 12, 16
  const [pcbTraceWidth, setPcbTraceWidth] = useState(4); // 2.5, 4, 6

  // Custom drawing previews
  const [drawingTracePoints, setDrawingTracePoints] = useState(null); 
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [drcReport, setDrcReport] = useState(null);

  const checkNetConnectivity = (startPad, endPad, currentTraces) => {
    const visited = new Set();
    const queue = [{ x: startPad.x, y: startPad.y }];
    
    while (queue.length > 0) {
      const current = queue.shift();
      if (Math.hypot(current.x - endPad.x, current.y - endPad.y) < 15) {
        return true; 
      }

      currentTraces.forEach((trace) => {
        if (visited.has(trace.id)) return;
        
        let touches = false;
        for (let i = 0; i < trace.points.length; i++) {
          const pt = trace.points[i];
          if (Math.hypot(current.x - pt.x, current.y - pt.y) < 12) {
            touches = true;
            break;
          }
        }

        for (let i = 0; i < trace.points.length - 1; i++) {
          const dist = distToSegment(current, trace.points[i], trace.points[i+1]);
          if (dist < 12) {
            touches = true;
            break;
          }
        }

        if (touches) {
          visited.add(trace.id);
          trace.points.forEach(pt => {
            queue.push({ x: pt.x, y: pt.y });
          });
        }
      });
    }

    return false;
  };

  const runDesignRuleCheck = () => {
    const errors = [];
    const warnings = [];

    // 1. Check for trace overlaps / short circuits on same layer between different tracks
    for (let i = 0; i < customPcbTraces.length; i++) {
      for (let j = i + 1; j < customPcbTraces.length; j++) {
        const t1 = customPcbTraces[i];
        const t2 = customPcbTraces[j];
        if (t1.layer === t2.layer && t1.netId !== t2.netId) {
          let hasOverlap = false;
          t1.points.forEach(p1 => {
            t2.points.forEach(p2 => {
              if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 12) {
                hasOverlap = true;
              }
            });
          });
          if (hasOverlap) {
            errors.push(`Short Circuit: Overlapping tracks on ${t1.layer.toUpperCase()} copper layers.`);
          }
        }
      }
    }

    // 2. Check clearance against foreign component pads
    customPcbTraces.forEach(trace => {
      components.forEach(comp => {
        const footprint = getPcbFootprint(comp);
        footprint.pads.forEach(pad => {
          const padNetId = traces.find(t => 
            (t.from.componentId === comp.id && t.from.pin === pad.name) ||
            (t.to.componentId === comp.id && t.to.pin === pad.name)
          )?.id;

          // Only check clearance if trace belongs to a different net
          if (trace.netId !== padNetId) {
            for (let i = 0; i < trace.points.length - 1; i++) {
              const dist = distToSegment(pad, trace.points[i], trace.points[i+1]);
              const isNearStart = Math.hypot(pad.x - trace.points[0].x, pad.y - trace.points[0].y) < 15;
              const isNearEnd = Math.hypot(pad.x - trace.points[trace.points.length - 1].x, pad.y - trace.points[trace.points.length - 1].y) < 15;
              if (dist > 0 && dist < 12 && !isNearStart && !isNearEnd) {
                errors.push(`Clearance Limit: Track too close to pad ${comp.name}.${pad.name} (${Math.round(dist)}px).`);
              }
            }
          }
        });
      });
    });

    // 3. Check for disconnected nets / orphans
    traces.forEach(net => {
      const compFrom = components.find(c => c.id === net.from.componentId);
      const compTo = components.find(c => c.id === net.to.componentId);
      if (!compFrom || !compTo) return;

      const pinFrom = compFrom.pins.find(p => p.name === net.from.pin);
      const pinTo = compTo.pins.find(p => p.name === net.to.pin);
      if (!pinFrom || !pinTo) return;

      const startPad = { x: compFrom.x + pinFrom.x, y: compFrom.y + pinFrom.y };
      const endPad = { x: compTo.x + pinTo.x, y: compTo.y + pinTo.y };

      const isConnected = checkNetConnectivity(startPad, endPad, customPcbTraces);
      if (!isConnected) {
        warnings.push(`Orphan Net: "${net.from.componentId}.${net.from.pin} ➔ ${net.to.componentId}.${net.to.pin}" is not routed.`);
      }
    });

    if (errors.length === 0 && warnings.length === 0) {
      setDrcReport({ status: 'clean', messages: ["No violations found. Layout matches board requirements!"] });
    } else {
      setDrcReport({ 
        status: errors.length > 0 ? 'error' : 'warning', 
        messages: [...Array.from(new Set(errors)), ...Array.from(new Set(warnings))].slice(0, 4) 
      });
    }
  };

  // Programmatic Multi-Layer A* Maze Router
  const findAStarPath = (startX, startY, endX, endY, netId, currentTraces) => {
    const openSet = [];
    const closedSet = new Set();

    const startNode = {
      x: startX,
      y: startY,
      layer: 'top',
      g: 0,
      h: Math.abs(startX - endX) + Math.abs(startY - endY),
      f: Math.abs(startX - endX) + Math.abs(startY - endY),
      parent: null
    };

    openSet.push(startNode);

    const getNeighbors = (node) => {
      const neighbors = [];
      const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
      ];

      dirs.forEach(d => {
        neighbors.push({
          x: node.x + d.dx * 15,
          y: node.y + d.dy * 15,
          layer: node.layer,
          cost: 15
        });
      });

      // Layer switch via penalty
      neighbors.push({
        x: node.x,
        y: node.y,
        layer: node.layer === 'top' ? 'bottom' : 'top',
        cost: 60 
      });

      return neighbors;
    };

    const isCollision = (x, y, layer) => {
      // Check collision with foreign component pads
      for (const comp of components) {
        const footprint = getPcbFootprint(comp);
        for (const pad of footprint.pads) {
          const isStartPad = Math.hypot(x - startX, y - startY) < 15;
          const isEndPad = Math.hypot(x - endX, y - endY) < 15;
          if (isStartPad || isEndPad) continue;

          if (Math.hypot(x - pad.x, y - pad.y) < 15) {
            return true; 
          }
        }
      }

      // Check collision with foreign tracks already routed
      for (const trace of currentTraces) {
        if (trace.netId !== netId && trace.layer === layer) {
          for (let i = 0; i < trace.points.length - 1; i++) {
            const dist = distToSegment({ x, y }, trace.points[i], trace.points[i+1]);
            if (dist < 15) {
              return true; 
            }
          }
        }
      }

      // Bound checking
      if (x < 20 || x > 980 || y < 20 || y > 680) return true;

      return false;
    };

    let iterations = 0;
    while (openSet.length > 0 && iterations < 800) {
      iterations++;
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();

      if (Math.hypot(current.x - endX, current.y - endY) < 10) {
        const path = [];
        let curr = current;
        while (curr !== null) {
          path.unshift(curr);
          curr = curr.parent;
        }
        return path;
      }

      const key = `${current.x}_${current.y}_${current.layer}`;
      closedSet.add(key);

      const neighbors = getNeighbors(current);
      for (const n of neighbors) {
        const neighborKey = `${n.x}_${n.y}_${n.layer}`;
        if (closedSet.has(neighborKey)) continue;

        if (isCollision(n.x, n.y, n.layer)) continue;

        const gScore = current.g + n.cost;
        let existing = openSet.find(o => o.x === n.x && o.y === n.y && o.layer === n.layer);

        if (!existing) {
          const hScore = Math.abs(n.x - endX) + Math.abs(n.y - endY);
          const newNode = {
            x: n.x,
            y: n.y,
            layer: n.layer,
            g: gScore,
            h: hScore,
            f: gScore + hScore,
            parent: current
          };
          openSet.push(newNode);
        } else if (gScore < existing.g) {
          existing.g = gScore;
          existing.f = gScore + existing.h;
          existing.parent = current;
        }
      }
    }

    // Direct line fallback if routing blocked
    return [
      { x: startX, y: startY, layer: 'top' },
      { x: endX, y: endY, layer: 'top' }
    ];
  };

  const runAutorouter = () => {
    console.log("[PCB Autorouter] Running Multi-Layer Maze search...");
    const newTraces = [];

    traces.forEach(net => {
      const compFrom = components.find(c => c.id === net.from.componentId);
      const compTo = components.find(c => c.id === net.to.componentId);
      if (!compFrom || !compTo) return;

      const pinFrom = compFrom.pins.find(p => p.name === net.from.pin);
      const pinTo = compTo.pins.find(p => p.name === net.to.pin);
      if (!pinFrom || !pinTo) return;

      const startX = snapToGrid(compFrom.x + pinFrom.x);
      const startY = snapToGrid(compFrom.y + pinFrom.y);
      const endX = snapToGrid(compTo.x + pinTo.x);
      const endY = snapToGrid(compTo.y + pinTo.y);

      const path = findAStarPath(startX, startY, endX, endY, net.id, newTraces);
      if (path && path.length > 1) {
        let currentPoints = [path[0]];
        let currentLayer = path[0].layer;

        for (let i = 1; i < path.length; i++) {
          const pt = path[i];
          if (pt.layer !== currentLayer) {
            newTraces.push({
              id: `trace_${net.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              netId: net.id,
              points: currentPoints,
              layer: currentLayer,
              width: 4
            });
            currentPoints = [path[i - 1], pt];
            currentLayer = pt.layer;
          } else {
            currentPoints.push(pt);
          }
        }

        newTraces.push({
          id: `trace_${net.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          netId: net.id,
          points: currentPoints,
          layer: currentLayer,
          width: 4
        });
      }
    });

    setCustomPcbTraces(newTraces);
  };


  const GRID_SIZE = 15;

  // Run DRC check automatically on layout modification
  useEffect(() => {
    runDesignRuleCheck();
  }, [customPcbTraces, components, traces, customPcbPads]);

  // ResizeObserver setup
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(100, rect.width),
          height: Math.max(100, rect.height)
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => handleResize());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  // Spacebar pan toggle key listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === ' ' && !spacePressed) {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      // Hotkey switches
      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      if (key === 'h') setActiveTool('pan');
      if (key === 'p') setActiveTool('pad');
      if (key === 't') setActiveTool('trace');
      if (key === 'e') setActiveTool('eraser');
    };

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed]);

  // Focus step cameras during AI tour runs
  useEffect(() => {
    if (cameraTarget) {
      const targetPanX = (dimensions.width / 2) - cameraTarget.x * cameraTarget.zoom;
      const targetPanY = (dimensions.height / 2) - cameraTarget.y * cameraTarget.zoom;
      setPan({ x: targetPanX, y: targetPanY });
      setZoom(cameraTarget.zoom);
      setCameraTarget(null);
    }
  }, [cameraTarget, dimensions]);

  // Close context menu on click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [contextMenu]);

  // Override browser trackpad horizontal sweeps, browser history shifts, and page-zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      
      if (e.ctrlKey) {
        const zoomFactor = 1.08;
        setZoom(prev => {
          const next = e.deltaY < 0 ? prev * zoomFactor : prev / zoomFactor;
          return Math.max(0.4, Math.min(2.5, next));
        });
      } else {
        setPan(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    };

    const handleGestureStart = (e) => e.preventDefault();

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('gesturestart', handleGestureStart, { passive: false });
    canvas.addEventListener('gesturechange', handleGestureStart, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('gesturestart', handleGestureStart);
      canvas.removeEventListener('gesturechange', handleGestureStart);
    };
  }, []);

  const screenToWorld = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  const snapToGrid = (val) => {
    return Math.round(val / gridSize) * gridSize;
  };

  const getPcbFootprint = (comp) => {
    const px = comp.x;
    const py = comp.y;
    
    // Always map pads dynamically from the same comp.pins definition
    // to maintain alignment between Schematic and PCB layers.
    const isDiscrete = ['resistor', 'capacitor', 'led'].includes(comp.type) && !comp.isImported;
    return {
      x: px,
      y: py,
      w: comp.width,
      h: comp.height,
      type: comp.package || comp.footprintName || `${comp.type.toUpperCase()}-PACK`,
      pads: comp.pins.map((pin) => {
        const padX = px + pin.x;
        const padY = py + pin.y;
        return {
          name: pin.name,
          x: padX,
          y: padY,
          type: isDiscrete ? 'circle' : 'rect',
          w: pin.dir === 'up' || pin.dir === 'down' ? 12 : 8,
          h: pin.dir === 'up' || pin.dir === 'down' ? 8 : 12
        };
      })
    };
  };

  const findPadAt = (x, y) => {
    for (const pad of customPcbPads) {
      if (Math.hypot(x - pad.x, y - pad.y) <= 10) {
        return { id: pad.id, x: pad.x, y: pad.y, custom: true };
      }
    }
    for (const comp of components) {
      const footprint = getPcbFootprint(comp);
      for (const pad of footprint.pads) {
        if (Math.hypot(x - pad.x, y - pad.y) <= 10) {
          return { id: `${comp.id}.${pad.name}`, x: pad.x, y: pad.y, custom: false };
        }
      }
    }
    return null;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const world = screenToWorld(e.clientX, e.clientY);
    let targetType = 'empty';
    let targetId = null;

    const clickedPad = findPadAt(world.x, world.y);
    if (clickedPad && clickedPad.custom) {
      targetType = 'pad';
      targetId = clickedPad.id;
    } else {
      for (const trace of customPcbTraces) {
        for (let i = 0; i < trace.points.length - 1; i++) {
          if (distToSegment(world, trace.points[i], trace.points[i+1]) <= 6) {
            targetType = 'trace';
            targetId = trace.id;
            break;
          }
        }
        if (targetId) break;
      }
    }

    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      type: targetType,
      targetId: targetId,
      rawCoord: world
    });
  };

  const handleMouseDown = (e) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const gridX = snapToGrid(world.x);
    const gridY = snapToGrid(world.y);

    if (e.button === 2) {
      return; // Handled by handleContextMenu
    }

    if (e.button === 1 || activeTool === 'pan' || spacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    if (activeTool === 'pad') {
      const exists = customPcbPads.some(p => p.x === gridX && p.y === gridY);
      if (!exists) {
        const newPad = {
          id: `custom_pad_${Date.now()}`,
          x: gridX,
          y: gridY,
          size: pcbPadSize // inherit selected size!
        };
        setCustomPcbPads(prev => [...prev, newPad]);
      }
    }

    else if (activeTool === 'trace') {
      const clickedPad = findPadAt(world.x, world.y);
      const startPt = clickedPad ? { x: clickedPad.x, y: clickedPad.y } : { x: gridX, y: gridY };

      if (!drawingTracePoints) {
        setDrawingTracePoints([startPt]);
        setMousePos(world);
      } else {
        const lastPt = drawingTracePoints[drawingTracePoints.length - 1];
        const dx = Math.abs(gridX - lastPt.x);
        const dy = Math.abs(gridY - lastPt.y);
        
        let targetPt = { x: gridX, y: gridY };
        if (dx > dy) {
          targetPt = { x: gridX, y: lastPt.y };
        } else {
          targetPt = { x: lastPt.x, y: gridY };
        }

        const nextPoints = [...drawingTracePoints, targetPt];
        const destPad = findPadAt(world.x, world.y);
        
        if (destPad && (destPad.x !== drawingTracePoints[0].x || destPad.y !== drawingTracePoints[0].y)) {
          const finalTrace = {
            id: `custom_trace_${Date.now()}`,
            points: [...drawingTracePoints, { x: destPad.x, y: destPad.y }],
            layer: activeLayer,
            width: pcbTraceWidth, // inherit selected width!
            isLocked: true
          };
          setCustomPcbTraces(prev => [...prev, finalTrace]);
          setDrawingTracePoints(null);
        } else {
          setDrawingTracePoints(nextPoints);
        }
      }
    }

    else if (activeTool === 'eraser') {
      const padIdx = customPcbPads.findIndex(p => Math.hypot(world.x - p.x, world.y - p.y) <= 10);
      if (padIdx !== -1) {
        setCustomPcbPads(prev => prev.filter((_, i) => i !== padIdx));
        return;
      }

      const traceIdx = customPcbTraces.findIndex(t => {
        for (let i = 0; i < t.points.length - 1; i++) {
          const dist = distToSegment(world, t.points[i], t.points[i+1]);
          if (dist <= 6) return true;
        }
        return false;
      });

      if (traceIdx !== -1) {
        setCustomPcbTraces(prev => prev.filter((_, i) => i !== traceIdx));
      }
    }
  };

  const handleMouseMove = (e) => {
    const world = screenToWorld(e.clientX, e.clientY);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (activeTool === 'trace' && drawingTracePoints) {
      setMousePos(world);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape' && drawingTracePoints) {
      setDrawingTracePoints(null);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [drawingTracePoints]);

  const distToSegment = (p, v, w) => {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const substrateWidth = 1000;
    const substrateHeight = 700;

    // Matte dark-green PCB board
    ctx.fillStyle = '#0b2e13'; 
    ctx.strokeStyle = '#1e3f20';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(0, 0, substrateWidth, substrateHeight, 16);
    ctx.fill();
    ctx.stroke();

    // Silkscreen border line
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.roundRect(8, 8, substrateWidth - 16, substrateHeight - 16, 12);
    ctx.stroke();
    ctx.setLineDash([]);

    // PCB Grid background (subtle copper dots)
    if (layersVisibility.grid) {
      ctx.fillStyle = '#114a1e';
      for (let x = 30; x < substrateWidth - 30; x += gridSize * 2) {
        for (let y = 30; y < substrateHeight - 30; y += gridSize * 2) {
          ctx.beginPath();
          ctx.arc(x, y, 0.8, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }

    // 1. Draw schematic traces
    traces.forEach(trace => {
      const isVisible = trace.isLocked ? layersVisibility.lockedTraces : layersVisibility.traces;
      if (!isVisible || !trace.path || trace.path.length < 2) return;

      ctx.lineWidth = trace.isLocked ? 4 : 2.5;
      ctx.strokeStyle = trace.isLocked ? '#f59e0b' : '#3b82f6';

      ctx.beginPath();
      ctx.moveTo(trace.path[0].x, trace.path[0].y);
      for (let i = 1; i < trace.path.length; i++) {
        ctx.lineTo(trace.path[i].x, trace.path[i].y);
      }
      ctx.stroke();
      
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 1;
      trace.path.forEach((pt, i) => {
        if (i > 0 && i < trace.path.length - 1) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      });
    });

    // 2. Draw custom copper trace paths
    customPcbTraces.forEach(trace => {
      const isVisible = trace.layer === 'top' ? layersVisibility.lockedTraces : layersVisibility.traces;
      if (!isVisible || !trace.points || trace.points.length < 2) return;

      ctx.lineWidth = trace.width || 4;
      ctx.strokeStyle = trace.layer === 'top' ? '#d97706' : '#2563eb'; 
      
      ctx.beginPath();
      ctx.moveTo(trace.points[0].x, trace.points[0].y);
      for (let i = 1; i < trace.points.length; i++) {
        ctx.lineTo(trace.points[i].x, trace.points[i].y);
      }
      ctx.stroke();
    });

    // 3. Draw trace preview
    if (activeTool === 'trace' && drawingTracePoints && drawingTracePoints.length > 0) {
      ctx.lineWidth = pcbTraceWidth;
      ctx.strokeStyle = activeLayer === 'top' ? 'rgba(217, 119, 6, 0.6)' : 'rgba(37, 99, 235, 0.6)';
      ctx.setLineDash([4, 2]);

      const lastPt = drawingTracePoints[drawingTracePoints.length - 1];
      const gridX = snapToGrid(mousePos.x);
      const gridY = snapToGrid(mousePos.y);

      const dx = Math.abs(gridX - lastPt.x);
      const dy = Math.abs(gridY - lastPt.y);
      let targetPt = { x: gridX, y: gridY };
      if (dx > dy) {
        targetPt = { x: gridX, y: lastPt.y };
      } else {
        targetPt = { x: lastPt.x, y: gridY };
      }

      ctx.beginPath();
      ctx.moveTo(drawingTracePoints[0].x, drawingTracePoints[0].y);
      for (let i = 1; i < drawingTracePoints.length; i++) {
        ctx.lineTo(drawingTracePoints[i].x, drawingTracePoints[i].y);
      }
      ctx.lineTo(targetPt.x, targetPt.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Draw custom placed pads
    customPcbPads.forEach(pad => {
      const padR = pad.size / 2;
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, padR + 0.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, padR - 1.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    // 5. Draw component footprints
    if (layersVisibility.components) {
      components.forEach(comp => {
        const footprint = getPcbFootprint(comp);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        
        if (comp.type === 'mcu') {
          ctx.strokeRect(footprint.x + 8, footprint.y + 6, footprint.w - 16, footprint.h - 12);
          if (layersVisibility.text) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Courier New, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(comp.name, footprint.x + footprint.w / 2, footprint.y + footprint.h / 2);
          }
        } else {
          ctx.strokeRect(footprint.x + 10, footprint.y + 4, footprint.w - 20, footprint.h - 8);
          if (layersVisibility.text) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(comp.name, footprint.x + footprint.w / 2, footprint.y - 4);
          }
        }

        footprint.pads.forEach(pad => {
          ctx.fillStyle = '#d4af37';
          if (pad.type === 'rect') {
            ctx.fillRect(pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(pad.x - pad.w / 2 + 1.5, pad.y - pad.h / 2 + 1.5, pad.w - 3, pad.h - 3);
          } else {
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, 2.5, 0, 2 * Math.PI);
            ctx.fill();
          }
        });
      });
    }

    // 6. Custom text annotations
    if (layersVisibility.text) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'italic 11px Courier New';
      ctx.textAlign = 'left';
      customTexts.forEach(t => {
        ctx.fillText(t.text, t.x, t.y);
      });
    }

    // 7. Custom outlines
    if (layersVisibility.shapes) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      customShapes.forEach(shape => {
        ctx.strokeRect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);
      });
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [components, traces, customPcbPads, customPcbTraces, customTexts, customShapes, pan, zoom, activeTool, activeLayer, drawingTracePoints, mousePos, dimensions, gridSize, layersVisibility, pcbPadSize, pcbTraceWidth]);

  const dpr = window.devicePixelRatio || 1;

  const getCursorClass = () => {
    if (spacePressed || activeTool === 'pan') {
      return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    }
    if (activeTool === 'eraser') return 'cursor-cell';
    return 'cursor-crosshair';
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full bg-slate-900 flex overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* VIRTUAL PCB TOOLBAR WITH macOS STYLE SLIDE-OUT DRAWER */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-15 flex items-stretch text-slate-400">
        
        {/* Core Vertical Strip */}
        <div className="flex flex-col bg-slate-800/95 border border-slate-700/80 p-1.5 rounded-xl shadow-md space-y-1.5 z-20">
          <button
            onClick={() => { setActiveTool('select'); setDrawingTracePoints(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'select' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'}`}
            title="Pointer / Select Tool (V)"
          >
            <Navigation size={15} className="rotate-[270deg]" />
          </button>

          <button
            onClick={() => { setActiveTool('pan'); setDrawingTracePoints(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'pan' || spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'}`}
            title="Pan Board Tool (H / Spacebar Drag)"
          >
            <Move size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('pad'); setDrawingTracePoints(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'pad' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'}`}
            title="Place Custom Solder Joint / Pad (P)"
          >
            <Circle size={15} className="fill-current stroke-none" />
          </button>

          <button
            onClick={() => { setActiveTool('trace'); setDrawingTracePoints(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'trace' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'}`}
            title="Route Copper Trace Rail (T)"
          >
            <Flame size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('eraser'); setDrawingTracePoints(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'eraser' && !spacePressed ? 'bg-rose-600 text-white shadow-sm' : 'hover:bg-slate-700 hover:text-white'}`}
            title="Erase Solder Pads / Track segment (E)"
          >
            <Trash2 size={15} />
          </button>

          <span className="h-px bg-slate-700 w-full font-sans"></span>

          <button
            onClick={() => { setPan({ x: 60, y: 60 }); setZoom(0.85); }}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-700 hover:text-white transition"
            title="Recenter PCB View"
          >
            <HelpCircle size={15} />
          </button>
        </div>

        {/* macOS Style Slideout Settings Drawer */}
        {activeTool && activeTool !== 'select' && activeTool !== 'pan' && (
          <div className="ml-2 bg-slate-800/95 border border-slate-700/80 rounded-xl shadow-md p-3 text-[11px] text-slate-300 flex flex-col justify-center transition-all duration-300 transform translate-x-0 w-44 z-10 select-none animate-in fade-in slide-in-from-left-4 font-sans">
            {activeTool === 'pad' && (
              <div className="space-y-2">
                <div className="font-bold border-b border-slate-700 pb-1 text-white">Solder Joint Size</div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold block mb-1">Pad Size Options:</span>
                  <div className="flex space-x-1 bg-slate-900 p-0.5 rounded border border-slate-750">
                    <button onClick={() => setPcbPadSize(8)} className={`flex-1 py-1 text-[9px] rounded font-bold transition ${pcbPadSize === 8 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>8px</button>
                    <button onClick={() => setPcbPadSize(12)} className={`flex-1 py-1 text-[9px] rounded font-bold transition ${pcbPadSize === 12 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>12px</button>
                    <button onClick={() => setPcbPadSize(16)} className={`flex-1 py-1 text-[9px] rounded font-bold transition ${pcbPadSize === 16 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>16px</button>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 leading-normal">Select pad hole diameter then click grid paper to print solder sinks.</p>
              </div>
            )}

            {activeTool === 'trace' && (
              <div className="space-y-2">
                <div className="font-bold border-b border-slate-700 pb-1 text-white">Copper Tracks</div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold block mb-1">Line Thickness:</span>
                  <div className="flex space-x-1 bg-slate-900 p-0.5 rounded border border-slate-750">
                    <button onClick={() => setPcbTraceWidth(2.5)} className={`flex-1 py-1 text-[9px] rounded font-bold transition ${pcbTraceWidth === 2.5 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>2.5px</button>
                    <button onClick={() => setPcbTraceWidth(4)} className={`flex-1 py-1 text-[9px] rounded font-bold transition ${pcbTraceWidth === 4 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>4px</button>
                    <button onClick={() => setPcbTraceWidth(6)} className={`flex-1 py-1 text-[9px] rounded font-bold transition ${pcbTraceWidth === 6 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>6px</button>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 leading-normal">Draw copper wires on {activeLayer.toUpperCase()} copper layers.</p>
              </div>
            )}

            {activeTool === 'eraser' && (
              <div className="space-y-1.5 text-rose-400">
                <div className="font-bold border-b border-rose-900/40 pb-1">Eraser Mode</div>
                <p className="text-[10px] text-slate-500 leading-normal">Click custom copper lines or manual solder joints on board to erase.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Solder active layer indicators */}
      <div className="absolute top-3 left-16 z-10 flex items-center space-x-2 bg-slate-800/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg shadow-sm">
        <span className="text-[10px] font-bold text-slate-400 uppercase">Layer:</span>
        <select
          value={activeLayer}
          onChange={(e) => setActiveLayer(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-[10px] font-mono text-white outline-none"
        >
          <option value="top">Top Copper (Gold)</option>
          <option value="bottom">Bottom Copper (Blue)</option>
        </select>
        
        <span className="h-4 w-px bg-slate-700"></span>
        
        <button
          onClick={() => { setCustomPcbPads([]); setCustomPcbTraces([]); setDrawingTracePoints(null); setDrcReport(null); }}
          className="text-rose-450 hover:text-rose-300 text-[10px] font-bold transition cursor-pointer"
        >
          Reset Solder
        </button>

        <span className="h-4 w-px bg-slate-700"></span>
        
        <button
          onClick={runDesignRuleCheck}
          className="text-amber-400 hover:text-amber-300 text-[10px] font-bold transition flex items-center cursor-pointer"
          title="Run Design Rule Check (DRC) on current copper layouts"
        >
          🔍 Run DRC
        </button>

        <span className="h-4 w-px bg-slate-700"></span>
        
        <button
          onClick={runAutorouter}
          className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold transition flex items-center cursor-pointer animate-pulse"
          title="Automatically route all nets on Top/Bottom copper layers"
        >
          ⚡ Run Autorouter
        </button>
      </div>

      {/* DRC Report Modal Overlay */}
      {drcReport && (
        <div className={`absolute bottom-3 right-3 z-15 p-3.5 rounded-xl border shadow-md font-sans text-xs min-w-[280px] max-w-[320px] transition-all animate-in fade-in slide-in-from-bottom-4 ${drcReport.status === 'clean' ? 'bg-emerald-950/95 border-emerald-800 text-emerald-100' : drcReport.status === 'warning' ? 'bg-amber-950/95 border-amber-800 text-amber-100' : 'bg-rose-950/95 border-rose-900/80 text-rose-100'}`}>
          <div className="flex items-center justify-between font-bold border-b border-white/20 pb-1 mb-1.5 uppercase tracking-wider text-[9px]">
            <span>{drcReport.status === 'clean' ? '✔ DRC Clean' : drcReport.status === 'warning' ? '⚠️ DRC Warnings' : '⚠️ Design Rule Violations'}</span>
            <button onClick={() => setDrcReport(null)} className="text-white/60 hover:text-white cursor-pointer font-bold">✕</button>
          </div>
          <ul className="space-y-1.5 text-[10px] list-disc list-inside">
            {drcReport.messages.map((m, idx) => (
              <li key={idx} className="leading-normal font-medium">{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }} 
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 text-xs text-slate-300 min-w-[140px] font-sans"
        >
          {contextMenu.type === 'pad' && (
            <button 
              onClick={() => {
                setCustomPcbPads(prev => prev.filter(p => p.id !== contextMenu.targetId));
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 hover:bg-slate-700 hover:text-white flex items-center transition"
            >
              <Trash2 size={12} className="mr-1.5 text-rose-400" /> Delete Pad
            </button>
          )}

          {contextMenu.type === 'trace' && (
            <button 
              onClick={() => {
                setCustomPcbTraces(prev => prev.filter(t => t.id !== contextMenu.targetId));
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 hover:bg-slate-700 hover:text-white flex items-center transition"
            >
              <Trash2 size={12} className="mr-1.5 text-rose-400" /> Delete Track
            </button>
          )}

          {contextMenu.type === 'empty' && (
            <>
              <div className="px-3 py-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider">Quick Actions</div>
              <button 
                onClick={() => {
                  const gx = snapToGrid(contextMenu.rawCoord.x);
                  const gy = snapToGrid(contextMenu.rawCoord.y);
                  if (!customPcbPads.some(p => p.x === gx && p.y === gy)) {
                    setCustomPcbPads(prev => [...prev, { id: `custom_pad_${Date.now()}`, x: gx, y: gy, size: pcbPadSize }]);
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-700 hover:text-white flex items-center transition"
              >
                + Add Pad at Grid
              </button>
              <button 
                onClick={() => {
                  setActiveLayer(prev => prev === 'top' ? 'bottom' : 'top');
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-slate-700 hover:text-white flex items-center transition"
              >
                Toggle Routing Layer
              </button>
              <span className="block h-px bg-slate-700 my-0.5"></span>
              <button 
                onClick={() => { setPan({ x: 60, y: 60 }); setZoom(0.85); setContextMenu(null); }}
                className="w-full px-3 py-1.5 hover:bg-slate-700 hover:text-white flex items-center transition text-slate-500"
              >
                Reset Camera
              </button>
            </>
          )}
        </div>
      )}

      <div className="absolute top-3 right-3 z-10 bg-slate-800/90 border border-slate-700 px-2.5 py-1.5 rounded-md pointer-events-none text-[10px] font-mono text-slate-400 space-y-1">
        <div>Active: {activeTool.toUpperCase()} MODE</div>
        {drawingTracePoints && (
          <div className="text-amber-400 animate-pulse">ESC to cancel routing</div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className={`${getCursorClass()} w-full h-full cursor-crosshair bg-slate-950`}
      />
    </div>
  );
}
