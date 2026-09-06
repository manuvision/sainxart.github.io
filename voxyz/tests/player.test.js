import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { Player } from '../player.js';

class Surface {
  constructor() {
    this.listeners = new Map();
    this.style = {};
    this.classes = new Set();
    this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)) };
    this.captured = new Set();
    this.knob = { style: {} };
  }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  dispatch(name, data = {}) {
    const event = { type: name, target: this, preventDefault() {}, stopPropagation() { this.stopped = true; }, ...data };
    for (let surface = this; surface; surface = event.stopped ? null : surface.parent) {
      for (const callback of surface.listeners.get(name) || []) callback(event);
    }
  }
  querySelector() { return this.knob; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  closest() { return this.ui ? this : null; }
  setPointerCapture(id) { this.captured.add(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

function fixture(getBlock = (x, y) => y < 1 ? 1 : 0, getWaterLevel, options = {}) {
  const win = new Surface();
  win.matchMedia = () => ({ matches: false });
  win.innerWidth = options.width ?? 1280;
  const doc = new Surface();
  doc.defaultView = win;
  const controls = Object.fromEntries(['move-stick', 'jump-button', 'break-button', 'place-button']
    .map((id) => [id, new Surface()]));
  doc.querySelector = (selector) => selector.startsWith('dialog[open]') ? (doc.modalOpen ? {} : null) : controls[selector.slice(1)];
  for (const element of Object.values(controls)) { element.parent = doc; element.ui = true; }
  doc.pointerLockElement = null;
  doc.exitPointerLock = () => { doc.pointerLockElement = null; doc.dispatch('pointerlockchange'); };
  const canvas = new Surface();
  canvas.ownerDocument = doc;
  canvas.parent = doc;
  if (options.requestPointerLock) canvas.requestPointerLock = options.requestPointerLock;
  const camera = new THREE.PerspectiveCamera();
  const actions = [];
  const selections = [];
  let pauses = 0;
  const player = new Player(camera, canvas, { getBlock, getWaterLevel }, {
    onAction: (kind) => actions.push(kind),
    onSelect: (index) => selections.push(index),
    onPause: () => pauses++,
    slotCount: options.slotCount ?? 5,
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

test('movement, direct touch look and jump remain independent across three pointers', () => {
  const f = fixture();
  f.tick(0.4);
  f.controls['move-stick'].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 18 });
  assert.equal(f.player._drag, null, 'movement joystick never starts camera dragging');
  f.canvas.dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0, clientX: 450, clientY: 200 });
  f.win.dispatch('pointermove', { pointerId: 2, clientX: 550, clientY: 210 });
  assert.ok(f.player.yaw < -0.2);
  assert.equal(f.camera.rotation.y, f.player.yaw, 'camera responds before another animation frame');
  f.controls['jump-button'].dispatch('pointerdown', { pointerId: 3, pointerType: 'touch' });
  f.tick(0.1);
  assert.ok(f.player.position.z < 0.5);
  assert.ok(f.player.position.y > 1.5);
  const yaw = f.player.yaw;
  const pitch = f.player.pitch;
  f.win.dispatch('pointerup', { pointerId: 2 });
  f.tick(0.1);
  assert.ok(Math.abs(f.player.yaw - yaw) < 1e-12, 'look has no yaw inertia');
  assert.equal(f.player.pitch, pitch, 'look has no pitch inertia');
  assert.equal(f.player._moveStick.y, -1);
  assert.equal(f.player._touchJump, true);
  f.win.dispatch('pointercancel', { pointerId: 1 });
  assert.equal(f.player._moveStick.y, 0);
  assert.equal(f.player._touchJump, true);
  f.win.dispatch('pointerup', { pointerId: 3 });
  assert.equal(f.player._touchJump, false);
  assert.deepEqual(f.actions, [], 'touch look never mines a block');
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
  f.doc.dispatch('keydown', { code: 'Digit5' });
  f.doc.dispatch('keydown', { code: 'Digit9' });
  f.canvas.dispatch('wheel', { deltaY: 30, timeStamp: 1000 });
  assert.deepEqual(f.selections, [4, 0]);
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

test('touch camera drag applies the first small delta anywhere outside UI and cancels cleanly', () => {
  const f = fixture();
  const overlay = new Surface();
  overlay.parent = f.doc;
  overlay.dispatch('pointerdown', { pointerId: 8, pointerType: 'touch', button: 0, clientX: 80, clientY: 120 });
  f.win.dispatch('pointermove', { pointerId: 8, clientX: 81, clientY: 122 });
  assert.equal(f.player.yaw, -.0022);
  assert.equal(f.player.pitch, -.0044);
  assert.equal(f.camera.rotation.y, -.0022);
  f.canvas.dispatch('lostpointercapture', { pointerId: 8 });
  f.win.dispatch('pointermove', { pointerId: 8, clientX: 180, clientY: 220 });
  assert.equal(f.player.yaw, -.0022);
  assert.equal(f.player._drag, null);
  assert.deepEqual(f.actions, []);
});

test('UI presses and open settings never become camera drags, movement or attacks', () => {
  const f = fixture();
  const map = new Surface();
  map.parent = f.doc;
  map.ui = true;
  map.dispatch('pointerdown', { pointerId: 8, pointerType: 'touch', button: 0, clientX: 80, clientY: 120 });
  f.win.dispatch('pointermove', { pointerId: 8, clientX: 180, clientY: 220 });
  assert.equal(f.player._drag, null);
  assert.equal(f.player.yaw, 0);
  f.doc.modalOpen = true;
  f.canvas.dispatch('pointerdown', { pointerId: 9, pointerType: 'touch', button: 0, clientX: 0, clientY: 0 });
  f.controls['move-stick'].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 18 });
  f.controls['break-button'].dispatch('pointerdown', { pointerId: 2, pointerType: 'touch' });
  f.doc.dispatch('keydown', { code: 'KeyW' });
  assert.equal(f.player._drag, null);
  assert.equal(f.player._moveStick.y, 0);
  assert.equal(f.player.keys.size, 0);
  assert.deepEqual(f.actions, []);
  f.player.update(1 / 60);
  assert.equal(f.player.enabled, false);
  assert.equal(f.pauses, 1);
});

test('narrow desktop view uses direct drag and action buttons without requesting pointer lock', () => {
  let requests = 0;
  const f = fixture(undefined, undefined, { width: 390, requestPointerLock: () => { requests++; } });
  assert.equal(requests, 0);
  f.canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 120, clientY: 200 });
  f.win.dispatch('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 121, clientY: 200 });
  assert.equal(f.player.yaw, -.0022);
  f.win.dispatch('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0 });
  assert.deepEqual(f.actions, []);
  f.controls['break-button'].dispatch('pointerdown', { pointerId: 2, pointerType: 'mouse', button: 0 });
  assert.deepEqual(f.actions, ['break'], 'explicit action buttons respond even during launch-click suppression');
  assert.ok(f.controls['break-button'].classes.has('is-pressed'));
  f.tick(.5);
  assert.deepEqual(f.actions, ['break', 'break', 'break']);
  f.win.dispatch('pointercancel', { pointerId: 2, pointerType: 'mouse', button: -1 });
  assert.ok(!f.controls['break-button'].classes.has('is-pressed'));
  f.tick(.5);
  assert.equal(f.actions.length, 3);
});

test('recenter levels pitch and roll immediately while preserving heading and movement', () => {
  const f = fixture();
  f.player.yaw = 1.234;
  f.player.pitch = -.8;
  f.camera.rotation.set(-.8, 1.234, .3, 'YXZ');
  f.player.keys.add('KeyW');
  f.player.recenter();
  assert.equal(f.player.yaw, 1.234);
  assert.equal(f.player.pitch, 0);
  assert.equal(f.camera.rotation.y, 1.234);
  assert.equal(f.camera.rotation.x, 0);
  assert.equal(f.camera.rotation.z, 0);
  assert.ok(f.player.keys.has('KeyW'));
});

test('slot count controls number keys, bounds and bidirectional wheel wrapping', () => {
  const f = fixture(undefined, undefined, { slotCount: 3 });
  f.doc.dispatch('keydown', { code: 'Digit3' });
  f.doc.dispatch('keydown', { code: 'Digit4' });
  f.canvas.dispatch('wheel', { deltaY: 20, timeStamp: 1000 });
  f.canvas.dispatch('wheel', { deltaY: -20, timeStamp: 1100 });
  assert.deepEqual(f.selections, [2, 0, 2]);
  f.player.select(50);
  assert.equal(f.player.selected, 2);
  f.player.select(-10);
  assert.equal(f.player.selected, 0);
  f.player.select(NaN);
  assert.equal(f.player.selected, 0);
});

test('pause releases every held pointer and no look or action survives re-enabling', () => {
  const f = fixture();
  f.controls['move-stick'].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 18 });
  f.canvas.dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0, clientX: 80, clientY: 120 });
  f.controls['place-button'].dispatch('pointerdown', { pointerId: 3, pointerType: 'touch' });
  f.win.dispatch('blur');
  assert.equal(f.player.enabled, false);
  assert.equal(f.player._moveStick.y, 0);
  assert.equal(f.player._drag, null);
  assert.equal(f.canvas.captured.size, 0);
  assert.equal(f.player._actions.size, 0);
  assert.ok(!f.controls['place-button'].classes.has('is-pressed'));
  f.player.enable();
  const yaw = f.player.yaw;
  f.win.dispatch('pointermove', { pointerId: 2, clientX: 800, clientY: 120 });
  f.tick(.5);
  assert.equal(f.player.yaw, yaw);
  assert.deepEqual(f.actions, ['place']);
});

test('a cancelled locked pointer stops its held action even without a button number', () => {
  const f = fixture();
  f.doc.pointerLockElement = f.canvas;
  f.doc.dispatch('pointerlockchange');
  f.tick(.3);
  f.canvas.dispatch('pointerdown', { pointerId: 5, pointerType: 'mouse', button: 0 });
  f.win.dispatch('pointercancel', { pointerId: 5, pointerType: 'mouse', button: -1 });
  f.tick(.5);
  assert.deepEqual(f.actions, ['break']);
});

test('a swim-up tap released before the next frame creates a short stroke, not a lost input or a held ascent', () => {
  const water = (x, y) => y < 1 ? 1 : y < 8 ? 7 : 0;
  const idle = fixture(water);
  const tapped = fixture(water);
  const held = fixture(water);
  for (const f of [idle, tapped, held]) { f.player.teleport(.5, 1, .5); f.tick(.3); }
  tapped.controls['jump-button'].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch' });
  tapped.win.dispatch('pointerup', { pointerId: 1, pointerType: 'touch' });
  held.controls['jump-button'].dispatch('pointerdown', { pointerId: 2, pointerType: 'touch' });
  assert.equal(tapped.player._touchJump, false, 'the complete tap happened before any physics update');
  for (const f of [idle, tapped, held]) f.tick(.12);
  assert.ok(tapped.player.position.y > idle.player.position.y + .05, 'buffered tap visibly lifts the player from the pond floor');
  assert.ok(tapped.player.velocity.y > 0);
  for (const f of [idle, tapped, held]) f.tick(.7);
  assert.ok(held.player.position.y > tapped.player.position.y + .7, 'holding still sustains swimming after the tap stroke ends');
  assert.equal(tapped.player._jumpBuffer, 0);
  assert.ok(tapped.player.velocity.y <= 0, 'a released tap does not keep accelerating upward');
  tapped.tick(1);
  assert.ok(Math.abs(tapped.player.position.y - 1) < .0001);
  for (const f of [idle, tapped, held]) f.player.dispose();
});
