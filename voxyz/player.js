import * as THREE from './vendor/three.module.js';

const HALF_WIDTH = 0.29;
const BODY_HEIGHT = 1.78;
const EYE_HEIGHT = 1.62;
const EPSILON = 0.0001;
const JUMP_SPEED = 7.8;
const MAX_PITCH = Math.PI / 2 - 0.035;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** First-person controller. Position is the center of the player's feet. */
export class Player {
  constructor(camera, canvas, world, { onAction = () => {}, onSelect = () => {}, onPause = () => {} } = {}) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.onAction = onAction;
    this.onSelect = onSelect;
    this.onPause = onPause;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = camera.rotation.y;
    this.pitch = camera.rotation.x;
    this.enabled = false;
    this.inWater = false;
    this.underwater = false;
    this.grounded = false;
    this.moving = false;
    this.sprinting = false;
    this.selected = 0;
    this.height = BODY_HEIGHT;
    this.radius = HALF_WIDTH;
    this.eyeHeight = EYE_HEIGHT;
    this.keys = new Set();
    this._document = canvas.ownerDocument || document;
    this._window = this._document.defaultView || window;
    this._touchDevice = this._window.matchMedia?.('(pointer: coarse)').matches || false;
    this._listeners = [];
    this._controlResets = [];
    this._moveStick = { x: 0, y: 0 };
    this._lookStick = { x: 0, y: 0 };
    this._touchJump = false;
    this._touchSprint = false;
    this._actions = new Map();
    this._jumpBuffer = 0;
    this._coyoteTime = 0;
    this._hadPointerLock = false;
    this._drag = null;
    this._wheelTime = -Infinity;
    this._actionDelay = 0;
    this._bindInputs();
  }

  _listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this._listeners.push(() => target.removeEventListener(type, listener, options));
  }

  _isInput(target) {
    return target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '');
  }

  _bindInputs() {
    const doc = this._document;
    const win = this._window;
    this._listen(doc, 'keydown', (event) => {
      if (!this.enabled || this._isInput(event.target)) return;
      if (event.code === 'Escape') {
        event.preventDefault();
        this._pause();
        return;
      }
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
      if (event.code === 'Space' && !this.keys.has('Space')) this._jumpBuffer = 0.16;
      this.keys.add(event.code);
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
      if (digit && !event.repeat) this.select(Number(digit[1]) - 1);
    });
    this._listen(doc, 'keyup', (event) => this.keys.delete(event.code));
    this._listen(doc, 'pointerlockchange', () => {
      const locked = doc.pointerLockElement === this.canvas;
      if (locked) {
        if (!this.enabled) { doc.exitPointerLock?.(); return; }
        this._hadPointerLock = true;
        this._drag = null;
        this._actions.clear();
      } else if (this.enabled && this._hadPointerLock) {
        this._pause();
      }
    });
    // Failure is a supported drag-look mode, not a pause or a game error.
    this._listen(doc, 'pointerlockerror', () => {
      if (doc.pointerLockElement !== this.canvas) this._hadPointerLock = false;
    });
    this._listen(doc, 'mousemove', (event) => {
      if (this.enabled && doc.pointerLockElement === this.canvas) {
        this._look(event.movementX, event.movementY);
      }
    });
    this._listen(this.canvas, 'contextmenu', (event) => event.preventDefault());
    this._listen(this.canvas, 'pointerdown', (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      const locked = doc.pointerLockElement === this.canvas;
      if (locked && (event.button === 0 || event.button === 2)) {
        this._startAction(`mouse:${event.button}`, event.button === 0 ? 'break' : 'place');
      } else if (event.button === 2 && event.pointerType !== 'touch') {
        this._startAction(`mouse:${event.button}`, 'place');
      } else if (!this._drag && (event.button === 0 || event.pointerType === 'touch')) {
        // An un-dragged click breaks; dragging looks without excavating a trail.
        this._drag = {
          id: event.pointerId, x: event.clientX, y: event.clientY,
          distance: 0, moved: false, touch: event.pointerType === 'touch',
        };
        try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Older browser. */ }
      }
    });
    this._listen(win, 'pointermove', (event) => {
      const drag = this._drag;
      if (!this.enabled || !drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.distance += Math.abs(dx) + Math.abs(dy);
      if (drag.distance > 5) drag.moved = true;
      if (drag.moved) this._look(dx, dy);
    });
    const releasePointer = (event) => {
      this._actions.delete(`mouse:${event.button}`);
      const drag = this._drag;
      if (drag && event.pointerId === drag.id) {
        if (event.type === 'pointerup' && !drag.moved && !drag.touch && this.enabled && this._actionDelay <= 0) {
          this.onAction('break');
        }
        this._drag = null;
        try { this.canvas.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
      }
    };
    this._listen(win, 'pointerup', releasePointer);
    this._listen(win, 'pointercancel', releasePointer);
    this._listen(this.canvas, 'wheel', (event) => {
      if (!this.enabled || Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      const time = event.timeStamp;
      if (time - this._wheelTime < 75) return;
      this._wheelTime = time;
      this.select((this.selected + Math.sign(event.deltaY) + 9) % 9);
    }, { passive: false });
    this._listen(win, 'blur', () => { if (this.enabled) this._pause(); });
    this._listen(doc, 'visibilitychange', () => { if (doc.hidden && this.enabled) this._pause(); });

    this._bindStick('#move-stick', this._moveStick);
    this._bindStick('#look-stick', this._lookStick);
    this._bindButton('#jump-button', (held) => {
      this._touchJump = held;
      if (held) this._jumpBuffer = 0.16;
    });
    this._bindButton('#sprint-button', (held) => { this._touchSprint = held; });
    this._bindButton('#break-button', (held) => {
      if (held) this._startAction('touch:break', 'break');
      else this._actions.delete('touch:break');
    });
    this._bindButton('#place-button', (held) => {
      if (held) this._startAction('touch:place', 'place');
      else this._actions.delete('touch:place');
    });
  }

  _bindStick(selector, value) {
    const element = this._document.querySelector(selector);
    if (!element) return;
    const knob = element.querySelector('.stick-knob');
    let pointerId = null;
    const reset = () => {
      const previous = pointerId;
      pointerId = null;
      value.x = value.y = 0;
      if (knob) knob.style.translate = '0px 0px';
      element.classList.remove('active');
      if (previous !== null) {
        try { element.releasePointerCapture(previous); } catch { /* Not captured. */ }
      }
    };
    const move = (event) => {
      if (pointerId !== event.pointerId) return;
      const rect = element.getBoundingClientRect();
      const radius = Math.max(20, Math.min(rect.width, rect.height) * 0.32);
      let x = (event.clientX - rect.left - rect.width / 2) / radius;
      let y = (event.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      if (knob) knob.style.translate = `${x * radius}px ${y * radius}px`;
      const magnitude = Math.min(length, 1);
      const filtered = magnitude < 0.12 ? 0 : (magnitude - 0.12) / 0.88;
      value.x = magnitude > 0 ? x / magnitude * filtered : 0;
      value.y = magnitude > 0 ? y / magnitude * filtered : 0;
    };
    element.style.touchAction = 'none';
    this._listen(element, 'pointerdown', (event) => {
      if (!this.enabled || pointerId !== null) return;
      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      element.classList.add('active');
      try { element.setPointerCapture(pointerId); } catch { /* Window listeners remain active. */ }
      move(event);
    });
    this._listen(this._window, 'pointermove', move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this._listen(type === 'lostpointercapture' ? element : this._window, type, (event) => {
        if (event.pointerId === pointerId) reset();
      });
    }
    this._controlResets.push(reset);
  }

  _bindButton(selector, setHeld) {
    const element = this._document.querySelector(selector);
    if (!element) return;
    let pointerId = null;
    const reset = () => {
      const previous = pointerId;
      pointerId = null;
      element.classList.remove('active');
      setHeld(false);
      if (previous !== null) {
        try { element.releasePointerCapture(previous); } catch { /* Already released. */ }
      }
    };
    element.style.touchAction = 'none';
    this._listen(element, 'pointerdown', (event) => {
      if (!this.enabled || pointerId !== null) return;
      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      element.classList.add('active');
      try { element.setPointerCapture(pointerId); } catch { /* Window listeners remain active. */ }
      setHeld(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this._listen(type === 'lostpointercapture' ? element : this._window, type, (event) => {
        if (event.pointerId === pointerId) reset();
      });
    }
    this._listen(element, 'contextmenu', (event) => event.preventDefault());
    this._controlResets.push(reset);
  }

  _startAction(key, kind) {
    // Enabling the game on a click must never consume that click as an attack.
    if (this._actionDelay > 0) return;
    this.onAction(kind);
    this._actions.set(key, { kind, remaining: kind === 'break' ? 0.21 : 0.25 });
  }

  _look(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.yaw -= dx * 0.0022;
    this.pitch = clamp(this.pitch - dy * 0.0022, -MAX_PITCH, MAX_PITCH);
  }

  select(index) {
    const next = clamp(Math.floor(index), 0, 8);
    if (!Number.isFinite(next)) return;
    this.selected = next;
    this.onSelect(next);
  }

  enable() {
    this.enabled = true;
    this._actionDelay = 0.22;
    this._hadPointerLock = this._document.pointerLockElement === this.canvas;
    this.keys.clear();
    this._actions.clear();
    this._drag = null;
    // Touch and environments without pointer lock use the same movement engine.
    if (!this._touchDevice && !this._hadPointerLock && this.canvas.requestPointerLock) {
      try {
        const result = this.canvas.requestPointerLock();
        result?.catch?.(() => { /* Drag-look remains available after rejection. */ });
      } catch { /* Safari, embedded browsers and denied permissions use drag-look. */ }
    }
  }

  disable() {
    this.enabled = false;
    this.moving = false;
    this.sprinting = false;
    this.velocity.set(0, 0, 0);
    this.keys.clear();
    this._actions.clear();
    this._drag = null;
    this._jumpBuffer = 0;
    this._hadPointerLock = false;
    for (const reset of this._controlResets) reset();
    if (this._document.pointerLockElement === this.canvas) this._document.exitPointerLock?.();
  }

  _pause() {
    if (!this.enabled) return;
    this.disable();
    this.onPause();
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this._coyoteTime = 0;
    this._jumpBuffer = 0;
    this._updateWater();
    this._updateCamera();
  }

  _block(x, y, z) {
    return this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  _solid(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    return id !== 0 && id !== 7 && id !== 10 && id != null;
  }

  /** Used by placement validation to avoid building a block inside the player. */
  intersectsBlock(x, y, z) {
    const p = this.position;
    return p.x + HALF_WIDTH > x && p.x - HALF_WIDTH < x + 1
      && p.y + BODY_HEIGHT > y && p.y < y + 1
      && p.z + HALF_WIDTH > z && p.z - HALF_WIDTH < z + 1;
  }

  _updateWater() {
    const p = this.position;
    const low = this._waterAt(p.x, p.y + 0.2, p.z);
    const mid = this._waterAt(p.x, p.y + 0.9, p.z);
    this.underwater = this._waterAt(p.x, p.y + EYE_HEIGHT, p.z);
    this.inWater = low || mid || this.underwater;
    this._waterFraction = (Number(low) + Number(mid) + Number(this.underwater)) / 3;
    this._swimming = mid;
  }

  _waterAt(x, y, z) {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    if (this.world.getBlock(bx, by, bz) !== 7) return false;
    // Match exposed source/flow geometry in mesher.js. Stacked water is full
    // height; mock worlds without fluid levels behave as full source blocks.
    const stacked = this.world.getBlock(bx, by + 1, bz) === 7;
    const level = this.world.getWaterLevel?.(bx, by, bz) || 8;
    const surface = by + (stacked ? 1 : 0.16 + 0.7 * (level / 8));
    return y < surface;
  }

  _moveAxis(axis, distance) {
    if (!distance) return false;
    const p = this.position;
    p[axis] += distance;
    const minX = Math.floor(p.x - HALF_WIDTH + EPSILON);
    const maxX = Math.floor(p.x + HALF_WIDTH - EPSILON);
    const minY = Math.floor(p.y + EPSILON);
    const maxY = Math.floor(p.y + BODY_HEIGHT - EPSILON);
    const minZ = Math.floor(p.z - HALF_WIDTH + EPSILON);
    const maxZ = Math.floor(p.z + HALF_WIDTH - EPSILON);
    let collided = false;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (!this._solid(x, y, z)) continue;
          collided = true;
          const coordinate = axis === 'x' ? x : axis === 'y' ? y : z;
          const extent = axis === 'y' ? (distance > 0 ? BODY_HEIGHT : 0) : HALF_WIDTH;
          const boundary = distance > 0 ? coordinate - extent : coordinate + 1 + extent;
          p[axis] = distance > 0 ? Math.min(p[axis], boundary) : Math.max(p[axis], boundary);
        }
      }
    }
    if (collided) this.velocity[axis] = 0;
    return collided;
  }

  update(dt) {
    if (!this.enabled || !Number.isFinite(dt) || dt <= 0) return;
    // Avoid tunnelling on a suspended tab, and cap work before the next draw.
    dt = Math.min(dt, 0.1);
    this._actionDelay = Math.max(0, this._actionDelay - dt);
    for (const action of this._actions.values()) {
      action.remaining -= dt;
      if (action.remaining <= 0) {
        this.onAction(action.kind);
        action.remaining += action.kind === 'break' ? 0.21 : 0.25;
      }
    }
    this.yaw -= this._lookStick.x * 2.4 * dt;
    this.pitch = clamp(this.pitch - this._lookStick.y * 2.0 * dt, -MAX_PITCH, MAX_PITCH);
    // Keep yaw small after long play sessions without changing its orientation.
    this.yaw = THREE.MathUtils.euclideanModulo(this.yaw + Math.PI, Math.PI * 2) - Math.PI;
    let sideways = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this._moveStick.x;
    let forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - this._moveStick.y;
    const inputLength = Math.hypot(sideways, forward);
    if (inputLength > 1) { sideways /= inputLength; forward /= inputLength; }
    this.sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this._touchSprint;
    const wantsUp = this.keys.has('Space') || this._touchJump;
    const wantsDown = this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyC');
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const directionX = sideways * cos - forward * sin;
    const directionZ = -sideways * sin - forward * cos;
    const steps = Math.ceil(dt / (1 / 120));
    const step = dt / steps;
    const startX = this.position.x;
    const startZ = this.position.z;

    for (let iteration = 0; iteration < steps; iteration++) {
      this._updateWater();
      this._coyoteTime = this.grounded ? 0.10 : Math.max(0, this._coyoteTime - step);
      this._jumpBuffer = Math.max(0, this._jumpBuffer - step);
      if (this._jumpBuffer > 0 && this._coyoteTime > 0 && !this._swimming) {
        this.velocity.y = JUMP_SPEED;
        this.grounded = false;
        this._coyoteTime = 0;
        this._jumpBuffer = 0;
      }
      const speed = this._swimming ? (this.sprinting ? 3.7 : 2.8) : (this.sprinting ? 6.5 : 4.3);
      const acceleration = this._swimming ? 6 : this.grounded ? 16 : 7;
      const damping = 1 - Math.exp(-acceleration * step);
      this.velocity.x += (directionX * speed - this.velocity.x) * damping;
      this.velocity.z += (directionZ * speed - this.velocity.z) * damping;
      if (this._swimming) {
        // Buoyancy is conditional on being in water: holding jump cannot fly.
        this.velocity.y -= 4.5 * step;
        if (wantsUp) this.velocity.y += 15.5 * step;
        if (wantsDown) this.velocity.y -= 7 * step;
        this.velocity.y *= Math.exp(-2.6 * step);
        this.velocity.y = clamp(this.velocity.y, -4, 3.6);
      } else {
        this.velocity.y = Math.max(-35, this.velocity.y - 24 * step);
      }
      const vy = this.velocity.y;
      // Each substep is shorter than a block at maximum speed, so an intervening
      // voxel cannot be skipped. Separate axes permit smooth sliding along walls.
      const yHit = this._moveAxis('y', vy * step);
      this.grounded = yHit && vy < 0;
      this._moveAxis('x', this.velocity.x * step);
      this._moveAxis('z', this.velocity.z * step);
    }
    this.moving = Math.hypot(this.position.x - startX, this.position.z - startZ) > dt * 0.15;
    this._updateWater();
    this._updateCamera();
  }

  _updateCamera() {
    this.camera.position.copy(this.position);
    this.camera.position.y += EYE_HEIGHT;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();
  }

  dispose() {
    this.disable();
    for (const remove of this._listeners) remove();
    this._listeners.length = 0;
  }
}

export default Player;
