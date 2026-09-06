import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { Player } from '../player.js';

class Surface {
  constructor() {
    this.listeners = new Map();
    this.style = {};
    this.classList = { add() {}, remove() {} };
    this.knob = { style: {} };
  }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  dispatch(name, data = {}) {
    const event = { type: name, target: this, preventDefault() {}, stopPropagation() {}, ...data };
    for (const callback of this.listeners.get(name) || []) callback(event);
  }
  querySelector() { return this.knob; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

function fixture(getBlock = (x, y) => y < 1 ? 1 : 0, getWaterLevel) {
  const win = new Surface();
  win.matchMedia = () => ({ matches: false });
  const doc = new Surface();
  doc.defaultView = win;
  const controls = Object.fromEntries(['move-stick', 'look-stick', 'jump-button', 'break-button', 'place-button', 'sprint-button']
    .map((id) => [id, new Surface()]));
  doc.querySelector = (selector) => controls[selector.slice(1)];
  doc.pointerLockElement = null;
  doc.exitPointerLock = () => { doc.pointerLockElement = null; doc.dispatch('pointerlockchange'); };
  const canvas = new Surface();
  canvas.ownerDocument = doc;
  const camera = new THREE.PerspectiveCamera();
  const actions = [];
  const selections = [];
  let pauses = 0;
  const player = new Player(camera, canvas, { getBlock, getWaterLevel }, {
    onAction: (kind) => actions.push(kind),
    onSelect: (index) => selections.push(index),
    onPause: () => pauses++,
  });
  player.teleport(0.5, 1.06, 0.5);
  player.enable();
  const tick = (seconds, dt = 1 / 60) => {
    for (let time = 0; time < seconds; time += dt) player.update(dt);
  };
  return { player, camera, canvas, controls, doc, win, actions, selections, tick, get pauses() { return pauses; } };
}

test('feet settle on the floor and remain stable over ten seconds', () => {
  const f = fixture();
  f.tick(10);
  assert.ok(Math.abs(f.player.position.y - 1) < 0.0001);
  assert.equal(f.player.grounded, true);
  assert.equal(f.player.velocity.y, 0);
  assert.ok(Math.abs(f.camera.position.y - 2.62) < 0.0001);
});

test('sprinting cannot tunnel through a wall and can slide along it', () => {
  const f = fixture((x, y, z) => y < 1 || (z === -3 && y < 5) ? 1 : 0);
  f.player.keys.add('KeyW');
  f.player.keys.add('ShiftLeft');
  f.tick(3, 0.1);
  assert.ok(f.player.position.z >= -2 + f.player.radius - 0.0001);
  f.player.keys.add('KeyD');
  f.tick(1);
  assert.ok(f.player.position.x > 3);
  assert.ok(f.player.position.z >= -2 + f.player.radius - 0.0001);
});

test('jump rises enough for a one-block obstacle and holding space never flies', () => {
  const f = fixture();
  f.tick(0.4);
  f.doc.dispatch('keydown', { code: 'Space' });
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    f.player.update(1 / 120);
    peak = Math.max(peak, f.player.position.y);
  }
  assert.ok(peak > 2.15 && peak < 2.4, `jump peak ${peak}`);
  f.tick(2);
  assert.ok(Math.abs(f.player.position.y - 1) < 0.0001);
});

test('jump collides with the underside of a low ceiling', () => {
  const f = fixture((x, y) => y < 1 || y === 3 ? 1 : 0);
  f.tick(0.4);
  f.doc.dispatch('keydown', { code: 'Space' });
  for (let i = 0; i < 60; i++) {
    f.player.update(1 / 120);
    assert.ok(f.player.position.y + f.player.height <= 3.0001);
  }
  f.tick(1);
  assert.equal(f.player.grounded, true);
});

test('falling at terminal velocity during a long frame cannot cross a floor', () => {
  const f = fixture();
  f.player.teleport(0.5, 4, 0.5);
  f.player.velocity.y = -35;
  f.player.update(0.1);
  assert.ok(f.player.position.y >= 1);
  f.tick(1);
  assert.ok(Math.abs(f.player.position.y - 1) < 0.0001);
});

test('water allows ascent but stops providing buoyancy above the surface', () => {
  const f = fixture((x, y) => y < 0 ? 1 : y < 4 ? 7 : 0);
  f.player.teleport(0.5, 0.1, 0.5);
  assert.equal(f.player.underwater, true);
  f.doc.dispatch('keydown', { code: 'Space' });
  let highest = 0;
  for (let i = 0; i < 600; i++) {
    f.player.update(1 / 60);
    highest = Math.max(highest, f.player.position.y);
  }
  assert.ok(highest > 3 && highest < 4, `swimming peak ${highest}`);
  assert.equal(f.player.underwater, false);
  f.doc.dispatch('keyup', { code: 'Space' });
  f.tick(4);
  assert.equal(f.player.underwater, true);
});

test('underwater detection follows the exposed source surface, not the whole voxel', () => {
  const f = fixture((x, y) => y < 0 ? 1 : y < 4 ? 7 : 0);
  f.player.teleport(0.5, 3.85 - f.player.eyeHeight, 0.5);
  assert.equal(f.player.underwater, true);
  f.player.teleport(0.5, 3.87 - f.player.eyeHeight, 0.5);
  assert.equal(f.player.underwater, false);
  assert.equal(f.player.inWater, true);
});

test('shallow flowing water uses its actual level for feet and eye samples', () => {
  const f = fixture((x, y) => y < 1 ? 1 : y === 1 ? 7 : 0, () => 1);
  const surface = 1 + 0.16 + 0.7 / 8;
  f.player.teleport(0.5, 1.0, 0.5);
  assert.equal(f.player.inWater, true);
  f.player.teleport(0.5, 1.10, 0.5);
  assert.equal(f.player.inWater, false);
  f.player.teleport(0.5, surface - f.player.eyeHeight - 0.001, 0.5);
  assert.equal(f.player.underwater, true);
  f.player.teleport(0.5, surface - f.player.eyeHeight + 0.001, 0.5);
  assert.equal(f.player.underwater, false);
});

test('diagonal input has the same horizontal speed as cardinal input', () => {
  const straight = fixture();
  const diagonal = fixture();
  straight.player.keys.add('KeyW');
  diagonal.player.keys.add('KeyW');
  diagonal.player.keys.add('KeyD');
  straight.tick(2);
  diagonal.tick(2);
  const a = Math.hypot(straight.player.velocity.x, straight.player.velocity.z);
  const b = Math.hypot(diagonal.player.velocity.x, diagonal.player.velocity.z);
  assert.ok(Math.abs(a - b) < 0.000001);
});

test('joysticks and jump remain independent across multiple pointers', () => {
  const f = fixture();
  f.tick(0.4);
  f.controls['move-stick'].dispatch('pointerdown', { pointerId: 1, clientX: 50, clientY: 18 });
  f.controls['look-stick'].dispatch('pointerdown', { pointerId: 2, clientX: 82, clientY: 50 });
  f.controls['jump-button'].dispatch('pointerdown', { pointerId: 3 });
  f.tick(0.1);
  assert.ok(f.player.yaw < -0.2);
  assert.ok(f.player.position.z < 0.5);
  assert.ok(f.player.position.y > 1.5);
  f.win.dispatch('pointerup', { pointerId: 2 });
  assert.equal(f.player._lookStick.x, 0);
  assert.equal(f.player._moveStick.y, -1);
  assert.equal(f.player._touchJump, true);
  f.win.dispatch('pointercancel', { pointerId: 1 });
  assert.equal(f.player._moveStick.y, 0);
  assert.equal(f.player._touchJump, true);
  f.win.dispatch('pointerup', { pointerId: 3 });
  assert.equal(f.player._touchJump, false);
});

test('pointer-lock rejection supports drag-look, and actual lock loss pauses once', () => {
  const f = fixture();
  f.doc.dispatch('pointerlockerror');
  assert.equal(f.player.enabled, true);
  assert.equal(f.pauses, 0);
  f.tick(0.4);
  f.canvas.dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
  f.win.dispatch('pointermove', { pointerId: 1, clientX: 100, clientY: 10 });
  f.win.dispatch('pointerup', { pointerId: 1, button: 0 });
  assert.ok(f.player.yaw < -0.2);
  assert.deepEqual(f.actions, []);
  f.doc.pointerLockElement = f.canvas;
  f.doc.dispatch('pointerlockchange');
  f.doc.exitPointerLock();
  assert.equal(f.player.enabled, false);
  assert.equal(f.pauses, 1);
  f.doc.dispatch('pointerlockchange');
  assert.equal(f.pauses, 1);
});

test('starter input is suppressed; held actions repeat and release cleanly', () => {
  const f = fixture();
  f.doc.pointerLockElement = f.canvas;
  f.doc.dispatch('pointerlockchange');
  f.canvas.dispatch('pointerdown', { pointerId: 1, button: 0 });
  f.win.dispatch('pointerup', { pointerId: 1, button: 0 });
  assert.deepEqual(f.actions, []);
  f.tick(0.3);
  f.canvas.dispatch('pointerdown', { pointerId: 1, button: 0 });
  f.tick(0.5);
  assert.deepEqual(f.actions, ['break', 'break', 'break']);
  f.win.dispatch('pointerup', { pointerId: 1, button: 0 });
  f.tick(0.5);
  assert.equal(f.actions.length, 3);
  f.doc.dispatch('keydown', { code: 'Digit9' });
  f.canvas.dispatch('wheel', { deltaY: 30, timeStamp: 1000 });
  assert.deepEqual(f.selections, [8, 0]);
});

test('fast locked clicks act synchronously and release before the next frame', () => {
  const f = fixture();
  f.doc.pointerLockElement = f.canvas;
  f.doc.dispatch('pointerlockchange');
  f.tick(0.3);
  f.canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0 });
  assert.deepEqual(f.actions, ['break']);
  f.win.dispatch('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0 });
  f.canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 2 });
  assert.deepEqual(f.actions, ['break', 'place']);
  f.win.dispatch('pointerup', { pointerId: 1, pointerType: 'mouse', button: 2 });
  f.tick(0.5);
  assert.deepEqual(f.actions, ['break', 'place']);
  f.player.dispose();
});

test('fast fallback clicks and touch action buttons work without a frame between press and release', () => {
  const f = fixture();
  f.tick(0.3);
  f.canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 50, clientY: 50 });
  f.win.dispatch('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 50, clientY: 50 });
  assert.deepEqual(f.actions, ['break']);
  f.controls['place-button'].dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0 });
  assert.deepEqual(f.actions, ['break', 'place']);
  f.win.dispatch('pointerup', { pointerId: 2, pointerType: 'touch', button: 0 });
  f.tick(0.5);
  assert.deepEqual(f.actions, ['break', 'place']);
  f.player.dispose();
});
