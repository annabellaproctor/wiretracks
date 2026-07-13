import React, { useRef, useEffect, useState } from 'react';

export default function BreadboardCanvas({ components, traces }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Transform and responsive size settings
  const [pan, setPan] = useState({ x: 30, y: 120 });
  const [zoom, setZoom] = useState(0.85);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  const HOLE_PITCH = 14; 
  const COLUMNS = 64;

  // ResizeObserver for responsive canvas boundaries
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

  // Override browser trackpad horizontal sweeps, browser history shifts, and page-zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      
      // If ctrlKey is true, it represents pinch-to-zoom (trackpads) or scroll wheel + Ctrl zoom
      if (e.ctrlKey) {
        const zoomFactor = 1.08;
        setZoom(prev => {
          const next = e.deltaY < 0 ? prev * zoomFactor : prev / zoomFactor;
          return Math.max(0.4, Math.min(2, next));
        });
      } else {
        // Trackpad panning (two-finger scroll)
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

  const handleMouseDown = (e) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const getBreadboardFootprint = (comp) => {
    switch (comp.type) {
      case 'mcu':
        return {
          col: 15,
          rowOffset: 0,
          widthCols: 15,
          pins: [
            { name: '5V', col: 15, row: 'A' },
            { name: '3V3', col: 16, row: 'A' },
            { name: 'GND', col: 24, row: 'A' },
            { name: 'IO2', col: 18, row: 'J' },
            { name: 'IO4', col: 19, row: 'J' },
            { name: 'RX2', col: 22, row: 'J' },
            { name: 'TX2', col: 23, row: 'J' }
          ]
        };
      case 'regulator':
        return {
          col: 6,
          rowOffset: 0,
          widthCols: 3,
          pins: [
            { name: 'IN', col: 6, row: 'C' },
            { name: 'GND', col: 7, row: 'C' },
            { name: 'OUT', col: 8, row: 'C' }
          ]
        };
      case 'resistor':
        const startCol = comp.name.includes('1') ? 35 : 42;
        return {
          col: startCol,
          pins: [
            { name: '1', col: startCol, row: 'C' },
            { name: '2', col: startCol + 5, row: 'C' }
          ]
        };
      case 'capacitor':
        const capCol = comp.name.includes('1') ? 5 : 10;
        return {
          col: capCol,
          pins: [
            { name: '1', col: capCol, row: 'B' },
            { name: '2', col: capCol, row: 'E' }
          ]
        };
      case 'led':
        return {
          col: 40,
          pins: [
            { name: 'A', col: 40, row: 'D' }, 
            { name: 'K', col: 40, row: 'E' }  
          ]
        };
      default:
        return {
          col: 30,
          pins: [
            { name: '1', col: 30, row: 'C' },
            { name: '2', col: 31, row: 'C' }
          ]
        };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // High DPI scaling
    ctx.scale(dpr, dpr);

    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const boardWidth = 1000;
    const boardHeight = 320;

    // Plastic board outline
    ctx.fillStyle = '#fbfbf9'; 
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.roundRect(0, 0, boardWidth, boardHeight, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, boardHeight / 2 - 8, boardWidth, 16);

    const rowsTop = ['A', 'B', 'C', 'D', 'E'];
    const rowsBottom = ['F', 'G', 'H', 'I', 'J'];

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Courier New, monospace';
    ctx.textAlign = 'center';

    for (let c = 1; c <= 60; c++) {
      const x = 50 + c * HOLE_PITCH;
      if (c % 5 === 0) {
        ctx.fillText(c.toString(), x, 22);
        ctx.fillText(c.toString(), x, boardHeight - 12);
      }
    }

    const drawHolesAndLabels = () => {
      // Top section rows A-E
      for (let r = 0; r < 5; r++) {
        const y = 45 + r * HOLE_PITCH;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(rowsTop[r], 24, y + 4);
        ctx.fillText(rowsTop[r], boardWidth - 24, y + 4);

        for (let c = 1; c <= 60; c++) {
          const x = 50 + c * HOLE_PITCH;
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // Bottom section rows F-J
      for (let r = 0; r < 5; r++) {
        const y = boardHeight / 2 + 25 + r * HOLE_PITCH;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(rowsBottom[r], 24, y + 4);
        ctx.fillText(rowsBottom[r], boardWidth - 24, y + 4);

        for (let c = 1; c <= 60; c++) {
          const x = 50 + c * HOLE_PITCH;
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    };

    drawHolesAndLabels();

    const drawPowerRails = () => {
      const yPowerTop = 15;
      const yGndTop = 27;
      const yPowerBottom = boardHeight - 27;
      const yGndBottom = boardHeight - 15;

      ctx.strokeStyle = '#ef4444'; 
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(50, yPowerTop - 4);
      ctx.lineTo(boardWidth - 50, yPowerTop - 4);
      ctx.moveTo(50, yPowerBottom + 4);
      ctx.lineTo(boardWidth - 50, yPowerBottom + 4);
      ctx.stroke();

      ctx.strokeStyle = '#3b82f6'; 
      ctx.beginPath();
      ctx.moveTo(50, yGndTop + 4);
      ctx.lineTo(boardWidth - 50, yGndTop + 4);
      ctx.moveTo(50, yGndBottom - 4);
      ctx.lineTo(boardWidth - 50, yGndBottom - 4);
      ctx.stroke();

      const drawRailHoles = (y) => {
        for (let c = 1; c <= 60; c++) {
          if (c % 6 === 0) continue;
          const x = 50 + c * HOLE_PITCH;
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      };

      drawRailHoles(yPowerTop);
      drawRailHoles(yGndTop);
      drawRailHoles(yPowerBottom);
      drawRailHoles(yGndBottom);
    };

    drawPowerRails();

    const getRowY = (rowChar) => {
      const idxT = rowsTop.indexOf(rowChar);
      if (idxT !== -1) return 45 + idxT * HOLE_PITCH;
      const idxB = rowsBottom.indexOf(rowChar);
      if (idxB !== -1) return boardHeight / 2 + 25 + idxB * HOLE_PITCH;
      return boardHeight / 2;
    };

    const getColX = (colNum) => 50 + colNum * HOLE_PITCH;

    const physicalPinPositions = {};

    components.forEach(comp => {
      const fp = getBreadboardFootprint(comp);
      const startX = getColX(fp.col);

      fp.pins.forEach(pin => {
        const px = getColX(pin.col);
        const py = getRowY(pin.row);
        physicalPinPositions[`${comp.id}.${pin.name}`] = { x: px, y: py };
      });

      if (comp.type === 'mcu') {
        const cy = boardHeight / 2;
        const w = fp.widthCols * HOLE_PITCH + 10;
        const h = 80;

        ctx.fillStyle = '#1e293b'; 
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(startX - 10, cy - h / 2, w, h, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(startX - 2, cy - 24, 28, 22);

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(startX - 9, cy - 22);
        ctx.lineTo(startX - 5, cy - 22);
        ctx.lineTo(startX - 5, cy - 10);
        ctx.lineTo(startX - 9, cy - 10);
        ctx.stroke();

        ctx.fillStyle = '#f59e0b'; 
        fp.pins.forEach(pin => {
          const pinPos = physicalPinPositions[`${comp.id}.${pin.name}`];
          if (!pinPos) return;
          ctx.beginPath();
          ctx.arc(pinPos.x, pinPos.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        });

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comp.name, startX + w / 2 - 10, cy + 3);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '7px Courier New';
        ctx.fillText("ESP32 NODE", startX + w / 2 - 10, cy + 12);
      }
      else if (comp.type === 'regulator') {
        const rx = startX;
        const ry = getRowY('A') - 10;

        ctx.fillStyle = '#64748b';
        ctx.fillRect(rx - 8, ry - 14, 24, 12);
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(rx + 4, ry - 8, 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rx - 8, ry - 2, 24, 14);

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.8;
        fp.pins.forEach(pin => {
          const pinPos = physicalPinPositions[`${comp.id}.${pin.name}`];
          if (!pinPos) return;
          ctx.beginPath();
          ctx.moveTo(pinPos.x, ry + 12);
          ctx.lineTo(pinPos.x, pinPos.y);
          ctx.stroke();
        });

        ctx.fillStyle = '#ffffff';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("7805", rx + 4, ry + 7);
      }
      else if (comp.type === 'resistor') {
        const p1 = physicalPinPositions[`${comp.id}.1`];
        const p2 = physicalPinPositions[`${comp.id}.2`];
        if (!p1 || !p2) return;

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.fillStyle = '#f5f5dc';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(midX - 16, midY - 5, 32, 10, 3);
        ctx.fill();
        ctx.stroke();

        const is220 = comp.value.includes('220');
        const colorStripes = is220 
          ? ['#ef4444', '#ef4444', '#78350f', '#f59e0b'] 
          : ['#78350f', '#000000', '#f97316', '#f59e0b']; 

        ctx.lineWidth = 2.2;
        colorStripes.forEach((color, i) => {
          ctx.strokeStyle = color;
          ctx.beginPath();
          const sx = midX - 10 + i * 6;
          ctx.moveTo(sx, midY - 4.5);
          ctx.lineTo(sx, midY + 4.5);
          ctx.stroke();
        });
      }
      else if (comp.type === 'capacitor') {
        const p1 = physicalPinPositions[`${comp.id}.1`];
        const p2 = physicalPinPositions[`${comp.id}.2`];
        if (!p1 || !p2) return;

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const isPolar = comp.value.includes('0.33') || comp.value.includes('Polarized');

        if (isPolar) {
          ctx.fillStyle = '#2563eb';
          ctx.beginPath();
          ctx.arc(midX, midY, 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(midX - 6, midY - 2, 3, 4);
        } else {
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(midX, midY, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }
      else if (comp.type === 'led') {
        const p1 = physicalPinPositions[`${comp.id}.A`];
        const p2 = physicalPinPositions[`${comp.id}.K`];
        if (!p1 || !p2) return;

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - 3, p1.y - 12);
        ctx.lineTo(p2.x + 3, p2.y - 12);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc((p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 14, 7, Math.PI, 0, false);
        ctx.lineTo((p1.x + p2.x) / 2 + 7, (p1.y + p2.y) / 2 - 10);
        ctx.lineTo((p1.x + p2.x) / 2 - 7, (p1.y + p2.y) / 2 - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc((p1.x + p2.x) / 2 - 2, (p1.y + p2.y) / 2 - 16, 1.8, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    traces.forEach(trace => {
      const startPt = physicalPinPositions[trace.from];
      const endPt = physicalPinPositions[trace.to];

      if (!startPt || !endPt) return;

      ctx.lineWidth = trace.isLocked ? 3.5 : 2.5;
      
      if (trace.isLocked) {
        ctx.strokeStyle = '#c2410c'; 
      } else {
        const isPower = trace.from.includes('5V') || trace.to.includes('5V') || trace.from.includes('3V3') || trace.to.includes('3V3');
        const isGnd = trace.from.includes('GND') || trace.to.includes('GND');
        ctx.strokeStyle = isPower ? '#dc2626' : (isGnd ? '#1e293b' : '#16a34a'); 
      }

      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      
      const cp1x = startPt.x + dx * 0.25;
      const cp1y = startPt.y + dy * 0.25 + (trace.isLocked ? 10 : 35);
      const cp2x = startPt.x + dx * 0.75;
      const cp2y = startPt.y + dy * 0.75 + (trace.isLocked ? 10 : 35);
      
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endPt.x, endPt.y);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(startPt.x, startPt.y, 2, 0, 2 * Math.PI);
      ctx.arc(endPt.x, endPt.y, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }, [components, traces, pan, zoom, dimensions]);

  const dpr = window.devicePixelRatio || 1;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-100 flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
        <span className="text-xs font-semibold text-slate-500 mr-2">PROTOTYPE:</span>
        <span className="text-xs text-slate-700">Breadboard Jumper Routing View</span>
      </div>

      <canvas
        ref={canvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}
