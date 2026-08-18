export const GRID_WIDTH = 16;
export const GRID_HEIGHT = 16;
export const EXPORT_SIZE = 512;
export const EDITOR_BACKGROUND = '#050807';
export const EDITOR_TOOLS = Object.freeze(['pen', 'eraser']);

function assertDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError('Pixel-grid dimensions must be positive integers.');
  }
}

function assertCoordinates(x, y, width, height) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
    throw new RangeError('Pixel coordinates must be inside the grid.');
  }
}

function assertGrid(grid, width, height) {
  assertDimensions(width, height);
  if (!Array.isArray(grid) || grid.length !== width * height) {
    throw new RangeError('Pixel-grid data does not match its dimensions.');
  }
}

function cellIndex(x, y, width) {
  return y * width + x;
}

export function createPixelGrid(width = GRID_WIDTH, height = GRID_HEIGHT) {
  assertDimensions(width, height);
  return Array(width * height).fill(null);
}

function gridsMatch(first, second) {
  return first.length === second.length && first.every((cell, index) => cell === second[index]);
}

export function createGridHistory(initialGrid, limit = 100) {
  if (!Array.isArray(initialGrid)) throw new TypeError('A pixel grid is required.');
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('History limit must be a positive integer.');
  }

  let present = [...initialGrid];
  const past = [];
  const future = [];
  const snapshot = () => [...present];

  return Object.freeze({
    current: snapshot,
    commit(nextGrid) {
      if (!Array.isArray(nextGrid) || nextGrid.length !== present.length) {
        throw new RangeError('History snapshots must match the initial grid size.');
      }
      if (gridsMatch(present, nextGrid)) return snapshot();

      past.push(present);
      if (past.length > limit) past.shift();
      present = [...nextGrid];
      future.length = 0;
      return snapshot();
    },
    undo() {
      if (past.length === 0) return snapshot();
      future.push(present);
      present = past.pop();
      return snapshot();
    },
    redo() {
      if (future.length === 0) return snapshot();
      past.push(present);
      if (past.length > limit) past.shift();
      present = future.pop();
      return snapshot();
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  });
}

export function getSymmetryPoints({
  x,
  y,
  width = GRID_WIDTH,
  height = GRID_HEIGHT,
  vertical = false,
  horizontal = false,
}) {
  assertCoordinates(x, y, width, height);

  const points = new Map();
  const addPoint = (pointX, pointY) => points.set(`${pointX}:${pointY}`, { x: pointX, y: pointY });
  addPoint(x, y);

  if (vertical) addPoint(width - x - 1, y);
  if (horizontal) addPoint(x, height - y - 1);
  if (vertical && horizontal) addPoint(width - x - 1, height - y - 1);

  return [...points.values()];
}

export function getLinePoints(startX, startY, endX, endY) {
  [startX, startY, endX, endY].forEach((value) => {
    if (!Number.isInteger(value)) throw new TypeError('Line coordinates must be integers.');
  });

  const points = [];
  let x = startX;
  let y = startY;
  const deltaX = Math.abs(endX - startX);
  const deltaY = Math.abs(endY - startY);
  const stepX = startX < endX ? 1 : -1;
  const stepY = startY < endY ? 1 : -1;
  let error = deltaX - deltaY;

  while (true) {
    points.push({ x, y });
    if (x === endX && y === endY) break;

    const doubledError = error * 2;
    if (doubledError > -deltaY) {
      error -= deltaY;
      x += stepX;
    }
    if (doubledError < deltaX) {
      error += deltaX;
      y += stepY;
    }
  }

  return points;
}

export function floodFill(grid, {
  x,
  y,
  color,
  width = GRID_WIDTH,
  height = GRID_HEIGHT,
}) {
  assertGrid(grid, width, height);
  assertCoordinates(x, y, width, height);

  const result = [...grid];
  const startIndex = cellIndex(x, y, width);
  const targetColor = result[startIndex];
  if (targetColor === color) return result;

  const stack = [{ x, y }];
  result[startIndex] = color;

  while (stack.length > 0) {
    const point = stack.pop();
    const neighbors = [
      { x: point.x - 1, y: point.y },
      { x: point.x + 1, y: point.y },
      { x: point.x, y: point.y - 1 },
      { x: point.x, y: point.y + 1 },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= width || neighbor.y >= height) continue;
      const neighborIndex = cellIndex(neighbor.x, neighbor.y, width);
      if (result[neighborIndex] !== targetColor) continue;
      result[neighborIndex] = color;
      stack.push(neighbor);
    }
  }

  return result;
}

export function applyEditorTool(grid, {
  x,
  y,
  tool,
  color,
  bucket = false,
  width = GRID_WIDTH,
  height = GRID_HEIGHT,
  verticalSymmetry = false,
  horizontalSymmetry = false,
}) {
  assertGrid(grid, width, height);
  assertCoordinates(x, y, width, height);
  if (!EDITOR_TOOLS.includes(tool)) throw new RangeError(`Unsupported editor tool: ${tool}`);
  if (typeof bucket !== 'boolean') throw new TypeError('Bucket mode must be a boolean.');
  if (tool === 'pen' && typeof color !== 'string') {
    throw new TypeError('The pen tool requires a color.');
  }

  const points = getSymmetryPoints({
    x,
    y,
    width,
    height,
    vertical: verticalSymmetry,
    horizontal: horizontalSymmetry,
  });
  const replacement = tool === 'eraser' ? null : color;

  if (bucket) {
    return points.reduce(
      (result, point) => floodFill(result, { ...point, color: replacement, width, height }),
      [...grid],
    );
  }

  const result = [...grid];
  points.forEach((point) => {
    result[cellIndex(point.x, point.y, width)] = replacement;
  });
  return result;
}

export function countPaintedCells(grid) {
  if (!Array.isArray(grid)) throw new TypeError('A pixel grid is required.');
  return grid.reduce((total, color) => total + (color === null ? 0 : 1), 0);
}

export function renderPixelGrid(canvas, grid, {
  width = GRID_WIDTH,
  height = GRID_HEIGHT,
  showGrid = true,
  background = EDITOR_BACKGROUND,
} = {}) {
  assertGrid(grid, width, height);
  const context = canvas?.getContext?.('2d');
  if (!context) throw new TypeError('A 2D canvas is required to render the pixel grid.');

  const cellWidth = canvas.width / width;
  const cellHeight = canvas.height / height;
  context.imageSmoothingEnabled = false;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  grid.forEach((color, index) => {
    if (color === null) return;
    const x = index % width;
    const y = Math.floor(index / width);
    context.fillStyle = color;
    context.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
  });

  if (showGrid) {
    context.beginPath();
    for (let x = 1; x < width; x += 1) {
      const lineX = Math.round(x * cellWidth) + 0.5;
      context.moveTo(lineX, 0);
      context.lineTo(lineX, canvas.height);
    }
    for (let y = 1; y < height; y += 1) {
      const lineY = Math.round(y * cellHeight) + 0.5;
      context.moveTo(0, lineY);
      context.lineTo(canvas.width, lineY);
    }
    context.strokeStyle = 'rgba(143, 196, 168, 0.19)';
    context.lineWidth = 1;
    context.stroke();
  }

  return canvas;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function makeCreatedPngFilename(date = new Date()) {
  const localDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(localDate.getTime())) throw new TypeError('A valid date is required.');
  const dateStamp = [
    localDate.getFullYear(),
    pad(localDate.getMonth() + 1),
    pad(localDate.getDate()),
  ].join('');
  return `glyxel-create-${dateStamp}.png`;
}
