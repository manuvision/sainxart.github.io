import {
  BIOMES,
  BOSS_ENEMY_ID,
  DEFAULT_SELL_RATIO,
  ENEMY_ARCHETYPES,
  ENGINE_VERSION,
  FIXED_STEP_SECONDS,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_TOWER_LEVEL,
  MIN_BUILD_PADS,
  MIN_PATH_TILES,
  NORMAL_ENEMY_IDS,
  RELIC_ORDER,
  RELICS,
  STARTING_BASE_HEALTH,
  STARTING_GOLD,
  TALENT_ORDER,
  TALENT_TREE,
  TARGET_BUILD_PADS_MAX,
  TARGET_BUILD_PADS_MIN,
  TOWER_ARCHETYPES,
  TOWER_ORDER,
} from "./content.js";

const UINT32_MAX = 0x100000000;
const DOT_TICK_SECONDS = 0.5;
const MAX_MASTERY = 5;

function clone(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, places = 4) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function asNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function actionError(state, message) {
  return { state, events: [], error: message };
}

function actionSuccess(state, events = []) {
  return { state, events, error: null };
}

export function normalizeSeed(value) {
  if (typeof value === "number" && Number.isFinite(value)) return (Math.floor(value) >>> 0) || 1;
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "cairnloom");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

export function hashSeed(...parts) {
  return normalizeSeed(parts.map((part) => String(part)).join("|"));
}

export function createRng(seed) {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX;
  };
}

function randomInteger(rng, minimum, maximum) {
  return minimum + Math.floor(rng() * (maximum - minimum + 1));
}

function shuffled(values, rng) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function gridDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function chooseNextColumn(currentX, rng) {
  const possible = [];
  for (let x = 0; x < MAP_WIDTH; x += 1) {
    const distance = Math.abs(x - currentX);
    if (distance >= 1 && distance <= 3) possible.push(x);
  }
  return possible[randomInteger(rng, 0, possible.length - 1)];
}

function pathNeighbourCount(cell, pathSet) {
  return [
    { x: cell.x - 1, y: cell.y },
    { x: cell.x + 1, y: cell.y },
    { x: cell.x, y: cell.y - 1 },
    { x: cell.x, y: cell.y + 1 },
  ].reduce((count, neighbour) => count + Number(pathSet.has(cellKey(neighbour))), 0);
}

export function validateMap(map) {
  const errors = [];
  if (!map || typeof map !== "object") return { valid: false, errors: ["Map must be an object."] };
  if (map.width !== MAP_WIDTH || map.height !== MAP_HEIGHT) errors.push(`Map must be ${MAP_WIDTH}×${MAP_HEIGHT}.`);
  if (!Array.isArray(map.path) || map.path.length < MIN_PATH_TILES) errors.push(`Path must contain at least ${MIN_PATH_TILES} tiles.`);
  if (!Array.isArray(map.buildPads) || map.buildPads.length < MIN_BUILD_PADS) errors.push(`Map must contain at least ${MIN_BUILD_PADS} build pads.`);

  if (Array.isArray(map.path) && map.path.length) {
    const seen = new Set();
    for (const cell of map.path) {
      if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.x >= MAP_WIDTH || cell.y < 0 || cell.y >= MAP_HEIGHT) {
        errors.push("Every path tile must be an in-bounds integer coordinate.");
        break;
      }
      const key = cellKey(cell);
      if (seen.has(key)) errors.push(`Path repeats tile ${key}.`);
      seen.add(key);
    }
    if (map.path[0]?.y !== 0) errors.push("Path must enter from the top row.");
    if (map.path.at(-1)?.y !== MAP_HEIGHT - 1) errors.push("Path must reach the bottom row.");
    for (let index = 1; index < map.path.length; index += 1) {
      if (manhattanDistance(map.path[index - 1], map.path[index]) !== 1) {
        errors.push(`Path tiles ${index - 1} and ${index} are not contiguous.`);
        break;
      }
    }
    if (seen.size === map.path.length) {
      map.path.forEach((cell, index) => {
        const expected = index === 0 || index === map.path.length - 1 ? 1 : 2;
        if (pathNeighbourCount(cell, seen) !== expected) errors.push(`Path branches or touches itself at ${cellKey(cell)}.`);
      });
    }
    const horizontalSteps = map.path.slice(1).filter((cell, index) => cell.x !== map.path[index].x).length;
    if (horizontalSteps < 3) errors.push("Path is not winding enough.");

    if (Array.isArray(map.buildPads)) {
      const padKeys = new Set();
      for (const pad of map.buildPads) {
        const key = cellKey(pad);
        if (!pad.id || !Number.isInteger(pad.x) || !Number.isInteger(pad.y) || pad.x < 0 || pad.x >= MAP_WIDTH || pad.y < 0 || pad.y >= MAP_HEIGHT) {
          errors.push("Every build pad must have an id and in-bounds integer coordinates.");
          break;
        }
        if (seen.has(key)) errors.push(`Build pad ${pad.id} overlaps the path.`);
        if (padKeys.has(key)) errors.push(`Build pads repeat tile ${key}.`);
        padKeys.add(key);
        const distanceToPath = Math.min(...map.path.map((pathCell) => manhattanDistance(pad, pathCell)));
        if (distanceToPath > 3) errors.push(`Build pad ${pad.id} is too far from the path.`);
      }
    }
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function buildMapAttempt(seed, chapter, attempt) {
  const mapSeed = hashSeed("cairnloom-map", seed, chapter, attempt);
  const rng = createRng(mapSeed);
  const path = [];
  let x = randomInteger(rng, 0, MAP_WIDTH - 1);
  path.push({ x, y: 0 });
  const shiftRows = new Set([1, 3, 5, 7, 9]);

  for (let y = 1; y < MAP_HEIGHT; y += 1) {
    path.push({ x, y });
    if (!shiftRows.has(y)) continue;
    const nextX = chooseNextColumn(x, rng);
    const direction = Math.sign(nextX - x);
    while (x !== nextX) {
      x += direction;
      path.push({ x, y });
    }
  }

  const pathSet = new Set(path.map(cellKey));
  const candidates = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let candidateX = 0; candidateX < MAP_WIDTH; candidateX += 1) {
      const candidate = { x: candidateX, y };
      if (pathSet.has(cellKey(candidate))) continue;
      const nearestPathIndex = path.reduce((nearest, pathCell, index) => {
        const distance = manhattanDistance(candidate, pathCell);
        return distance < nearest.distance ? { distance, index } : nearest;
      }, { distance: Infinity, index: 0 });
      if (nearestPathIndex.distance <= 2) candidates.push({ ...candidate, pathIndex: nearestPathIndex.index });
    }
  }

  const desiredPadCount = randomInteger(rng, TARGET_BUILD_PADS_MIN, TARGET_BUILD_PADS_MAX);
  const candidateOrder = shuffled(candidates, rng).sort((a, b) => a.pathIndex - b.pathIndex);
  const pads = [];
  const buckets = Array.from({ length: desiredPadCount }, () => []);
  candidateOrder.forEach((candidate) => {
    const bucket = Math.min(desiredPadCount - 1, Math.floor(candidate.pathIndex / Math.max(1, path.length) * desiredPadCount));
    buckets[bucket].push(candidate);
  });
  for (let bucketIndex = 0; bucketIndex < buckets.length && pads.length < desiredPadCount; bucketIndex += 1) {
    const candidate = buckets[bucketIndex].find((item) => pads.every((pad) => gridDistance(pad, item) >= 1.35));
    if (candidate) pads.push(candidate);
  }
  for (const candidate of candidateOrder) {
    if (pads.length >= desiredPadCount) break;
    if (!pads.some((pad) => pad.x === candidate.x && pad.y === candidate.y)) pads.push(candidate);
  }

  const buildPads = pads.slice(0, desiredPadCount).map(({ x: padX, y: padY }, index) => ({
    id: `pad-${index + 1}-${padX}-${padY}`,
    x: padX,
    y: padY,
  }));
  const padSet = new Set(buildPads.map(cellKey));
  const decorKinds = ["stone", "fern", "charred-tree", "rune"];
  const decor = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let decorX = 0; decorX < MAP_WIDTH; decorX += 1) {
      const cell = { x: decorX, y };
      if (pathSet.has(cellKey(cell)) || padSet.has(cellKey(cell)) || rng() > 0.23) continue;
      decor.push({ ...cell, kind: decorKinds[randomInteger(rng, 0, decorKinds.length - 1)], rotation: randomInteger(rng, -12, 12) });
    }
  }

  return {
    version: ENGINE_VERSION,
    seed: mapSeed,
    chapter,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    biomeId: BIOMES[(chapter - 1) % BIOMES.length].id,
    entrance: { ...path[0] },
    base: { ...path.at(-1) },
    path,
    buildPads,
    decor,
  };
}

export function generateMap(seed, chapter = 1) {
  const normalizedChapter = Math.max(1, asNonNegativeInteger(chapter, 1));
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const map = buildMapAttempt(seed, normalizedChapter, attempt);
    if (validateMap(map).valid) return map;
  }
  throw new Error("Unable to generate a valid Cairnloom map for this seed.");
}

export function getMobPosition(map, mob) {
  if (!map?.path?.length) return { x: 0, y: 0, segment: 0, progress: 0 };
  const lastIndex = map.path.length - 1;
  const progress = Number(mob?.progress) || 0;
  if (progress <= 0) {
    const first = map.path[0];
    const second = map.path[1] || { x: first.x, y: first.y + 1 };
    return {
      x: round(first.x + (second.x - first.x) * progress),
      y: round(first.y + (second.y - first.y) * progress),
      segment: 0,
      progress,
    };
  }
  if (progress >= lastIndex) {
    const previous = map.path[Math.max(0, lastIndex - 1)];
    const last = map.path[lastIndex];
    const excess = progress - lastIndex;
    return {
      x: round(last.x + (last.x - previous.x) * excess),
      y: round(last.y + (last.y - previous.y) * excess),
      segment: lastIndex,
      progress,
    };
  }
  const segment = Math.floor(progress);
  const portion = progress - segment;
  const from = map.path[segment];
  const to = map.path[segment + 1];
  return {
    x: round(from.x + (to.x - from.x) * portion),
    y: round(from.y + (to.y - from.y) * portion),
    segment,
    progress,
  };
}

function initialTowerProfile() {
  return Object.fromEntries(TOWER_ORDER.map((towerId) => [towerId, {
    unlocked: Boolean(TOWER_ARCHETYPES[towerId].initiallyUnlocked),
    mastery: 0,
  }]));
}

function initialTalentProfile() {
  return Object.fromEntries(TALENT_ORDER.map((talentId) => [talentId, 0]));
}

function syncProfileAliases(profile) {
  profile.cinders = profile.currencies.cinders;
  profile.sigils = profile.currencies.sigils;
  profile.unlockedTowerIds = TOWER_ORDER.filter((towerId) => profile.towers[towerId].unlocked);
  profile.towerMastery = Object.fromEntries(TOWER_ORDER.map((towerId) => [towerId, profile.towers[towerId].mastery]));
  profile.stats = {
    bestWave: profile.lifetime.bestWave,
    runsCompleted: profile.lifetime.runsCompleted,
    totalWaves: profile.lifetime.totalWaves,
    totalKills: profile.lifetime.totalKills,
    bossesDefeated: profile.lifetime.bossesDefeated,
  };
  profile.bestWave = profile.lifetime.bestWave;
  return profile;
}

export function createProfile() {
  return syncProfileAliases({
    version: ENGINE_VERSION,
    currencies: { cinders: 0, sigils: 0 },
    towers: initialTowerProfile(),
    talents: initialTalentProfile(),
    lifetime: {
      runsCompleted: 0,
      bestWave: 0,
      totalWaves: 0,
      totalKills: 0,
      bossesDefeated: 0,
      cindersEarned: 0,
      sigilsEarned: 0,
    },
  });
}

export function normalizeProfile(candidate) {
  const fallback = createProfile();
  if (!candidate || typeof candidate !== "object") return fallback;
  const normalized = clone(fallback);
  normalized.currencies.cinders = asNonNegativeInteger(candidate.currencies?.cinders ?? candidate.cinders ?? candidate.embers);
  normalized.currencies.sigils = asNonNegativeInteger(candidate.currencies?.sigils ?? candidate.sigils ?? candidate.bossSigils);
  const unlockedAliases = candidate.unlockedTowerIds ?? candidate.unlockedTowers ?? [];
  TOWER_ORDER.forEach((towerId) => {
    const source = candidate.towers?.[towerId];
    normalized.towers[towerId].unlocked = TOWER_ARCHETYPES[towerId].initiallyUnlocked || Boolean(source?.unlocked) || unlockedAliases.includes?.(towerId);
    normalized.towers[towerId].mastery = clamp(asNonNegativeInteger(source?.mastery ?? candidate.towerMastery?.[towerId] ?? candidate.mastery?.[towerId]), 0, MAX_MASTERY);
  });
  TALENT_ORDER.forEach((talentId) => {
    normalized.talents[talentId] = clamp(asNonNegativeInteger(candidate.talents?.[talentId]), 0, TALENT_TREE[talentId].maxLevel);
  });
  Object.keys(normalized.lifetime).forEach((key) => {
    normalized.lifetime[key] = asNonNegativeInteger(candidate.lifetime?.[key] ?? candidate.stats?.[key] ?? (key === "bestWave" ? candidate.bestWave : undefined));
  });
  return syncProfileAliases(normalized);
}

export function serializeProfile(profile) {
  return JSON.stringify(normalizeProfile(profile));
}

export function deserializeProfile(serialized) {
  if (!serialized) return createProfile();
  try {
    return normalizeProfile(typeof serialized === "string" ? JSON.parse(serialized) : serialized);
  } catch {
    return createProfile();
  }
}

export function deriveProfileModifiers(profileState) {
  const profile = normalizeProfile(profileState);
  const talent = (id) => profile.talents[id] || 0;
  return {
    startGold: STARTING_GOLD + talent("war_chest") * 15,
    maxBaseHp: STARTING_BASE_HEALTH + talent("reinforced_foundation") * 2,
    towerDamageMultiplier: 1 + talent("tempered_arsenal") * 0.04,
    attackSpeedMultiplier: 1 + talent("quickened_gears") * 0.04,
    waveGoldMultiplier: 1 + talent("bounty_oath") * 0.06,
    armorPenetration: talent("keen_iron"),
    statusDurationMultiplier: 1 + talent("deep_embers") * 0.08,
    dotDamageMultiplier: 1 + talent("deep_embers") * 0.08,
    sellRatio: Math.min(0.9, DEFAULT_SELL_RATIO + talent("salvage_lore") * 0.04),
    baseHealAfterBoss: talent("wardstone"),
    cinderMultiplier: 1 + talent("cinder_compact") * 0.1,
    rangeBonus: 0,
    buildDiscount: 0,
    towerDamageBonuses: Object.fromEntries(TOWER_ORDER.map((towerId) => [towerId, 0])),
    towerSpecialBonuses: Object.fromEntries(TOWER_ORDER.map((towerId) => [towerId, 0])),
    mastery: Object.fromEntries(TOWER_ORDER.map((towerId) => [towerId, profile.towers[towerId].mastery])),
  };
}

export function createRun(profileState = createProfile(), options = {}) {
  const profile = normalizeProfile(profileState);
  const requestedSeed = typeof options === "number" || typeof options === "string" ? options : options.seed;
  const seed = normalizeSeed(requestedSeed ?? 1);
  const chapter = 1;
  const mapSeed = hashSeed(seed, "chapter", chapter);
  const modifiers = deriveProfileModifiers(profile);
  return {
    version: ENGINE_VERSION,
    seed,
    status: "build",
    chapter,
    mapSeed,
    map: generateMap(mapSeed, chapter),
    waveNumber: 0,
    wavesCleared: 0,
    gold: modifiers.startGold,
    baseHp: modifiers.maxBaseHp,
    maxBaseHp: modifiers.maxBaseHp,
    towers: [],
    mobs: [],
    activeWave: null,
    pendingRelicChoice: null,
    pendingRelicChoices: [],
    relics: Object.fromEntries(RELIC_ORDER.map((relicId) => [relicId, 0])),
    tick: 0,
    cinderBank: 0,
    sigilBank: 0,
    modifiers,
    unlockedTowerIds: TOWER_ORDER.filter((towerId) => profile.towers[towerId].unlocked),
    stats: {
      kills: 0,
      leaked: 0,
      damageDealt: 0,
      effectDamage: 0,
      goldEarned: 0,
      towersPlaced: 0,
      upgradesBought: 0,
      towersSold: 0,
      shotsFired: 0,
      bossesDefeated: 0,
    },
    idCounters: { tower: 1, mob: 1 },
    rewardsClaimed: false,
  };
}

export function getWaveBudget(waveNumber) {
  const wave = Math.max(1, asNonNegativeInteger(waveNumber, 1));
  return Math.floor(7 + wave * 2.25 + Math.pow(wave, 1.18) * 0.85);
}

function weightedEnemyChoice(available, remainingBudget, waveNumber, rng) {
  const affordable = available.filter((enemy) => enemy.budgetCost <= remainingBudget);
  if (!affordable.length) return null;
  const weighted = affordable.map((enemy) => {
    let weight = enemy.weight;
    if (waveNumber >= enemy.availableFromWave + 2) weight += 1;
    if (enemy.family === "swarm" && waveNumber % 3 === 0) weight *= 1.7;
    if (enemy.family === "armored" && waveNumber % 4 === 0) weight *= 1.55;
    if (enemy.family === "shielded" && waveNumber % 5 === 0) weight *= 1.65;
    if (enemy.family === "tank" && waveNumber >= 9) weight *= 1.35;
    return { enemy, weight };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.enemy;
  }
  return weighted.at(-1).enemy;
}

export function generateWave(runSeed, waveNumber) {
  const number = Math.max(1, asNonNegativeInteger(waveNumber, 1));
  const seed = hashSeed("cairnloom-wave", runSeed, number);
  const rng = createRng(seed);
  const isBoss = number % 10 === 0;
  const budget = getWaveBudget(number);
  let remainingBudget = isBoss ? Math.max(8, Math.floor(budget * 0.44)) : budget;
  const available = NORMAL_ENEMY_IDS
    .map((enemyId) => ENEMY_ARCHETYPES[enemyId])
    .filter((enemy) => enemy.availableFromWave <= number);
  const types = [];

  const newest = [...available].sort((a, b) => b.availableFromWave - a.availableFromWave)[0];
  if (newest && newest.availableFromWave > 1 && newest.budgetCost <= remainingBudget) {
    types.push(newest.id);
    remainingBudget -= newest.budgetCost;
  }
  while (remainingBudget > 0) {
    const choice = weightedEnemyChoice(available, remainingBudget, number, rng);
    if (!choice) break;
    types.push(choice.id);
    remainingBudget -= choice.budgetCost;
  }
  while (remainingBudget > 0) {
    types.push("ashling");
    remainingBudget -= 1;
  }

  const orderedTypes = shuffled(types, rng);
  if (isBoss) orderedTypes.splice(Math.floor(orderedTypes.length * 0.64), 0, BOSS_ENEMY_ID);
  const spawnInterval = Math.max(0.34, 0.84 - number * 0.018);
  const spawns = orderedTypes.map((typeId, index) => ({
    id: `wave-${number}-spawn-${index + 1}`,
    typeId,
    spawnTick: Math.round(index * spawnInterval / FIXED_STEP_SECONDS),
  }));
  const compositionCounts = Object.fromEntries([...new Set(orderedTypes)].map((typeId) => [typeId, orderedTypes.filter((id) => id === typeId).length]));
  const composition = Object.entries(compositionCounts).map(([typeId, count]) => ({ typeId, count }));
  const rewardGold = Math.round(22 + number * 4.2 + budget * 0.55 + (isBoss ? 45 + number * 2 : 0));
  const cinderReward = 2 + Math.floor(number / 2) + (isBoss ? 8 + Math.floor(number / 10) : 0);

  return {
    version: ENGINE_VERSION,
    seed,
    number,
    isBoss,
    budget,
    spawnInterval,
    composition,
    compositionCounts,
    spawns,
    rewardGold,
    cinderReward,
    sigilReward: isBoss ? 1 + Math.floor((number - 1) / 20) : 0,
  };
}

export function getWavePreview(run) {
  if (run?.status === "wave" && run.activeWave) return clone(run.activeWave);
  return generateWave(run.seed, run.waveNumber + 1);
}

export function getEnemyStats(typeId, waveNumber) {
  const archetype = ENEMY_ARCHETYPES[typeId];
  if (!archetype) return null;
  const wave = Math.max(1, asNonNegativeInteger(waveNumber, 1));
  const offset = wave - 1;
  const healthScale = 1 + offset * 0.085 + Math.pow(offset, 1.35) * 0.008;
  const speedScale = Math.min(1.35, 1 + offset * 0.006);
  return {
    maxHp: Math.max(1, Math.round(archetype.health * healthScale)),
    maxShield: Math.max(0, Math.round(archetype.shield * healthScale)),
    armor: archetype.armor + Math.floor(offset / 20),
    speed: round(archetype.speed * speedScale),
    leakDamage: archetype.leakDamage + Math.floor(offset / 25),
    bounty: archetype.bounty,
  };
}

function createMob(typeId, waveNumber, id) {
  const archetype = ENEMY_ARCHETYPES[typeId];
  const stats = getEnemyStats(typeId, waveNumber);
  if (!archetype || !stats) return null;
  return {
    id,
    typeId,
    name: archetype.name,
    boss: Boolean(archetype.boss),
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    shield: stats.maxShield,
    maxShield: stats.maxShield,
    armor: stats.armor,
    speed: stats.speed,
    leakDamage: stats.leakDamage,
    bounty: stats.bounty,
    progress: -0.35,
    effects: { dots: [], slow: null },
  };
}

function validWaveOverride(wave, expectedNumber) {
  return wave && wave.number === expectedNumber && Array.isArray(wave.spawns) && wave.spawns.every((spawn) => ENEMY_ARCHETYPES[spawn.typeId] && Number.isInteger(spawn.spawnTick));
}

export function startWave(runState, waveOverride = null) {
  if (!runState || runState.status !== "build") return actionError(runState, "A wave can only begin during the build phase.");
  if (runState.pendingRelicChoice) return actionError(runState, "Choose one of the offered relics before beginning the next wave.");
  const expectedNumber = runState.waveNumber + 1;
  const definition = waveOverride ? clone(waveOverride) : generateWave(runState.seed, expectedNumber);
  if (!validWaveOverride(definition, expectedNumber)) return actionError(runState, "Wave definition is invalid or out of sequence.");
  const state = clone(runState);
  state.status = "wave";
  state.waveNumber = definition.number;
  state.mobs = [];
  state.activeWave = {
    ...definition,
    spawnIndex: 0,
    elapsedTicks: 0,
    remaining: definition.spawns.length,
  };
  state.towers.forEach((tower) => { tower.cooldownTicks = 0; });
  return actionSuccess(state, [{ type: "wave-started", waveNumber: definition.number, isBoss: Boolean(definition.isBoss) }]);
}

export function getTowerUpgradeCost(typeId, level, runOrModifiers = null) {
  const archetype = TOWER_ARCHETYPES[typeId];
  const normalizedLevel = asNonNegativeInteger(level, 1);
  if (!archetype || normalizedLevel < 1 || normalizedLevel >= MAX_TOWER_LEVEL) return null;
  const baseCost = archetype.upgradeCosts[normalizedLevel - 1] ?? null;
  if (baseCost == null) return null;
  const modifiers = runOrModifiers?.modifiers || runOrModifiers;
  return Math.max(1, Math.round(baseCost * (1 - clamp(modifiers?.buildDiscount || 0, 0, 0.5))));
}

export function getTowerPurchaseCost(runOrModifiers, typeId) {
  const archetype = TOWER_ARCHETYPES[typeId];
  if (!archetype) return null;
  const modifiers = runOrModifiers?.modifiers || runOrModifiers;
  return Math.max(1, Math.round(archetype.baseCost * (1 - clamp(modifiers?.buildDiscount || 0, 0, 0.5))));
}

export function getEffectiveTowerStats(runOrModifiers, typeId, level = 1) {
  const archetype = TOWER_ARCHETYPES[typeId];
  if (!archetype) return null;
  const modifiers = runOrModifiers?.modifiers || runOrModifiers || deriveProfileModifiers(createProfile());
  const normalizedLevel = clamp(asNonNegativeInteger(level, 1), 1, MAX_TOWER_LEVEL);
  const mastery = clamp(asNonNegativeInteger(modifiers.mastery?.[typeId]), 0, MAX_MASTERY);
  const levelDamage = 1.32 ** (normalizedLevel - 1);
  const masteryDamage = 1 + mastery * 0.05;
  const attackSpeed = (modifiers.attackSpeedMultiplier || 1) * (1 + mastery * 0.02);
  const towerDamageBonus = modifiers.towerDamageBonuses?.[typeId] || 0;
  const towerSpecialBonus = modifiers.towerSpecialBonuses?.[typeId] || 0;
  const placementCost = getTowerPurchaseCost(modifiers, typeId);
  const stats = {
    typeId,
    role: archetype.role,
    level: normalizedLevel,
    damage: Math.max(1, Math.round(archetype.damage * levelDamage * (modifiers.towerDamageMultiplier || 1) * masteryDamage * (1 + towerDamageBonus))),
    range: round(archetype.range + (normalizedLevel - 1) * 0.12 + mastery * 0.035 + (modifiers.rangeBonus || 0)),
    attackInterval: round(Math.max(0.18, archetype.attackInterval * (0.93 ** (normalizedLevel - 1)) / attackSpeed)),
    armorPenetration: asNonNegativeInteger(modifiers.armorPenetration),
    placementCost,
    cost: placementCost,
    buildCost: placementCost,
    upgradeCost: getTowerUpgradeCost(typeId, normalizedLevel, modifiers),
  };
  if (archetype.splashRadius) stats.splashRadius = round(archetype.splashRadius + (normalizedLevel - 1) * 0.08 + towerSpecialBonus);
  if (archetype.dotDamage) {
    stats.dotDamage = Math.max(1, Math.round(archetype.dotDamage * (1.28 ** (normalizedLevel - 1)) * (modifiers.dotDamageMultiplier || 1) * masteryDamage * (1 + towerSpecialBonus)));
    stats.dotInterval = archetype.dotInterval;
    stats.dotDuration = round(archetype.dotDuration * (1 + (normalizedLevel - 1) * 0.06) * (modifiers.statusDurationMultiplier || 1));
  }
  if (archetype.slowMultiplier) {
    stats.slowMultiplier = round(Math.max(0.35, archetype.slowMultiplier - (normalizedLevel - 1) * 0.025 - mastery * 0.01 - towerSpecialBonus));
    stats.slowDuration = round(archetype.slowDuration * (1 + (normalizedLevel - 1) * 0.06) * (modifiers.statusDurationMultiplier || 1));
  }
  if (archetype.chainCount) {
    stats.chainCount = archetype.chainCount + Math.floor((normalizedLevel - 1) / 2) + Math.round(towerSpecialBonus);
    stats.chainRange = round(archetype.chainRange + (normalizedLevel - 1) * 0.05);
    stats.chainFalloff = round(Math.min(0.82, archetype.chainFalloff + (normalizedLevel - 1) * 0.025));
  }
  return stats;
}

export function getTowerSellValue(run, tower) {
  if (!tower) return 0;
  return Math.max(0, Math.floor(tower.invested * (run?.modifiers?.sellRatio ?? DEFAULT_SELL_RATIO)));
}

function runAllowsConstruction(run) {
  return run && (run.status === "build" || run.status === "wave");
}

export function placeTower(runState, padId, typeId) {
  if (!runAllowsConstruction(runState)) return actionError(runState, "Towers cannot be placed after the Ward has fallen.");
  const archetype = TOWER_ARCHETYPES[typeId];
  if (!archetype) return actionError(runState, "Unknown tower type.");
  if (!runState.unlockedTowerIds.includes(typeId)) return actionError(runState, `${archetype.name} is not permanently unlocked.`);
  const pad = runState.map.buildPads.find((candidate) => candidate.id === padId);
  if (!pad) return actionError(runState, "That build pad does not exist on this map.");
  if (runState.towers.some((tower) => tower.padId === padId)) return actionError(runState, "That build pad is already occupied.");
  const placementCost = getTowerPurchaseCost(runState, typeId);
  if (runState.gold < placementCost) return actionError(runState, `You need ${placementCost} Gold to place ${archetype.name}.`);
  const state = clone(runState);
  const tower = {
    id: `tower-${state.idCounters.tower}`,
    typeId,
    padId,
    x: pad.x,
    y: pad.y,
    level: 1,
    invested: placementCost,
    cooldownTicks: 0,
  };
  state.idCounters.tower += 1;
  state.gold -= placementCost;
  state.towers.push(tower);
  state.stats.towersPlaced += 1;
  return actionSuccess(state, [{ type: "tower-placed", tower: clone(tower), goldSpent: placementCost }]);
}

export function upgradeTower(runState, towerId) {
  if (!runAllowsConstruction(runState)) return actionError(runState, "Towers cannot be upgraded after the Ward has fallen.");
  const tower = runState.towers.find((candidate) => candidate.id === towerId);
  if (!tower) return actionError(runState, "Tower not found.");
  const cost = getTowerUpgradeCost(tower.typeId, tower.level, runState);
  if (cost == null) return actionError(runState, "That tower is already at maximum level.");
  if (runState.gold < cost) return actionError(runState, `You need ${cost} Gold for this upgrade.`);
  const state = clone(runState);
  const nextTower = state.towers.find((candidate) => candidate.id === towerId);
  state.gold -= cost;
  nextTower.level += 1;
  nextTower.invested += cost;
  nextTower.cooldownTicks = Math.min(nextTower.cooldownTicks, Math.round(getEffectiveTowerStats(state, nextTower.typeId, nextTower.level).attackInterval / FIXED_STEP_SECONDS));
  state.stats.upgradesBought += 1;
  return actionSuccess(state, [{ type: "tower-upgraded", towerId, level: nextTower.level, goldSpent: cost }]);
}

export function sellTower(runState, towerId) {
  if (!runAllowsConstruction(runState)) return actionError(runState, "Towers cannot be sold after the Ward has fallen.");
  const tower = runState.towers.find((candidate) => candidate.id === towerId);
  if (!tower) return actionError(runState, "Tower not found.");
  const refund = getTowerSellValue(runState, tower);
  const state = clone(runState);
  state.towers = state.towers.filter((candidate) => candidate.id !== towerId);
  state.gold += refund;
  state.stats.towersSold += 1;
  return actionSuccess(state, [{ type: "tower-sold", towerId, goldRefunded: refund }]);
}

function spawnDueMobs(state, events) {
  const wave = state.activeWave;
  while (wave.spawnIndex < wave.spawns.length && wave.spawns[wave.spawnIndex].spawnTick <= wave.elapsedTicks) {
    const spawn = wave.spawns[wave.spawnIndex];
    const mob = createMob(spawn.typeId, wave.number, `mob-${state.idCounters.mob}`);
    state.idCounters.mob += 1;
    wave.spawnIndex += 1;
    wave.remaining = wave.spawns.length - wave.spawnIndex;
    if (!mob) continue;
    state.mobs.push(mob);
    events.push({ type: "mob-spawned", mob: clone(mob), waveNumber: wave.number });
  }
}

function applyDamage(state, mob, rawDamage, options, events) {
  if (!mob || mob.hp <= 0) return 0;
  let incoming = Math.max(0, Math.round(rawDamage));
  const shieldAbsorbed = Math.min(mob.shield, incoming);
  mob.shield -= shieldAbsorbed;
  incoming -= shieldAbsorbed;
  const effectiveArmor = options.ignoreArmor ? 0 : Math.max(0, mob.armor - (options.armorPenetration || 0));
  const armorBlocked = incoming > 0 ? Math.min(effectiveArmor, Math.max(0, incoming - 1)) : 0;
  const dealt = incoming > 0 ? Math.max(1, incoming - effectiveArmor) : 0;
  const position = getMobPosition(state.map, mob);
  mob.hp = Math.max(0, mob.hp - dealt);
  state.stats.damageDealt += dealt;
  if (options.kind === "dot") state.stats.effectDamage += dealt;
  events.push({
    type: "mob-damaged",
    mobId: mob.id,
    sourceTowerId: options.sourceTowerId || null,
    kind: options.kind || "direct",
    rawDamage: Math.round(rawDamage),
    amount: dealt,
    shieldAbsorbed,
    armorBlocked,
    hp: mob.hp,
    shield: mob.shield,
    x: position.x,
    y: position.y,
  });
  if (mob.hp === 0) {
    state.stats.kills += 1;
    events.push({ type: "mob-killed", mobId: mob.id, typeId: mob.typeId, boss: mob.boss, progress: mob.progress, x: position.x, y: position.y });
  }
  return dealt;
}

function processEffects(state, events) {
  for (const mob of state.mobs) {
    if (mob.hp <= 0) continue;
    for (const dot of mob.effects.dots) {
      dot.remainingTicks -= 1;
      dot.nextTickIn -= 1;
      if (dot.nextTickIn <= 0 && dot.remainingTicks >= 0 && mob.hp > 0) {
        applyDamage(state, mob, dot.damage, { sourceTowerId: dot.sourceTowerId, kind: "dot", ignoreArmor: true }, events);
        dot.nextTickIn = dot.intervalTicks;
      }
    }
    mob.effects.dots = mob.effects.dots.filter((dot) => dot.remainingTicks > 0);
    if (mob.effects.slow) {
      mob.effects.slow.remainingTicks -= 1;
      if (mob.effects.slow.remainingTicks <= 0) {
        events.push({ type: "slow-ended", mobId: mob.id });
        mob.effects.slow = null;
      }
    }
  }
}

function targetableMobs(state, tower, range) {
  return state.mobs
    .filter((mob) => mob.hp > 0 && mob.progress >= -0.4 && gridDistance(tower, getMobPosition(state.map, mob)) <= range)
    .sort((a, b) => b.progress - a.progress || a.id.localeCompare(b.id));
}

function applyDot(mob, tower, stats, events) {
  const intervalTicks = Math.max(1, Math.round(stats.dotInterval / FIXED_STEP_SECONDS));
  const remainingTicks = Math.max(intervalTicks, Math.round(stats.dotDuration / FIXED_STEP_SECONDS));
  const existing = mob.effects.dots.find((dot) => dot.sourceTowerId === tower.id);
  if (existing) {
    existing.damage = Math.max(existing.damage, stats.dotDamage);
    existing.remainingTicks = Math.max(existing.remainingTicks, remainingTicks);
    existing.intervalTicks = intervalTicks;
  } else {
    mob.effects.dots.push({
      sourceTowerId: tower.id,
      damage: stats.dotDamage,
      intervalTicks,
      nextTickIn: intervalTicks,
      remainingTicks,
    });
  }
  events.push({ type: "dot-applied", towerId: tower.id, mobId: mob.id, damage: stats.dotDamage, duration: stats.dotDuration });
}

function applySlow(mob, tower, stats, events) {
  const remainingTicks = Math.max(1, Math.round(stats.slowDuration / FIXED_STEP_SECONDS));
  const current = mob.effects.slow;
  if (!current || stats.slowMultiplier < current.multiplier || current.sourceTowerId === tower.id) {
    mob.effects.slow = { sourceTowerId: tower.id, multiplier: stats.slowMultiplier, remainingTicks };
  } else {
    current.remainingTicks = Math.max(current.remainingTicks, remainingTicks);
  }
  events.push({ type: "slow-applied", towerId: tower.id, mobId: mob.id, multiplier: stats.slowMultiplier, duration: stats.slowDuration });
}

function fireTower(state, tower, stats, primary, events) {
  state.stats.shotsFired += 1;
  const primaryPosition = getMobPosition(state.map, primary);
  events.push({ type: "tower-fired", towerId: tower.id, typeId: tower.typeId, towerTypeId: tower.typeId, role: stats.role, targetId: primary.id, x: primaryPosition.x, y: primaryPosition.y });
  if (stats.role === "aoe") {
    const impact = getMobPosition(state.map, primary);
    const victims = state.mobs
      .filter((mob) => mob.hp > 0 && gridDistance(impact, getMobPosition(state.map, mob)) <= stats.splashRadius)
      .sort((a, b) => b.progress - a.progress || a.id.localeCompare(b.id));
    victims.forEach((mob) => applyDamage(state, mob, stats.damage, { sourceTowerId: tower.id, kind: "aoe", armorPenetration: stats.armorPenetration }, events));
    events.push({ type: "aoe-impact", towerId: tower.id, targetIds: victims.map((mob) => mob.id), radius: stats.splashRadius, x: impact.x, y: impact.y });
    return;
  }
  if (stats.role === "chain") {
    const hit = [];
    let current = primary;
    for (let jump = 0; jump < stats.chainCount && current; jump += 1) {
      const damage = Math.max(1, Math.round(stats.damage * (stats.chainFalloff ** jump)));
      applyDamage(state, current, damage, { sourceTowerId: tower.id, kind: "chain", armorPenetration: stats.armorPenetration }, events);
      hit.push(current.id);
      const origin = getMobPosition(state.map, current);
      events.push({ type: "chain-hit", towerId: tower.id, mobId: current.id, jump, damage, x: origin.x, y: origin.y });
      current = state.mobs
        .filter((mob) => mob.hp > 0 && !hit.includes(mob.id) && gridDistance(origin, getMobPosition(state.map, mob)) <= stats.chainRange)
        .sort((a, b) => gridDistance(origin, getMobPosition(state.map, a)) - gridDistance(origin, getMobPosition(state.map, b)) || b.progress - a.progress || a.id.localeCompare(b.id))[0] || null;
    }
    return;
  }

  applyDamage(state, primary, stats.damage, { sourceTowerId: tower.id, kind: stats.role, armorPenetration: stats.armorPenetration }, events);
  if (primary.hp <= 0) return;
  if (stats.role === "dot") applyDot(primary, tower, stats, events);
  if (stats.role === "slow") applySlow(primary, tower, stats, events);
}

function processTowers(state, events) {
  const towers = [...state.towers].sort((a, b) => a.id.localeCompare(b.id));
  for (const tower of towers) {
    tower.cooldownTicks = Math.max(0, tower.cooldownTicks - 1);
    if (tower.cooldownTicks > 0) continue;
    const stats = getEffectiveTowerStats(state, tower.typeId, tower.level);
    const primary = targetableMobs(state, tower, stats.range)[0];
    if (!primary) continue;
    fireTower(state, tower, stats, primary, events);
    tower.cooldownTicks = Math.max(1, Math.round(stats.attackInterval / FIXED_STEP_SECONDS));
  }
}

function moveAndLeakMobs(state, events) {
  const leakThreshold = state.map.path.length - 0.05;
  for (const mob of state.mobs) {
    if (mob.hp <= 0) continue;
    const slowMultiplier = mob.effects.slow?.multiplier ?? 1;
    mob.progress = round(mob.progress + mob.speed * slowMultiplier * FIXED_STEP_SECONDS);
    if (mob.progress < leakThreshold) continue;
    mob.leaked = true;
    state.baseHp = Math.max(0, state.baseHp - mob.leakDamage);
    state.stats.leaked += 1;
    const position = getMobPosition(state.map, mob);
    events.push({ type: "base-leak", mobId: mob.id, typeId: mob.typeId, damage: mob.leakDamage, baseHp: state.baseHp, boss: mob.boss, x: position.x, y: position.y });
  }
}

function relicChoiceWave(waveNumber) {
  const chapterWave = ((waveNumber - 1) % 10) + 1;
  return chapterWave === 3 || chapterWave === 6 || chapterWave === 9;
}

export function generateRunRelicChoices(runState, waveNumber = runState?.wavesCleared) {
  if (!runState) return null;
  const normalizedWave = Math.max(1, asNonNegativeInteger(waveNumber, 1));
  const stacks = runState.relics || {};
  const eligible = RELIC_ORDER.filter((relicId) => {
    const relic = RELICS[relicId];
    if ((stacks[relicId] || 0) >= relic.maxStacks) return false;
    if (relic.towerId && !runState.unlockedTowerIds.includes(relic.towerId)) return false;
    return true;
  });
  if (!eligible.length) return null;
  const rng = createRng(hashSeed("cairnloom-relics", runState.seed, normalizedWave));
  const common = shuffled(eligible.filter((relicId) => !RELICS[relicId].towerId), rng);
  const specialized = shuffled(eligible.filter((relicId) => RELICS[relicId].towerId), rng);
  const options = [];
  if (specialized.length && rng() < 0.62) options.push(specialized[0]);
  for (const relicId of shuffled([...common, ...specialized], rng)) {
    if (options.length >= 3) break;
    if (!options.includes(relicId)) options.push(relicId);
  }
  return {
    id: `relic-choice-${normalizedWave}`,
    waveNumber: normalizedWave,
    options,
  };
}

export function chooseRunRelic(runState, relicId) {
  const choice = runState?.pendingRelicChoice;
  if (!choice) return actionError(runState, "There is no relic choice waiting.");
  if (!choice.options.includes(relicId)) return actionError(runState, "That relic is not part of the current offer.");
  const relic = RELICS[relicId];
  if (!relic) return actionError(runState, "Unknown relic.");
  const currentStacks = runState.relics?.[relicId] || 0;
  if (currentStacks >= relic.maxStacks) return actionError(runState, "That relic has reached its stack cap.");
  const state = clone(runState);
  state.relics[relicId] = currentStacks + 1;
  if (relic.effect === "damage") state.modifiers.towerDamageMultiplier = round(state.modifiers.towerDamageMultiplier * (1 + relic.amount));
  else if (relic.effect === "attack-speed") state.modifiers.attackSpeedMultiplier = round(state.modifiers.attackSpeedMultiplier * (1 + relic.amount));
  else if (relic.effect === "range") state.modifiers.rangeBonus = round((state.modifiers.rangeBonus || 0) + relic.amount);
  else if (relic.effect === "wave-gold") state.modifiers.waveGoldMultiplier = round(state.modifiers.waveGoldMultiplier * (1 + relic.amount));
  else if (relic.effect === "ward-health") {
    state.maxBaseHp += relic.amount;
    state.baseHp = Math.min(state.maxBaseHp, state.baseHp + relic.amount);
  } else if (relic.effect === "build-discount") {
    state.modifiers.buildDiscount = round(Math.min(0.4, (state.modifiers.buildDiscount || 0) + relic.amount));
  } else if (relic.effect === "tower-damage") {
    state.modifiers.towerDamageBonuses[relic.towerId] = round((state.modifiers.towerDamageBonuses[relic.towerId] || 0) + relic.amount);
  } else if (relic.effect === "tower-special") {
    state.modifiers.towerSpecialBonuses[relic.towerId] = round((state.modifiers.towerSpecialBonuses[relic.towerId] || 0) + relic.amount);
  }
  state.pendingRelicChoice = null;
  state.pendingRelicChoices = [];
  return actionSuccess(state, [{ type: "relic-chosen", relicId, name: relic.name, stack: state.relics[relicId], waveNumber: choice.waveNumber }]);
}

export function skipRunRelic(runState) {
  const choice = runState?.pendingRelicChoice;
  if (!choice) return actionError(runState, "There is no relic choice waiting.");
  const state = clone(runState);
  state.pendingRelicChoice = null;
  state.pendingRelicChoices = [];
  state.gold += 40;
  state.stats.goldEarned += 40;
  return actionSuccess(state, [{ type: "relic-skipped", waveNumber: choice.waveNumber, goldReward: 40 }]);
}

function finishWave(state, events) {
  const wave = state.activeWave;
  const goldReward = Math.max(0, Math.round(wave.rewardGold * state.modifiers.waveGoldMultiplier));
  const cinderReward = Math.max(0, asNonNegativeInteger(wave.cinderReward));
  state.gold += goldReward;
  state.cinderBank += cinderReward;
  state.stats.goldEarned += goldReward;
  state.wavesCleared = wave.number;
  events.push({ type: "wave-complete", waveNumber: wave.number, goldReward, cinderReward, isBoss: Boolean(wave.isBoss) });
  events.push({ type: "wave-reward", waveNumber: wave.number, gold: goldReward, reward: goldReward, cinders: cinderReward });

  if (wave.isBoss) {
    const sigils = Math.max(0, asNonNegativeInteger(wave.sigilReward));
    state.sigilBank += sigils;
    state.stats.bossesDefeated += 1;
    const salvage = state.towers.reduce((sum, tower) => sum + tower.invested, 0);
    const oldChapter = state.chapter;
    state.gold += salvage;
    state.stats.goldEarned += salvage;
    state.towers = [];
    state.chapter += 1;
    state.mapSeed = hashSeed(state.seed, "chapter", state.chapter);
    state.map = generateMap(state.mapSeed, state.chapter);
    const chapterRepair = Math.max(2, Math.ceil(state.maxBaseHp * 0.2)) + state.modifiers.baseHealAfterBoss;
    const repaired = Math.min(state.maxBaseHp - state.baseHp, chapterRepair);
    state.baseHp += repaired;
    events.push({ type: "boss-defeated", waveNumber: wave.number, sigils, chapter: oldChapter });
    events.push({ type: "chapter-started", chapter: state.chapter, mapSeed: state.mapSeed, biomeId: state.map.biomeId, salvageGold: salvage, baseRepaired: repaired });
  }

  if (!wave.isBoss && relicChoiceWave(wave.number)) {
    state.pendingRelicChoice = generateRunRelicChoices(state, wave.number);
    state.pendingRelicChoices = state.pendingRelicChoice?.options ? [...state.pendingRelicChoice.options] : [];
    if (state.pendingRelicChoice) events.push({ type: "relic-choice", choice: clone(state.pendingRelicChoice) });
  }

  state.status = "build";
  state.activeWave = null;
  state.mobs = [];
}

function fixedStep(state, events) {
  if (state.status !== "wave" || !state.activeWave) return;
  state.tick += 1;
  spawnDueMobs(state, events);
  processEffects(state, events);
  state.mobs = state.mobs.filter((mob) => mob.hp > 0 && !mob.leaked);
  processTowers(state, events);
  state.mobs = state.mobs.filter((mob) => mob.hp > 0 && !mob.leaked);
  moveAndLeakMobs(state, events);
  state.mobs = state.mobs.filter((mob) => mob.hp > 0 && !mob.leaked);

  if (state.baseHp <= 0) {
    state.status = "defeat";
    events.push({ type: "defeat", waveNumber: state.waveNumber, wavesCleared: state.wavesCleared, tick: state.tick });
    return;
  }

  state.activeWave.elapsedTicks += 1;
  const allSpawned = state.activeWave.spawnIndex >= state.activeWave.spawns.length;
  if (allSpawned && state.mobs.length === 0) finishWave(state, events);
}

export function stepSimulation(runState, ticks = 1) {
  if (!runState || runState.status !== "wave" || !runState.activeWave) return actionError(runState, "The simulation only advances during an active wave.");
  const steps = Math.max(1, asNonNegativeInteger(ticks, 1));
  const state = clone(runState);
  const events = [];
  for (let index = 0; index < steps && state.status === "wave"; index += 1) fixedStep(state, events);
  return actionSuccess(state, events);
}

export function calculateDefeatRewards(run) {
  const wavesCleared = asNonNegativeInteger(run?.wavesCleared);
  const kills = asNonNegativeInteger(run?.stats?.kills);
  const bossesDefeated = asNonNegativeInteger(run?.stats?.bossesDefeated);
  const banked = asNonNegativeInteger(run?.cinderBank);
  const progressionBonus = Math.floor(Math.pow(wavesCleared, 1.28) * 2.4);
  const combatBonus = Math.floor(kills / 8);
  const bossBonus = bossesDefeated * 8;
  const subtotal = banked + progressionBonus + combatBonus + bossBonus;
  const cinders = Math.floor(subtotal * (run?.modifiers?.cinderMultiplier || 1));
  return {
    cinders: Math.max(0, cinders),
    sigils: asNonNegativeInteger(run?.sigilBank),
    bankedCinders: banked,
    progressionBonus,
    combatBonus,
    bossBonus,
    wavesCleared,
    defeatedOnWave: asNonNegativeInteger(run?.waveNumber),
    kills,
    bossesDefeated,
  };
}

export function settleDefeat(profileState, runState) {
  if (!runState || runState.status !== "defeat") return { profile: profileState, run: runState, rewards: null, error: "Rewards can only be settled after defeat." };
  if (runState.rewardsClaimed) return { profile: profileState, run: runState, rewards: null, error: "This run's rewards were already claimed." };
  const profile = normalizeProfile(profileState);
  const run = clone(runState);
  const rewards = calculateDefeatRewards(run);
  profile.currencies.cinders += rewards.cinders;
  profile.currencies.sigils += rewards.sigils;
  profile.lifetime.runsCompleted += 1;
  profile.lifetime.bestWave = Math.max(profile.lifetime.bestWave, rewards.defeatedOnWave);
  profile.lifetime.totalWaves += rewards.wavesCleared;
  profile.lifetime.totalKills += rewards.kills;
  profile.lifetime.bossesDefeated += rewards.bossesDefeated;
  profile.lifetime.cindersEarned += rewards.cinders;
  profile.lifetime.sigilsEarned += rewards.sigils;
  syncProfileAliases(profile);
  run.rewardsClaimed = true;
  return { profile, run, rewards, error: null };
}

export function getTowerMasteryCost(profileState, typeId) {
  const profile = normalizeProfile(profileState);
  const tower = profile.towers[typeId];
  if (!tower || tower.mastery >= MAX_MASTERY) return null;
  const level = tower.mastery;
  return 30 + level * 20 + level * level * 5;
}

export function purchaseTowerUnlock(profileState, typeId) {
  const profile = normalizeProfile(profileState);
  const archetype = TOWER_ARCHETYPES[typeId];
  if (!archetype) return { profile: profileState, purchase: null, error: "Unknown tower type." };
  if (profile.towers[typeId].unlocked) return { profile: profileState, purchase: null, error: `${archetype.name} is already unlocked.` };
  if (profile.currencies.cinders < archetype.unlockCost) return { profile: profileState, purchase: null, error: `You need ${archetype.unlockCost} Cinders.` };
  profile.currencies.cinders -= archetype.unlockCost;
  profile.towers[typeId].unlocked = true;
  syncProfileAliases(profile);
  return { profile, purchase: { type: "tower-unlock", typeId, cost: archetype.unlockCost }, error: null };
}

export function purchaseTowerMastery(profileState, typeId) {
  const profile = normalizeProfile(profileState);
  const tower = profile.towers[typeId];
  if (!tower) return { profile: profileState, purchase: null, error: "Unknown tower type." };
  if (!tower.unlocked) return { profile: profileState, purchase: null, error: "Unlock that tower before buying mastery." };
  const cost = getTowerMasteryCost(profile, typeId);
  if (cost == null) return { profile: profileState, purchase: null, error: "That tower has reached maximum mastery." };
  if (profile.currencies.cinders < cost) return { profile: profileState, purchase: null, error: `You need ${cost} Cinders.` };
  profile.currencies.cinders -= cost;
  profile.towers[typeId].mastery += 1;
  syncProfileAliases(profile);
  return { profile, purchase: { type: "tower-mastery", typeId, level: profile.towers[typeId].mastery, cost }, error: null };
}

export function getTalentPurchaseState(profileState, talentId) {
  const profile = normalizeProfile(profileState);
  const talent = TALENT_TREE[talentId];
  if (!talent) return { available: false, cost: null, reason: "Unknown talent." };
  const level = profile.talents[talentId];
  if (level >= talent.maxLevel) return { available: false, cost: null, reason: "Maximum rank reached.", level };
  if (talent.requires && profile.talents[talent.requires.id] < talent.requires.level) {
    return { available: false, cost: talent.costs[level], reason: `Requires ${TALENT_TREE[talent.requires.id].name} rank ${talent.requires.level}.`, level };
  }
  const cost = talent.costs[level];
  if (profile.currencies[talent.currency] < cost) return { available: false, cost, reason: `You need ${cost} ${talent.currency}.`, level };
  return { available: true, cost, reason: null, level };
}

export function purchaseTalent(profileState, talentId) {
  const profile = normalizeProfile(profileState);
  const talent = TALENT_TREE[talentId];
  if (!talent) return { profile: profileState, purchase: null, error: "Unknown talent." };
  const purchaseState = getTalentPurchaseState(profile, talentId);
  if (!purchaseState.available) return { profile: profileState, purchase: null, error: purchaseState.reason };
  profile.currencies[talent.currency] -= purchaseState.cost;
  profile.talents[talentId] += 1;
  syncProfileAliases(profile);
  return {
    profile,
    purchase: { type: "talent", talentId, level: profile.talents[talentId], cost: purchaseState.cost, currency: talent.currency },
    error: null,
  };
}

export function serializeRun(run) {
  return JSON.stringify(run);
}

export function deserializeRun(serialized) {
  try {
    const run = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
    if (!run || run.version !== ENGINE_VERSION || !validateMap(run.map).valid) return null;
    return run;
  } catch {
    return null;
  }
}

export const ENGINE_CONSTANTS = Object.freeze({
  version: ENGINE_VERSION,
  mapWidth: MAP_WIDTH,
  mapHeight: MAP_HEIGHT,
  fixedStepSeconds: FIXED_STEP_SECONDS,
  startingGold: STARTING_GOLD,
  startingBaseHealth: STARTING_BASE_HEALTH,
  maxTowerLevel: MAX_TOWER_LEVEL,
});
