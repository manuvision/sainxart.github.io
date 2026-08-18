import { COPIC_MARKERS } from '../generator.js?v=20260818-1';
import {
  EDITOR_BACKGROUND,
  EXPORT_SIZE,
  GRID_HEIGHT,
  GRID_WIDTH,
  applyEditorTool,
  countPaintedCells,
  createGridHistory,
  createPixelGrid,
  getLinePoints,
  makeCreatedPngFilename,
  renderPixelGrid,
} from './editor.js?v=20260818-2';

const canvas = document.querySelector('#pixelCanvas');
const palette = document.querySelector('#palette');
const colorLabel = document.querySelector('#colorLabel');
const paintedCount = document.querySelector('#paintedCount');
const verticalSymmetryInput = document.querySelector('#verticalSymmetry');
const horizontalSymmetryInput = document.querySelector('#horizontalSymmetry');
const saveButton = document.querySelector('#saveButton');
const bucketToggle = document.querySelector('#bucketToggle');
const undoButton = document.querySelector('#undoButton');
const redoButton = document.querySelector('#redoButton');
const clearButton = document.querySelector('#clearButton');
const toast = document.querySelector('#toast');
const toolButtons = [...document.querySelectorAll('[data-tool]')];

let grid = createPixelGrid();
const history = createGridHistory(grid);
let selectedMarker = COPIC_MARKERS.find(({ code }) => code === 'R46') || COPIC_MARKERS[0];
let activeTool = 'pen';
let bucketMode = false;
let verticalSymmetry = true;
let horizontalSymmetry = false;
let drawingPointerId = null;
let lastPointerCell = null;
let keyboardCursor = { x: Math.floor(GRID_WIDTH / 2) - 1, y: Math.floor(GRID_HEIGHT / 2) - 1 };
let keyboardMode = false;
let toastTimer = 0;

function haptic(duration) {
  if ('vibrate' in navigator) navigator.vibrate(duration);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function markerTextColor(hex) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 155 ? '#262330' : '#fffaf2';
}

function buildPalette() {
  COPIC_MARKERS.forEach((marker) => {
    const button = document.createElement('button');
    button.className = 'color-button';
    button.type = 'button';
    button.dataset.color = marker.hex;
    button.dataset.code = marker.code;
    button.style.setProperty('--swatch', marker.hex);
    button.style.setProperty('--swatch-ink', markerTextColor(marker.hex));
    button.textContent = marker.code;
    button.setAttribute('aria-label', `${marker.code}, ${marker.name}`);
    button.setAttribute('aria-pressed', String(marker.code === selectedMarker.code));
    button.title = `${marker.code} — ${marker.name}`;
    button.classList.toggle('is-selected', marker.code === selectedMarker.code);
    button.addEventListener('click', () => selectMarker(marker));
    palette.appendChild(button);
  });
}

function selectMarker(marker) {
  selectedMarker = marker;
  colorLabel.textContent = `${marker.code} / ${marker.name}`;
  document.querySelectorAll('.color-button').forEach((button) => {
    const selected = button.dataset.code === marker.code;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  haptic(7);
}

function drawKeyboardCursor() {
  if (!keyboardMode || document.activeElement !== canvas) return;
  const context = canvas.getContext('2d');
  const cellWidth = canvas.width / GRID_WIDTH;
  const cellHeight = canvas.height / GRID_HEIGHT;
  context.save();
  context.strokeStyle = '#fff8dc';
  context.lineWidth = 3;
  context.strokeRect(
    keyboardCursor.x * cellWidth + 2,
    keyboardCursor.y * cellHeight + 2,
    cellWidth - 4,
    cellHeight - 4,
  );
  context.strokeStyle = 'rgba(5, 8, 7, 0.86)';
  context.lineWidth = 1;
  context.strokeRect(
    keyboardCursor.x * cellWidth + 4,
    keyboardCursor.y * cellHeight + 4,
    cellWidth - 8,
    cellHeight - 8,
  );
  context.restore();
}

function renderEditor() {
  renderPixelGrid(canvas, grid);
  drawKeyboardCursor();
  const painted = countPaintedCells(grid);
  paintedCount.textContent = `${painted} / ${GRID_WIDTH * GRID_HEIGHT} cells`;
  undoButton.disabled = !history.canUndo();
  redoButton.disabled = !history.canRedo();
  clearButton.disabled = painted === 0;
  const activeAction = bucketMode ? `bucket ${activeTool}` : activeTool;
  canvas.setAttribute(
    'aria-label',
    `${GRID_WIDTH} by ${GRID_HEIGHT} pixel drawing grid with ${painted} colored cells. ${activeAction} selected.`,
  );
}

function applyAt(point) {
  grid = applyEditorTool(grid, {
    ...point,
    tool: activeTool,
    bucket: bucketMode,
    color: selectedMarker.hex,
    verticalSymmetry,
    horizontalSymmetry,
  });
  keyboardCursor = point;
}

function drawTo(point) {
  const points = bucketMode || !lastPointerCell
    ? [point]
    : getLinePoints(lastPointerCell.x, lastPointerCell.y, point.x, point.y);
  points.forEach(applyAt);
  lastPointerCell = point;
  renderEditor();
}

function pointFromPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * GRID_WIDTH);
  const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * GRID_HEIGHT);
  return {
    x: Math.min(GRID_WIDTH - 1, Math.max(0, x)),
    y: Math.min(GRID_HEIGHT - 1, Math.max(0, y)),
  };
}

function finishPointer(event) {
  if (drawingPointerId !== event.pointerId) return;
  drawingPointerId = null;
  lastPointerCell = null;
  grid = history.commit(grid);
  renderEditor();
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

function selectTool(tool) {
  activeTool = tool;
  toolButtons.forEach((button) => {
    const selected = button.dataset.tool === tool;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  renderEditor();
  haptic(7);
}

function toggleBucketMode() {
  bucketMode = !bucketMode;
  bucketToggle.classList.toggle('is-toggled', bucketMode);
  bucketToggle.setAttribute('aria-pressed', String(bucketMode));
  renderEditor();
  showToast(bucketMode ? `BUCKET ${activeTool.toUpperCase()} ON` : 'BUCKET OFF');
  haptic(7);
}

function undo() {
  if (!history.canUndo()) return;
  grid = history.undo();
  renderEditor();
  showToast('UNDONE');
  haptic(7);
}

function redo() {
  if (!history.canRedo()) return;
  grid = history.redo();
  renderEditor();
  showToast('REDONE');
  haptic(7);
}

function clearAll() {
  if (countPaintedCells(grid) === 0) return;
  grid = history.commit(createPixelGrid());
  renderEditor();
  showToast('CANVAS CLEARED — UNDO AVAILABLE');
  haptic([8, 35, 8]);
}

function canvasToBlob(targetCanvas) {
  return new Promise((resolve, reject) => {
    targetCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The Glyxel canvas could not be converted to PNG.'));
    }, 'image/png');
  });
}

async function savePng() {
  saveButton.disabled = true;

  try {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    renderPixelGrid(exportCanvas, grid, { showGrid: false, background: EDITOR_BACKGROUND });
    const blob = await canvasToBlob(exportCanvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = makeCreatedPngFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast('CLEAN 512 PX PNG SAVED');
    haptic([8, 35, 12]);
  } catch (error) {
    console.error('Could not save the created Glyxel.', error);
    showToast('PNG COULD NOT BE SAVED');
  } finally {
    saveButton.disabled = false;
  }
}

canvas.addEventListener('pointerdown', (event) => {
  if (drawingPointerId !== null) return;
  event.preventDefault();
  drawingPointerId = event.pointerId;
  lastPointerCell = null;
  keyboardMode = false;
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({ preventScroll: true });
  drawTo(pointFromPointer(event));
  haptic(5);
});

canvas.addEventListener('pointermove', (event) => {
  if (drawingPointerId !== event.pointerId || bucketMode) return;
  event.preventDefault();
  const point = pointFromPointer(event);
  if (lastPointerCell?.x === point.x && lastPointerCell?.y === point.y) return;
  drawTo(point);
});

canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
canvas.addEventListener('lostpointercapture', () => {
  if (drawingPointerId !== null) grid = history.commit(grid);
  drawingPointerId = null;
  lastPointerCell = null;
  renderEditor();
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener('keydown', (event) => {
  const moves = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  if (moves[event.key]) {
    event.preventDefault();
    keyboardMode = true;
    keyboardCursor = {
      x: Math.min(GRID_WIDTH - 1, Math.max(0, keyboardCursor.x + moves[event.key][0])),
      y: Math.min(GRID_HEIGHT - 1, Math.max(0, keyboardCursor.y + moves[event.key][1])),
    };
    renderEditor();
  } else if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    keyboardMode = true;
    applyAt(keyboardCursor);
    grid = history.commit(grid);
    renderEditor();
    haptic(5);
  }
});

canvas.addEventListener('focus', renderEditor);
canvas.addEventListener('blur', () => {
  keyboardMode = false;
  renderEditor();
});
toolButtons.forEach((button) => button.addEventListener('click', () => selectTool(button.dataset.tool)));
bucketToggle.addEventListener('click', toggleBucketMode);
undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);
clearButton.addEventListener('click', clearAll);

verticalSymmetryInput.addEventListener('change', () => {
  verticalSymmetry = verticalSymmetryInput.checked;
  renderEditor();
  haptic(7);
});

horizontalSymmetryInput.addEventListener('change', () => {
  horizontalSymmetry = horizontalSymmetryInput.checked;
  renderEditor();
  haptic(7);
});

saveButton.addEventListener('click', savePng);

buildPalette();
renderEditor();
