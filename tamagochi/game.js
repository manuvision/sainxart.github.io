const SAVE_KEY = 'manu.vision.tamagochi.v1';
const MINUTE = 60_000;
const HATCH_TIME = 10_000;
const MAX_OFFLINE = 4 * 60 * MINUTE;
const STATS = ['hunger', 'happiness', 'cleanliness', 'energy', 'health'];
const CARE = [
  { id: 'food', label: 'FOOD', icon: 'food' },
  { id: 'clean', label: 'BATH', icon: 'clean' },
  { id: 'games', label: 'PLAY', icon: 'game' },
  { id: 'stats', label: 'STATS', icon: 'heart' },
  { id: 'sleep', label: 'LIGHTS', icon: 'moon' },
  { id: 'medicine', label: 'MEDICINE', icon: 'medicine' },
];
const FOOD = [
  { id: 'meal', label: 'MEAL / FREE', icon: 'food' },
  { id: 'snack', label: 'TREAT / 2 COINS', icon: 'heart' },
];
const GAMES = [
  { id: 'catch', label: 'FOOD CATCH', icon: 'food' },
  { id: 'memory', label: 'TONE MEMORY', icon: 'game' },
];
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const finite = (value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
const copy = (value) => JSON.parse(JSON.stringify(value));
const stageFor = (pet) => !pet.hatched ? 'egg' : pet.ageMs < 6 * MINUTE ? 'baby' : pet.ageMs < 24 * MINUTE ? 'child' : 'adult';

function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function fresh(now) {
  return {
    version: 1,
    lastTick: now,
    pet: { name: 'MOMO', hatched: false, ageMs: 0, hunger: 86, happiness: 80, cleanliness: 100, energy: 100, health: 100, sleeping: false },
    hatchStartedAt: null,
    poop: 0,
    poopClock: 0,
    coins: 5,
    highScores: { catch: 0, memory: 0 },
    mode: 'home',
    selection: 0,
    activity: null,
  };
}

function restore(raw, now) {
  if (!raw || raw.version !== 1 || !raw.pet || typeof raw.pet !== 'object') return fresh(now);
  const next = fresh(now);
  const pet = raw.pet;
  next.pet.hatched = pet.hatched === true;
  next.pet.ageMs = finite(pet.ageMs, 0, 0, 3650 * 24 * 60 * MINUTE);
  next.pet.sleeping = next.pet.hatched && pet.sleeping === true;
  for (const key of STATS) next.pet[key] = finite(pet[key], next.pet[key], 0, 100);
  next.pet.health = Math.max(15, next.pet.health);
  next.lastTick = finite(raw.lastTick, now, 0, now);
  next.hatchStartedAt = typeof raw.hatchStartedAt === 'number' && Number.isFinite(raw.hatchStartedAt) ? clamp(raw.hatchStartedAt, 0, now) : null;
  next.poop = Math.floor(finite(raw.poop, 0, 0, 3));
  next.poopClock = finite(raw.poopClock, 0, 0, 9 * MINUTE);
  next.coins = Math.floor(finite(raw.coins, 5, 0, 9999));
  next.highScores.catch = Math.floor(finite(raw.highScores?.catch, 0, 0, 9999));
  next.highScores.memory = Math.floor(finite(raw.highScores?.memory, 0, 0, 12));
  const modes = ['home', 'menu', 'food', 'stats', 'gameSelect', 'catch', 'memory', 'hatching'];
  next.mode = modes.includes(raw.mode) ? raw.mode : 'home';
  next.selection = Math.floor(finite(raw.selection, 0, 0, 5));
  if (!next.pet.hatched) {
    next.mode = next.hatchStartedAt !== null ? 'hatching' : 'home';
  } else if (next.mode === 'hatching') next.mode = 'home';
  const a = raw.activity;
  if (next.pet.hatched && !next.pet.sleeping && next.mode === 'catch' && a && a.kind === 'catch') {
    next.activity = {
      kind: 'catch', active: a.active === true, complete: a.complete === true,
      lane: Math.floor(finite(a.lane, 1, 0, 2)), score: Math.floor(finite(a.score, 0, 0, 999)),
      lives: Math.floor(finite(a.lives, 3, 0, 3)), elapsed: finite(a.elapsed, 0, 0, 35_000), spawnClock: finite(a.spawnClock, 0, 0, 900),
      objects: Array.isArray(a.objects) ? a.objects.slice(0, 12).filter(o => o && typeof o === 'object').map(o => ({ lane: Math.floor(finite(o.lane, 1, 0, 2)), y: finite(o.y, 0, 0, 1.1), kind: o.kind === 'bad' ? 'bad' : 'food' })) : [],
      result: typeof a.result === 'string' ? a.result.slice(0, 28) : '',
    };
  } else if (next.pet.hatched && !next.pet.sleeping && next.mode === 'memory' && a && a.kind === 'memory') {
    const sequence = Array.isArray(a.sequence) ? a.sequence.slice(0, 12).map(n => Math.floor(finite(n, 0, 0, 2))) : [];
    next.activity = {
      kind: 'memory', active: a.active === true, complete: a.complete === true,
      phase: ['ready', 'show', 'input', 'result'].includes(a.phase) ? a.phase : 'ready',
      sequence, score: Math.floor(finite(a.score, 0, 0, 12)),
      inputIndex: Math.floor(finite(a.inputIndex, 0, 0, sequence.length)),
      elapsed: finite(a.elapsed, 0, 0, 15_000), highlight: null, showIndex: -1,
      result: typeof a.result === 'string' ? a.result.slice(0, 28) : '',
    };
    if (!sequence.length && next.activity.phase !== 'ready') next.activity.phase = 'ready';
  } else if (['catch', 'memory'].includes(next.mode)) next.mode = 'home';
  return next;
}

/** A forgiving, offline-capable pocket pet. Clock inputs are Unix milliseconds. */
export class PetGame {
  constructor({ onSound = () => {}, storage = defaultStorage(), now = Date.now } = {}) {
    this.now = now;
    this.storage = storage;
    this.onSound = onSound;
    this.message = null;
    this.effect = null;
    this.saveAvailable = false;
    this._lastSaved = 0;
    this._lastMemoryHighlight = -1;
    const timestamp = this.now();
    let parsed = null;
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      if (raw && raw.length <= 100_000) parsed = JSON.parse(raw);
    } catch { /* Private mode or corrupt saves never prevent play. */ }
    this.data = restore(parsed, timestamp);
    const elapsed = Math.max(0, timestamp - this.data.lastTick);
    this.time = timestamp;
    this._advancePet(Math.min(elapsed, MAX_OFFLINE));
    this.data.lastTick = timestamp;
    this._finishHatch();
    if (elapsed > 10 * MINUTE && this.data.pet.hatched) this._say('WELCOME BACK!', 'happy', 4000);
    this._save(true);
  }

  _sound(name) {
    try { this.onSound(name); } catch { /* Audio is an enhancement. */ }
  }

  _say(text, type = 'info', duration = 2600) {
    this.message = { text, type, until: this.time + duration };
  }

  _animate(type, duration = 1800) {
    this.effect = { type, start: this.time, duration };
  }

  _save(force = false) {
    if (!force && this.time - this._lastSaved < 1500) return;
    try {
      if (typeof this.storage?.setItem !== 'function') this.saveAvailable = false;
      else {
        this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
        this.saveAvailable = true;
      }
    } catch { this.saveAvailable = false; /* Full or disabled storage: continue in memory. */ }
    this._lastSaved = this.time;
  }

  _advancePet(dt) {
    const d = this.data;
    const p = d.pet;
    if (!p.hatched || dt <= 0) return;
    const previousStage = stageFor(p);
    const minutes = dt / MINUTE;
    p.ageMs += dt;
    p.hunger = clamp(p.hunger - minutes * (p.sleeping ? 0.14 : 0.32));
    p.happiness = clamp(p.happiness - minutes * (p.sleeping ? 0.06 : 0.19));
    p.cleanliness = clamp(p.cleanliness - minutes * (0.12 + d.poop * 0.14));
    p.energy = clamp(p.energy + minutes * (p.sleeping ? 4 : -0.24));
    const comfortable = p.hunger > 35 && p.cleanliness > 35 && p.energy > 20;
    p.health = clamp(p.health + minutes * (comfortable ? 0.16 : -0.13), 15, 100);
    if (!p.sleeping) {
      d.poopClock += dt;
      if (d.poopClock >= 9 * MINUTE) {
        d.poop = Math.min(3, d.poop + Math.floor(d.poopClock / (9 * MINUTE)));
        d.poopClock %= 9 * MINUTE;
      }
    }
    if (stageFor(p) !== previousStage) {
      this._say(stageFor(p) === 'child' ? 'I GREW BIGGER!' : 'ALL GROWN UP!', 'happy', 4500);
      this._animate('grow', 3500);
      this._sound('evolve');
    }
  }

  _finishHatch() {
    const d = this.data;
    if (!d.pet.hatched && d.hatchStartedAt !== null && this.time - d.hatchStartedAt >= HATCH_TIME) {
      d.pet.hatched = true;
      d.pet.ageMs = 0;
      d.hatchStartedAt = null;
      d.mode = 'home';
      this._say('HELLO! I AM MOMO', 'happy', 4500);
      this._animate('hatch', 2500);
      this._sound('hatch');
      this._save(true);
    }
  }

  tick(timestamp = this.now()) {
    if (!Number.isFinite(timestamp)) return this.getSnapshot();
    this.time = Math.max(timestamp, this.data.lastTick);
    const gap = Math.max(0, this.time - this.data.lastTick);
    this._advancePet(Math.min(gap, MAX_OFFLINE));
    this.data.lastTick = this.time;
    this._finishHatch();
    // A backgrounded minigame pauses instead of silently spending lives.
    const dt = gap > 1500 ? 0 : gap;
    if (this.data.mode === 'catch') this._tickCatch(dt);
    if (this.data.mode === 'memory') this._tickMemory(dt);
    if (this.message && this.time >= this.message.until) this.message = null;
    if (this.effect && this.time >= this.effect.start + this.effect.duration) this.effect = null;
    this._save();
    return this.getSnapshot();
  }

  press(button) {
    if (!['a', 'b', 'c'].includes(button)) return this.getSnapshot();
    this.tick(this.now());
    const d = this.data;
    const p = d.pet;
    if (!p.hatched) {
      if (d.mode === 'hatching') {
        this._sound('click');
      } else if (button === 'b') {
        d.hatchStartedAt = this.time;
        d.mode = 'hatching';
        this._say('A LITTLE LIFE...', 'happy', HATCH_TIME);
        this._sound('egg');
      } else {
        this._say('PRESS B TO HATCH');
        this._sound('select');
      }
    } else if (d.mode === 'catch') this._pressCatch(button);
    else if (d.mode === 'memory') this._pressMemory(button);
    else if (button === 'c') {
      if (d.mode === 'home') this._navigate('stats');
      else if (d.mode === 'food' || d.mode === 'gameSelect') this._navigate('menu');
      else this._navigate('home');
      this._sound('back');
    } else if (d.mode === 'home') {
      if (button === 'a') {
        this._navigate('menu');
        this._sound('select');
      } else if (p.sleeping) {
        this._say('SHHH... SWEET DREAMS', 'sleep');
        this._sound('sleep');
      } else {
        p.happiness = clamp(p.happiness + 3);
        this._say('MOMO LOVES YOU!', 'happy');
        this._animate('love');
        this._sound('happy');
      }
    } else if (d.mode === 'stats') {
      if (button === 'a') this._navigate('menu');
      else this._navigate('home');
      this._sound('select');
    } else {
      const items = this._menuItems();
      if (button === 'a') {
        d.selection = (d.selection + 1) % items.length;
        this._sound('select');
      } else {
        this._choose(items[d.selection % items.length].id);
      }
    }
    this._save(true);
    return this.getSnapshot();
  }

  _navigate(mode) {
    this.data.mode = mode;
    this.data.selection = 0;
    if (!['catch', 'memory'].includes(mode)) this.data.activity = null;
  }

  _menuItems() {
    return this.data.mode === 'food' ? FOOD : this.data.mode === 'gameSelect' ? GAMES : CARE;
  }

  _choose(id) {
    const p = this.data.pet;
    if (p.sleeping && !['sleep', 'stats'].includes(id)) {
      this._say('LIGHTS ON TO PLAY', 'sleep');
      this._sound('error');
      return;
    }
    switch (id) {
      case 'food': this._navigate('food'); this._sound('confirm'); break;
      case 'games': this._navigate('gameSelect'); this._sound('confirm'); break;
      case 'stats': this._navigate('stats'); this._sound('confirm'); break;
      case 'meal':
        if (p.hunger >= 99) { this._say('MY TUMMY IS FULL!'); this._sound('error'); break; }
        p.hunger = clamp(p.hunger + 27);
        p.health = clamp(p.health + 2);
        this._navigate('home'); this._say('YUM! THANK YOU!', 'happy'); this._animate('eat'); this._sound('eat');
        break;
      case 'snack':
        if (this.data.coins < 2) { this._say('PLAY TO EARN COINS'); this._sound('error'); break; }
        this.data.coins -= 2;
        p.hunger = clamp(p.hunger + 10);
        p.happiness = clamp(p.happiness + 18);
        this._navigate('home'); this._say('A TINY TREAT!', 'happy'); this._animate('eat'); this._sound('eat');
        this.effect.food = 'snack';
        break;
      case 'clean':
        this.data.poop = 0;
        this.data.poopClock = 0;
        p.cleanliness = 100;
        p.happiness = clamp(p.happiness + 7);
        p.health = clamp(p.health + 5);
        this._navigate('home'); this._say('SQUEAKY CLEAN!', 'happy'); this._animate('clean', 2500); this._sound('clean');
        break;
      case 'sleep':
        p.sleeping = !p.sleeping;
        this._navigate('home'); this._say(p.sleeping ? 'GOOD NIGHT, MOMO' : 'GOOD MORNING!', p.sleeping ? 'sleep' : 'happy');
        this._animate(p.sleeping ? 'sleep' : 'wake'); this._sound(p.sleeping ? 'sleep' : 'happy');
        break;
      case 'medicine':
        p.health = clamp(p.health + 40);
        this._navigate('home'); this._say('FEELING BETTER!', 'happy'); this._animate('medicine'); this._sound('heal');
        break;
      case 'catch':
        this.data.mode = 'catch'; this.data.activity = this._newCatch(); this.message = null; this._sound('confirm');
        break;
      case 'memory':
        this.data.mode = 'memory'; this.data.activity = this._newMemory(); this.message = null; this._sound('confirm');
        break;
    }
  }

  _newCatch() {
    return { kind: 'catch', active: false, complete: false, lane: 1, objects: [], score: 0, lives: 3, elapsed: 0, spawnClock: 650, result: '' };
  }

  _pressCatch(button) {
    const a = this.data.activity;
    if (!a.active) {
      if (button === 'c') { this._navigate('gameSelect'); this._sound('back'); }
      else if (button === 'b') {
        this.data.activity = this._newCatch();
        this.data.activity.active = true;
        this._sound('start');
      } else this._sound('select');
      return;
    }
    if (button === 'a') a.lane = Math.max(0, a.lane - 1);
    if (button === 'b') a.lane = 1;
    if (button === 'c') a.lane = Math.min(2, a.lane + 1);
    this._sound('move');
  }

  _tickCatch(dt) {
    const a = this.data.activity;
    if (!a?.active || dt <= 0) return;
    a.elapsed += dt;
    a.spawnClock += dt;
    const speed = 0.00029 + Math.min(0.0001, a.score * 0.000005);
    for (const object of a.objects) {
      const before = object.y;
      object.y += dt * speed;
      if (before < 0.87 && object.y >= 0.87) {
        if (object.lane === a.lane) {
          if (object.kind === 'food') { a.score += 1; this._sound('coin'); }
          else { a.lives -= 1; this._sound('miss'); }
        } else if (object.kind === 'food') { a.lives -= 1; this._sound('miss'); }
      }
    }
    a.objects = a.objects.filter(o => o.y < 0.91);
    if (a.spawnClock >= 1000) {
      a.spawnClock %= 1000;
      a.objects.push({ lane: Math.floor(Math.random() * 3), y: 0, kind: Math.random() < 0.22 ? 'bad' : 'food' });
    }
    if (a.lives <= 0 || a.elapsed >= 35_000) {
      a.lives = Math.max(0, a.lives);
      a.active = false;
      a.complete = true;
      const earned = a.score > 0 ? Math.max(1, Math.ceil(a.score / 3)) : 0;
      this._reward('catch', a.score, earned);
      a.result = `${a.score} CAUGHT / +${earned} COINS`;
      this._sound(a.score ? 'win' : 'gameover');
      this._save(true);
    }
  }

  _newMemory() {
    return { kind: 'memory', active: false, complete: false, phase: 'ready', sequence: [], score: 0, showIndex: -1, inputIndex: 0, highlight: null, elapsed: 0, result: '' };
  }

  _memoryRound() {
    const a = this.data.activity;
    a.sequence.push(Math.floor(Math.random() * 3));
    a.phase = 'show'; a.elapsed = 0; a.inputIndex = 0; a.highlight = null; a.showIndex = -1;
    this._lastMemoryHighlight = -1;
  }

  _pressMemory(button) {
    const a = this.data.activity;
    if (!a.active) {
      if (button === 'c') { this._navigate('gameSelect'); this._sound('back'); }
      else if (button === 'b') {
        this.data.activity = this._newMemory();
        this.data.activity.active = true;
        this._memoryRound();
        this._sound('start');
      }
      return;
    }
    if (a.phase !== 'input') return;
    const index = ['a', 'b', 'c'].indexOf(button);
    a.highlight = index;
    a.elapsed = 0;
    this._sound(`tone${index}`);
    if (a.sequence[a.inputIndex] !== index) {
      a.active = false; a.complete = true; a.phase = 'result';
      const earned = a.score > 0 ? a.score : 0;
      this._reward('memory', a.score, earned);
      a.result = `ROUND ${a.score} / +${earned} COINS`;
      this._sound('gameover');
    } else {
      a.inputIndex += 1;
      if (a.inputIndex === a.sequence.length) {
        a.score += 1; a.phase = 'result'; a.elapsed = 0; a.result = 'PERFECT! NEXT ROUND';
        this._sound('happy');
        if (a.score === 12) {
          a.active = false; a.complete = true;
          this._reward('memory', a.score, 15);
          a.result = 'MASTER! +15 COINS';
          this._sound('win');
        }
      }
    }
  }

  _tickMemory(dt) {
    const a = this.data.activity;
    if (!a?.active || dt <= 0) return;
    a.elapsed += dt;
    if (a.phase === 'show') {
      const offset = a.elapsed - 450;
      const index = Math.floor(offset / 780);
      a.showIndex = index;
      a.highlight = offset >= 0 && index < a.sequence.length && offset % 780 < 540 ? a.sequence[index] : null;
      if (a.highlight !== null && index !== this._lastMemoryHighlight) {
        this._lastMemoryHighlight = index;
        this._sound(`tone${a.highlight}`);
      }
      if (offset >= a.sequence.length * 780 + 200) {
        a.phase = 'input'; a.elapsed = 0; a.highlight = null; a.showIndex = -1;
      }
    } else if (a.phase === 'input' && a.elapsed >= 200) a.highlight = null;
    else if (a.phase === 'result' && a.elapsed >= 1200) this._memoryRound();
  }

  _reward(game, score, coins) {
    const p = this.data.pet;
    this.data.coins = clamp(this.data.coins + coins, 0, 9999);
    this.data.highScores[game] = Math.max(this.data.highScores[game], score);
    p.happiness = clamp(p.happiness + 8 + Math.min(18, score * 2));
    p.energy = clamp(p.energy - 4);
  }

  getSnapshot() {
    const d = this.data;
    const stage = stageFor(d.pet);
    const p = { ...d.pet };
    for (const key of STATS) p[key] = Math.round(p[key]);
    const items = this._menuItems().map(item => ({ ...item }));
    if (d.mode === 'menu') items[4].label = p.sleeping ? 'LIGHTS ON' : 'LIGHTS OFF';
    const a = d.activity;
    const buttons = this._buttons();
    const need = p.hunger < 30 ? 'Momo is hungry.' : p.cleanliness < 35 || d.poop ? 'Momo needs a bath.' : p.energy < 25 ? 'Momo needs sleep.' : p.happiness < 35 ? 'Momo wants to play.' : 'Momo is doing well.';
    let summary = stage === 'egg'
      ? d.mode === 'hatching' ? 'Momo is hatching. Your new pet will arrive soon.' : 'A little egg is waiting. Press the middle button B to hatch your pet.'
      : `${p.name}, ${stage}, ${p.sleeping ? 'sleeping' : 'awake'}. Fullness ${p.hunger}%, happiness ${p.happiness}%, cleanliness ${p.cleanliness}%, energy ${p.energy}%, health ${p.health}%. ${need} ${d.coins} coins. ${this.message?.text ?? ''}`;
    if (['menu', 'food', 'gameSelect'].includes(d.mode)) summary += ` Selected: ${items[d.selection % items.length].label}. A selects the next option, B chooses it, C goes back.`;
    if (d.mode === 'catch' && a) summary += a.active
      ? ` Food Catch. Lane ${a.lane + 1} of 3. Score ${a.score}, ${a.lives} lives. A moves left, B centers, and C moves right.`
      : ` Food Catch. ${a.result || 'Catch apples and dodge the mess.'} B starts, C goes back.`;
    if (d.mode === 'memory' && a) summary += a.active
      ? a.phase === 'show'
        ? ` Tone Memory, round ${a.sequence.length}. Remember this pattern: ${a.sequence.map(n => ['A', 'B', 'C'][n]).join(', ')}.`
        : a.phase === 'input' ? ` Your turn. ${a.inputIndex} of ${a.sequence.length} notes entered.` : ` Correct! Round ${a.score} complete.`
      : ` Tone Memory. ${a.result || 'Remember and repeat the A, B, C pattern.'} B starts, C goes back.`;
    return {
      mode: d.mode, stage, pet: p, time: this.time, frame: Math.floor(this.time / 300),
      menu: { title: d.mode === 'food' ? 'FOOD' : d.mode === 'gameSelect' ? 'PLAY' : 'CARE', items, selected: d.selection % items.length },
      message: this.message ? { ...this.message } : null,
      effect: this.effect ? { ...this.effect } : null,
      poop: d.poop, coins: d.coins, highScores: { ...d.highScores },
      hatch: { progress: d.hatchStartedAt === null ? 0 : clamp((this.time - d.hatchStartedAt) / HATCH_TIME, 0, 1) },
      catch: a?.kind === 'catch' ? { ...copy(a), remaining: Math.max(0, Math.ceil((35_000 - a.elapsed) / 1000)) } : null,
      memory: a?.kind === 'memory' ? copy(a) : null,
      buttons, hint: this._hint(), summary, saveAvailable: this.saveAvailable,
    };
  }

  _buttons() {
    const d = this.data;
    if (!d.pet.hatched) return { a: 'Select', b: d.mode === 'hatching' ? 'Hatching' : 'Hatch egg', c: 'Back' };
    if (d.mode === 'catch') return d.activity?.active ? { a: 'Move left', b: 'Center lane', c: 'Move right' } : { a: 'Left', b: d.activity?.complete ? 'Play again' : 'Start game', c: 'Back' };
    if (d.mode === 'memory') return d.activity?.active ? { a: 'Low tone', b: 'Middle tone', c: 'High tone' } : { a: 'Low tone', b: d.activity?.complete ? 'Play again' : 'Start game', c: 'Back' };
    if (d.mode === 'home') return { a: 'Open care menu', b: d.pet.sleeping ? 'Dream' : 'Pet Momo', c: 'View stats' };
    if (d.mode === 'stats') return { a: 'Open care menu', b: 'Home', c: 'Back' };
    return { a: 'Next option', b: `Choose ${this._menuItems()[d.selection % this._menuItems().length].label}`, c: 'Back' };
  }

  _hint() {
    const d = this.data;
    if (!d.pet.hatched) return d.mode === 'hatching' ? 'A NEW FRIEND...' : 'B: HATCH YOUR EGG';
    if (d.mode === 'catch') return d.activity?.active ? 'A: LEFT   C: RIGHT' : 'B: PLAY   C: BACK';
    if (d.mode === 'memory') return d.activity?.active ? d.activity.phase === 'show' ? 'WATCH & LISTEN' : d.activity.phase === 'input' ? 'REPEAT: A B C' : 'NICE MEMORY!' : 'B: PLAY   C: BACK';
    if (d.mode === 'stats') return 'B: HOME   C: BACK';
    if (d.mode === 'home') return d.pet.sleeping ? 'A: CARE  B: DREAM' : 'A: CARE  B: LOVE';
    return 'A: NEXT  B: OK  C: BACK';
  }

  /** Shell Escape/back control; C is intentionally a gameplay button inside games. */
  back() {
    if (['catch', 'memory'].includes(this.data.mode)) return this.exitGame();
    this.tick(this.now());
    if (this.data.mode === 'home' || this.data.mode === 'hatching') return this.getSnapshot();
    this._navigate(['food', 'gameSelect'].includes(this.data.mode) ? 'menu' : 'home');
    this._sound('back');
    this._save(true);
    return this.getSnapshot();
  }

  /** Leave a minigame with earned progress; usable by an on-screen mobile control. */
  exitGame() {
    this.tick(this.now());
    const a = this.data.activity;
    if (!['catch', 'memory'].includes(this.data.mode)) return this.getSnapshot();
    if (a?.active && a.score > 0) {
      const earned = a.kind === 'catch' ? Math.max(1, Math.ceil(a.score / 3)) : a.score;
      this._reward(a.kind, a.score, earned);
      this._say(`NICE PLAY! +${earned} COINS`, 'happy');
    }
    this._navigate('gameSelect');
    this._sound('back');
    this._save(true);
    return this.getSnapshot();
  }

  /** Reset is intentionally exposed only for the shell's confirmed reset flow. */
  reset() {
    this.time = this.now();
    this.data = fresh(this.time);
    this.message = null;
    this.effect = null;
    this._lastMemoryHighlight = -1;
    this._save(true);
    this._sound('egg');
    return this.getSnapshot();
  }
}

export { SAVE_KEY };
