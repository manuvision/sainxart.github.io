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
  const controls = Object.fromEntries(['move-stick', 'jump-button', 'descend-button', 'break-button', 'place-button']
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
  const actionCalls = [];
  const selections = [];
  const flightChanges = [];
  let pauses = 0;
  const player = new Player(camera, canvas, { getBlock, getWaterLevel }, {
    onAction: (...args) => { actions.push(args[0]); actionCalls.push(args); },
    onSelect: (index) => selections.push(index),
    onPause: () => pauses++,
    onFlightChange: (flying) => flightChanges.push(flying),
    slotCount: options.slotCount ?? 5,
  });
  player.teleport(0.5, 1.06, 0.5);
  player.enable();
  const tick = (seconds, dt = 1 / 60) => {
    for (let time = 0; time < seconds; time += dt) player.update(dt);
  };
  return { player, camera, canvas, controls, doc, win, actions, actionCalls, selections, flightChanges, tick, get pauses() { return pauses; } };
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
  f.player.teleport(0.5, 3.874 - f.player.eyeHeight, 0.5);
  assert.equal(f.player.underwater, true);
  f.player.teleport(0.5, 3.876 - f.player.eyeHeight, 0.5);
  assert.equal(f.player.underwater, false);
  assert.equal(f.player.inWater, true);
});

test('shallow flowing water uses its actual level for feet and eye samples', () => {
  const f = fixture((x, y) => y < 1 ? 1 : y === 1 ? 7 : 0, () => 1);
  const surface = 1 + 1 / 8;
  f.player.teleport(0.5, .90, 0.5);
  assert.equal(f.player.inWater, true);
  f.player.teleport(0.5, 1.10, 0.5);
  assert.equal(f.player.inWater, false);
  f.player.teleport(0.5, surface - f.player.eyeHeight - 0.001, 0.5);
  assert.equal(f.player.underwater, true);
  f.player.teleport(0.5, surface - f.player.eyeHeight + 0.001, 0.5);
  assert.equal(f.player.underwater, false);
});

test('falling water fills the last eighth of its voxel for underwater detection', () => {
  const water = (x, y) => y < 1 ? 1 : y === 3 ? 7 : 0;
  const falling = fixture(water, () => 9);
  const source = fixture(water, () => 8);
  for (const f of [falling, source]) f.player.teleport(.5, 3.95 - f.player.eyeHeight, .5);
  assert.equal(falling.player.underwater, true, 'a falling cell is full up to y=4');
  assert.equal(source.player.underwater, false, 'an exposed source ends at y=3.875');
  falling.player.teleport(.5, 3.999 - falling.player.eyeHeight, .5);
  assert.equal(falling.player.underwater, true);
  falling.player.teleport(.5, 4.001 - falling.player.eyeHeight, .5);
  assert.equal(falling.player.underwater, false, 'falling water does not extend into the air cell above');
  for (const f of [falling, source]) f.player.dispose();
});

test('swimming receives buoyancy in the full-height falling-water lip, but not above a source surface', () => {
  const water = (x, y) => y < 1 ? 1 : y === 3 ? 7 : 0;
  const falling = fixture(water, () => 9);
  const source = fixture(water, () => 8);
  for (const f of [falling, source]) {
    // The body sample is at 3.975: wet in falling water, dry above a source.
    f.player.teleport(.5, 3.075, .5);
    f.doc.dispatch('keydown', { code: 'Space' });
    f.player.update(1 / 120);
  }
  assert.ok(falling.player.velocity.y > 0, 'swim-up accelerates inside the falling column');
  assert.ok(falling.player.position.y > 3.075);
  assert.ok(source.player.velocity.y < 0, 'the dry body sample receives gravity instead of swim acceleration');
  assert.ok(source.player.position.y < 3.075);
  falling.player.teleport(.5, 4.1, .5);
  falling.player.update(1 / 120);
  assert.ok(falling.player.velocity.y < 0, 'holding swim-up does not grant buoyancy after leaving the falling column');
  for (const f of [falling, source]) f.player.dispose();
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
  assert.deepEqual(f.actionCalls, [['break'], ['break', { repeat: true }], ['break', { repeat: true }]]);
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
  assert.deepEqual(f.actionCalls, [['break'], ['place']], 'fresh desktop presses do not receive repeat metadata');
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
  assert.deepEqual(f.actionCalls, [['break'], ['place']], 'fallback clicks and fresh touch presses are initial actions');
  f.player.dispose();
});

test('held touch break and place report repeat metadata, and a fresh press starts without it', () => {
  for (const kind of ['break', 'place']) {
    const f = fixture();
    f.controls[`${kind}-button`].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0 });
    assert.deepEqual(f.actionCalls, [[kind]], 'the immediate press callback has no second argument');
    f.tick(.6);
    assert.ok(f.actionCalls.length >= 3);
    for (const call of f.actionCalls.slice(1)) assert.deepEqual(call, [kind, { repeat: true }]);
    f.win.dispatch('pointercancel', { pointerId: 1, pointerType: 'touch', button: -1 });
    const releasedCount = f.actionCalls.length;
    f.tick(.5);
    assert.equal(f.actionCalls.length, releasedCount, 'cancelled fingers leave no repeat behind');
    f.controls[`${kind}-button`].dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0 });
    assert.deepEqual(f.actionCalls.at(-1), [kind], 're-pressing starts a new action, not another repeat');
    f.player.dispose();
  }
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


test('two distinct Space presses within 300 ms toggle flight on and off between frames', () => {
  const f = fixture();
  const press = timeStamp => f.doc.dispatch('keydown', { code: 'Space', timeStamp });
  const release = () => f.doc.dispatch('keyup', { code: 'Space' });
  press(0);
  release();
  press(250);
  assert.equal(f.player.flying, true);
  assert.equal(f.player._jumpBuffer, 0, 'the entry tap does not leave a walking jump queued');
  release();
  f.player.teleport(.5, 5, .5);
  press(1000);
  release();
  press(1300);
  assert.equal(f.player.flying, false, 'the 300 ms edge remains inside the double-tap window');
  assert.deepEqual(f.flightChanges, [true, false]);
  release();
  f.player.update(.1);
  assert.ok(f.player.position.y < 5, 'gravity resumes after flight is disabled');
  f.player.dispose();
});

test('slow taps, duplicate keydowns and OS repeats cannot toggle flight', () => {
  const f = fixture();
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1000 });
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1100, repeat: true });
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1200 });
  assert.equal(f.player.flying, false, 'the key must be released before another press counts');
  f.doc.dispatch('keyup', { code: 'Space' });
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1301 });
  assert.equal(f.player.flying, false, '301 ms is outside the double-tap window');
  f.doc.dispatch('keyup', { code: 'Space' });
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1550 });
  assert.equal(f.player.flying, true, 'a later valid pair still works');
  f.player.dispose();
});

test('flight holds altitude, rises and descends, and stops instantly on release', () => {
  const f = fixture();
  f.player.teleport(.5, 8, .5);
  f.player.setFlying(true);
  f.tick(3);
  assert.equal(f.player.position.y, 8);
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1000 });
  f.tick(.5);
  assert.ok(f.player.position.y > 10.5);
  f.doc.dispatch('keyup', { code: 'Space' });
  const high = f.player.position.clone();
  f.tick(1);
  assert.deepEqual(f.player.position.toArray(), high.toArray(), 'released input has no flight drift');
  assert.equal(f.player.velocity.y, 0);
  f.doc.dispatch('keydown', { code: 'KeyC' });
  f.tick(.3);
  assert.ok(f.player.position.y < high.y - 1.5);
  f.doc.dispatch('keyup', { code: 'KeyC' });
  f.doc.dispatch('keydown', { code: 'ControlRight' });
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 3000 });
  const balanced = f.player.position.y;
  f.tick(.2);
  assert.equal(f.player.position.y, balanced, 'simultaneous up and down cancel');
  assert.equal(f.camera.position.y, f.player.position.y + f.player.eyeHeight);
  f.player.dispose();
});

test('flying follows heading, normalizes diagonal movement and supports Shift sprint', () => {
  const straight = fixture(), diagonal = fixture();
  for (const f of [straight, diagonal]) {
    f.player.teleport(.5, 6, .5);
    f.player.yaw = Math.PI / 2;
    f.player.setFlying(true);
    f.doc.dispatch('keydown', { code: 'KeyW' });
  }
  diagonal.doc.dispatch('keydown', { code: 'KeyD' });
  for (const f of [straight, diagonal]) f.player.update(.1);
  assert.ok(straight.player.position.x < .5, 'forward follows the current compass heading');
  assert.ok(Math.abs(Math.hypot(straight.player.velocity.x, straight.player.velocity.z) - Math.hypot(diagonal.player.velocity.x, diagonal.player.velocity.z)) < 1e-9);
  const normalSpeed = straight.player.velocity.length();
  straight.doc.dispatch('keydown', { code: 'ShiftLeft' });
  straight.player.update(.1);
  assert.ok(straight.player.velocity.length() > normalSpeed * 1.5);
  straight.doc.dispatch('keyup', { code: 'KeyW' });
  straight.player.update(.1);
  assert.equal(straight.player.velocity.length(), 0);
  for (const f of [straight, diagonal]) f.player.dispose();
});

test('flight cannot cross ceilings, floors or walls even while sprinting through long frames', () => {
  const f = fixture((x, y, z) => y < 1 || y === 8 || z === -3 ? 1 : 0);
  f.player.teleport(.5, 5, .5);
  f.player.setFlying(true);
  f.doc.dispatch('keydown', { code: 'Space' });
  f.doc.dispatch('keydown', { code: 'ShiftLeft' });
  f.doc.dispatch('keydown', { code: 'KeyW' });
  f.tick(3, .1);
  assert.ok(f.player.position.y + f.player.height <= 8.0001, 'ceiling blocks ascent');
  assert.ok(f.player.position.z >= -2 + f.player.radius - .0001, 'wall blocks forward flight');
  f.doc.dispatch('keydown', { code: 'KeyD' });
  const x = f.player.position.x;
  f.tick(.5, .1);
  assert.ok(f.player.position.x > x + 2, 'flight slides along the wall');
  f.doc.dispatch('keyup', { code: 'Space' });
  f.doc.dispatch('keydown', { code: 'ControlLeft' });
  f.tick(3, .1);
  assert.equal(f.player.position.y, 1, 'floor blocks descent');
  assert.equal(f.player.flying, true, 'contact does not silently disable creative flight');
  f.player.dispose();
});

test('flight remains buoyancy-independent inside water and hovers after swimming upward', () => {
  const f = fixture((x, y) => y < 1 ? 1 : y < 8 ? 7 : 0);
  f.player.teleport(.5, 3, .5);
  f.player.setFlying(true);
  f.tick(2);
  assert.equal(f.player.position.y, 3);
  assert.equal(f.player.underwater, true);
  f.doc.dispatch('keydown', { code: 'Space' });
  f.tick(1);
  assert.ok(f.player.position.y > 8);
  assert.equal(f.player.inWater, false);
  f.doc.dispatch('keyup', { code: 'Space' });
  const y = f.player.position.y;
  f.tick(1);
  assert.equal(f.player.position.y, y);
  f.player.dispose();
});

test('mobile double-tap flight keeps movement, camera drag and descent on independent pointers', () => {
  const f = fixture(undefined, undefined, { width: 390 });
  f.player.teleport(.5, 5, .5);
  const jump = f.controls['jump-button'], down = f.controls['descend-button'];
  f.controls['move-stick'].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 18 });
  f.canvas.dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0, clientX: 200, clientY: 200 });
  jump.dispatch('pointerdown', { pointerId: 3, pointerType: 'touch', timeStamp: 1000 });
  jump.dispatch('pointerdown', { pointerId: 4, pointerType: 'touch', timeStamp: 1100 });
  assert.equal(f.player.flying, false, 'a second finger on an already held button is not a double-tap');
  f.win.dispatch('pointerup', { pointerId: 3 });
  jump.dispatch('pointerdown', { pointerId: 4, pointerType: 'touch', timeStamp: 1200 });
  assert.equal(f.player.flying, true);
  f.win.dispatch('pointermove', { pointerId: 2, clientX: 220, clientY: 190 });
  f.player.update(.1);
  assert.ok(f.player.position.y > 5.5, 'holding the second tap ascends');
  assert.ok(f.player.position.z < .5);
  assert.ok(f.player.yaw < 0);
  f.win.dispatch('pointerup', { pointerId: 4 });
  down.dispatch('pointerdown', { pointerId: 5, pointerType: 'touch' });
  const y = f.player.position.y;
  f.player.update(.1);
  assert.ok(f.player.position.y < y - .5);
  assert.equal(f.player._moveStick.y, -1);
  assert.equal(f.player._drag.id, 2);
  f.win.dispatch('pointercancel', { pointerId: 5 });
  assert.equal(f.player._touchDescend, false);
  assert.ok(!down.classes.has('is-pressed'));
  const stopY = f.player.position.y;
  f.player.update(.1);
  assert.equal(f.player.position.y, stopY);
  assert.deepEqual(f.actions, []);
  f.player.dispose();
});

test('pause retains flight but releases held controls and cancels the double-tap sequence', () => {
  const f = fixture();
  f.player.teleport(.5, 5, .5);
  f.player.setFlying(true);
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1000 });
  f.controls['descend-button'].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch' });
  f.controls['move-stick'].dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 50, clientY: 18 });
  f.win.dispatch('blur');
  assert.equal(f.player.flying, true);
  assert.equal(f.player._touchDescend, false);
  assert.equal(f.player._touchJump, false);
  assert.equal(f.player.keys.size, 0);
  assert.equal(f.controls['descend-button'].captured.size, 0);
  f.player.enable();
  f.doc.dispatch('keydown', { code: 'Space', repeat: true, timeStamp: 1100 });
  f.tick(.2);
  assert.equal(f.player.position.y, 5, 'a stale OS repeat after resuming cannot restart ascent');
  f.doc.dispatch('keyup', { code: 'Space' });
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1200 });
  assert.equal(f.player.flying, true, 'pre-pause tap cannot combine with post-pause tap');
  f.doc.dispatch('keyup', { code: 'Space' });
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 1400 });
  assert.equal(f.player.flying, false);
  f.player.dispose();
});

test('leaving flight releases descent capture and ordinary walking ignores the hidden down control', () => {
  const f = fixture();
  const down = f.controls['descend-button'];
  down.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch' });
  assert.equal(down.captured.size, 0);
  assert.equal(f.player._touchDescend, false);
  f.player.setFlying(true);
  down.dispatch('pointerdown', { pointerId: 2, pointerType: 'touch' });
  assert.equal(f.player._touchDescend, true);
  f.player.setFlying(false);
  assert.equal(f.player._touchDescend, false);
  assert.equal(down.captured.size, 0);
  assert.ok(!down.classes.has('is-pressed'));
  f.player.dispose();
});

test('flight taps completed between frames produce short up or down strokes, then hover', () => {
  const inputs = [
    { button: 'jump-button', direction: 1 },
    { code: 'Space', direction: 1 },
    { button: 'descend-button', direction: -1 },
    { code: 'ControlLeft', direction: -1 },
    { code: 'ControlRight', direction: -1 },
    { code: 'KeyC', direction: -1 },
  ];
  for (const input of inputs) {
    const f = fixture();
    f.player.teleport(.5, 8, .5);
    f.player.setFlying(true);
    if (input.button) {
      f.controls[input.button].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', timeStamp: 1000 });
      f.win.dispatch('pointerup', { pointerId: 1 });
    } else {
      f.doc.dispatch('keydown', { code: input.code, timeStamp: 1000 });
      f.doc.dispatch('keyup', { code: input.code });
    }
    assert.equal(f.player._touchJump || f.player._touchDescend || f.player.keys.size > 0, false, 'the complete tap precedes every physics update');
    f.tick(.2);
    const distance = (f.player.position.y - 8) * input.direction;
    assert.ok(Math.abs(distance - .66) < .001, `${input.button || input.code} produces a 120 ms stroke, moved ${distance}`);
    const y = f.player.position.y;
    f.tick(1);
    assert.equal(f.player.position.y, y, 'a tap finishes with no vertical drift');
    assert.equal(f.player.velocity.y, 0);
    assert.equal(f.player.flying, true);
    f.player.dispose();
  }
});

test('a fast double-tap enters flight with an upward stroke and toggling off clears both pending strokes', () => {
  const f = fixture();
  f.player.teleport(.5, 8, .5);
  for (const timeStamp of [1000, 1200]) {
    f.doc.dispatch('keydown', { code: 'Space', timeStamp });
    f.doc.dispatch('keyup', { code: 'Space' });
  }
  assert.equal(f.player.flying, true);
  f.tick(.2);
  assert.ok(f.player.position.y > 8.6, 'the toggle tap remains visible even when released before the next frame');
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 2000 });
  f.doc.dispatch('keyup', { code: 'Space' });
  f.controls['descend-button'].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch' });
  f.win.dispatch('pointerup', { pointerId: 1 });
  assert.ok(f.player._flightUpBuffer > 0 && f.player._flightDownBuffer > 0);
  f.doc.dispatch('keydown', { code: 'Space', timeStamp: 2250 });
  f.doc.dispatch('keyup', { code: 'Space' });
  assert.equal(f.player.flying, false);
  assert.equal(f.player._flightUpBuffer, 0);
  assert.equal(f.player._flightDownBuffer, 0);
  f.player.dispose();
});

test('pause and pointer cancellation discard unobserved flight taps instead of resuming stale strokes', () => {
  for (const button of ['jump-button', 'descend-button']) {
    const f = fixture();
    f.player.teleport(.5, 8, .5);
    f.player.setFlying(true);
    f.controls[button].dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', timeStamp: 1000 });
    f.win.dispatch('pointercancel', { pointerId: 1 });
    f.tick(.2);
    assert.equal(f.player.position.y, 8, 'cancelled touch never becomes a stroke');
    f.controls[button].dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', timeStamp: 2000 });
    f.win.dispatch('pointerup', { pointerId: 2 });
    f.win.dispatch('blur');
    assert.equal(f.player._flightUpBuffer, 0);
    assert.equal(f.player._flightDownBuffer, 0);
    f.player.enable();
    f.tick(.2);
    assert.equal(f.player.position.y, 8, 'pause drops pending taps while preserving hover mode');
    assert.equal(f.player.flying, true);
    f.player.dispose();
  }
});
