const REPEATING_KEYS = new Set(['up', 'down', 'left', 'right', 'a']);

/** Shared physical-button lifecycle. Timer callbacks cannot outlive their hold. */
export class ButtonHolds {
  constructor({ send, changed = () => {}, canRepeat = () => true, clock = globalThis } = {}) {
    this.send = send; this.changed = changed; this.canRepeat = canRepeat; this.clock = clock;
    this.held = new Map();
  }
  hasKey(key) { return [...this.held.values()].some(hold => hold.key === key); }
  start(id, key, group = 'pointer') {
    this.stop(id);
    const alreadyDown = this.hasKey(key), hold = { key, group, timer: null };
    this.held.set(id, hold);
    if (!alreadyDown) this.changed(key, true);
    this.send(key);
    if (!REPEATING_KEYS.has(key) || this.held.get(id) !== hold) return;
    const repeat = () => {
      if (this.held.get(id) !== hold) return;
      if (!this.canRepeat()) { this.clear(); return; }
      this.send(key);
      if (this.held.get(id) === hold) hold.timer = this.clock.setTimeout(repeat, key === 'a' ? 220 : 110);
    };
    hold.timer = this.clock.setTimeout(repeat, 300);
  }
  stop(id) {
    const hold = this.held.get(id); if (!hold) return;
    this.clock.clearTimeout(hold.timer); this.held.delete(id);
    if (!this.hasKey(hold.key)) this.changed(hold.key, false);
  }
  stopGroup(group) { for (const [id, hold] of this.held) if (hold.group === group) this.stop(id); }
  clear() { for (const id of this.held.keys()) this.stop(id); }
}

/** Suppress browser gestures only where touches are game input, never dialogs. */
export function protectGameplayGestures(element) {
  const prevent = event => { if (event.cancelable) event.preventDefault(); };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'touchstart', 'touchmove', 'touchend', 'contextmenu']) {
    element.addEventListener(type, prevent, { passive: false });
  }
}
