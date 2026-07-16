/**
 * Orthogonal A* Routing Pathfinder for Wiretracks
 * Calculates neat vertical and horizontal paths between points while avoiding obstacles.
 */

const GRID_COLS = 200;
const GRID_ROWS = 150;

/**
 * Calculates an orthogonal route from start to end grid coordinates, avoiding component obstacles.
 * 
 * @param {Object} start - { x: pixels, y: pixels }
 * @param {Object} end - { x: pixels, y: pixels }
 * @param {Array} components - List of placed components with boundaries
 * @param {Array} traces - All other traces currently drawn
 * @param {number} gridSize - Grid cell size in pixels (default 15)
 * @returns {Array} List of grid points [{x, y}, ...] representing the path
 */
export function findOrthogonalPath(start, end, components = [], traces = [], gridSize = 15, startCompId = null, endCompId = null, startDir = null, endDir = null) {
  const getDirDelta = (dir) => {
    if (dir === 'left') return { dx: -1, dy: 0 };
    if (dir === 'right') return { dx: 1, dy: 0 };
    if (dir === 'up') return { dx: 0, dy: -1 };
    if (dir === 'down') return { dx: 0, dy: 1 };
    return null;
  };

  const startDirDelta = getDirDelta(startDir);
  const endDirDelta = getDirDelta(endDir);

  const startGrid = {
    x: Math.round(start.x / gridSize),
    y: Math.round(start.y / gridSize)
  };
  const endGrid = {
    x: Math.round(end.x / gridSize),
    y: Math.round(end.y / gridSize)
  };

  // Bounds clamping
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  startGrid.x = clamp(startGrid.x, 0, GRID_COLS - 1);
  startGrid.y = clamp(startGrid.y, 0, GRID_ROWS - 1);
  endGrid.x = clamp(endGrid.x, 0, GRID_COLS - 1);
  endGrid.y = clamp(endGrid.y, 0, GRID_ROWS - 1);

  // If start is same as end, return single point path
  if (startGrid.x === endGrid.x && startGrid.y === endGrid.y) {
    return [start];
  }

  // Pre-calculate component bounding boxes in grid units
  const componentBoxes = components.map(c => {
    const cx = Math.round(c.x / gridSize);
    const cy = Math.round(c.y / gridSize);
    const cw = Math.round(c.width / gridSize);
    const ch = Math.round(c.height / gridSize);
    // Add padding around component body to avoid drawing lines hugging the body
    return {
      x1: cx - 1,
      y1: cy - 1,
      x2: cx + cw,
      y2: cy + ch,
      id: c.id
    };
  });

  // Collect trace line segments to penalize crossing them
  const segmentObstacles = [];
  traces.forEach(trace => {
    if (!trace.path || trace.path.length < 2) return;
    for (let i = 0; i < trace.path.length - 1; i++) {
      const p1 = trace.path[i];
      const p2 = trace.path[i + 1];
      const p1Grid = { x: Math.round(p1.x / gridSize), y: Math.round(p1.y / gridSize) };
      const p2Grid = { x: Math.round(p2.x / gridSize), y: Math.round(p2.y / gridSize) };
      segmentObstacles.push({
        p1: p1Grid,
        p2: p2Grid,
        isLocked: trace.isLocked
      });
    }
  });

  // Helper to check if a grid point falls inside a component bounding box
  const isInsideComponent = (x, y) => {
    // Let start and end pins be inside component boundaries, otherwise we couldn't connect
    if ((x === startGrid.x && y === startGrid.y) || (x === endGrid.x && y === endGrid.y)) {
      return false;
    }
    for (const c of components) {
      if (c.id === startCompId || c.id === endCompId) {
        continue; // Exclude start/end components from hard blocking so they can connect
      }

      const cx = Math.round(c.x / gridSize);
      const cy = Math.round(c.y / gridSize);
      const cw = Math.round(c.width / gridSize);
      const ch = Math.round(c.height / gridSize);
      
      // Hard block the actual physical body interior of other components
      if (x >= cx && x < cx + cw && y >= cy && y < cy + ch) {
        return true;
      }
    }
    return false;
  };

  // Helper to check if a grid point falls inside any component body/margin and apply cost
  const getBodyPenalty = (x, y) => {
    if ((x === startGrid.x && y === startGrid.y) || (x === endGrid.x && y === endGrid.y)) {
      return 0;
    }
    for (const c of components) {
      const cx = Math.round(c.x / gridSize);
      const cy = Math.round(c.y / gridSize);
      const cw = Math.round(c.width / gridSize);
      const ch = Math.round(c.height / gridSize);
      
      // 1. Interior actual physical body check
      if (x >= cx && x < cx + cw && y >= cy && y < cy + ch) {
        if (c.id === startCompId || c.id === endCompId) {
          return 3000; // High soft penalty for start/end component interior
        }
        return 10000; // Hard-blocked in isInsideComponent anyway, but keep for safety
      }

      // 2. Outer padded boundary check (adds soft cost to keep trace spacing from component edges)
      const x1 = cx - 1;
      const y1 = cy - 1;
      const x2 = cx + cw;
      const y2 = cy + ch;
      if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        if (c.id === startCompId || c.id === endCompId) {
          continue; // Exclude start/end components from padding penalty to allow clean pin escapes
        }
        return 150; // Moderate soft penalty to keep distance from other components if possible
      }
    }
    return 0;
  };

  // Helper to check if a point sits on an existing trace segment
  const getTraceCost = (x, y) => {
    let penalty = 0;
    for (const seg of segmentObstacles) {
      const minX = Math.min(seg.p1.x, seg.p2.x);
      const maxX = Math.max(seg.p1.x, seg.p2.x);
      const minY = Math.min(seg.p1.y, seg.p2.y);
      const maxY = Math.max(seg.p1.y, seg.p2.y);
      
      // Is point on the segment
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        if (seg.isLocked) {
          // EXTREMELY high penalty to prevent sharing/crossing locked lines
          penalty += 250;
        } else {
          // High penalty to force A* to route around other wires instead of overlapping
          penalty += 150;
        }
      }
    }
    return penalty;
  };

  // Priority queue item key
  const nodeKey = (x, y) => `${x},${y}`;

  const openSet = [];
  const closedSet = new Set();
  
  const gScore = {};
  const fScore = {};
  const cameFrom = {};

  const startKey = nodeKey(startGrid.x, startGrid.y);
  gScore[startKey] = 0;
  fScore[startKey] = manhattanDistance(startGrid, endGrid);
  
  openSet.push({
    x: startGrid.x,
    y: startGrid.y,
    f: fScore[startKey],
    dir: null // {dx, dy}
  });

  let found = false;
  let maxIterations = 8000; // safety ceiling for larger grid
  let iterations = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    // Sort openSet by fScore ascending
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currentKey = nodeKey(current.x, current.y);

    if (current.x === endGrid.x && current.y === endGrid.y) {
      found = true;
      break;
    }

    closedSet.add(currentKey);

    // 4 directions
    let dirs = [
      { dx: 0, dy: -1 }, // Up
      { dx: 0, dy: 1 },  // Down
      { dx: -1, dy: 0 }, // Left
      { dx: 1, dy: 0 }   // Right
    ];

    // Force starting cell escape direction
    if (current.x === startGrid.x && current.y === startGrid.y && startDirDelta) {
      dirs = [startDirDelta];
    }

    for (const d of dirs) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;

      // Check grid bounds
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;

      const neighborKey = nodeKey(nx, ny);
      if (closedSet.has(neighborKey)) continue;

      // Check obstacle
      if (isInsideComponent(nx, ny)) continue;

      // Force entering the end pin from the correct facing direction
      if (nx === endGrid.x && ny === endGrid.y && endDirDelta) {
        const isEnteringCorrectly = (current.x === endGrid.x + endDirDelta.dx && current.y === endGrid.y + endDirDelta.dy);
        if (!isEnteringCorrectly) continue;
      }

      // Base step cost
      let stepCost = 1;

      // Penalize direction changes to keep lines straight
      if (current.dir && (current.dir.dx !== d.dx || current.dir.dy !== d.dy)) {
        stepCost += 8; // penalty for corners
      }

      // Add trace overlapping/crossing penalties
      stepCost += getTraceCost(nx, ny);
      stepCost += getBodyPenalty(nx, ny);

      const tentativeGScore = gScore[currentKey] + stepCost;

      if (gScore[neighborKey] === undefined || tentativeGScore < gScore[neighborKey]) {
        cameFrom[neighborKey] = { x: current.x, y: current.y };
        gScore[neighborKey] = tentativeGScore;
        fScore[neighborKey] = tentativeGScore + manhattanDistance({ x: nx, y: ny }, endGrid);

        // Check if neighbor already in openSet
        const existingIdx = openSet.findIndex(item => item.x === nx && item.y === ny);
        if (existingIdx === -1) {
          openSet.push({
            x: nx,
            y: ny,
            f: fScore[neighborKey],
            dir: d
          });
        } else {
          // Update existing openSet item with the new lower f score and direction
          openSet[existingIdx].f = fScore[neighborKey];
          openSet[existingIdx].dir = d;
        }
      }
    }
  }

  // Reconstruction
  if (found) {
    const path = [];
    let curr = endGrid;
    while (curr) {
      path.push({ x: curr.x * gridSize, y: curr.y * gridSize });
      curr = cameFrom[nodeKey(curr.x, curr.y)];
    }
    path.reverse();
    
    // Smooth the path to only contain corner nodes (reduces JSON size and simplifies drawing)
    const smoothed = smoothOrthogonalPath(path);
    if (smoothed.length > 0) {
      smoothed[0] = { x: start.x, y: start.y };
      smoothed[smoothed.length - 1] = { x: end.x, y: end.y };
    }
    return smoothed;
  }

  // Fallback: Return a simple Manhattan L-shaped route if A* fails
  return fallbackManhattanPath(start, end);
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Removes collinear points in a grid path to simplify rendering and data size.
 */
function smoothOrthogonalPath(path) {
  if (path.length <= 2) return path;
  const smoothed = [path[0]];
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];

    const isCollinear = (prev.x === curr.x && curr.x === next.x) || 
                        (prev.y === curr.y && curr.y === next.y);
                        
    if (!isCollinear) {
      smoothed.push(curr);
    }
  }
  
  smoothed.push(path[path.length - 1]);
  return smoothed;
}

/**
 * Returns a fallback 2-segment Manhattan connection (horizontal, then vertical)
 */
function fallbackManhattanPath(start, end) {
  const corner = { x: end.x, y: start.y };
  return [start, corner, end];
}
