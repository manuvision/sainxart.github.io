import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEditorTool,
  countPaintedCells,
  createPixelGrid,
  floodFill,
  getLinePoints,
  getSymmetryPoints,
  makeCreatedPngFilename,
  renderPixelGrid,
} from '../create/editor.js';

test('creates a blank pixel grid with the requested dimensions', () => {
  const grid = createPixelGrid(4, 3);
  assert.equal(grid.length, 12);
  assert.ok(grid.every((cell) => cell === null));
});

test('vertical symmetry mirrors left and right across the vertical centerline', () => {
  assert.deepEqual(
    getSymmetryPoints({ x: 2, y: 4, width: 16, height: 16, vertical: true }),
    [{ x: 2, y: 4 }, { x: 13, y: 4 }],
  );
});

test('horizontal and vertical symmetry combine into four unique points', () => {
  assert.deepEqual(
    getSymmetryPoints({
      x: 1,
      y: 3,
      width: 8,
      height: 8,
      vertical: true,
      horizontal: true,
    }),
    [
      { x: 1, y: 3 },
      { x: 6, y: 3 },
      { x: 1, y: 4 },
      { x: 6, y: 4 },
    ],
  );
});

test('pen and eraser apply to every active symmetry point', () => {
  const blank = createPixelGrid(4, 4);
  const painted = applyEditorTool(blank, {
    x: 0,
    y: 1,
    tool: 'pen',
    color: '#E6506D',
    width: 4,
    height: 4,
    verticalSymmetry: true,
    horizontalSymmetry: true,
  });
  assert.equal(countPaintedCells(painted), 4);

  const erased = applyEditorTool(painted, {
    x: 0,
    y: 1,
    tool: 'eraser',
    width: 4,
    height: 4,
    verticalSymmetry: true,
    horizontalSymmetry: true,
  });
  assert.equal(countPaintedCells(erased), 0);
});

test('paint bucket fills only the connected region', () => {
  const wall = '#97599A';
  const fill = '#FFEE39';
  const grid = [
    null, wall, null,
    null, wall, null,
    null, wall, null,
  ];
  const result = floodFill(grid, { x: 0, y: 0, color: fill, width: 3, height: 3 });

  assert.deepEqual(result, [
    fill, wall, null,
    fill, wall, null,
    fill, wall, null,
  ]);
  assert.deepEqual(grid, [
    null, wall, null,
    null, wall, null,
    null, wall, null,
  ]);
});

test('paint bucket respects symmetry when regions are separated', () => {
  const wall = '#97599A';
  const fill = '#8DD1E7';
  const grid = [
    null, wall, null,
    null, wall, null,
    null, wall, null,
  ];
  const result = applyEditorTool(grid, {
    x: 0,
    y: 1,
    tool: 'bucket',
    color: fill,
    width: 3,
    height: 3,
    verticalSymmetry: true,
  });

  assert.deepEqual(result, [
    fill, wall, fill,
    fill, wall, fill,
    fill, wall, fill,
  ]);
});

test('line interpolation includes every cell between fast pointer samples', () => {
  assert.deepEqual(getLinePoints(0, 0, 4, 2), [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 2 },
  ]);
});

test('created PNG filenames include the local date without a time', () => {
  const morning = new Date(2026, 7, 18, 8, 30, 12);
  const evening = new Date(2026, 7, 18, 21, 45, 51);
  assert.equal(makeCreatedPngFilename(morning), 'glyxel-create-20260818.png');
  assert.equal(makeCreatedPngFilename(evening), 'glyxel-create-20260818.png');
});

test('clean export rendering omits the visible editor grid', () => {
  const calls = [];
  const context = {
    beginPath: () => calls.push('beginPath'),
    fillRect: (...values) => calls.push(['fillRect', ...values]),
    lineTo: () => calls.push('lineTo'),
    moveTo: () => calls.push('moveTo'),
    stroke: () => calls.push('stroke'),
  };
  const canvas = {
    width: 512,
    height: 512,
    getContext: () => context,
  };
  const grid = createPixelGrid(2, 2);
  grid[0] = '#E6506D';

  renderPixelGrid(canvas, grid, { width: 2, height: 2, showGrid: false });

  assert.equal(calls.filter((call) => call === 'stroke').length, 0);
  assert.equal(calls.filter((call) => Array.isArray(call) && call[0] === 'fillRect').length, 2);
});
