const MAP_SIZE = 40;
const VIEW_SIZE = 10;
const MAX_HP = 10;
const BEST_KEY = 'rogue-ascii-best-turns';
const dirs = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

const stage = document.querySelector('.stage');
const statsEl = document.querySelector('.stats');
const logEl = document.querySelector('.log');
const overlay = document.querySelector('.overlay');
const overlayKicker = document.querySelector('.overlay-kicker');
const overlayTitle = document.querySelector('.overlay-title');
const overlayCopy = document.querySelector('.overlay-copy');
const hpEl = document.querySelector('[data-hp]');
const levelEl = document.querySelector('[data-level]');

let state = createGame(99912);
let bestTurns = Number(localStorage.getItem(BEST_KEY)) || null;
let audioContext;
let touchStart = null;

function rng(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function same(a, b) {
  return a.x === b.x && a.y === b.y;
}

function key(point) {
  return `${point.x},${point.y}`;
}

function dist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function blocked(tile) {
  return tile === 'tree' || tile === 'rock';
}

function inBounds(point) {
  return point.x >= 0 && point.y >= 0 && point.x < MAP_SIZE && point.y < MAP_SIZE;
}

function message(text) {
  state.messages = [text, ...state.messages].slice(0, 4);
}

function createMap(seed) {
  const rand = rng(seed);
  const hero = { x: 20, y: 20 };
  const tiles = Array.from({ length: MAP_SIZE }, (_, y) =>
    Array.from({ length: MAP_SIZE }, (_, x) => {
      const point = { x, y };
      if (x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1) return rand() > 0.44 ? 'tree' : 'rock';
      if (dist(point, hero) <= 5) return 'floor';
      if ((x + y) % 13 === 0 && rand() > 0.28) return 'tree';
      if ((x * 3 + y * 5) % 29 === 0 && rand() > 0.35) return 'rock';
      const roll = rand();
      if (roll < 0.12) return 'tree';
      if (roll < 0.21) return 'rock';
      return 'floor';
    }),
  );

  return { tiles };
}

function createGame(seed) {
  const rand = rng(seed);
  const hero = { x: 20, y: 20 };
  const level = createMap(seed);
  const occupied = new Set([key(hero)]);

  function place(minDistance = 7) {
    for (let i = 0; i < 900; i += 1) {
      const point = { x: 1 + Math.floor(rand() * (MAP_SIZE - 2)), y: 1 + Math.floor(rand() * (MAP_SIZE - 2)) };
      const k = key(point);
      if (blocked(level.tiles[point.y][point.x])) continue;
      if (dist(point, hero) < minDistance) continue;
      if (occupied.has(k)) continue;
      occupied.add(k);
      return point;
    }
    return { x: 1, y: 1 };
  }

  const monsters = Array.from({ length: 14 }, (_, i) => ({
      ...place(),
      id: i,
      hp: 2,
    }));

  const chests = Array.from({ length: 7 }, (_, i) => ({
      ...place(5),
      id: i,
      open: false,
    }));

  return {
    seed,
    seedCode: Math.abs(Math.imul(seed, 1497563863)),
    turn: 1,
    hero,
    hp: MAX_HP,
    level,
    monsters,
    chests,
    kills: 0,
    messages: ['Wake up in the layered woods.'],
    end: 'playing',
  };
}

function currentLevel() {
  return state.level;
}

function lineOfSight(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
  const step = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
  let cursor = { x: from.x + step.x, y: from.y + step.y };
  const tiles = currentLevel().tiles;
  while (!same(cursor, to)) {
    if (blocked(tiles[cursor.y][cursor.x])) return false;
    cursor = { x: cursor.x + step.x, y: cursor.y + step.y };
  }
  return true;
}

function occupied(point, monsterId = null) {
  if (same(point, state.hero)) return true;
  if (state.monsters.some((m) => m.id !== monsterId && same(m, point))) return true;
  return state.chests.some((c) => !c.open && same(c, point));
}

function monsterStep(monster) {
  if (dist(monster, state.hero) > VIEW_SIZE + 2) return monster;
  if (!lineOfSight(monster, state.hero)) return monster;
  const tiles = currentLevel().tiles;
  const queue = [monster];
  const cameFrom = new Map([[key(monster), null]]);

  while (queue.length) {
    const current = queue.shift();
    if (same(current, state.hero)) break;
    for (const dir of dirs) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      const k = key(next);
      if (!inBounds(next) || cameFrom.has(k)) continue;
      if (blocked(tiles[next.y][next.x])) continue;
      if (!same(next, state.hero) && occupied(next, monster.id)) continue;
      cameFrom.set(k, key(current));
      queue.push(next);
    }
  }

  if (!cameFrom.has(key(state.hero))) return monster;
  let currentKey = key(state.hero);
  let previous = cameFrom.get(currentKey);
  while (previous && previous !== key(monster)) {
    currentKey = previous;
    previous = cameFrom.get(currentKey);
  }
  const [x, y] = currentKey.split(',').map(Number);
  return { ...monster, x, y };
}

function moveMonsters() {
  state.monsters = state.monsters.map((monster) => {
    if (dist(monster, state.hero) === 1) {
      state.hp -= 1;
      message('A monster claws you.');
      beep('hit');
      return monster;
    }
    const moved = monsterStep(monster);
    if (!same(moved, monster) && dist(moved, state.hero) === 1) {
      state.hp -= 1;
      message('A monster closes in.');
      beep('hit');
    }
    return moved;
  });
  checkEnd();
}

function checkEnd() {
  if (state.hp <= 0) {
    state.hp = 0;
    state.end = 'lost';
    message('You fall. No score recorded.');
    beep('lose');
  } else if (state.monsters.length === 0) {
    state.end = 'won';
    if (!bestTurns || state.turn < bestTurns) {
      bestTurns = state.turn;
      localStorage.setItem(BEST_KEY, String(bestTurns));
    }
    message(`Clear in ${state.turn} turns.`);
    beep('win');
  }
}

function move(dir) {
  if (state.end !== 'playing') return;
  const target = { x: state.hero.x + dir.x, y: state.hero.y + dir.y };
  const tiles = currentLevel().tiles;
  if (!inBounds(target) || blocked(tiles[target.y][target.x])) {
    message('Blocked.');
    beep('blocked');
    render();
    return;
  }
  if (state.monsters.some((m) => same(m, target))) {
    message('Space to attack.');
    beep('blocked');
    render();
    return;
  }
  if (state.chests.some((c) => !c.open && same(c, target))) {
    message('Space to open.');
    beep('blocked');
    render();
    return;
  }
  state.hero = target;
  state.turn += 1;
  beep('move');
  moveMonsters();
  render();
}

function interact() {
  if (state.end !== 'playing') return;
  state.turn += 1;

  const chest = state.chests.find((c) => !c.open && dist(c, state.hero) === 1);
  if (chest) {
    chest.open = true;
    state.hp = Math.min(MAX_HP, state.hp + 5);
    message('Chest: +5 hp.');
    beep('chest');
    moveMonsters();
    render();
    return;
  }

  const monster = state.monsters.find((m) => dist(m, state.hero) === 1);
  if (monster) {
    const crit = Math.random() < 0.1;
    monster.hp -= crit ? 2 : 1;
    message(crit ? 'Critical hit.' : 'Hit.');
    beep(crit ? 'crit' : 'hit');
    const before = state.monsters.length;
    state.monsters = state.monsters.filter((m) => m.hp > 0);
    state.kills += before - state.monsters.length;
    moveMonsters();
    checkEnd();
    render();
    return;
  }

  message('Nothing answers.');
  beep('blocked');
  moveMonsters();
  render();
}

function glyph(tile, point) {
  if (same(point, state.hero)) return ['@', 'hero'];
  if (state.monsters.some((m) => same(m, point))) return ['M', 'monster'];
  if (state.chests.some((c) => !c.open && same(c, point))) return ['C', 'chest'];
  if (tile === 'tree') return ['T', 'tree'];
  if (tile === 'rock') return ['R', 'rock'];
  return [(point.x + point.y) % 3 ? '.' : ',', 'floor'];
}

function cameraOrigin() {
  return {
    x: Math.max(0, Math.min(MAP_SIZE - VIEW_SIZE, state.hero.x - Math.floor(VIEW_SIZE / 2))),
    y: Math.max(0, Math.min(MAP_SIZE - VIEW_SIZE, state.hero.y - Math.floor(VIEW_SIZE / 2))),
  };
}

function addGridCell(layer, char, cls, phase = 0) {
  const cell = document.createElement('span');
  cell.className = `cell ${cls}`;
  cell.textContent = char;
  cell.style.setProperty('--phase', `${phase}ms`);
  layer.appendChild(cell);
}

function renderAmbientLayer(depth) {
  const layer = document.createElement('div');
  const drift = state.turn * depth * 0.45;
  const origin = cameraOrigin();
  const chars = ['.', ':', ';', 'o', 'O', '#', '+'];
  layer.className = `layer back back-${depth}`;
  layer.style.setProperty('--grid-size', '18');
  layer.style.transform = `translate3d(${-(origin.x * depth * 3.6) + Math.sin(drift / 8) * 14}px, ${-(origin.y * depth * 3.6) + Math.cos(drift / 10) * 10}px, ${-220 - depth * 120}px) scale(${1.42 + depth * 0.18})`;
  layer.style.opacity = String(0.18 + depth * 0.04);
  layer.style.filter = `blur(${depth * 1.6}px) brightness(${0.72 - depth * 0.04})`;
  layer.style.zIndex = String(2 - depth);

  for (let y = 0; y < 18; y += 1) {
    for (let x = 0; x < 18; x += 1) {
      const noise = Math.abs(Math.sin((x + state.seed) * 13.17 + (y - depth) * 7.71));
      const visible = noise > 0.54 || (x + y + depth) % 11 === 0;
      const char = visible ? chars[Math.floor(noise * chars.length) % chars.length] : '';
      const cls = noise > 0.82 ? 'rock' : noise > 0.68 ? 'tree' : 'floor';
      addGridCell(layer, char, cls);
    }
  }
  return layer;
}

function renderMapLayer(className, z) {
  const layer = document.createElement('div');
  const origin = cameraOrigin();
  layer.className = `layer ${className}`;
  layer.style.setProperty('--grid-size', VIEW_SIZE);
  layer.style.transform = z;

  for (let y = 0; y < VIEW_SIZE; y += 1) {
    for (let x = 0; x < VIEW_SIZE; x += 1) {
      const point = { x: origin.x + x, y: origin.y + y };
      const tile = state.level.tiles[point.y][point.x];
      const [char, cls] = glyph(tile, point);
      addGridCell(layer, char, cls, (point.x * 61 + point.y * 97) % 1300);
    }
  }
  return layer;
}

function renderLeafLayer(depth) {
  const layer = document.createElement('div');
  const gridSize = 10 + depth * 2;
  const origin = cameraOrigin();
  const drift = state.turn * (0.34 + depth * 0.12);
  const parallax = 2.2 + depth * 1.4;
  layer.className = `layer leaf-layer leaf-layer-${depth}`;
  layer.style.setProperty('--grid-size', gridSize);
  layer.style.transform = `translate3d(${-(origin.x * parallax) + Math.sin(drift + depth) * 13}px, ${-(origin.y * parallax) + Math.cos(drift * 0.8 + depth) * 13}px, ${150 + depth * 72}px) scale(${1.08 + depth * 0.11})`;
  layer.style.opacity = String(0.08 + depth * 0.04);
  layer.style.zIndex = String(16 + depth);

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const px = x + depth * 5.37 + origin.x * 0.13;
      const py = y + depth * 9.91 + origin.y * 0.13;
      const noise = Math.abs(Math.sin((px + state.seed * 0.001) * (8.7 + depth) + py * (13.1 - depth * 0.7)));
      const scatter = (x * (5 + depth) + y * (9 + depth * 2) + depth * 11) % (18 + depth * 3);
      const visible = noise > 0.945 || (scatter === 0 && noise > 0.7);
      addGridCell(layer, visible ? '8' : '', visible ? `leaf leaf-${depth}` : 'empty', (x * 47 + y * 83 + depth * 211) % 1100);
    }
  }
  return layer;
}

function render() {
  stage.replaceChildren(
    renderAmbientLayer(2),
    renderAmbientLayer(1),
    renderMapLayer('focus', 'translate3d(0, 0, 80px)'),
    renderLeafLayer(1),
    renderLeafLayer(2),
    renderLeafLayer(3),
  );
  stage.style.setProperty('--tilt-x', '0deg');
  stage.style.setProperty('--tilt-y', '0deg');

  statsEl.textContent = `BEST ${bestTurns || '--'}`;

  levelEl.textContent = '1';
  hpEl.textContent = `${state.hp}/${MAX_HP}`;
  logEl.innerHTML = state.messages.slice(0, 3).map((line) => `<p>${line}</p>`).join('');

  overlay.hidden = state.end === 'playing';
  if (!overlay.hidden) {
    overlayKicker.textContent = state.end === 'won' ? 'Clear' : 'Defeat';
    overlayTitle.textContent = state.end === 'won' ? `${state.turn} turns` : 'No score';
    overlayCopy.textContent = state.end === 'won'
      ? `Best score: ${bestTurns || state.turn} turns.`
      : 'Only complete monster clears are recorded.';
  }
}

function restart(seed = 90000 + Math.floor(Math.random() * 9999)) {
  state = createGame(seed);
  render();
}

function beep(kind) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioContext ||= new Ctx();
  if (audioContext.state === 'suspended') audioContext.resume();
  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  const notes = {
    move: [220],
    blocked: [90],
    hit: [130, 92],
    crit: [330, 660],
    chest: [440, 620, 820],
    win: [440, 554, 659, 880],
    lose: [180, 130, 90],
  }[kind];
  notes.forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * 0.045);
    osc.connect(gain);
    osc.start(now + i * 0.045);
    osc.stop(now + i * 0.045 + 0.07);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') move({ x: 0, y: -1 });
  if (event.key === 'ArrowDown') move({ x: 0, y: 1 });
  if (event.key === 'ArrowLeft') move({ x: -1, y: 0 });
  if (event.key === 'ArrowRight') move({ x: 1, y: 0 });
  if (event.key === ' ') interact();
  if (event.key.toLowerCase() === 'r') restart(state.seed + 1);
});

document.addEventListener('touchstart', (event) => {
  if (event.touches.length !== 1) return;
  const touch = event.touches[0];
  touchStart = {
    x: touch.clientX,
    y: touch.clientY,
    time: Date.now(),
    target: event.target,
  };
}, { passive: true });

document.addEventListener('touchmove', (event) => {
  if (touchStart) event.preventDefault();
}, { passive: false });

document.addEventListener('touchend', (event) => {
  if (!touchStart) return;
  if (touchStart.target instanceof Element && touchStart.target.closest('button')) {
    touchStart = null;
    return;
  }

  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const elapsed = Date.now() - touchStart.time;
  const swipeDistance = 36;
  const tapDistance = 12;

  event.preventDefault();

  if (Math.max(absX, absY) >= swipeDistance) {
    if (absX > absY) {
      move({ x: Math.sign(dx), y: 0 });
    } else {
      move({ x: 0, y: Math.sign(dy) });
    }
  } else if (Math.max(absX, absY) <= tapDistance && elapsed < 420) {
    interact();
  }

  touchStart = null;
}, { passive: false });

document.addEventListener('touchcancel', () => {
  touchStart = null;
});

document.querySelectorAll('[data-action="interact"]').forEach((button) => {
  button.addEventListener('click', interact);
});

document.querySelectorAll('[data-action="restart"]').forEach((button) => {
  button.addEventListener('click', () => restart(state.seed + 1));
});

render();
