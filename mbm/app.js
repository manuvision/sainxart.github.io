const WIDTH = 980;
const HEIGHT = 620;
const DEFAULT_RADIUS = 8;
const MIN_RADIUS = 4;
const MAX_ORGANISM_RADIUS = 26;
const DEFAULT_SPEED = 74;
const BASE_LIFETIME = 10;
const WHITE_FOOD_BONUS = 1.5;
const SPLIT_AFTER_KILLS = 3;
const INITIAL_PER_TRIBE = 20;
const INITIAL_WHITE_FOOD = 0;
const MAX_WHITE_FOOD = 450;
const PREDATOR_ALERT_RADIUS = Math.max(WIDTH, HEIGHT) * 1.25;
const PREY_DETECTION_RADIUS = Math.max(WIDTH, HEIGHT) * 1.25;
const FOOD_DETECTION_RADIUS = Math.max(WIDTH, HEIGHT) * 1.25;
const ALLY_GROUP_RADIUS = 120;
const GROUP_FORCE = 0.18;
const WHITE_FOOD_RADIUS = 3;
const WHITE_FOOD_SPEED = 8;
const TERRAIN_FLOW_SCALE = 0.68;
const HOT_ZONE_RADIUS = 150;
const HOT_ZONE_DURATION = 7;
const GRAZER_THRESHOLD = 5;
const GRAZER_DECAY = 0.996;
const ROCK_COUNT = 5;
const CURRENT_NODE_SPACING = 70;
const BOSS_MIN_RADIUS = 8;
const BOSS_PASSIVE_SHRINK_PER_SECOND = 3.15;
const BOSS_TERROR_RADIUS_MULTIPLIER = 3.4;
const TARGET_COMMIT_FORCE = 6.4;
const SWARM_ALIGNMENT_FORCE = 0.22;
const SWARM_CLOSE_REPULSION = 2.4;
const EDGE_SWARM_DAMPING = 0.22;
const HUNGER_FOOD_PRIORITY = 4.2;
const EDGE_RETURN_FORCE = 5.5;
const EDGE_STUCK_JITTER = 0.9;
const DIRECTION_SWAY_FACTOR = 0.16;
const MIN_MOVE_VECTOR = 0.22;
const EDGE_ESCAPE_FORCE = 4.2;
const SIZE_FADE_FLOOR = 0.01;
const DEFAULT_SOUND_VOLUME = 0.03;
const TRAIL_SHRINK = 0.985;
const TRAIL_FADE_DECAY = 0.982;

const DEFAULT_SETTINGS = {
  bossWhiteFoodThreshold: 56,
  trailFade: 0.84,
  trailLength: 56,
  foodBurstScale: 1,
  foodBurstMax: 10,
  hungerThreshold: 4,
  criticalHungerThreshold: 2,
  predatorMealBonus: 5,
  terrainDrift: 1,
  leakRate: 0.65,
  hotZoneBias: 1,
  shrinkRate: 0.12,
  obstacleAvoidance: 1,
  currentVisibility: 0.55,
  soundVolume: DEFAULT_SOUND_VOLUME,
};

const DEFAULT_FEATURES = {
  currents: true,
  hotZones: true,
  rocks: true,
  trails: true,
  shrink: true,
  separation: true,
  boss: true,
};

const TRIBES = {
  red: { key: "red", label: "Red", color: "#ff4d5a", prey: "green", predator: "blue" },
  green: { key: "green", label: "Green", color: "#53e36e", prey: "blue", predator: "red" },
  blue: { key: "blue", label: "Blue", color: "#57a6ff", prey: "red", predator: "green" },
};

const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerTitle = document.getElementById("winnerTitle");
const winnerStats = document.getElementById("winnerStats");

const playPauseBtn = document.getElementById("playPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const restartBtn = document.getElementById("restartBtn");
const spawnBossBtn = document.getElementById("spawnBossBtn");
const spawnRedBtn = document.getElementById("spawnRedBtn");
const spawnBlueBtn = document.getElementById("spawnBlueBtn");
const spawnGreenBtn = document.getElementById("spawnGreenBtn");
const featuresToggleBtn = document.getElementById("featuresToggleBtn");
const rulesToggleBtn = document.getElementById("rulesToggleBtn");
const tuningToggleBtn = document.getElementById("tuningToggleBtn");
const featuresPanel = document.getElementById("featuresPanel");
const rulesPanel = document.getElementById("rulesPanel");
const tuningPanel = document.getElementById("tuningPanel");
const featureGrid = document.getElementById("featureGrid");
const sliderGrid = document.getElementById("sliderGrid");
const resetTuningBtn = document.getElementById("resetTuningBtn");

let nextId = 1;
let nextFoodId = 1;
let nextBossId = 1;

const state = {
  running: true,
  winner: null,
  settings: { ...DEFAULT_SETTINGS },
  features: { ...DEFAULT_FEATURES },
  organisms: [],
  food: [],
  bosses: [],
  hotZones: [],
  kills: { red: 0, green: 0, blue: 0 },
  deaths: { red: 0, green: 0, blue: 0 },
  foodByTribe: { red: 0, green: 0, blue: 0 },
  environment: null,
  currentField: [],
  lastTime: 0,
  audioCtx: null,
  finalPhase: false,
};

function randomBetween(min, max) { return Math.random() * (max - min) + min; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function normalize(x, y) {
  const mag = Math.hypot(x, y) || 1;
  return { x: x / mag, y: y / mag };
}
function jitter(amount = 1) { return { x: randomBetween(-amount, amount), y: randomBetween(-amount, amount) }; }
function randomPosition(radius = DEFAULT_RADIUS) {
  return { x: randomBetween(radius, WIDTH - radius), y: randomBetween(radius, HEIGHT - radius) };
}
function countByTribe(organisms) {
  return organisms.reduce((acc, o) => {
    if (o.alive) acc[o.tribe] += 1;
    return acc;
  }, { red: 0, green: 0, blue: 0 });
}
function sizeEnergyDrain(radius) {
  return 1 + Math.max(0, (radius - DEFAULT_RADIUS) / DEFAULT_RADIUS) * 0.34;
}
function deathFoodCount(radius, scale, maxBurst) {
  return clamp(Math.round((radius / DEFAULT_RADIUS) * 3.2 * scale), 3, maxBurst);
}
function ensureAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return null;
  if (!state.audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new Ctx();
  }
  if (state.audioCtx.state === "suspended") state.audioCtx.resume();
  return state.audioCtx;
}
function playTone(freq, duration, type, volume = state.settings.soundVolume, glideTo) {
  const audio = ensureAudio();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.max(600, freq * 4), now);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, glideTo), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}
function playNoise(duration, volume = state.settings.soundVolume, filterFreq = 1400) {
  const audio = ensureAudio();
  if (!audio) return;
  const buffer = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * duration)), audio.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
  const src = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  const now = audio.currentTime;
  src.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFreq, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  src.start(now);
}
function playDeathPop() { playTone(210, 0.12, "triangle", state.settings.soundVolume, 82); playNoise(0.08, state.settings.soundVolume, 1200); }
function playFoodEat() { playTone(620, 0.09, "sine", state.settings.soundVolume, 780); playTone(420, 0.11, "triangle", state.settings.soundVolume, 520); }
function playOrganismEat() { playTone(180, 0.16, "sawtooth", state.settings.soundVolume, 110); playNoise(0.06, state.settings.soundVolume, 900); }
function playBossEat() { playTone(92, 0.28, "square", state.settings.soundVolume, 58); playTone(138, 0.22, "sawtooth", state.settings.soundVolume, 70); playNoise(0.09, state.settings.soundVolume, 480); }
function playSpawnSound() { playTone(340, 0.12, "triangle", state.settings.soundVolume, 510); playTone(510, 0.08, "sine", state.settings.soundVolume, 680); }

function flowField(x, y, current) {
  const nx = x / WIDTH;
  const ny = y / HEIGHT;
  const fx = Math.sin(ny * current.ay + current.ax) + Math.cos(nx * current.by + current.bx);
  const fy = Math.cos(nx * current.cy + current.cx) - Math.sin(ny * current.ay * 0.72 + current.ax * 0.6);
  return normalize(fx, fy);
}
function buildCurrentField(current) {
  const vectors = [];
  for (let x = CURRENT_NODE_SPACING / 2; x < WIDTH; x += CURRENT_NODE_SPACING) {
    for (let y = CURRENT_NODE_SPACING / 2; y < HEIGHT; y += CURRENT_NODE_SPACING) {
      const flow = flowField(x, y, current);
      vectors.push({ x, y, dx: flow.x, dy: flow.y });
    }
  }
  return vectors;
}
function createRock(existing = []) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const radius = randomBetween(26, 54);
    const rock = { id: `rock-${Math.random().toString(36).slice(2, 9)}`, x: randomBetween(radius + 24, WIDTH - radius - 24), y: randomBetween(radius + 24, HEIGHT - radius - 24), radius };
    const overlaps = existing.some((other) => distance(rock, other) < rock.radius + other.radius + 40);
    if (!overlaps) return rock;
  }
  return { id: `rock-${Math.random().toString(36).slice(2, 9)}`, x: randomBetween(60, WIDTH - 60), y: randomBetween(60, HEIGHT - 60), radius: randomBetween(26, 54) };
}
function generateEnvironment() {
  const rocks = [];
  for (let i = 0; i < ROCK_COUNT; i++) rocks.push(createRock(rocks));
  return {
    rocks,
    current: {
      ax: randomBetween(0, Math.PI * 2),
      ay: randomBetween(5.5, 10),
      bx: randomBetween(0, Math.PI * 2),
      by: randomBetween(4.5, 8.5),
      cx: randomBetween(0, Math.PI * 2),
      cy: randomBetween(5.5, 9.5),
    },
  };
}
function createOrganism(tribe, overrides = {}) {
  const radius = overrides.radius ?? DEFAULT_RADIUS;
  const pos = randomPosition(radius);
  return {
    id: nextId++,
    tribe,
    x: overrides.x ?? pos.x,
    y: overrides.y ?? pos.y,
    vx: overrides.vx ?? randomBetween(-1, 1),
    vy: overrides.vy ?? randomBetween(-1, 1),
    radius,
    speed: overrides.speed ?? DEFAULT_SPEED,
    lifetimeLeft: overrides.lifetimeLeft ?? BASE_LIFETIME,
    mealsEaten: overrides.mealsEaten ?? 0,
    killsSinceSplit: overrides.killsSinceSplit ?? 0,
    lastFoodX: overrides.lastFoodX ?? null,
    lastFoodY: overrides.lastFoodY ?? null,
    recentKillTimer: overrides.recentKillTimer ?? 0,
    grazeCount: overrides.grazeCount ?? 0,
    aggression: overrides.aggression ?? clamp(1 + randomBetween(-0.05, 0.05), 0.7, 1.4),
    fear: overrides.fear ?? clamp(1 + randomBetween(-0.05, 0.05), 0.7, 1.4),
    scavenging: overrides.scavenging ?? clamp(1 + randomBetween(-0.05, 0.05), 0.7, 1.4),
    trail: overrides.trail ?? [],
    alive: overrides.alive ?? true,
  };
}
function createFood(overrides = {}) {
  const pos = randomPosition(WHITE_FOOD_RADIUS);
  return {
    id: nextFoodId++,
    x: overrides.x ?? pos.x,
    y: overrides.y ?? pos.y,
    radius: overrides.radius ?? WHITE_FOOD_RADIUS,
    vx: overrides.vx ?? randomBetween(-1, 1),
    vy: overrides.vy ?? randomBetween(-1, 1),
    speed: overrides.speed ?? WHITE_FOOD_SPEED,
    ttl: overrides.ttl ?? randomBetween(8, 18),
    value: overrides.value ?? randomBetween(0.9, 1.2),
    tribe: overrides.tribe,
  };
}
function createFoodBurst(x, y, radius, scale, maxBurst, tribe) {
  const count = deathFoodCount(radius, scale, maxBurst);
  return Array.from({ length: count }, () =>
    createFood({
      x: clamp(x + randomBetween(-radius * 1.8, radius * 1.8), WHITE_FOOD_RADIUS, WIDTH - WHITE_FOOD_RADIUS),
      y: clamp(y + randomBetween(-radius * 1.8, radius * 1.8), WHITE_FOOD_RADIUS, HEIGHT - WHITE_FOOD_RADIUS),
      vx: randomBetween(-1, 1),
      vy: randomBetween(-1, 1),
      ttl: randomBetween(8, 18),
      value: randomBetween(0.9, 1.3),
      tribe,
    })
  );
}
function getRole(organism) {
  if (organism.recentKillTimer > 0) return "hunter";
  if (organism.grazeCount >= GRAZER_THRESHOLD) return "grazer";
  return "scavenger";
}
function tribeCounts(population) {
  const values = Object.values(population);
  return { min: Math.min(...values), max: Math.max(...values) };
}
function predatorKillReward(preyRadius, predatorMealBonus) {
  if (preyRadius > DEFAULT_RADIUS * 1.8) return predatorMealBonus + 2;
  if (preyRadius > DEFAULT_RADIUS * 1.2) return predatorMealBonus + 1;
  return predatorMealBonus;
}
function mutateTrait(value, amount) {
  return clamp(value + randomBetween(-amount, amount), 0.6, 1.6);
}
function spawnChildrenFromHunter(hunter, mutation) {
  return [0, 1].map(() =>
    createOrganism(hunter.tribe, {
      x: clamp(hunter.x + randomBetween(-12, 12), DEFAULT_RADIUS, WIDTH - DEFAULT_RADIUS),
      y: clamp(hunter.y + randomBetween(-12, 12), DEFAULT_RADIUS, HEIGHT - DEFAULT_RADIUS),
      aggression: mutateTrait(hunter.aggression, mutation),
      fear: mutateTrait(hunter.fear, mutation),
      scavenging: mutateTrait(hunter.scavenging, mutation),
    })
  );
}

function resetSimulation() {
  playSpawnSound();
  nextId = 1;
  nextFoodId = 1;
  nextBossId = 1;
  state.organisms = [];
  for (const tribe of Object.keys(TRIBES)) {
    for (let i = 0; i < INITIAL_PER_TRIBE; i++) state.organisms.push(createOrganism(tribe));
  }
  state.food = Array.from({ length: INITIAL_WHITE_FOOD }, () => createFood());
  state.bosses = [];
  state.hotZones = [];
  state.kills = { red: 0, green: 0, blue: 0 };
  state.deaths = { red: 0, green: 0, blue: 0 };
  state.foodByTribe = { red: 0, green: 0, blue: 0 };
  state.winner = null;
  state.finalPhase = false;
  state.running = true;
  state.environment = generateEnvironment();
  state.currentField = buildCurrentField(state.environment.current);
  winnerOverlay.classList.add("hidden");
  updateButtons();
}

function spawnBoss() {
  playSpawnSound();
  state.features.boss = true;
  const pos = randomPosition(18);
  state.bosses = [{ id: nextBossId++, x: pos.x, y: pos.y, vx: 0, vy: 0, radius: 64, speed: 90, cooldown: 0 }];
  renderFeaturePanel();
}

function spawnOne(tribe) {
  playSpawnSound();
  state.organisms.push(createOrganism(tribe));
  state.running = true;
  state.winner = null;
  winnerOverlay.classList.add("hidden");
  updateButtons();
}

function updateButtons() {
  playPauseBtn.textContent = state.running ? "Pause" : "Play";
}

function renderFeaturePanel() {
  featureGrid.innerHTML = "";
  Object.entries(state.features).forEach(([key, value]) => {
    const btn = document.createElement("button");
    btn.className = "feature-btn";
    btn.innerHTML = `<span>${key === "boss" ? "boss predator" : key}</span><span>${value ? "On" : "Off"}</span>`;
    btn.addEventListener("click", () => {
      state.features[key] = !state.features[key];
      if (key === "boss" && !state.features[key]) state.bosses = [];
      renderFeaturePanel();
    });
    featureGrid.appendChild(btn);
  });
}

const sliderDefs = [
  ["Food burst scale", "foodBurstScale", 0.5, 2.5, 0.1],
  ["Food burst max", "foodBurstMax", 4, 20, 1],
  ["Hungry threshold", "hungerThreshold", 2, 8, 0.25],
  ["Critical threshold", "criticalHungerThreshold", 0.5, 4, 0.25],
  ["Predator meal bonus", "predatorMealBonus", 2, 10, 1],
  ["Terrain drift", "terrainDrift", 0, 2, 0.1],
  ["Leak rate", "leakRate", 0, 2, 0.1],
  ["Hot zone bias", "hotZoneBias", 0, 2, 0.1],
  ["Shrink rate", "shrinkRate", 0.02, 0.35, 0.01],
  ["Obstacle avoidance", "obstacleAvoidance", 0, 2, 0.1],
  ["Current visibility", "currentVisibility", 0, 1.2, 0.05],
  ["Trail length", "trailLength", 5, 100, 1],
  ["Trail fade", "trailFade", 0.7, 0.99, 0.01],
  ["Boss spawn food", "bossWhiteFoodThreshold", 20, 300, 5],
  ["Sound volume", "soundVolume", 0, 0.08, 0.005],
];

function renderSliderPanel() {
  sliderGrid.innerHTML = "";
  sliderDefs.forEach(([label, key, min, max, step]) => {
    const wrap = document.createElement("div");
    wrap.className = "slider-card";
    wrap.innerHTML = `
      <div class="slider-head"><span>${label}</span><span data-value>${state.settings[key]}</span></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${state.settings[key]}">
    `;
    const input = wrap.querySelector("input");
    const valueEl = wrap.querySelector("[data-value]");
    input.addEventListener("input", () => {
      state.settings[key] = Number(input.value);
      valueEl.textContent = input.value;
    });
    sliderGrid.appendChild(wrap);
  });
}

function updateHUD() {
  const population = countByTribe(state.organisms);
  hud.innerHTML = `
    <div class="badge"><span class="label">Alive/Dead</span></div>
    <div class="badge"><span class="dot blue"></span><span>${population.blue}</span><span class="muted">/</span><span>${state.deaths.blue}</span></div>
    <div class="badge"><span class="dot red"></span><span>${population.red}</span><span class="muted">/</span><span>${state.deaths.red}</span></div>
    <div class="badge"><span class="dot green"></span><span>${population.green}</span><span class="muted">/</span><span>${state.deaths.green}</span></div>
    <div class="badge"><span class="dot yellow"></span><span>${state.bosses.length}</span></div>
  `;
}

function drawBackgroundGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const x = (WIDTH / 18) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const y = (HEIGHT / 12) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}
function drawCurrents() {
  if (!state.features.currents) return;
  ctx.save();
  ctx.strokeStyle = "rgba(190,220,255,0.9)";
  ctx.fillStyle = "rgba(190,220,255,0.95)";
  ctx.globalAlpha = 0.22 * state.settings.currentVisibility;
  ctx.lineWidth = 1.4;
  for (const vector of state.currentField) {
    const len = 14;
    const x2 = vector.x + vector.dx * len;
    const y2 = vector.y + vector.dy * len;
    ctx.beginPath();
    ctx.moveTo(vector.x, vector.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2, y2, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawRocks() {
  if (!state.features.rocks) return;
  for (const rock of state.environment.rocks) {
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.arc(rock.x, rock.y, rock.radius * 1.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#171b24";
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
function drawTrails() {
  if (!state.features.trails) return;
  for (const organism of state.organisms) {
    for (const point of organism.trail) {
      ctx.fillStyle = hexToRgba(TRIBES[organism.tribe].color, 0.34 * point.life * point.fade);
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
function drawFood() {
  for (const pellet of state.food) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, pellet.radius * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pellet.tribe ? TRIBES[pellet.tribe].color : "#ffffff";
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, pellet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawBosses() {
  if (!state.features.boss) return;
  for (const b of state.bosses) {
    const bossFade = clamp((b.radius - BOSS_MIN_RADIUS) / 20, SIZE_FADE_FLOOR, 1);
    ctx.fillStyle = `rgba(255,216,77,${0.12 * bossFade})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,216,77,${bossFade})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawOrganisms() {
  for (const organism of state.organisms) {
    if (!organism.alive) continue;
    const hungerPulse = organism.lifetimeLeft < state.settings.criticalHungerThreshold ? 1.28 : organism.lifetimeLeft < state.settings.hungerThreshold ? 1.14 : 1;
    const opacity = clamp(organism.lifetimeLeft / BASE_LIFETIME, 0, 1);
    ctx.fillStyle = hexToRgba(TRIBES[organism.tribe].color, 0.08 * opacity);
    ctx.beginPath();
    ctx.arc(organism.x, organism.y, organism.radius * 1.9 * hungerPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexToRgba(TRIBES[organism.tribe].color, opacity);
    ctx.beginPath();
    ctx.arc(organism.x, organism.y, organism.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackgroundGrid();
  drawCurrents();
  drawRocks();
  drawTrails();
  drawFood();
  drawBosses();
  drawOrganisms();
  updateHUD();
}

function checkWinner() {
  const population = countByTribe(state.organisms);
  const living = Object.entries(population).filter(([, count]) => count > 0);
  if (living.length === 1 && state.organisms.length > 0) {
    const winningTribe = living[0][0];
    state.winner = {
      tribe: winningTribe,
      label: TRIBES[winningTribe].label,
      color: TRIBES[winningTribe].color,
      kills: state.kills[winningTribe],
      food: state.foodByTribe[winningTribe],
      survivors: population[winningTribe],
    };
    state.running = false;
    winnerTitle.textContent = `${state.winner.label} wins`;
    winnerTitle.style.color = state.winner.color;
    winnerStats.innerHTML = `
      <div class="winner-stat"><span>Kills</span><span>${state.winner.kills}</span></div>
      <div class="winner-stat"><span>Food eaten</span><span>${state.winner.food}</span></div>
      <div class="winner-stat"><span>Survivors</span><span>${state.winner.survivors}</span></div>
    `;
    winnerOverlay.classList.remove("hidden");
  } else if (living.length === 0) {
    state.winner = { tribe: null, label: "No tribe survived", color: "#ffffff", kills: 0, food: 0, survivors: 0 };
    state.running = false;
    winnerTitle.textContent = state.winner.label;
    winnerTitle.style.color = state.winner.color;
    winnerStats.innerHTML = `<div class="winner-stat"><span>Result</span><span>Extinction</span></div>`;
    winnerOverlay.classList.remove("hidden");
  }
  updateButtons();
}

function step(time) {
  if (!state.lastTime) state.lastTime = time;
  const dt = clamp((time - state.lastTime) / 1000, 0.001, 0.03);
  state.lastTime = time;

  if (state.running && !state.winner) {
    if (!state.features.boss && state.bosses.length) state.bosses = [];

    if (state.features.hotZones) {
      state.hotZones = state.hotZones.map((z) => ({ ...z, ttl: z.ttl - dt })).filter((z) => z.ttl > 0);
    }

    let foodEatCount = 0;
    let organismEatCount = 0;
    let bossEatCount = 0;
    let popDeathCount = 0;

    const countsSnapshot = countByTribe(state.organisms);

    for (const pellet of state.food) {
      pellet.ttl -= dt;
      const drift = jitter(0.08);
      const flow = state.features.currents ? flowField(pellet.x, pellet.y, state.environment.current) : { x: 0, y: 0 };
      const dirF = normalize((pellet.vx ?? 0.5) + drift.x + flow.x * state.settings.terrainDrift * 0.9, (pellet.vy ?? 0.5) + drift.y + flow.y * state.settings.terrainDrift * 0.9);
      pellet.vx = dirF.x;
      pellet.vy = dirF.y;
      pellet.x = clamp(pellet.x + pellet.vx * pellet.speed * dt, pellet.radius, WIDTH - pellet.radius);
      pellet.y = clamp(pellet.y + pellet.vy * pellet.speed * dt, pellet.radius, HEIGHT - pellet.radius);
      if (pellet.x <= pellet.radius + 1 || pellet.x >= WIDTH - pellet.radius - 1) pellet.vx *= -1;
      if (pellet.y <= pellet.radius + 1 || pellet.y >= HEIGHT - pellet.radius - 1) pellet.vy *= -1;

      if (state.features.rocks) {
        for (const rock of state.environment.rocks) {
          const d = distance(pellet, rock);
          if (d < rock.radius + pellet.radius + 3) {
            const away = normalize(pellet.x - rock.x, pellet.y - rock.y);
            pellet.vx = away.x;
            pellet.vy = away.y;
            pellet.x = clamp(rock.x + away.x * (rock.radius + pellet.radius + 4), pellet.radius, WIDTH - pellet.radius);
            pellet.y = clamp(rock.y + away.y * (rock.radius + pellet.radius + 4), pellet.radius, HEIGHT - pellet.radius);
          }
        }
      }
    }
    state.food = state.food.filter((pellet) => pellet.ttl > 0);

    for (const b of state.bosses) {
      b.cooldown = Math.max(0, b.cooldown - dt);
      b.radius -= BOSS_PASSIVE_SHRINK_PER_SECOND * dt;
      let target = null;
      let best = Infinity;
      for (const o of state.organisms) {
        if (!o.alive) continue;
        const d = distance(o, b);
        if (d < best) { best = d; target = o; }
      }
      const dirB = target ? normalize(target.x - b.x, target.y - b.y) : normalize(Math.cos(time * 0.001), Math.sin(time * 0.0013));
      const bossSpeed = b.cooldown > 0 ? b.speed * 0.55 : b.speed;
      b.vx = dirB.x;
      b.vy = dirB.y;
      b.x = clamp(b.x + b.vx * bossSpeed * dt, b.radius, WIDTH - b.radius);
      b.y = clamp(b.y + b.vy * bossSpeed * dt, b.radius, HEIGHT - b.radius);
    }

    for (let i = 0; i < state.organisms.length; i++) {
      const organism = state.organisms[i];
      if (!organism.alive) continue;
      const tribeInfo = TRIBES[organism.tribe];

      let desiredX = 0, desiredY = 0, alignX = 0, alignY = 0;
      let nearestPredator = Infinity, nearestPrey = Infinity, nearestFoodScore = Infinity;
      let predatorRepelX = 0, predatorRepelY = 0;
      let predX = 0, predY = 0, preyX = 0, preyY = 0, foodX = 0, foodY = 0;

      for (let j = 0; j < state.organisms.length; j++) {
        if (i === j) continue;
        const other = state.organisms[j];
        if (!other.alive) continue;
        const dx = other.x - organism.x;
        const dy = other.y - organism.y;
        const d = Math.hypot(dx, dy) || 0.001;

        if (other.tribe === tribeInfo.predator) {
          const fear = 1 - Math.min(d / PREDATOR_ALERT_RADIUS, 1);
          predatorRepelX -= (dx / d) * (fear * 8.5 + 0.35);
          predatorRepelY -= (dy / d) * (fear * 8.5 + 0.35);
          if (d < nearestPredator) { nearestPredator = d; predX = dx / d; predY = dy / d; }
        }
        if (other.tribe === tribeInfo.prey && d < nearestPrey) {
          nearestPrey = d; preyX = dx / d; preyY = dy / d;
        }
        if (other.tribe === organism.tribe && d < ALLY_GROUP_RADIUS) {
          const closeness = 1 - d / ALLY_GROUP_RADIUS;
          const edgeBias = Math.max(0, 1 - Math.min(organism.x, WIDTH - organism.x, organism.y, HEIGHT - organism.y) / 70);
          const swarmBias = nearestPredator < Infinity || nearestPrey < Infinity ? 0.24 : edgeBias > 0.15 ? 0.18 : 0.72;
          desiredX += (dx / d) * GROUP_FORCE * closeness * swarmBias;
          desiredY += (dy / d) * GROUP_FORCE * closeness * swarmBias;
          alignX += (other.vx || 0) * SWARM_ALIGNMENT_FORCE * closeness * swarmBias;
          alignY += (other.vy || 0) * SWARM_ALIGNMENT_FORCE * closeness * swarmBias;
          if (d < organism.radius * 4.2) {
            desiredX -= (dx / d) * SWARM_CLOSE_REPULSION * (1 - d / (organism.radius * 4.2));
            desiredY -= (dy / d) * SWARM_CLOSE_REPULSION * (1 - d / (organism.radius * 4.2));
          }
        }
      }

      for (const pellet of state.food) {
        if (pellet.tribe && pellet.tribe !== tribeInfo.prey) continue;
        const dx = pellet.x - organism.x;
        const dy = pellet.y - organism.y;
        const d = Math.hypot(dx, dy) || 0.001;
        let bossPenalty = 1;
        for (const b of state.bosses) {
          const db = Math.hypot(pellet.x - b.x, pellet.y - b.y);
          const blockRadius = Math.max(b.radius * 6.5, PREDATOR_ALERT_RADIUS * 0.55);
          if (db < blockRadius) {
            bossPenalty = organism.lifetimeLeft <= state.settings.criticalHungerThreshold ? 0.55 : 0.2;
            break;
          }
        }
        const starvationBoost = organism.lifetimeLeft <= state.settings.criticalHungerThreshold
          ? 8.5
          : organism.lifetimeLeft <= state.settings.hungerThreshold ? HUNGER_FOOD_PRIORITY : 1;
        const score = d / (pellet.value * starvationBoost * bossPenalty);
        if (score < nearestFoodScore) {
          nearestFoodScore = score;
          foodX = dx / d;
          foodY = dy / d;
        }
      }

      const starving = organism.lifetimeLeft <= state.settings.criticalHungerThreshold;
      for (const b of state.bosses) {
        const dx = b.x - organism.x;
        const dy = b.y - organism.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const panicRadius = Math.max(PREDATOR_ALERT_RADIUS * BOSS_TERROR_RADIUS_MULTIPLIER, b.radius * 12);
        if (d < panicRadius) {
          const terror = 1 - d / panicRadius;
          const centerDir = normalize(WIDTH * 0.5 - organism.x, HEIGHT * 0.5 - organism.y);
          const bossFlee = starving ? 4.2 : (20 * terror + 4);
          desiredX -= (dx / d) * bossFlee;
          desiredY -= (dy / d) * bossFlee;
          desiredX += centerDir.x * (6.5 * terror);
          desiredY += centerDir.y * (6.5 * terror);
        }
      }

      const predatorPressure = nearestPredator < Infinity ? clamp(1 - nearestPredator / PREDATOR_ALERT_RADIUS, 0, 1) : 0;
      const hungerPressure = clamp(1 - organism.lifetimeLeft / Math.max(state.settings.hungerThreshold, 0.001), 0, 1);
      const fleeWeight = predatorPressure * (TARGET_COMMIT_FORCE * 0.72);

      if (nearestPredator < Infinity) {
        desiredX += predatorRepelX * 0.18 - predX * fleeWeight;
        desiredY += predatorRepelY * 0.18 - predY * fleeWeight;
        const centerDx = WIDTH * 0.5 - organism.x;
        const centerDy = HEIGHT * 0.5 - organism.y;
        const centerDir = normalize(centerDx, centerDy);
        desiredX += centerDir.x * (predatorPressure * 2.2);
        desiredY += centerDir.y * (predatorPressure * 2.2);
      }
      if (nearestPrey < Infinity) {
        const chaseWeight = TARGET_COMMIT_FORCE * (1.55 + hungerPressure * 0.95 - predatorPressure * 0.08) * (starving ? 0.72 : 1);
        desiredX += preyX * chaseWeight;
        desiredY += preyY * chaseWeight;
      }
      if (nearestFoodScore < Infinity) {
        const foodWeight = (starving ? 8.5 : HUNGER_FOOD_PRIORITY) * (0.95 + hungerPressure * 1.35) * (1 - predatorPressure * (starving ? 0.03 : 0.1));
        desiredX += foodX * foodWeight;
        desiredY += foodY * foodWeight;
      }

      const edgeMargin = 48;
      const edgeProximityX = Math.max(0, 1 - Math.min(organism.x, WIDTH - organism.x) / edgeMargin);
      const edgeProximityY = Math.max(0, 1 - Math.min(organism.y, HEIGHT - organism.y) / edgeMargin);
      const edgeProximity = Math.max(edgeProximityX, edgeProximityY);
      if (organism.x < edgeMargin) desiredX += EDGE_ESCAPE_FORCE * 0.28;
      if (organism.x > WIDTH - edgeMargin) desiredX -= EDGE_ESCAPE_FORCE * 0.28;
      if (organism.y < edgeMargin) desiredY += EDGE_ESCAPE_FORCE * 0.28;
      if (organism.y > HEIGHT - edgeMargin) desiredY -= EDGE_ESCAPE_FORCE * 0.28;
      desiredX += (WIDTH * 0.5 - organism.x) / WIDTH * (EDGE_RETURN_FORCE * edgeProximity * (1.35 + predatorPressure * 0.85 + hungerPressure * 0.45));
      desiredY += (HEIGHT * 0.5 - organism.y) / HEIGHT * (EDGE_RETURN_FORCE * edgeProximity * (1.35 + predatorPressure * 0.85 + hungerPressure * 0.45));
      if (edgeProximity > 0.5) {
        desiredX += randomBetween(-EDGE_STUCK_JITTER, EDGE_STUCK_JITTER) * edgeProximity;
        desiredY += randomBetween(-EDGE_STUCK_JITTER, EDGE_STUCK_JITTER) * edgeProximity;
      }

      if (predatorPressure < 0.55) {
        const alignWeight = 0.68 - edgeProximity * EDGE_SWARM_DAMPING - predatorPressure * 0.45;
        desiredX += alignX * Math.max(0, alignWeight);
        desiredY += alignY * Math.max(0, alignWeight);
      }

      if (Math.hypot(desiredX, desiredY) < MIN_MOVE_VECTOR) {
        const centerDir = normalize(WIDTH * 0.5 - organism.x + randomBetween(-12, 12), HEIGHT * 0.5 - organism.y + randomBetween(-12, 12));
        desiredX = centerDir.x;
        desiredY = centerDir.y;
      }

      const desiredDir = normalize(desiredX, desiredY);
      const swayFactor = edgeProximity > 0.2 ? 0.34 : DIRECTION_SWAY_FACTOR;
      const blendedDir = normalize(
        (organism.vx || 0) * (1 - swayFactor) + desiredDir.x * swayFactor,
        (organism.vy || 0) * (1 - swayFactor) + desiredDir.y * swayFactor
      );
      organism.vx = blendedDir.x;
      organism.vy = blendedDir.y;
      organism.x = clamp(organism.x + organism.vx * organism.speed * dt, organism.radius, WIDTH - organism.radius);
      organism.y = clamp(organism.y + organism.vy * organism.speed * dt, organism.radius, HEIGHT - organism.radius);

      if (state.features.rocks) {
        for (const rock of state.environment.rocks) {
          const dRock = distance(organism, rock);
          const safe = rock.radius + organism.radius + 1.5;
          if (dRock < safe) {
            const away = normalize(organism.x - rock.x, organism.y - rock.y);
            organism.x = clamp(rock.x + away.x * safe, organism.radius, WIDTH - organism.radius);
            organism.y = clamp(rock.y + away.y * safe, organism.radius, HEIGHT - organism.radius);
            organism.vx = away.x;
            organism.vy = away.y;
          }
        }
      }

      if (state.features.separation) {
        for (let k = 0; k < state.organisms.length; k++) {
          if (k === i) continue;
          const other = state.organisms[k];
          if (!other.alive) continue;
          const dx = organism.x - other.x;
          const dy = organism.y - other.y;
          const d = Math.hypot(dx, dy) || 0.0001;
          const minDist = organism.radius + other.radius + 1.5;
          if (d < minDist) {
            const push = (minDist - d) * 0.5;
            organism.x = clamp(organism.x + (dx / d) * push, organism.radius, WIDTH - organism.radius);
            organism.y = clamp(organism.y + (dy / d) * push, organism.radius, HEIGHT - organism.radius);
          }
        }
      }

      organism.recentKillTimer = Math.max(0, organism.recentKillTimer - dt);
      organism.grazeCount *= GRAZER_DECAY;
      organism.lifetimeLeft -= dt * sizeEnergyDrain(organism.radius);
      if (state.features.shrink) {
        const hungerCollapse = clamp(1 - organism.lifetimeLeft / Math.max(0.001, BASE_LIFETIME), 0, 1);
        const sizeDecay = state.settings.shrinkRate * (1 + Math.max(0, organism.radius - DEFAULT_RADIUS) / DEFAULT_RADIUS * 0.45 + hungerCollapse * 2.4);
        organism.radius = clamp(organism.radius - dt * sizeDecay, MIN_RADIUS, MAX_ORGANISM_RADIUS);
      }
      if (state.features.trails) {
        organism.trail.push({ x: organism.x, y: organism.y, r: organism.radius, life: 1, fade: clamp(organism.lifetimeLeft / BASE_LIFETIME, 0, 1) });
        if (organism.trail.length > state.settings.trailLength) organism.trail.shift();
        organism.trail.forEach((point) => {
          point.life *= state.settings.trailFade;
          point.r *= TRAIL_SHRINK;
          point.fade *= TRAIL_FADE_DECAY;
        });
        organism.trail = organism.trail.filter((point) => point.life > 0.04 && point.r > 0.35);
      } else {
        organism.trail = [];
      }
    }

    for (const b of state.bosses) {
      for (const o of state.organisms) {
        if (!o.alive) continue;
        if (distance(o, b) <= b.radius + o.radius) {
          o.alive = false;
          b.cooldown = 1.5;
          state.deaths[o.tribe] += 1;
          popDeathCount += 1;
          bossEatCount += 1;
          state.food.push(...createFoodBurst(o.x, o.y, o.radius, state.settings.foodBurstScale, state.settings.foodBurstMax, o.tribe));
        }
      }
    }

    for (const hunter of state.organisms) {
      if (!hunter.alive) continue;
      const preyTribe = TRIBES[hunter.tribe].prey;

      for (const pellet of state.food) {
        if (!pellet || pellet._eaten) continue;
        const d = distance(hunter, pellet);
        if (d <= (hunter.radius + pellet.radius) * 1.45 + 1) {
          if (pellet.tribe && pellet.tribe !== preyTribe) continue;
          pellet._eaten = true;
          hunter.lifetimeLeft += WHITE_FOOD_BONUS * 1.3 * pellet.value;
          hunter.radius = clamp(hunter.radius * 1.035, MIN_RADIUS, MAX_ORGANISM_RADIUS);
          hunter.speed = Math.max(18, hunter.speed * 0.992);
          hunter.mealsEaten += 1;
          hunter.grazeCount += 1;
          state.foodByTribe[hunter.tribe] += 1;
          foodEatCount += 1;
          break;
        }
      }

      for (const prey of state.organisms) {
        if (hunter === prey || !prey.alive) continue;
        if (prey.tribe !== preyTribe) continue;
        const d = distance(hunter, prey);
        if (d <= (hunter.radius + prey.radius) * 1.45) {
          prey.alive = false;
          state.deaths[prey.tribe] += 1;
          popDeathCount += 1;
          hunter.radius = clamp(hunter.radius * 1.28, MIN_RADIUS, MAX_ORGANISM_RADIUS);
          hunter.speed = Math.max(16, hunter.speed * 0.82);
          hunter.lifetimeLeft += predatorKillReward(prey.radius, state.settings.predatorMealBonus);
          hunter.mealsEaten += 1;
          hunter.killsSinceSplit += 1;
          hunter.recentKillTimer = 4.5;
          hunter.grazeCount = Math.max(0, hunter.grazeCount - 2);
          state.kills[hunter.tribe] += 1;
          organismEatCount += 1;
          state.food.push(...createFoodBurst(prey.x, prey.y, prey.radius, state.settings.foodBurstScale, state.settings.foodBurstMax, prey.tribe));
          if (state.features.hotZones) state.hotZones.push({ x: prey.x, y: prey.y, radius: HOT_ZONE_RADIUS, ttl: HOT_ZONE_DURATION });

          if (hunter.killsSinceSplit >= SPLIT_AFTER_KILLS) {
            hunter.alive = false;
            state.organisms.push(...spawnChildrenFromHunter(hunter, 0.08));
          }
          break;
        }
      }
    }

    state.food = state.food.filter((p) => !p._eaten).slice(0, MAX_WHITE_FOOD);
    state.organisms = state.organisms.filter((o) => {
      if (!o.alive || o.lifetimeLeft <= 0 || o.radius <= MIN_RADIUS) {
        if (o.alive && (o.lifetimeLeft <= 0 || o.radius <= MIN_RADIUS)) {
          state.deaths[o.tribe] += 1;
          popDeathCount += 1;
          state.food.push(...createFoodBurst(o.x, o.y, Math.max(o.radius, DEFAULT_RADIUS * 0.8), state.settings.foodBurstScale, state.settings.foodBurstMax, o.tribe));
        }
        return false;
      }
      return true;
    });
    state.bosses = state.bosses.filter((b) => b.radius > BOSS_MIN_RADIUS);

    if (state.features.boss && state.bosses.length === 0 && state.food.length >= state.settings.bossWhiteFoodThreshold) {
      const pos = randomPosition(18);
      state.bosses = [{ id: nextBossId++, x: pos.x, y: pos.y, vx: 0, vy: 0, radius: 64, speed: 90, cooldown: 0 }];
    }

    if (bossEatCount > 0) playBossEat();
    else if (organismEatCount > 0) playOrganismEat();
    else if (foodEatCount > 0) playFoodEat();
    if (popDeathCount > 0) playDeathPop();

    checkWinner();
  }

  render();
  requestAnimationFrame(step);
}

playPauseBtn.addEventListener("click", () => { state.running = !state.running; updateButtons(); });
resetBtn.addEventListener("click", resetSimulation);
restartBtn.addEventListener("click", resetSimulation);
spawnBossBtn.addEventListener("click", spawnBoss);
spawnRedBtn.addEventListener("click", () => spawnOne("red"));
spawnBlueBtn.addEventListener("click", () => spawnOne("blue"));
spawnGreenBtn.addEventListener("click", () => spawnOne("green"));
featuresToggleBtn.addEventListener("click", () => featuresPanel.classList.toggle("hidden"));
rulesToggleBtn.addEventListener("click", () => rulesPanel.classList.toggle("hidden"));
tuningToggleBtn.addEventListener("click", () => tuningPanel.classList.toggle("hidden"));
resetTuningBtn.addEventListener("click", () => {
  state.settings = { ...DEFAULT_SETTINGS };
  renderSliderPanel();
});

document.addEventListener("pointerover", (event) => {
  const target = event.target;
  if (target.closest("button")) playTone(780, 0.04, "sine", state.settings.soundVolume, 860);
}, true);
document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (target.closest("button, input[type='range']")) playTone(280, 0.06, "triangle", state.settings.soundVolume, 220);
}, true);

renderFeaturePanel();
renderSliderPanel();
resetSimulation();
requestAnimationFrame(step);
