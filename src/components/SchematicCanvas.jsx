import React, { useRef, useEffect, useState } from 'react';
import { findOrthogonalPath } from '../utils/router';
import { Lock, Unlock, Trash2, RotateCw, Settings, Search, Edit3, Navigation, Move, HelpCircle, Type, Square, Ruler, Layers } from 'lucide-react';
import { searchComponentImages, searchJLCPartCode } from '../utils/partsApi';
import { sendToRouter } from '../utils/openRouter';

// --- CAD Component Layout Helpers ---





const distributePinsBySides = (pins, sidesMap, pitch, width, height, pinOffsets = {}) => {
  const leftPins = pins.filter(p => sidesMap[p.name] === 'left');
  const rightPins = pins.filter(p => sidesMap[p.name] === 'right');
  const topPins = pins.filter(p => sidesMap[p.name] === 'top');
  const bottomPins = pins.filter(p => sidesMap[p.name] === 'bottom');
  
  const result = [];
  
  leftPins.forEach((p, i) => {
    const defaultY = i * pitch + 15;
    let customY = pinOffsets[p.name] !== undefined ? pinOffsets[p.name] : defaultY;
    customY = Math.max(8, Math.min(height - 8, customY));
    result.push({
      ...p,
      x: 0,
      y: customY,
      dir: 'left'
    });
  });
  
  rightPins.forEach((p, i) => {
    const defaultY = i * pitch + 15;
    let customY = pinOffsets[p.name] !== undefined ? pinOffsets[p.name] : defaultY;
    customY = Math.max(8, Math.min(height - 8, customY));
    result.push({
      ...p,
      x: width,
      y: customY,
      dir: 'right'
    });
  });
  
  topPins.forEach((p, i) => {
    const defaultX = i * pitch + 15;
    let customX = pinOffsets[p.name] !== undefined ? pinOffsets[p.name] : defaultX;
    customX = Math.max(8, Math.min(width - 8, customX));
    result.push({
      ...p,
      x: customX,
      y: 0,
      dir: 'up'
    });
  });
  
  bottomPins.forEach((p, i) => {
    const defaultX = i * pitch + 15;
    let customX = pinOffsets[p.name] !== undefined ? pinOffsets[p.name] : defaultX;
    customX = Math.max(8, Math.min(width - 8, customX));
    result.push({
      ...p,
      x: customX,
      y: height,
      dir: 'down'
    });
  });
  
  return result;
};

const getConnectedPins = (compId, pinName, currentTraces = [], currentComps = []) => {
  const startPinStr = `${compId}.${pinName}`;
  const visited = new Set();
  const queue = [startPinStr];
  visited.add(startPinStr);
  
  while (queue.length > 0) {
    const current = queue.shift();
    currentTraces.forEach(t => {
      if (t.from === current && !visited.has(t.to)) {
        visited.add(t.to);
        queue.push(t.to);
      } else if (t.to === current && !visited.has(t.from)) {
        visited.add(t.from);
        queue.push(t.from);
      }
    });
  }
  
  const list = [];
  visited.forEach(pinStr => {
    if (pinStr === startPinStr) return;
    const [cId, pName] = pinStr.split('.');
    const comp = currentComps.find(c => c.id === cId || c.name === cId);
    if (comp) {
      list.push({
        compId: comp.id,
        compLabel: comp.label || comp.partNumber || comp.name,
        pinName: pName
      });
    }
  });
  return list;
};

export default function SchematicCanvas({
  components,
  setComponents,
  traces,
  setTraces,
  customTexts,
  setCustomTexts,
  customShapes,
  setCustomShapes,
  selectedComponentId,
  setSelectedComponentId,
  selectedTraceId,
  setSelectedTraceId,
  cameraTarget,
  setCameraTarget,
  gridSize = 15,
  layersVisibility
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Transform and size states
  const [pan, setPan] = useState({ x: 100, y: 80 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Toolbelt: 'select', 'pan', 'wire', 'text', 'shape', 'ruler', 'eraser'
  const [activeTool, setActiveTool] = useState('select'); 
  const [spacePressed, setSpacePressed] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); 
  const [skinPicker, setSkinPicker] = useState(null); // { compId, partNumber, images: [], selectedUrl: '', customUrl: '', loading: false }
  const [visibleCount, setVisibleCount] = useState(12);
  const [pinoutReference, setPinoutReference] = useState('');
  const [isSmartPlacing, setIsSmartPlacing] = useState(false);

  // States for interactive pin hover and connection info card
  const [hoveredPin, setHoveredPin] = useState(null); // { compId, pinName, compLabel, pin }
  const [tooltipState, setTooltipState] = useState({ visible: false, x: 0, y: 0, compLabel: '', pinName: '', connections: [] });
  const tooltipTimerRef = useRef(null);


  // macOS Slide-out Options Panel settings
  const [wireColor, setWireColor] = useState('#2563eb'); // '#2563eb', '#dc2626', '#16a34a', '#d97706'
  const [autoPenaltyMode, setAutoPenaltyMode] = useState('high'); // 'high', 'low'


  // Dragging and custom shape/ruler states
  const [draggingCompId, setDraggingCompId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggingNodule, setDraggingNodule] = useState(null); // { traceId, index }
  
  const [drawingWireFrom, setDrawingWireFrom] = useState(null); 
  const [drawingShapeStart, setDrawingShapeStart] = useState(null); 
  const [rulerStart, setRulerStart] = useState(null); 
  const [rulerEnd, setRulerEnd] = useState(null); 

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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

  // Listen for Spacebar key toggles
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

      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      if (key === 'h') setActiveTool('pan');
      if (key === 'w') setActiveTool('wire');
      if (key === 't') setActiveTool('text');
      if (key === 's') setActiveTool('shape');
      if (key === 'm') setActiveTool('ruler');
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

  // Center camera targets during tours
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
          return Math.max(0.4, Math.min(3, next));
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

  const recalculateAllRoutes = (currentComps = components, currentTraces = traces) => {
    const sortedTraces = [...currentTraces].sort((a, b) => {
      if (a.isLocked && !b.isLocked) return -1;
      if (!a.isLocked && b.isLocked) return 1;
      return 0;
    });

    const updatedTraces = [];
    
    sortedTraces.forEach((trace) => {
      // Keep manual paths intact if locked
      if (trace.isLocked && trace.path && trace.path.length > 0) {
        updatedTraces.push(trace);
        return;
      }

      const [startCompId, startPinName] = trace.from.split('.');
      const [endCompId, endPinName] = trace.to.split('.');

      const startComp = currentComps.find(c => c.id === startCompId || c.name === startCompId);
      const endComp = currentComps.find(c => c.id === endCompId || c.name === endCompId);

      if (!startComp || !endComp) return;

      const startPin = startComp.pins.find(p => p.name === startPinName);
      const endPin = endComp.pins.find(p => p.name === endPinName);

      if (!startPin || !endPin) return;

      const startPos = {
        x: startComp.x + startPin.x,
        y: startComp.y + startPin.y
      };
      const endPos = {
        x: endComp.x + endPin.x,
        y: endComp.y + endPin.y
      };

      const path = findOrthogonalPath(
        startPos, 
        endPos, 
        currentComps, 
        updatedTraces,
        gridSize
      );

      updatedTraces.push({
        ...trace,
        path
      });
    });

    setTraces(updatedTraces);
  };

  useEffect(() => {
    if (components.length > 0) {
      recalculateAllRoutes();
    }
  }, [components, gridSize]);

  // Main Drawing Loop
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

    // 1. Draw Grid Lines
    if (layersVisibility.grid) {
      ctx.strokeStyle = '#f1ebde';
      ctx.lineWidth = 0.5;

      const startX = Math.floor((-pan.x / zoom) / gridSize) * gridSize;
      const endX = Math.ceil(((-pan.x + dimensions.width) / zoom) / gridSize) * gridSize;
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -pan.y / zoom);
        ctx.lineTo(x, (-pan.y + dimensions.height) / zoom);
        ctx.stroke();
      }

      const startY = Math.floor((-pan.y / zoom) / gridSize) * gridSize;
      const endY = Math.ceil(((-pan.y + dimensions.height) / zoom) / gridSize) * gridSize;
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-pan.x / zoom, y);
        ctx.lineTo((-pan.x + dimensions.width) / zoom, y);
        ctx.stroke();
      }

      // Major grid guides (every 5th cell)
      ctx.strokeStyle = '#e3d9c5';
      ctx.lineWidth = 1.2;
      const majorStep = gridSize * 5;

      const mStartX = Math.floor((-pan.x / zoom) / majorStep) * majorStep;
      const mEndX = Math.ceil(((-pan.x + dimensions.width) / zoom) / majorStep) * majorStep;
      for (let x = mStartX; x <= mEndX; x += majorStep) {
        ctx.beginPath();
        ctx.moveTo(x, -pan.y / zoom);
        ctx.lineTo(x, (-pan.y + dimensions.height) / zoom);
        ctx.stroke();
      }

      const mStartY = Math.floor((-pan.y / zoom) / majorStep) * majorStep;
      const mEndY = Math.ceil(((-pan.y + dimensions.height) / zoom) / majorStep) * majorStep;
      for (let y = mStartY; y <= mEndY; y += majorStep) {
        ctx.beginPath();
        ctx.moveTo(-pan.x / zoom, y);
        ctx.lineTo((-pan.x + dimensions.width) / zoom, y);
        ctx.stroke();
      }
    }

    // 2. Draw custom outline shapes
    if (layersVisibility.shapes && customShapes) {
      let shapesList = customShapes;
      if (typeof shapesList === 'string') {
        try { shapesList = JSON.parse(shapesList); } catch (e) { shapesList = []; }
      }
      if (Array.isArray(shapesList)) {
        shapesList.forEach(shape => {
          ctx.strokeStyle = shape.color || '#3b82f6';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
          ctx.fillRect(Math.min(shape.x1, shape.x2), Math.min(shape.y1, shape.y2), 65, 14);
          ctx.font = '8px Inter, sans-serif';
          ctx.fillStyle = '#1d4ed8';
          ctx.fillText("Boundary Box", Math.min(shape.x1, shape.x2) + 5, Math.min(shape.y1, shape.y2) + 10);
        });
      }

      if (activeTool === 'shape' && drawingShapeStart) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        const gx = snapToGrid(mousePos.x);
        const gy = snapToGrid(mousePos.y);
        ctx.strokeRect(drawingShapeStart.x, drawingShapeStart.y, gx - drawingShapeStart.x, gy - drawingShapeStart.y);
        ctx.setLineDash([]);
      }
    }

    // 3. Draw electrical traces
    traces.forEach((trace) => {
      const isSelected = trace.id === selectedTraceId;
      const isVisible = trace.isLocked ? layersVisibility.lockedTraces : layersVisibility.traces;
      if (!isVisible || !trace.path || trace.path.length < 2) return;

      ctx.lineWidth = trace.isLocked ? 3.5 : (isSelected ? 3 : 2);
      
      // Inherit custom color settings if saved
      ctx.strokeStyle = trace.color || (trace.isLocked ? '#d97706' : (isSelected ? '#ef4444' : '#2563eb'));

      ctx.beginPath();
      ctx.moveTo(trace.path[0].x, trace.path[0].y);
      for (let i = 1; i < trace.path.length; i++) {
        ctx.lineTo(trace.path[i].x, trace.path[i].y);
      }
      ctx.stroke();

      if (isSelected || trace.isLocked) {
        ctx.fillStyle = trace.isLocked ? '#fbbf24' : '#ef4444';
        trace.path.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.2, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    });

    // 4. Draw wire pencil preview
    if (drawingWireFrom) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = wireColor;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(drawingWireFrom.x, drawingWireFrom.y);
      ctx.lineTo(mousePos.x, drawingWireFrom.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Draw component blocks
    if (layersVisibility.components) {
      components.forEach((comp) => {
        const isSelected = comp.id === selectedComponentId;
        
        if (isSelected) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
          ctx.fillRect(comp.x - 4, comp.y - 4, comp.width + 8, comp.height + 8);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(comp.x - 4, comp.y - 4, comp.width + 8, comp.height + 8);
        }

        // Draw the premium CAD board body
        ctx.save();
        ctx.fillStyle = '#0f172a'; // Deep slate solder mask
        ctx.strokeStyle = comp.groupId ? '#3b82f6' : '#1e293b'; 
        ctx.lineWidth = comp.groupId ? 2.5 : 2;
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.width, comp.height, 4);
        ctx.fill();
        ctx.stroke();

        // Draw a beautiful white silkscreen margin inside the board
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(comp.x + 3, comp.y + 3, comp.width - 6, comp.height - 6, 2);
        ctx.stroke();

        // Draw microchip CAD graphics for MCUs / Custom chips
        let compShapes = comp.customShapes;
        if (typeof compShapes === 'string') {
          try { compShapes = JSON.parse(compShapes); } catch(e) { compShapes = []; }
        }
        if (Array.isArray(compShapes) && compShapes.length > 0) {
          compShapes.forEach(shape => {
            ctx.save();
            ctx.fillStyle = shape.fill || 'transparent';
            ctx.strokeStyle = shape.stroke || 'transparent';
            ctx.lineWidth = shape.strokeWidth || 1;
            
            if (shape.type === 'rect') {
              ctx.beginPath();
              ctx.rect(comp.x + (shape.x || 0), comp.y + (shape.y || 0), shape.w || 0, shape.h || 0);
              if (shape.fill && shape.fill !== 'transparent') ctx.fill();
              if (shape.stroke && shape.stroke !== 'transparent') ctx.stroke();
            } else if (shape.type === 'circle') {
              ctx.beginPath();
              ctx.arc(comp.x + (shape.cx || 0), comp.y + (shape.cy || 0), shape.r || 0, 0, 2 * Math.PI);
              if (shape.fill && shape.fill !== 'transparent') ctx.fill();
              if (shape.stroke && shape.stroke !== 'transparent') ctx.stroke();
            } else if (shape.type === 'line') {
              ctx.beginPath();
              ctx.moveTo(comp.x + (shape.x1 || 0), comp.y + (shape.y1 || 0));
              ctx.lineTo(comp.x + (shape.x2 || 0), comp.y + (shape.y2 || 0));
              ctx.stroke();
            } else if (shape.type === 'text') {
              ctx.fillStyle = shape.fill || '#ffffff';
              ctx.font = shape.font || '9px sans-serif';
              ctx.textAlign = shape.align || 'center';
              ctx.textBaseline = shape.baseline || 'middle';
              ctx.fillText(shape.text || '', comp.x + (shape.x || 0), comp.y + (shape.y || 0));
            }
            ctx.restore();
          });
        } else if (comp.type === 'mcu' || comp.pins?.length > 4) {
          // Top antenna area
          ctx.fillStyle = '#020617'; // Darker antenna area
          ctx.fillRect(comp.x + 4, comp.y + 4, comp.width - 8, Math.round(comp.height * 0.12));
          
          // Antenna copper trace pattern (serpentine line)
          ctx.strokeStyle = '#d97706'; // Amber/copper color
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          const antY = comp.y + Math.round(comp.height * 0.06);
          ctx.moveTo(comp.x + 10, antY);
          ctx.lineTo(comp.x + comp.width - 10, antY);
          ctx.moveTo(comp.x + 15, antY - 2);
          ctx.lineTo(comp.x + 15, antY + 2);
          ctx.moveTo(comp.x + comp.width - 15, antY - 2);
          ctx.lineTo(comp.x + comp.width - 15, antY + 2);
          ctx.stroke();

          // Silver metallic chip shield in the center
          const shieldW = Math.round(comp.width * 0.7);
          const shieldH = Math.round(comp.height * 0.35);
          const shieldX = comp.x + Math.round((comp.width - shieldW) / 2);
          const shieldY = comp.y + Math.round(comp.height * 0.22);
          
          ctx.fillStyle = '#1e293b'; // Shield metal fill
          ctx.strokeStyle = '#475569'; // Shield outline
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(shieldX, shieldY, shieldW, shieldH, 3);
          ctx.fill();
          ctx.stroke();

          // Chip label/logo
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText("ESPRESSIF", shieldX + shieldW / 2, shieldY + 12);
          ctx.font = '7px sans-serif';
          ctx.fillText("ESP32-CORE", shieldX + shieldW / 2, shieldY + 24);
        } else {
          // For passive components, draw standard symbol inside
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          drawComponentSymbol(ctx, comp);
        }
        ctx.restore();

        if (comp.groupId) {
          ctx.fillStyle = '#3b82f6';
          ctx.font = '7px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`[G: ${comp.groupId.toUpperCase()}]`, comp.x + comp.width - 5, comp.y + 12);
        }

        if (!comp.image) {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          drawComponentSymbol(ctx, comp);
        }

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(comp.name, comp.x + comp.width / 2, comp.y - 6);

        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(comp.value, comp.x + comp.width / 2, comp.y + comp.height + 12);

        const isCadBoard = comp.type === 'mcu' || comp.pins?.length > 4;
        
        let compPins = comp.pins;
        if (typeof compPins === 'string') {
          try { compPins = JSON.parse(compPins); } catch (e) { compPins = []; }
        }
        if (Array.isArray(compPins)) {
          compPins.forEach((pin) => {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;

          const isLeft = pin.dir === 'left';
          const isRight = pin.dir === 'right';
          const isUp = pin.dir === 'up';
          const isDown = pin.dir === 'down';

          let hasPhysicalDot = false;
          let dotX = px;
          let dotY = py;
          if (isCadBoard) {
            const startPctVal = (comp.rawStartMargin !== undefined ? comp.rawStartMargin : 12) / 100;
            const endPctVal = (comp.rawEndMargin !== undefined ? comp.rawEndMargin : 88) / 100;
            const relY = pin.y;
            const relX = pin.x;
            
            if (isLeft || isRight) {
              const minY = comp.height * startPctVal - 10;
              const maxY = comp.height * endPctVal + 10;
              if (relY >= minY && relY <= maxY) {
                hasPhysicalDot = true;
                const horizPct = 0.04;
                dotX = comp.x + comp.width * (isLeft ? horizPct : (1 - horizPct));
              }
            } else if (isUp || isDown) {
              const minX = comp.width * startPctVal - 10;
              const maxX = comp.width * endPctVal + 10;
              if (relX >= minX && relX <= maxX) {
                hasPhysicalDot = true;
                const vertPct = 0.04;
                dotY = comp.y + comp.height * (isUp ? vertPct : (1 - vertPct));
              }
            }
          }

          let tx = px;
          let ty = py;
          const pinLen = isCadBoard ? 28 : 8;
          if (isLeft) tx -= pinLen;
          else if (isRight) tx += pinLen;
          else if (isUp) ty -= pinLen;
          else if (isDown) ty += pinLen;

          // Draw trace line connecting dot inside photo to outer circle
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(hasPhysicalDot ? dotX : px, hasPhysicalDot ? dotY : py);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          // Draw physical header via ring on CAD board
          if (isCadBoard && hasPhysicalDot) {
            ctx.save();
            ctx.fillStyle = '#fbbf24'; // Shiny gold via ring
            ctx.strokeStyle = '#020617';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2.8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            
            // Draw dark center hole of via
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(dotX, dotY, 1.2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
          }

          // Draw hover highlight in pill form
          const isHovered = hoveredPin && hoveredPin.compId === comp.id && hoveredPin.pinName === pin.name;
          if (isHovered) {
            ctx.save();
            ctx.fillStyle = 'rgba(79, 70, 229, 0.14)';
            ctx.strokeStyle = 'rgba(79, 70, 229, 0.5)';
            ctx.lineWidth = 1.2;
            
            let pillX, pillY, pillW, pillH;
            if (isCadBoard) {
              if (isLeft) {
                pillX = tx - 4;
                pillY = py - 7;
                pillW = (comp.x - tx) + 2;
                pillH = 14;
              } else if (isRight) {
                pillX = comp.x + comp.width + 2;
                pillY = py - 7;
                pillW = (tx - (comp.x + comp.width)) + 2;
                pillH = 14;
              } else {
                pillX = tx - 8;
                pillY = ty - 8;
                pillW = 16;
                pillH = 16;
              }
            } else {
              if (isLeft) {
                pillX = tx - 4;
                pillY = py - 7;
                pillW = (px - tx) + 26;
                pillH = 14;
              } else if (isRight) {
                pillX = px - 6;
                pillY = py - 7;
                pillW = (tx - px) + 10;
                pillH = 14;
              } else {
                pillX = tx - 8;
                pillY = ty - 8;
                pillW = 16;
                pillH = 16;
              }
            }
            
            ctx.roundRect(pillX, pillY, pillW, pillH, 6);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(tx, ty, 3, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.textAlign = pin.dir === 'left' ? 'left' : (pin.dir === 'right' ? 'right' : 'center');
          
          let labelX = px;
          let labelY = py + 3;
          if (isCadBoard) {
            if (isLeft) labelX = tx + 7;
            else if (isRight) labelX = tx - 7;
            else if (isUp) labelY = ty + 12;
            else if (isDown) labelY = ty - 12;
          } else {
            const textMargin = 5;
            if (pin.dir === 'left') labelX += textMargin;
            else if (pin.dir === 'right') labelX -= textMargin;
            else if (pin.dir === 'up') labelY += textMargin + 4;
            else if (pin.dir === 'down') labelY -= textMargin;
          }

          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.8;
          ctx.lineJoin = 'round';
          ctx.strokeText(pin.name, labelX, labelY);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(pin.name, labelX, labelY);
          ctx.restore();
        });
      }
    });
    }

    // 6. Draw custom labels / texts
    if (layersVisibility.text) {
      ctx.fillStyle = '#334155';
      ctx.font = 'italic 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      customTexts.forEach(t => {
        ctx.fillText(t.text, t.x, t.y);
      });
    }

    // 7. Draw measurements ruler
    if (layersVisibility.measurements) {
      if (rulerStart) {
        const targetEnd = rulerEnd || mousePos;
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        
        ctx.beginPath();
        ctx.moveTo(rulerStart.x, rulerStart.y);
        ctx.lineTo(targetEnd.x, targetEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(rulerStart.x, rulerStart.y, 4, 0, 2 * Math.PI);
        ctx.arc(targetEnd.x, targetEnd.y, 4, 0, 2 * Math.PI);
        ctx.fill();

        const distancePx = Math.round(Math.hypot(targetEnd.x - rulerStart.x, targetEnd.y - rulerStart.y));
        const distanceMm = (distancePx * 0.25).toFixed(1); 
        
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillStyle = '#db2777';
        ctx.fillText(`📏 ${distancePx}px (${distanceMm}mm)`, (rulerStart.x + targetEnd.x) / 2 + 8, (rulerStart.y + targetEnd.y) / 2 - 8);
      }
    }

    ctx.restore();
  }, [components, traces, customTexts, customShapes, pan, zoom, selectedComponentId, selectedTraceId, drawingWireFrom, drawingShapeStart, rulerStart, rulerEnd, mousePos, dimensions, gridSize, layersVisibility, wireColor, hoveredPin]);

  const drawComponentSymbol = (ctx, comp) => {
    const cx = comp.x + comp.width / 2;
    const cy = comp.y + comp.height / 2;

    switch (comp.type) {
      case 'resistor':
        ctx.beginPath();
        ctx.moveTo(comp.x + 10, cy);
        ctx.lineTo(comp.x + 18, cy);
        ctx.lineTo(comp.x + 22, cy - 8);
        ctx.lineTo(comp.x + 28, cy + 8);
        ctx.lineTo(comp.x + 34, cy - 8);
        ctx.lineTo(comp.x + 40, cy + 8);
        ctx.lineTo(comp.x + 44, cy);
        ctx.lineTo(comp.x + 50, cy);
        ctx.stroke();
        break;

      case 'capacitor':
        ctx.beginPath();
        ctx.moveTo(cx - 8, comp.y + 10);
        ctx.lineTo(cx - 8, comp.y + comp.height - 10);
        ctx.moveTo(cx + 8, comp.y + 10);
        ctx.lineTo(cx + 8, comp.y + comp.height - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(comp.x + 15, cy);
        ctx.lineTo(cx - 8, cy);
        ctx.moveTo(cx + 8, cy);
        ctx.lineTo(comp.x + comp.width - 15, cy);
        ctx.stroke();
        break;

      case 'led':
        ctx.save();
        ctx.translate(cx - 8, cy);
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12, -10);
        ctx.lineTo(12, 10);
        ctx.stroke();
        ctx.strokeStyle = '#e11d48'; 
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -12); ctx.lineTo(-6, -18);
        ctx.moveTo(-2, -18); ctx.lineTo(-6, -18); ctx.lineTo(-6, -14);
        ctx.moveTo(6, -12); ctx.lineTo(0, -18);
        ctx.moveTo(4, -18); ctx.lineTo(0, -18); ctx.lineTo(0, -14);
        ctx.stroke();
        ctx.restore();
        break;

      case 'regulator':
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText("V-REG", cx, cy + 4);
        break;

      case 'mcu':
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx - 20, cy - 20, 40, 40);
        ctx.strokeRect(cx - 20, cy - 20, 40, 40);
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText("MCU", cx, cy - 2);
        ctx.font = '8px sans-serif';
        ctx.fillText("CORE", cx, cy + 8);
        break;

      default:
        break;
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const world = screenToWorld(e.clientX, e.clientY);
    let targetType = 'empty';
    let targetId = null;

    for (const comp of components) {
      if (world.x >= comp.x && world.x <= comp.x + comp.width && world.y >= comp.y && world.y <= comp.y + comp.height) {
        targetType = 'component';
        targetId = comp.id;
        break;
      }
    }

    if (targetType === 'empty') {
      for (const trace of traces) {
        if (!trace.path) continue;
        for (let i = 0; i < trace.path.length - 1; i++) {
          if (distToSegment(world, trace.path[i], trace.path[i+1]) <= 6) {
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

    if (activeTool === 'text') {
      const textVal = prompt('Enter custom label text annotations:');
      if (textVal) {
        setCustomTexts(prev => [...prev, {
          id: `text_${Date.now()}`,
          x: gridX,
          y: gridY,
          text: textVal
        }]);
      }
      return;
    }

    if (activeTool === 'shape') {
      setDrawingShapeStart({ x: gridX, y: gridY });
      setMousePos(world);
      return;
    }

    if (activeTool === 'ruler') {
      setRulerStart({ x: world.x, y: world.y });
      setRulerEnd(null);
      setMousePos(world);
      return;
    }

    if (activeTool === 'select') {
      // 1. Drag wire path nodules if selected
      if (selectedTraceId) {
        const trace = traces.find(t => t.id === selectedTraceId);
        if (trace && trace.path) {
          for (let i = 0; i < trace.path.length; i++) {
            const pt = trace.path[i];
            const dist = Math.hypot(world.x - pt.x, world.y - pt.y);
            if (dist <= 8) {
              setDraggingNodule({ traceId: trace.id, index: i });
              return;
            }
          }
        }
      }

      for (const comp of components) {
        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          else if (pin.dir === 'up') ty -= pinLen;
          else if (pin.dir === 'down') ty += pinLen;

          const dist = Math.hypot(world.x - tx, world.y - ty);
          if (dist <= 8) {
            setDrawingWireFrom({
              compId: comp.id,
              pinName: pin.name,
              x: tx,
              y: ty
            });
            setMousePos(world);
            return;
          }
        }
      }

      for (const comp of components) {
        if (world.x >= comp.x && world.x <= comp.x + comp.width && world.y >= comp.y && world.y <= comp.y + comp.height) {
          setDraggingCompId(comp.id);
          setDragOffset({ x: world.x - comp.x, y: world.y - comp.y });
          setSelectedComponentId(comp.id);
          setSelectedTraceId(null);
          return;
        }
      }

      for (const trace of traces) {
        if (!trace.path) continue;
        for (let i = 0; i < trace.path.length - 1; i++) {
          if (distToSegment(world, trace.path[i], trace.path[i+1]) <= 6) {
            setSelectedTraceId(trace.id);
            setSelectedComponentId(null);
            return;
          }
        }
      }

      setSelectedComponentId(null);
      setSelectedTraceId(null);
    }

    else if (activeTool === 'wire') {
      for (const comp of components) {
        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          const dist = Math.hypot(world.x - tx, world.y - ty);
          if (dist <= 12) {
            setDrawingWireFrom({
              compId: comp.id,
              pinName: pin.name,
              x: tx,
              y: ty
            });
            setMousePos(world);
            return;
          }
        }
      }
    }

    else if (activeTool === 'eraser') {
      for (const comp of components) {
        if (world.x >= comp.x && world.x <= comp.x + comp.width && world.y >= comp.y && world.y <= comp.y + comp.height) {
          setComponents(prev => prev.filter(c => c.id !== comp.id));
          setTraces(prev => prev.filter(t => !t.from.startsWith(`${comp.id}.`) && !t.to.startsWith(`${comp.id}.`)));
          return;
        }
      }

      for (const trace of traces) {
        if (!trace.path) continue;
        for (let i = 0; i < trace.path.length - 1; i++) {
          if (distToSegment(world, trace.path[i], trace.path[i+1]) <= 6) {
            setTraces(prev => prev.filter(t => t.id !== trace.id));
            return;
          }
        }
      }

      setCustomTexts(prev => prev.filter(t => Math.hypot(world.x - t.x, world.y - t.y) > 40));

      setCustomShapes(prev => prev.filter(s => {
        const left = Math.min(s.x1, s.x2);
        const right = Math.max(s.x1, s.x2);
        const top = Math.min(s.y1, s.y2);
        const bottom = Math.max(s.y1, s.y2);
        return !(world.x >= left && world.x <= right && world.y >= top && world.y <= bottom);
      }));
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

    if (draggingNodule && activeTool === 'select') {
      const snappedX = snapToGrid(world.x);
      const snappedY = snapToGrid(world.y);
      setTraces(prev => prev.map(t => {
        if (t.id === draggingNodule.traceId) {
          const nextPath = [...t.path];
          nextPath[draggingNodule.index] = { x: snappedX, y: snappedY };
          return { ...t, path: nextPath, isLocked: true };
        }
        return t;
      }));
      return;
    }

    if (draggingCompId && activeTool === 'select') {
      const targetComp = components.find(c => c.id === draggingCompId);
      if (targetComp) {
        const rawX = world.x - dragOffset.x;
        const rawY = world.y - dragOffset.y;
        const snappedX = snapToGrid(rawX);
        const snappedY = snapToGrid(rawY);

        const dx = snappedX - targetComp.x;
        const dy = snappedY - targetComp.y;

        if (dx !== 0 || dy !== 0) {
          setComponents(prev => prev.map(c => {
            if (c.id === draggingCompId) {
              return { ...c, x: snappedX, y: snappedY };
            }
            if (targetComp.groupId && c.groupId === targetComp.groupId) {
              return { ...c, x: c.x + dx, y: c.y + dy };
            }
            return c;
          }));
        }
      }
      return;
    }

    if (drawingWireFrom || drawingShapeStart || rulerStart) {
      setMousePos(world);
    }

    // Pin hovering detection
    let foundHovered = null;
    if (activeTool === 'select' && !isPanning && !draggingCompId && !draggingNodule) {
      for (const comp of components) {
        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          else if (pin.dir === 'up') ty -= pinLen;
          else if (pin.dir === 'down') ty += pinLen;

          const distCircle = Math.hypot(world.x - tx, world.y - ty);
          const distLabel = Math.hypot(world.x - px, world.y - py);
          if (distCircle <= 10 || distLabel <= 10) {
            foundHovered = {
              compId: comp.id,
              pinName: pin.name,
              compLabel: comp.label || comp.partNumber || comp.name,
              pin
            };
            break;
          }
        }
        if (foundHovered) break;
      }
    }

    if (foundHovered) {
      if (!hoveredPin || hoveredPin.compId !== foundHovered.compId || hoveredPin.pinName !== foundHovered.pinName) {
        setHoveredPin(foundHovered);
        setTooltipState(prev => ({ ...prev, visible: false }));
        if (tooltipTimerRef.current) {
          clearTimeout(tooltipTimerRef.current);
        }
        
        const canvasEl = canvasRef.current;
        if (canvasEl) {
          const rect = canvasEl.getBoundingClientRect();
          const tooltipX = e.clientX - rect.left + 15;
          const tooltipY = e.clientY - rect.top + 15;
          const conns = getConnectedPins(foundHovered.compId, foundHovered.pinName, traces, components);
          
          tooltipTimerRef.current = setTimeout(() => {
            setTooltipState({
              visible: true,
              x: tooltipX,
              y: tooltipY,
              compLabel: foundHovered.compLabel,
              pinName: foundHovered.pinName,
              connections: conns
            });
          }, 450);
        }
      }
    } else {
      if (hoveredPin) {
        setHoveredPin(null);
        setTooltipState(prev => ({ ...prev, visible: false }));
        if (tooltipTimerRef.current) {
          clearTimeout(tooltipTimerRef.current);
          tooltipTimerRef.current = null;
        }
      }
    }
  };

  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggingNodule) {
      const world = screenToWorld(e.clientX, e.clientY);
      let targetPin = null;

      for (const comp of components) {
        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          else if (pin.dir === 'up') ty -= pinLen;
          else if (pin.dir === 'down') ty += pinLen;

          const dist = Math.hypot(world.x - tx, world.y - ty);
          if (dist <= 12) {
            targetPin = `${comp.id}.${pin.name}`;
            break;
          }
        }
        if (targetPin) break;
      }

      if (targetPin) {
        setTraces(prev => prev.map(t => {
          if (t.id === draggingNodule.traceId) {
            const isStart = draggingNodule.index === 0;
            const isEnd = draggingNodule.index === t.path.length - 1;
            if (isStart) {
              return { ...t, from: targetPin, isLocked: true };
            } else if (isEnd) {
              return { ...t, to: targetPin, isLocked: true };
            }
          }
          return t;
        }));
      }
      setDraggingNodule(null);
      return;
    }

    if (draggingCompId) {
      setDraggingCompId(null);
      return;
    }

    if (drawingShapeStart) {
      const world = screenToWorld(e.clientX, e.clientY);
      const gx = snapToGrid(world.x);
      const gy = snapToGrid(world.y);
      if (gx !== drawingShapeStart.x || gy !== drawingShapeStart.y) {
        setCustomShapes(prev => [...prev, {
          id: `shape_${Date.now()}`,
          x1: drawingShapeStart.x,
          y1: drawingShapeStart.y,
          x2: gx,
          y2: gy,
          color: '#3b82f6'
        }]);
      }
      setDrawingShapeStart(null);
    }

    if (rulerStart) {
      const world = screenToWorld(e.clientX, e.clientY);
      setRulerEnd({ x: world.x, y: world.y });
    }

    if (drawingWireFrom) {
      const world = screenToWorld(e.clientX, e.clientY);
      let targetPinFound = false;

      for (const comp of components) {
        if (comp.id === drawingWireFrom.compId) continue;

        for (const pin of comp.pins) {
          const px = comp.x + pin.x;
          const py = comp.y + pin.y;
          let tx = px;
          let ty = py;
          const pinLen = 8;
          if (pin.dir === 'left') tx -= pinLen;
          else if (pin.dir === 'right') tx += pinLen;
          else if (pin.dir === 'up') ty -= pinLen;
          else if (pin.dir === 'down') ty += pinLen;

          const dist = Math.hypot(world.x - tx, world.y - ty);
          if (dist <= 12) {
            const fromStr = `${drawingWireFrom.compId}.${drawingWireFrom.pinName}`;
            const toStr = `${comp.id}.${pin.name}`;

            const exists = traces.some(t => 
              (t.from === fromStr && t.to === toStr) || 
              (t.from === toStr && t.to === fromStr)
            );

            if (!exists) {
              const newTrace = {
                id: `trace_${Date.now()}`,
                from: fromStr,
                to: toStr,
                isLocked: false,
                color: wireColor, // save color choice!
                path: []
              };
              setTraces(prev => [...prev, newTrace]);
            }
            targetPinFound = true;
            break;
          }
        }
        if (targetPinFound) break;
      }
      setDrawingWireFrom(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      setDrawingWireFrom(null);
      setDrawingShapeStart(null);
      setRulerStart(null);
      setRulerEnd(null);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const distToSegment = (p, v, w) => {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  const handleToggleGroup = (compId, groupId) => {
    setComponents(prev => prev.map(c => 
      c.id === compId ? { ...c, groupId: c.groupId === groupId ? null : groupId } : c
    ));
    setContextMenu(null);
  };

  const handleRotateComponent = (compId) => {
    const target = components.find(c => c.id === compId);
    if (!target) return;
    const newWidth = target.height;
    const newHeight = target.width;

    const rotatedPins = target.pins.map(pin => {
      const oldCx = target.width / 2;
      const oldCy = target.height / 2;
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

      return { ...pin, x: Math.round(nx), y: Math.round(ny), dir: ndir };
    });

    setComponents(prev => prev.map(c => 
      c.id === compId ? { ...c, width: newWidth, height: newHeight, pins: rotatedPins } : c
    ));
    setContextMenu(null);
  };

  const handleDistributePins = (compId) => {
    setComponents(prev => prev.map(c => {
      if (c.id === compId) {
        if (!c.pins || c.pins.length === 0) return c;
        const pins = [...c.pins];
        const pinsPerSide = Math.ceil(pins.length / 2);
        const pinPitch = 15;
        const width = 120;
        const height = Math.max(90, pinsPerSide * pinPitch + 30);
        
        const distributed = pins.map((p, i) => {
          const isLeft = i < pinsPerSide;
          const sideIndex = isLeft ? i : (i - pinsPerSide);
          return {
            ...p,
            x: isLeft ? 0 : width,
            y: sideIndex * pinPitch + 15,
            dir: isLeft ? 'left' : 'right'
          };
        });
        
        return {
          ...c,
          width,
          height,
          pins: distributed
        };
      }
      return c;
    }));
    setContextMenu(null);
  };

  const updateSidesMap = (pinName, newSide) => {
    setSkinPicker(prev => {
      if (!prev) return prev;
      const nextSides = { ...prev.sidesMap, [pinName]: newSide };
      const nextLeft = Object.values(nextSides).filter(s => s === 'left').length;
      const nextRight = Object.values(nextSides).filter(s => s === 'right').length;
      const nextTop = Object.values(nextSides).filter(s => s === 'top').length;
      const nextBottom = Object.values(nextSides).filter(s => s === 'bottom').length;
      
      const nextMinW = Math.max(60, Math.max(nextTop, nextBottom) * prev.pitch + 30);
      const nextMinH = Math.max(60, Math.max(nextLeft, nextRight) * prev.pitch + 30);
      
      return {
        ...prev,
        sidesMap: nextSides,
        width: Math.max(prev.width, nextMinW),
        height: Math.max(prev.height, nextMinH)
      };
    });
  };

  const updatePitch = (newPitch) => {
    setSkinPicker(prev => {
      if (!prev) return prev;
      const leftC = Object.values(prev.sidesMap).filter(s => s === 'left').length;
      const rightC = Object.values(prev.sidesMap).filter(s => s === 'right').length;
      const topC = Object.values(prev.sidesMap).filter(s => s === 'top').length;
      const bottomC = Object.values(prev.sidesMap).filter(s => s === 'bottom').length;
      
      const nextMinW = Math.max(60, Math.max(topC, bottomC) * newPitch + 30);
      const nextMinH = Math.max(60, Math.max(leftC, rightC) * newPitch + 30);
      
      return {
        ...prev,
        pitch: newPitch,
        width: Math.max(prev.width, nextMinW),
        height: Math.max(prev.height, nextMinH)
      };
    });
  };



  const handleEditComponentSkin = (compId) => {
    const comp = components.find(c => c.id === compId);
    if (!comp) return;
    
    setContextMenu(null);
    setPinoutReference(comp.pinoutReference || '');
    setIsSmartPlacing(false);
    
    const sidesMap = {};
    const pitch = skinPicker?.pitch || 15;
    const pinOffsets = {};
    (comp.pins || []).forEach(p => {
      sidesMap[p.name] = p.dir === 'up' ? 'top' : (p.dir === 'down' ? 'bottom' : (p.dir === 'right' ? 'right' : 'left'));
      if (p.dir === 'up' || p.dir === 'down') {
        pinOffsets[p.name] = p.x;
      } else {
        pinOffsets[p.name] = p.y;
      }
    });
    
    setSkinPicker({
      compId,
      partNumber: comp.label || comp.partNumber || comp.name,
      searchQuery: comp.label && !comp.label.match(/^C\d+$/i) ? comp.label : (comp.partNumber || comp.name),
      images: comp.rawImage ? [comp.rawImage] : (comp.image ? [comp.image] : []),
      selectedUrl: comp.rawImage || comp.image || '',
      customUrl: '',
      tolerance: comp.rawTolerance !== undefined ? comp.rawTolerance : (comp.imageTolerance !== undefined ? comp.imageTolerance : 20),
      doCrop: comp.imageCrop !== undefined ? comp.imageCrop : true,
      width: comp.width || 120,
      height: comp.height || 300,
      pitch,
      sidesMap,
      rawPins: comp.pins || [],
      rotation: comp.imageRotation || 0,
      flipH: comp.imageFlipH || false,
      flipV: comp.imageFlipV || false,
      opacity: comp.imageOpacity !== undefined ? comp.imageOpacity : 0.3,
      aspect: comp.imageAspect || 'stretch',
      pinOffsets,
      loading: false,
      lastLoadedUrl: comp.rawImage || comp.image || '',
      deskewAngle: comp.rawDeskewAngle !== undefined ? comp.rawDeskewAngle : (comp.imageDeskew || 0),
      subCropX: comp.rawSubCropX !== undefined ? comp.rawSubCropX : (comp.imageSubCropX || 0),
      subCropY: comp.rawSubCropY !== undefined ? comp.rawSubCropY : (comp.imageSubCropY || 0),
      subCropW: comp.rawSubCropW !== undefined ? comp.rawSubCropW : (comp.imageSubCropW || 100),
      subCropH: comp.rawSubCropH !== undefined ? comp.rawSubCropH : (comp.imageSubCropH || 100),
      startMargin: comp.rawStartMargin !== undefined ? comp.rawStartMargin : 12,
      endMargin: comp.rawEndMargin !== undefined ? comp.rawEndMargin : 88,
      lastStartMargin: comp.rawStartMargin !== undefined ? comp.rawStartMargin : 12,
      lastEndMargin: comp.rawEndMargin !== undefined ? comp.rawEndMargin : 88
    });
  };

  const applyHeuristicPlacement = () => {
    if (!skinPicker || !pinoutReference) return;
    
    const lines = pinoutReference.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean);
    const pinNames = skinPicker.rawPins.map(p => p.name);
    
    const nextSides = { ...skinPicker.sidesMap };
    const nextOffsets = { ...skinPicker.pinOffsets };
    
    // Track pin positions in reference text to see ordering
    const pinIndicesInText = [];
    pinNames.forEach(pinName => {
      const pinNameLower = pinName.toLowerCase();
      // Try to find the line containing this pin name
      let foundLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match boundary word to avoid matching substrings (e.g. TX matching TX1)
        const regex = new RegExp('\\b' + pinNameLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
        if (regex.test(line)) {
          foundLineIndex = i;
          
          // Heuristic 1: Explicit side keywords in this line
          if (line.includes('left') || line.includes('l:')) {
            nextSides[pinName] = 'left';
          } else if (line.includes('right') || line.includes('r:')) {
            nextSides[pinName] = 'right';
          } else if (line.includes('top') || line.includes('t:')) {
            nextSides[pinName] = 'top';
          } else if (line.includes('bottom') || line.includes('b:')) {
            nextSides[pinName] = 'bottom';
          }
          break;
        }
      }
      
      if (foundLineIndex !== -1) {
        pinIndicesInText.push({ pinName, lineIndex: foundLineIndex });
      }
    });

    // Heuristic 2: Electrical role conventions (defaults) for pins that haven't been explicitly placed by side keywords
    pinNames.forEach(pinName => {
      const pinLower = pinName.toLowerCase();
      const hasExplicitSide = pinIndicesInText.some(x => x.pinName === pinName && 
        (lines[x.lineIndex].includes('left') || lines[x.lineIndex].includes('right') || 
         lines[x.lineIndex].includes('top') || lines[x.lineIndex].includes('bottom')));
         
      if (!hasExplicitSide) {
        if (pinLower.includes('gnd') || pinLower.includes('vss') || pinLower.includes('gnd')) {
          nextSides[pinName] = 'bottom';
        } else if (pinLower.includes('3v3') || pinLower.includes('5v') || pinLower.includes('vcc') || pinLower.includes('vdd') || pinLower.includes('vin') || pinLower.includes('power')) {
          nextSides[pinName] = 'top';
        }
      }
    });

    // Heuristic 3: Sequential / symmetry placement
    // Sort pins found in text by their order of appearance
    pinIndicesInText.sort((a, b) => a.lineIndex - b.lineIndex);
    
    // Distribute pins that don't have explicit power or side assignments based on sequence
    const unassignedPins = pinNames.filter(name => {
      const isPower = name.toLowerCase().match(/(gnd|vss|3v3|5v|vcc|vdd|vin)/i);
      const hasExplicit = pinIndicesInText.some(x => x.pinName === name && 
        (lines[x.lineIndex].includes('left') || lines[x.lineIndex].includes('right') || 
         lines[x.lineIndex].includes('top') || lines[x.lineIndex].includes('bottom')));
      return !isPower && !hasExplicit;
    });

    // Place the sequential unassigned pins: half left, half right
    unassignedPins.forEach((pinName, idx) => {
      if (idx < unassignedPins.length / 2) {
        nextSides[pinName] = 'left';
      } else {
        nextSides[pinName] = 'right';
      }
    });

    // Recalculate offsets on each side to be evenly spaced by the pitch
    const sides = ['left', 'right', 'top', 'bottom'];
    sides.forEach(side => {
      const sidePins = pinNames.filter(p => nextSides[p] === side);
      // Sort them by original pin index
      sidePins.sort((a, b) => {
        const idxA = pinNames.indexOf(a);
        const idxB = pinNames.indexOf(b);
        return idxA - idxB;
      });
      sidePins.forEach((p, index) => {
        nextOffsets[p] = index * skinPicker.pitch + 15;
      });
    });

    // Update state
    setSkinPicker(prev => {
      if (!prev) return prev;
      
      const nextLeft = Object.values(nextSides).filter(s => s === 'left').length;
      const nextRight = Object.values(nextSides).filter(s => s === 'right').length;
      const nextTop = Object.values(nextSides).filter(s => s === 'top').length;
      const nextBottom = Object.values(nextSides).filter(s => s === 'bottom').length;
      
      const nextMinW = Math.max(60, Math.max(nextTop, nextBottom) * prev.pitch + 30);
      const nextMinH = Math.max(60, Math.max(nextLeft, nextRight) * prev.pitch + 30);
      
      return {
        ...prev,
        sidesMap: nextSides,
        pinOffsets: nextOffsets,
        width: Math.max(prev.width, nextMinW),
        height: Math.max(prev.height, nextMinH)
      };
    });
  };

  const applyAiPlacement = async () => {
    if (!skinPicker || !pinoutReference) return;
    
    setIsSmartPlacing(true);
    
    try {
      const pinNames = skinPicker.rawPins.map(p => p.name);
      
      const promptText = `Pasted Datasheet / Pinout Reference:
${pinoutReference}

List of Pin Names to map:
${JSON.stringify(pinNames)}

CAD Dimensions: width ${skinPicker.width}px, height ${skinPicker.height}px, default pitch ${skinPicker.pitch}px.

Your task is to assign each pin to one of the physical sides ('left', 'right', 'top', 'bottom') and assign a clean numeric offset value in pixels (spaced by the pitch e.g., 15, 30, 45...).
Format output strictly as a JSON object:
{
  "mappings": {
    "PIN_NAME": { "side": "left" | "right" | "top" | "bottom", "offset": number }
  }
}`;

      const result = await sendToRouter({
        prompt: promptText,
        modelName: 'google/gemini-2.5-flash',
        boardState: {}
      });

      const mappings = result?.mappings;
      if (mappings && typeof mappings === 'object') {
        const nextSides = { ...skinPicker.sidesMap };
        const nextOffsets = { ...skinPicker.pinOffsets };
        
        Object.keys(mappings).forEach(pinName => {
          const mapping = mappings[pinName];
          if (mapping && typeof mapping === 'object' && pinNames.includes(pinName)) {
            if (['left', 'right', 'top', 'bottom'].includes(mapping.side)) {
              nextSides[pinName] = mapping.side;
            }
            if (typeof mapping.offset === 'number' && mapping.offset >= 0) {
              nextOffsets[pinName] = mapping.offset;
            }
          }
        });

        setSkinPicker(prev => {
          if (!prev) return prev;
          
          const nextLeft = Object.values(nextSides).filter(s => s === 'left').length;
          const nextRight = Object.values(nextSides).filter(s => s === 'right').length;
          const nextTop = Object.values(nextSides).filter(s => s === 'top').length;
          const nextBottom = Object.values(nextSides).filter(s => s === 'bottom').length;
          
          const nextMinW = Math.max(60, Math.max(nextTop, nextBottom) * prev.pitch + 30);
          const nextMinH = Math.max(60, Math.max(nextLeft, nextRight) * prev.pitch + 30);
          
          return {
            ...prev,
            sidesMap: nextSides,
            pinOffsets: nextOffsets,
            width: Math.max(prev.width, nextMinW),
            height: Math.max(prev.height, nextMinH)
          };
        });
      } else {
        alert("AI did not return a valid mappings object. Please check pasted text or try heuristic auto-map.");
      }
    } catch (e) {
      console.error("[AI pinout map error]:", e);
      alert(`AI Map failed: ${e.message}. Attempting offline heuristic matcher.`);
      applyHeuristicPlacement();
    } finally {
      setIsSmartPlacing(false);
    }
  };



  const handleToggleTraceLockById = (traceId) => {
    setTraces(prev => prev.map(t => 
      t.id === traceId ? { ...t, isLocked: !t.isLocked } : t
    ));
    setContextMenu(null);
  };

  const handleAddQuickPassive = (type, coord) => {
    const gx = snapToGrid(coord.x);
    const gy = snapToGrid(coord.y);
    
    let num = 1;
    let newComp = {};
    if (type === 'resistor') {
      while (components.some(c => c.id === `R${num}`)) num++;
      newComp = {
        id: `R${num}`,
        name: `R${num}`,
        type: 'resistor',
        label: 'R_QUICK',
        value: '10kΩ',
        x: gx,
        y: gy,
        width: 60,
        height: 30,
        pins: [
          { name: '1', x: 0, y: 15, dir: 'left' },
          { name: '2', x: 60, y: 15, dir: 'right' }
        ],
        groupId: null
      };
    } else if (type === 'capacitor') {
      while (components.some(c => c.id === `C${num}`)) num++;
      newComp = {
        id: `C${num}`,
        name: `C${num}`,
        type: 'capacitor',
        label: 'C_QUICK',
        value: '100nF',
        x: gx,
        y: gy,
        width: 30,
        height: 45,
        pins: [
          { name: '1', x: 15, y: 0, dir: 'up' },
          { name: '2', x: 15, y: 45, dir: 'down' }
        ],
        groupId: null
      };
    } else if (type === 'led') {
      while (components.some(c => c.id === `D${num}`)) num++;
      newComp = {
        id: `D${num}`,
        name: `D${num}`,
        type: 'led',
        label: 'LED_QUICK',
        value: 'GaAs Red',
        x: gx,
        y: gy,
        width: 45,
        height: 60,
        pins: [
          { name: 'A', x: 0, y: 30, dir: 'left' },
          { name: 'K', x: 45, y: 30, dir: 'right' }
        ],
        groupId: null
      };
    }

    setComponents(prev => [...prev, newComp]);
    setContextMenu(null);
  };

  const dpr = window.devicePixelRatio || 1;

  const getCursorClass = () => {
    if (spacePressed || activeTool === 'pan') {
      return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    }
    if (activeTool === 'eraser') return 'cursor-cell';
    if (activeTool === 'text') return 'cursor-text';
    if (activeTool === 'ruler') return 'cursor-help';
    return 'cursor-default';
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full flex overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* VIRTUAL DRAWING TOOLBAR WITH macOS SLIDE-OUT PANEL */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-15 flex items-stretch">
        
        {/* Core Vertical Tool Strip */}
        <div className="flex flex-col bg-white/95 backdrop-blur border border-slate-200/80 p-1.5 rounded-xl shadow-md space-y-1.5 z-20">
          <button
            onClick={() => { setActiveTool('select'); setDrawingWireFrom(null); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'select' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Pointer / Select Tool (V)"
          >
            <Navigation size={15} className="rotate-[270deg]" />
          </button>

          <button
            onClick={() => { setActiveTool('pan'); setDrawingWireFrom(null); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'pan' || spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Pan Canvas Tool (H / Spacebar Drag)"
          >
            <Move size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('wire'); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'wire' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Route Wire Net Pencil (W)"
          >
            <Edit3 size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('text'); setDrawingWireFrom(null); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'text' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Place Text Annotation Label (T)"
          >
            <Type size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('shape'); setDrawingWireFrom(null); setRulerStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'shape' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Outline Boundary Shape Box (S)"
          >
            <Square size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('ruler'); setDrawingWireFrom(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'ruler' && !spacePressed ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Measure Distance Ruler Tool (M)"
          >
            <Ruler size={15} />
          </button>

          <button
            onClick={() => { setActiveTool('eraser'); setDrawingWireFrom(null); setRulerStart(null); setDrawingShapeStart(null); }}
            className={`p-2 rounded-lg transition-all ${activeTool === 'eraser' && !spacePressed ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Erase (E)"
          >
            <Trash2 size={15} />
          </button>

          <span className="h-px bg-slate-200 w-full font-sans"></span>

          <button
            onClick={() => { setPan({ x: 100, y: 80 }); setZoom(1); }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Recenter Camera Target"
          >
            <HelpCircle size={15} />
          </button>
        </div>

        {/* macOS Style Slide-out suboptions panel */}
        {activeTool && activeTool !== 'select' && activeTool !== 'pan' && (
          <div className="ml-2 bg-white/95 backdrop-blur border border-slate-200/80 rounded-xl shadow-md p-3 text-[11px] text-slate-700 flex flex-col justify-center transition-all duration-300 transform translate-x-0 w-44 z-10 select-none animate-in fade-in slide-in-from-left-4">
            {activeTool === 'wire' && (
              <div className="space-y-2 font-sans">
                <div className="font-bold border-b border-slate-100 pb-1 text-slate-800">Wire Settings</div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block mb-1">Trace Color:</span>
                  <div className="flex space-x-1.5">
                    <button onClick={() => setWireColor('#2563eb')} className={`w-4 h-4 rounded-full bg-blue-600 border ${wireColor === '#2563eb' ? 'border-slate-800 scale-110' : 'border-slate-300'}`} title="Signal Net (Blue)" />
                    <button onClick={() => setWireColor('#dc2626')} className={`w-4 h-4 rounded-full bg-red-600 border ${wireColor === '#dc2626' ? 'border-slate-800 scale-110' : 'border-slate-300'}`} title="5V VCC (Red)" />
                    <button onClick={() => setWireColor('#16a34a')} className={`w-4 h-4 rounded-full bg-green-600 border ${wireColor === '#16a34a' ? 'border-slate-800 scale-110' : 'border-slate-300'}`} title="GPIO (Green)" />
                    <button onClick={() => setWireColor('#d97706')} className={`w-4 h-4 rounded-full bg-amber-600 border ${wireColor === '#d97706' ? 'border-slate-800 scale-110' : 'border-slate-300'}`} title="Locked Solder (Gold)" />
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block mb-1">A* Penalty:</span>
                  <select 
                    value={autoPenaltyMode} 
                    onChange={(e) => setAutoPenaltyMode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[9px] text-slate-600 outline-none"
                  >
                    <option value="high">High Cost Crossings</option>
                    <option value="low">Low Penalty Overlaps</option>
                  </select>
                </div>
              </div>
            )}
            
            {activeTool === 'text' && (
              <div className="space-y-1.5 font-sans">
                <div className="font-bold border-b border-slate-100 pb-1 text-slate-800">Label Tags</div>
                <p className="text-[10px] text-slate-400 leading-normal">Click directly on any parchment grid intersection to insert custom specs labels.</p>
              </div>
            )}

            {activeTool === 'shape' && (
              <div className="space-y-1.5 font-sans">
                <div className="font-bold border-b border-slate-100 pb-1 text-slate-800">Keepouts</div>
                <p className="text-[10px] text-slate-400 leading-normal">Drag boxes on the sheet to define physical groupings or boundaries.</p>
              </div>
            )}

            {activeTool === 'ruler' && (
              <div className="space-y-1.5 font-sans">
                <div className="font-bold border-b border-slate-100 pb-1 text-slate-800">Measure</div>
                <p className="text-[10px] text-slate-400 leading-normal">Drag a line between pads. Press <kbd className="bg-slate-100 px-1 py-0.2 rounded border">ESC</kbd> to clear current lines.</p>
              </div>
            )}

            {activeTool === 'eraser' && (
              <div className="space-y-1.5 font-sans text-rose-700">
                <div className="font-bold border-b border-rose-100 pb-1">Eraser Tool</div>
                <p className="text-[10px] text-slate-400 leading-normal">Click components, nets, shapes, or texts on sheet to delete.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }} 
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-xs text-slate-700 min-w-[150px] font-sans"
        >
          {contextMenu.type === 'component' && (
            <>
              <div className="px-3 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">Groupings</div>
              <button 
                onClick={() => handleToggleGroup(contextMenu.targetId, 'group_a')}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                Toggle Group A
              </button>
              <button 
                onClick={() => handleToggleGroup(contextMenu.targetId, 'group_b')}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                Toggle Group B
              </button>
              <span className="block h-px bg-slate-100 my-0.5"></span>
              <button 
                onClick={() => handleRotateComponent(contextMenu.targetId)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium"
              >
                <RotateCw size={12} className="mr-1.5 text-slate-400" /> Rotate 90°
              </button>
              <button 
                onClick={() => handleDistributePins(contextMenu.targetId)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium text-indigo-600"
              >
                <Layers size={12} className="mr-1.5 text-indigo-400" /> Split Pins (Left/Right)
              </button>
              <button 
                onClick={() => handleEditComponentSkin(contextMenu.targetId)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium text-indigo-600 border-b border-slate-100"
              >
                <Settings size={12} className="mr-1.5 text-indigo-400" /> Configure CAD & Pinout
              </button>
              <button 
                onClick={() => {
                  setComponents(prev => prev.filter(c => c.id !== contextMenu.targetId));
                  setTraces(prev => prev.filter(t => !t.from.startsWith(`${contextMenu.targetId}.`) && !t.to.startsWith(`${contextMenu.targetId}.`)));
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-rose-50 hover:text-rose-600 flex items-center transition font-medium"
              >
                <Trash2 size={12} className="mr-1.5 text-rose-400" /> Delete Part
              </button>
            </>
          )}

          {contextMenu.type === 'trace' && (
            <>
              <button 
                onClick={() => handleToggleTraceLockById(contextMenu.targetId)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition font-medium"
              >
                {traces.find(t => t.id === contextMenu.targetId)?.isLocked ? (
                  <>
                    <Unlock size={12} className="mr-1.5 text-amber-500" /> Free Route
                  </>
                ) : (
                  <>
                    <Lock size={12} className="mr-1.5 text-amber-500" /> Lock Trace
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  setTraces(prev => prev.filter(t => t.id !== contextMenu.targetId));
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-rose-50 hover:text-rose-600 flex items-center transition font-medium"
              >
                <Trash2 size={12} className="mr-1.5 text-rose-400" /> Delete Net
              </button>
            </>
          )}

          {contextMenu.type === 'empty' && (
            <>
              <div className="px-3 py-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">Quick Add</div>
              <button 
                onClick={() => handleAddQuickPassive('resistor', contextMenu.rawCoord)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                + Resistor
              </button>
              <button 
                onClick={() => handleAddQuickPassive('capacitor', contextMenu.rawCoord)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                + Capacitor
              </button>
              <button 
                onClick={() => handleAddQuickPassive('led', contextMenu.rawCoord)}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition"
              >
                + LED
              </button>
              <span className="block h-px bg-slate-100 my-0.5"></span>
              <button 
                onClick={() => { setPan({ x: 100, y: 80 }); setZoom(1); setContextMenu(null); }}
                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center transition text-slate-400"
              >
                Reset Camera
              </button>
            </>
          )}
        </div>
      )}
      {/* Photo Skin Picker Modal Overlay */}
      {skinPicker && (() => {
        const leftCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'left').length;
        const rightCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'right').length;
        const topCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'top').length;
        const bottomCount = Object.values(skinPicker.sidesMap || {}).filter(s => s === 'bottom').length;
        
        const minW = Math.max(60, Math.max(topCount, bottomCount) * skinPicker.pitch + 30);
        const minH = Math.max(60, Math.max(leftCount, rightCount) * skinPicker.pitch + 30);

        const nudgePinOffset = (pinName, amount) => {
          setSkinPicker(prev => {
            if (!prev) return prev;
            let val = prev.pinOffsets[pinName];
            if (val === undefined || val === null) {
              const pinIndex = prev.rawPins.findIndex(p => p.name === pinName);
              val = pinIndex * prev.pitch + 15;
            }
            return {
              ...prev,
              pinOffsets: {
                ...prev.pinOffsets,
                [pinName]: Math.max(0, val + amount)
              }
            };
          });
        };

        const finalPinsForPreview = distributePinsBySides(
          skinPicker.rawPins,
          skinPicker.sidesMap,
          skinPicker.pitch,
          skinPicker.width,
          skinPicker.height,
          skinPicker.pinOffsets
        );

        // SVG preview variables
        const compW = skinPicker.width;
        const compH = skinPicker.height;
        const scaleK = Math.min(170 / compW, 170 / compH);
        const bx = (240 - compW * scaleK) / 2;
        const by = (240 - compH * scaleK) / 2;
        const bw = compW * scaleK;
        const bh = compH * scaleK;
        
        return (
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center font-sans p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95%] animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Configure CAD Layout & Pinout</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Component ID: {skinPicker.compId}</p>
                </div>
                <button 
                  onClick={() => setSkinPicker(null)}
                  className="text-slate-400 hover:text-slate-600 transition text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                {/* Left Column: Dimensions & SVG Preview */}
                <div className="flex flex-col space-y-4">
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 space-y-3">
                    <h4 className="font-semibold text-xs text-slate-700">CAD Body Dimensions</h4>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Width (px)</label>
                        <input 
                          type="number"
                          value={skinPicker.width}
                          min={minW}
                          onChange={(e) => setSkinPicker(prev => ({ ...prev, width: Math.max(minW, Number(e.target.value)) }))}
                          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Height (px)</label>
                        <input 
                          type="number"
                          value={skinPicker.height}
                          min={minH}
                          onChange={(e) => setSkinPicker(prev => ({ ...prev, height: Math.max(minH, Number(e.target.value)) }))}
                          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Pitch (px)</label>
                        <input 
                          type="number"
                          value={skinPicker.pitch}
                          min={5}
                          max={50}
                          onChange={(e) => updatePitch(Number(e.target.value))}
                          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Smart Pin Placement Assistant Box */}
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                        <Settings size={14} className="text-indigo-500 animate-pulse" />
                        Smart Pin Placement Assistant
                      </h4>
                      {isSmartPlacing && (
                        <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Paste datasheet pin lists, schema text, or copy-paste pinouts below to automatically position layout directions and spacing.
                    </p>
                    
                    <textarea
                      placeholder="e.g. Pin 1: VCC (power, top)&#10;Pin 2: GND (bottom)&#10;Pin 3: GPIO4 (left)&#10;Pin 4: RXD0 (right)"
                      value={pinoutReference}
                      onChange={(e) => setPinoutReference(e.target.value)}
                      className="w-full text-[10px] p-2 border border-slate-200 rounded-lg bg-white font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-20 resize-none leading-normal"
                      disabled={isSmartPlacing}
                    />
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={applyHeuristicPlacement}
                        disabled={isSmartPlacing || !pinoutReference.trim()}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 rounded text-[10px] font-semibold transition flex items-center justify-center gap-1 shadow-sm"
                        title="Distributes pins sequentially based on keywords/ordering in the text"
                      >
                        ⚡ Heuristic Algo
                      </button>
                      <button
                        type="button"
                        onClick={applyAiPlacement}
                        disabled={isSmartPlacing || !pinoutReference.trim()}
                        className="px-2.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 rounded text-[10px] font-semibold transition flex items-center justify-center gap-1 shadow-sm"
                        title="Calls Google Gemini / OpenRouter to parse pin mapping using AI"
                      >
                        ✨ AI Auto-Map
                      </button>
                    </div>
                  </div>

                  {/* SVG Live Mockup Preview Box */}
                  <div className="flex-1 border border-slate-200/60 rounded-xl bg-slate-950 flex flex-col items-center justify-center p-4 relative min-h-[280px]">
                    <div className="absolute top-3 left-3 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      Live CAD Mockup Preview
                    </div>
                    
                    <svg width="240" height="240" viewBox="0 0 240 240" className="drop-shadow-lg">
                      {/* Component Body */}
                      <rect 
                        x={bx} 
                        y={by} 
                        width={bw} 
                        height={bh} 
                        rx={4} 
                        fill="#0f172a" 
                        stroke="#334155" 
                        strokeWidth={1.5} 
                      />
                      {/* Silkscreen margin */}
                      <rect 
                        x={bx + 3} 
                        y={by + 3} 
                        width={Math.max(0, bw - 6)} 
                        height={Math.max(0, bh - 6)} 
                        rx={2} 
                        fill="none" 
                        stroke="rgba(241, 245, 249, 0.15)" 
                        strokeWidth={0.8} 
                      />
                      {/* Silver central shield logo */}
                      <rect 
                        x={bx + bw * 0.15} 
                        y={by + bh * 0.22} 
                        width={bw * 0.7} 
                        height={bh * 0.35} 
                        rx={2} 
                        fill="#1e293b" 
                        stroke="#475569" 
                        strokeWidth={1.2} 
                      />
                      <text 
                        x={bx + bw / 2} 
                        y={by + bh * 0.42} 
                        fill="#94a3b8" 
                        fontSize="6px" 
                        fontWeight="bold"
                        fontFamily="sans-serif" 
                        textAnchor="middle"
                      >
                        {skinPicker.partNumber || "MCU"}
                      </text>
                      
                      {/* Pins */}
                      {finalPinsForPreview.map((pin) => {
                        const px = bx + pin.x * scaleK;
                        const py = by + pin.y * scaleK;
                        
                        let tx = px;
                        let ty = py;
                        const pinLen = 8;
                        if (pin.dir === 'left') tx -= pinLen;
                        else if (pin.dir === 'right') tx += pinLen;
                        else if (pin.dir === 'up') ty -= pinLen;
                        else if (pin.dir === 'down') ty += pinLen;
                        
                        return (
                          <g key={pin.name}>
                            <line 
                              x1={px} 
                              y1={py} 
                              x2={tx} 
                              y2={ty} 
                              stroke="#64748b" 
                              strokeWidth={1.2} 
                            />
                            <circle 
                              cx={tx} 
                              cy={ty} 
                              r={2} 
                              fill="#ffffff" 
                              stroke="#475569" 
                              strokeWidth={0.8} 
                            />
                            <text 
                              x={pin.dir === 'left' ? px + 4 : (pin.dir === 'right' ? px - 4 : px)} 
                              y={pin.dir === 'up' ? py + 7 : (pin.dir === 'down' ? py - 3 : py + 2)}
                              fill="#e2e8f0"
                              fontSize="5px"
                              fontFamily="monospace"
                              textAnchor={pin.dir === 'left' ? 'start' : (pin.dir === 'right' ? 'end' : 'middle')}
                            >
                              {pin.name}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Right Column: Pin List & Alignment Controls */}
                <div className="flex flex-col min-h-0">
                  <h4 className="font-semibold text-xs text-slate-700 mb-2">Pin Side & Offset Configuration</h4>
                  
                  <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/30 p-3 space-y-2">
                    {skinPicker.rawPins.map((p) => {
                      const currentSide = skinPicker.sidesMap[p.name] || 'left';
                      const defaultIdx = skinPicker.rawPins.findIndex(pin => pin.name === p.name);
                      const currentOffset = skinPicker.pinOffsets[p.name] !== undefined 
                        ? skinPicker.pinOffsets[p.name] 
                        : (defaultIdx * skinPicker.pitch + 15);
                      
                      return (
                        <div 
                          key={p.name} 
                          className="flex items-center justify-between p-2.5 bg-white border border-slate-200/60 rounded-lg shadow-sm hover:border-slate-300 transition"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span className="text-xs font-semibold text-slate-800 font-mono">{p.name}</span>
                          </div>

                          <div className="flex items-center space-x-4">
                            {/* Side Selector */}
                            <div className="flex space-x-0.5 bg-slate-100 p-0.5 rounded-md">
                              {['left', 'right', 'top', 'bottom'].map((side) => {
                                const active = currentSide === side;
                                return (
                                  <button
                                    key={side}
                                    type="button"
                                    onClick={() => updateSidesMap(p.name, side)}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium uppercase transition ${
                                      active 
                                        ? 'bg-indigo-600 text-white shadow-sm' 
                                        : 'text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {side.substring(0, 3)}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Offset Nudge Controls */}
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => nudgePinOffset(p.name, -5)}
                                className="w-5 h-5 rounded border border-slate-200 flex items-center justify-center text-xs hover:bg-slate-50 text-slate-600 font-semibold"
                              >
                                -
                              </button>
                              <span className="text-[10px] font-mono text-slate-500 w-8 text-center">
                                {currentOffset}px
                              </span>
                              <button
                                type="button"
                                onClick={() => nudgePinOffset(p.name, 5)}
                                className="w-5 h-5 rounded border border-slate-200 flex items-center justify-center text-xs hover:bg-slate-50 text-slate-600 font-semibold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end space-x-2">
                <button
                  onClick={() => setSkinPicker(null)}
                  className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const finalPins = distributePinsBySides(
                      skinPicker.rawPins,
                      skinPicker.sidesMap,
                      skinPicker.pitch,
                      skinPicker.width,
                      skinPicker.height,
                      skinPicker.pinOffsets
                    );
                    
                    setComponents(prev => prev.map(c => 
                      c.id === skinPicker.compId ? { 
                        ...c, 
                        width: skinPicker.width,
                        height: skinPicker.height,
                        pins: finalPins,
                        image: null,
                        rawImage: null,
                        rawStartMargin: skinPicker.startMargin,
                        rawEndMargin: skinPicker.endMargin,
                        pinoutReference: pinoutReference
                      } : c
                    ));
                    
                    setSkinPicker(null);
                  }}
                  className="px-5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
                >
                  Apply CAD & Pinout
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <canvas
        ref={canvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className={`${getCursorClass()} w-full h-full bg-[#fbf9f5]`}
      />

      {/* Floating Pin Connection Tooltip Card */}
      {tooltipState.visible && (
        <div 
          style={{ 
            position: 'absolute', 
            left: tooltipState.x, 
            top: tooltipState.y, 
            zIndex: 9999,
            pointerEvents: 'none'
          }}
          className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl p-3 shadow-xl shadow-slate-200/50 max-w-xs transition-all duration-150 animate-in fade-in zoom-in-95"
        >
          <div className="space-y-1.5 font-sans">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                {tooltipState.compLabel}
              </span>
              <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 px-1 rounded">
                Pin {tooltipState.pinName}
              </span>
            </div>
            
            <div className="border-t border-slate-100 pt-1.5">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Electrical Net Connections:
              </span>
              {tooltipState.connections.length === 0 ? (
                <span className="text-[10px] text-slate-400 italic block">
                  Unconnected pin
                </span>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {tooltipState.connections.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                      <span className="text-slate-600 font-medium truncate max-w-[120px]">
                        {c.compLabel}
                      </span>
                      <span className="text-indigo-600 font-mono font-bold text-[9px] bg-indigo-50 px-1 rounded ml-2">
                        {c.pinName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
