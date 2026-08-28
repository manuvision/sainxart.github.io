import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateDefeatRewards,
  chooseRunRelic,
  createProfile,
  createRun,
  deserializeProfile,
  deserializeRun,
  generateMap,
  generateRunRelicChoices,
  generateWave,
  getEffectiveTowerStats,
  getMobPosition,
  getTalentPurchaseState,
  getTowerMasteryCost,
  getTowerPurchaseCost,
  getTowerSellValue,
  getTowerUpgradeCost,
  getWaveBudget,
  normalizeProfile,
  placeTower,
  purchaseTalent,
  purchaseTowerMastery,
  purchaseTowerUnlock,
  sellTower,
  serializeProfile,
  serializeRun,
  settleDefeat,
  skipRunRelic,
  startWave,
  stepSimulation,
  upgradeTower,
  validateMap,
} from "../engine.js";
import {
  BOSS_ENEMY_ID,
  ENEMY_ARCHETYPES,
  FIXED_STEP_SECONDS,
  MAP_HEIGHT,
  MAP_WIDTH,
  RELICS,
  STARTING_BASE_HEALTH,
  STARTING_GOLD,
  TALENT_ORDER,
  TALENT_TREE,
  TOWER_ARCHETYPES,
  TOWER_ORDER,
} from "../content.js";

function unlockedProfile() {
  const profile = createProfile();
  profile.currencies.cinders = 100_000;
  profile.currencies.sigils = 100_000;
  TOWER_ORDER.forEach((towerId) => { profile.towers[towerId].unlocked = true; });
  return profile;
}

function customWave(number, typeIds, overrides = {}) {
  return {
    version: 1,
    seed: number * 17,
    number,
    isBoss: false,
    budget: typeIds.length,
    spawnInterval: 0,
    composition: Object.fromEntries([...new Set(typeIds)].map((typeId) => [typeId, typeIds.filter((id) => id === typeId).length])),
    spawns: typeIds.map((typeId, index) => ({ id: `test-spawn-${index}`, typeId, spawnTick: 0 })),
    rewardGold: 0,
    cinderReward: 0,
    sigilReward: 0,
    ...overrides,
  };
}

function padCoverage(run, pad, range = 2.85) {
  return run.map.path.reduce((count, _cell, progress) => {
    const point = getMobPosition(run.map, { progress });
    return count + Number(Math.hypot(point.x - pad.x, point.y - pad.y) <= range);
  }, 0);
}

function bestPad(run, range = 2.85) {
  return [...run.map.buildPads].sort((a, b) => padCoverage(run, b, range) - padCoverage(run, a, range) || a.id.localeCompare(b.id))[0];
}

function setupTowerScenario(typeId, mobTypeIds, seed = 41) {
  let run = createRun(unlockedProfile(), { seed });
  run.gold = 100_000;
  const towerStats = getEffectiveTowerStats(run, typeId, 1);
  const placement = placeTower(run, bestPad(run, towerStats.range).id, typeId);
  assert.equal(placement.error, null);
  run = placement.state;
  const begun = startWave(run, customWave(1, mobTypeIds));
  assert.equal(begun.error, null);
  return begun.state;
}

function advanceUntil(run, eventType, maximumTicks = 2_000) {
  const events = [];
  for (let tick = 0; tick < maximumTicks && run.status === "wave"; tick += 1) {
    const result = stepSimulation(run);
    assert.equal(result.error, null);
    run = result.state;
    events.push(...result.events);
    if (result.events.some((event) => event.type === eventType)) return { run, events, matched: result.events };
  }
  return { run, events, matched: [] };
}

function finishActiveWave(run, maximumTicks = 30_000) {
  let elapsed = 0;
  const events = [];
  while (run.status === "wave" && elapsed < maximumTicks) {
    const result = stepSimulation(run, 20);
    assert.equal(result.error, null);
    run = result.state;
    events.push(...result.events);
    elapsed += 20;
  }
  assert.ok(elapsed < maximumTicks, "wave should resolve within the guard");
  return { run, events };
}

test("procedural maps are deterministic and valid across 180 seeds", () => {
  const signatures = new Set();
  for (let seed = 1; seed <= 180; seed += 1) {
    const map = generateMap(seed, 1 + seed % 4);
    const again = generateMap(seed, 1 + seed % 4);
    assert.deepEqual(map, again);
    assert.equal(map.width, MAP_WIDTH);
    assert.equal(map.height, MAP_HEIGHT);
    assert.equal(map.path[0].y, 0);
    assert.equal(map.path.at(-1).y, MAP_HEIGHT - 1);
    assert.ok(map.path.length >= 12);
    assert.ok(map.buildPads.length >= 10 && map.buildPads.length <= 14);
    assert.deepEqual(validateMap(map), { valid: true, errors: [] });
    assert.deepEqual(JSON.parse(JSON.stringify(map)), map);
    signatures.add(map.path.map((cell) => `${cell.x}${cell.y}`).join("-"));
  }
  assert.ok(signatures.size > 140, "most seeds should create visibly distinct routes");
});

test("map validation catches overlaps, breaks, and insufficient pads", () => {
  const map = generateMap(77, 1);
  const broken = structuredClone(map);
  broken.path[2] = { x: 6, y: 11 };
  broken.buildPads = broken.buildPads.slice(0, 3);
  broken.buildPads[0] = { id: "bad", ...broken.path[0] };
  const result = validateMap(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});

test("mob position interpolates the ordered route and can enter from off-board", () => {
  const map = generateMap(12, 1);
  const before = getMobPosition(map, { progress: -0.5 });
  const first = getMobPosition(map, { progress: 0 });
  const half = getMobPosition(map, { progress: 0.5 });
  assert.ok(before.y <= first.y);
  assert.equal(first.x, map.path[0].x);
  assert.ok(Number.isFinite(half.x) && Number.isFinite(half.y));
});

test("wave budgets rise forever and wave generation is deterministic", () => {
  let previous = 0;
  for (let wave = 1; wave <= 250; wave += 1) {
    const budget = getWaveBudget(wave);
    assert.ok(budget >= previous);
    previous = budget;
    assert.deepEqual(generateWave(9921, wave), generateWave(9921, wave));
  }
  assert.ok(getWaveBudget(250) > getWaveBudget(25) * 5);
});

test("a boss appears exactly once on every tenth wave and never elsewhere", () => {
  for (let wave = 1; wave <= 80; wave += 1) {
    const definition = generateWave(93, wave);
    const bossCount = definition.spawns.filter((spawn) => spawn.typeId === BOSS_ENEMY_ID).length;
    assert.equal(definition.isBoss, wave % 10 === 0);
    assert.equal(bossCount, wave % 10 === 0 ? 1 : 0);
    assert.equal(definition.sigilReward > 0, wave % 10 === 0);
  }
});

test("later waves broaden composition rather than only adding Ashlings", () => {
  assert.deepEqual(Object.keys(generateWave(5, 1).compositionCounts), ["ashling"]);
  const waveFive = generateWave(5, 5);
  const waveEight = generateWave(5, 8);
  assert.ok(waveFive.composition.length >= 3);
  assert.ok(waveEight.composition.length >= 4);
  assert.ok(waveFive.compositionCounts.veil_wisp >= 1);
  assert.ok(waveEight.compositionCounts.siege_hulk >= 1);
});

test("profile starts with exactly the two basic tower families unlocked", () => {
  const profile = createProfile();
  assert.deepEqual(TOWER_ORDER.filter((id) => profile.towers[id].unlocked), ["ashbolt", "cinder_mortar"]);
  assert.equal(profile.currencies.cinders, 0);
  assert.equal(profile.currencies.sigils, 0);
  assert.equal(TALENT_ORDER.length, 10);
  assert.equal(Object.keys(TALENT_TREE).length, 10);
});

test("profile normalization and serialization repair malformed durable data", () => {
  const normalized = normalizeProfile({
    currencies: { cinders: -3, sigils: 8.9 },
    towers: { ashbolt: { unlocked: false, mastery: 99 } },
    talents: { war_chest: 99 },
  });
  assert.equal(normalized.currencies.cinders, 0);
  assert.equal(normalized.currencies.sigils, 8);
  assert.equal(normalized.towers.ashbolt.unlocked, true);
  assert.equal(normalized.towers.ashbolt.mastery, 5);
  assert.equal(normalized.talents.war_chest, TALENT_TREE.war_chest.maxLevel);
  assert.deepEqual(deserializeProfile(serializeProfile(normalized)), normalized);
  assert.deepEqual(deserializeProfile("{bad json"), createProfile());
});

test("a fresh run is serializable and tuned for two or three opening towers", () => {
  const run = createRun(createProfile(), { seed: "first-fire" });
  assert.equal(run.status, "build");
  assert.equal(run.gold, STARTING_GOLD);
  assert.equal(run.baseHp, STARTING_BASE_HEALTH);
  assert.equal(run.maxBaseHp, STARTING_BASE_HEALTH);
  assert.ok(run.gold >= TOWER_ARCHETYPES.ashbolt.baseCost * 3);
  assert.ok(run.gold >= TOWER_ARCHETYPES.ashbolt.baseCost + TOWER_ARCHETYPES.cinder_mortar.baseCost);
  assert.deepEqual(deserializeRun(serializeRun(run)), run);
});

test("placement enforces unlock, funds, pad occupancy, and spends discounted cost", () => {
  let run = createRun(createProfile(), { seed: 3 });
  const pad = run.map.buildPads[0];
  assert.match(placeTower(run, pad.id, "brand_brazier").error, /not permanently unlocked/i);
  run.gold = 0;
  assert.match(placeTower(run, pad.id, "ashbolt").error, /need/i);
  run.gold = 1_000;
  run.modifiers.buildDiscount = 0.16;
  const expected = getTowerPurchaseCost(run, "ashbolt");
  const placed = placeTower(run, pad.id, "ashbolt");
  assert.equal(placed.error, null);
  assert.equal(placed.state.gold, 1_000 - expected);
  assert.equal(placed.state.towers[0].invested, expected);
  assert.match(placeTower(placed.state, pad.id, "ashbolt").error, /occupied/i);
});

test("tower upgrades cap at level four and selling returns the configured share", () => {
  let run = createRun(createProfile(), { seed: 4 });
  run.gold = 10_000;
  run = placeTower(run, run.map.buildPads[0].id, "ashbolt").state;
  const towerId = run.towers[0].id;
  for (let level = 1; level < 4; level += 1) {
    const cost = getTowerUpgradeCost("ashbolt", level, run);
    const before = run.gold;
    const upgraded = upgradeTower(run, towerId);
    assert.equal(upgraded.error, null);
    run = upgraded.state;
    assert.equal(run.gold, before - cost);
    assert.equal(run.towers[0].level, level + 1);
  }
  assert.match(upgradeTower(run, towerId).error, /maximum/i);
  const refund = getTowerSellValue(run, run.towers[0]);
  const beforeSale = run.gold;
  run = sellTower(run, towerId).state;
  assert.equal(run.towers.length, 0);
  assert.equal(run.gold, beforeSale + refund);
});

test("single-target Ashbolt damages only one mob per shot", () => {
  const scenario = advanceUntil(setupTowerScenario("ashbolt", ["cinder_brute", "cinder_brute", "cinder_brute"]), "tower-fired");
  assert.ok(scenario.matched.length);
  const damage = scenario.matched.filter((event) => event.type === "mob-damaged");
  assert.equal(damage.length, 1);
  assert.equal(damage[0].kind, "single");
});

test("Cinder Mortar deals AOE damage to a clustered formation", () => {
  const scenario = advanceUntil(setupTowerScenario("cinder_mortar", ["cinder_brute", "cinder_brute", "cinder_brute"]), "aoe-impact");
  const impact = scenario.matched.find((event) => event.type === "aoe-impact");
  assert.ok(impact.targetIds.length >= 3);
  assert.ok(scenario.matched.filter((event) => event.type === "mob-damaged" && event.kind === "aoe").length >= 3);
});

test("Brand Brazier applies and later resolves armor-ignoring damage over time", () => {
  let scenario = advanceUntil(setupTowerScenario("brand_brazier", ["siege_hulk"]), "dot-applied");
  assert.ok(scenario.matched.some((event) => event.type === "dot-applied"));
  scenario = advanceUntil(scenario.run, "mob-damaged", 20);
  assert.ok(scenario.events.some((event) => event.type === "mob-damaged" && event.kind === "dot"));
  assert.ok(scenario.run.stats.effectDamage > 0);
});

test("Rime Bell applies a real movement slow with a finite duration", () => {
  let scenario = advanceUntil(setupTowerScenario("rime_bell", ["siege_hulk"]), "slow-applied");
  const slowed = scenario.run.mobs[0];
  assert.ok(slowed.effects.slow.multiplier < 1);
  const before = slowed.progress;
  const baseSpeed = slowed.speed;
  const result = stepSimulation(scenario.run, 10);
  const after = result.state.mobs[0].progress;
  assert.ok(after - before < baseSpeed * 10 * FIXED_STEP_SECONDS);
});

test("Storm Reliquary chains through nearby mobs with diminishing damage", () => {
  const scenario = advanceUntil(setupTowerScenario("storm_reliquary", ["cinder_brute", "cinder_brute", "cinder_brute", "cinder_brute"]), "chain-hit");
  const hits = scenario.matched.filter((event) => event.type === "chain-hit");
  assert.ok(hits.length >= 3);
  for (let index = 1; index < hits.length; index += 1) assert.ok(hits[index].damage < hits[index - 1].damage);
  assert.equal(new Set(hits.map((event) => event.mobId)).size, hits.length);
});

test("shields absorb before health and armor reduces direct hits", () => {
  const shielded = advanceUntil(setupTowerScenario("ashbolt", ["veil_wisp"], 51), "tower-fired");
  const shieldHit = shielded.matched.find((event) => event.type === "mob-damaged");
  assert.ok(shieldHit.shieldAbsorbed > 0);
  assert.equal(shieldHit.amount, 0);

  const armored = advanceUntil(setupTowerScenario("ashbolt", ["ironbound"], 52), "tower-fired");
  const armorHit = armored.matched.find((event) => event.type === "mob-damaged");
  assert.ok(armorHit.armorBlocked > 0);
  assert.ok(armorHit.amount < armorHit.rawDamage);
});

test("fixed-step simulation is deterministic and remains JSON-safe", () => {
  const initial = setupTowerScenario("cinder_mortar", ["ashling", "spark_mite", "cinder_brute"], 909);
  const first = stepSimulation(initial, 200);
  const second = stepSimulation(initial, 200);
  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first.state));
});

test("leaks damage the Ward and zero health ends the run", () => {
  let run = createRun(createProfile(), { seed: 72 });
  run.baseHp = 1;
  run = startWave(run, customWave(1, ["ashling"])).state;
  run = stepSimulation(run).state;
  assert.equal(run.mobs.length, 1);
  run.mobs[0].progress = run.map.path.length - 0.051;
  const leaked = stepSimulation(run);
  assert.equal(leaked.state.status, "defeat");
  assert.equal(leaked.state.baseHp, 0);
  assert.ok(leaked.events.some((event) => event.type === "base-leak"));
  assert.ok(leaked.events.some((event) => event.type === "defeat"));
});

test("wave completion pays Gold and Cinders then returns to build phase", () => {
  let run = createRun(createProfile(), { seed: 81 });
  const before = run.gold;
  run = startWave(run, customWave(1, [], { rewardGold: 37, cinderReward: 4 })).state;
  const result = stepSimulation(run);
  assert.equal(result.state.status, "build");
  assert.equal(result.state.gold, before + 37);
  assert.equal(result.state.cinderBank, 4);
  assert.equal(result.state.wavesCleared, 1);
  assert.ok(result.events.some((event) => event.type === "wave-complete"));
});

test("chapter-relative waves 3, 6, and 9 produce deterministic capped relic drafts", () => {
  let run = createRun(unlockedProfile(), { seed: 602 });
  for (const wave of [3, 6, 9, 13, 16, 19]) {
    run.waveNumber = wave - 1;
    run.wavesCleared = wave - 1;
    run.pendingRelicChoice = null;
    const preview = generateRunRelicChoices(run, wave);
    assert.deepEqual(preview, generateRunRelicChoices(run, wave));
    assert.equal(preview.options.length, 3);
    assert.equal(new Set(preview.options).size, 3);
  }
  run.relics.sharpened_embers = RELICS.sharpened_embers.maxStacks;
  assert.ok(!generateRunRelicChoices(run, 3).options.includes("sharpened_embers"));
});

test("wave three pauses on a relic offer and choosing one mutates run modifiers", () => {
  let run = createRun(unlockedProfile(), { seed: 701 });
  run.waveNumber = 2;
  run.wavesCleared = 2;
  run = startWave(run, customWave(3, [], { rewardGold: 10 })).state;
  run = stepSimulation(run).state;
  assert.equal(run.status, "build");
  assert.equal(run.pendingRelicChoice.options.length, 3);
  assert.match(startWave(run).error, /choose/i);
  run.pendingRelicChoice.options = ["sharpened_embers"];
  const before = run.modifiers.towerDamageMultiplier;
  const chosen = chooseRunRelic(run, "sharpened_embers");
  assert.equal(chosen.error, null);
  assert.equal(chosen.state.pendingRelicChoice, null);
  assert.ok(chosen.state.modifiers.towerDamageMultiplier > before);
});

test("build discount and tower-special relics affect effective tower stats", () => {
  let run = createRun(unlockedProfile(), { seed: 702 });
  run.pendingRelicChoice = { id: "test", waveNumber: 3, options: ["builders_mark"] };
  const baseCost = getTowerPurchaseCost(run, "ashbolt");
  run = chooseRunRelic(run, "builders_mark").state;
  assert.ok(getTowerPurchaseCost(run, "ashbolt") < baseCost);

  const before = getEffectiveTowerStats(run, "cinder_mortar", 1).splashRadius;
  run.pendingRelicChoice = { id: "test-2", waveNumber: 6, options: ["scatter_charge"] };
  run = chooseRunRelic(run, "scatter_charge").state;
  assert.ok(getEffectiveTowerStats(run, "cinder_mortar", 1).splashRadius > before);
});

test("skipping a pending relic clears the offer and awards exactly 40 Gold", () => {
  const run = createRun(createProfile(), { seed: 703 });
  run.pendingRelicChoice = { id: "test", waveNumber: 3, options: ["sharpened_embers"] };
  run.pendingRelicChoices = ["sharpened_embers"];
  const before = run.gold;
  const skipped = skipRunRelic(run);
  assert.equal(skipped.error, null);
  assert.equal(skipped.state.gold, before + 40);
  assert.equal(skipped.state.pendingRelicChoice, null);
  assert.deepEqual(skipped.state.pendingRelicChoices, []);
});

test("boss completion banks a Sigil, salvages towers, and regenerates the chapter map", () => {
  let run = createRun(createProfile(), { seed: 804 });
  run.gold = 1_000;
  run = placeTower(run, run.map.buildPads[0].id, "ashbolt").state;
  run.baseHp = 5;
  const beforeBossHp = run.baseHp;
  const oldMapSeed = run.mapSeed;
  const invested = run.towers[0].invested;
  run.waveNumber = 9;
  run.wavesCleared = 9;
  run = startWave(run, customWave(10, [], { isBoss: true, rewardGold: 80, cinderReward: 15, sigilReward: 1 })).state;
  const completed = stepSimulation(run);
  run = completed.state;
  assert.equal(run.status, "build");
  assert.equal(run.chapter, 2);
  assert.notEqual(run.mapSeed, oldMapSeed);
  assert.equal(run.towers.length, 0);
  assert.equal(run.sigilBank, 1);
  assert.ok(run.baseHp >= beforeBossHp + Math.ceil(run.maxBaseHp * 0.2));
  assert.ok(run.gold >= 1_000 - invested + 80 + invested);
  assert.ok(completed.events.some((event) => event.type === "chapter-started"));
});

test("defeat rewards are deterministic, scale with progress, and can only settle once", () => {
  const run = createRun(createProfile(), { seed: 901 });
  run.status = "defeat";
  run.waveNumber = 9;
  run.wavesCleared = 8;
  run.cinderBank = 31;
  run.sigilBank = 1;
  run.stats.kills = 87;
  run.stats.bossesDefeated = 1;
  const rewards = calculateDefeatRewards(run);
  assert.deepEqual(rewards, calculateDefeatRewards(run));
  assert.ok(rewards.cinders > run.cinderBank);
  assert.equal(rewards.sigils, 1);
  const settlement = settleDefeat(createProfile(), run);
  assert.equal(settlement.error, null);
  assert.equal(settlement.profile.currencies.cinders, rewards.cinders);
  assert.equal(settlement.profile.currencies.sigils, 1);
  assert.equal(settlement.profile.lifetime.bestWave, 9);
  assert.equal(settleDefeat(settlement.profile, settlement.run).error, "This run's rewards were already claimed.");
});

test("Cinders unlock towers and buy capped tower mastery deterministically", () => {
  let profile = createProfile();
  profile.currencies.cinders = 10_000;
  const unlock = purchaseTowerUnlock(profile, "brand_brazier");
  assert.equal(unlock.error, null);
  assert.equal(unlock.profile.towers.brand_brazier.unlocked, true);
  assert.equal(unlock.purchase.cost, TOWER_ARCHETYPES.brand_brazier.unlockCost);
  profile = unlock.profile;
  for (let expected = 1; expected <= 5; expected += 1) {
    const cost = getTowerMasteryCost(profile, "brand_brazier");
    const purchase = purchaseTowerMastery(profile, "brand_brazier");
    assert.equal(purchase.error, null);
    assert.equal(purchase.purchase.cost, cost);
    profile = purchase.profile;
    assert.equal(profile.towers.brand_brazier.mastery, expected);
  }
  assert.match(purchaseTowerMastery(profile, "brand_brazier").error, /maximum/i);
});

test("the Sigil talent tree enforces prerequisites and changes new-run stats", () => {
  let profile = createProfile();
  profile.currencies.sigils = 100;
  assert.equal(getTalentPurchaseState(profile, "quickened_gears").available, false);
  assert.match(purchaseTalent(profile, "quickened_gears").error, /requires/i);
  profile = purchaseTalent(profile, "tempered_arsenal").profile;
  profile = purchaseTalent(profile, "tempered_arsenal").profile;
  const quickened = purchaseTalent(profile, "quickened_gears");
  assert.equal(quickened.error, null);
  profile = quickened.profile;
  profile = purchaseTalent(profile, "reinforced_foundation").profile;
  const run = createRun(profile, { seed: 1001 });
  assert.ok(run.maxBaseHp > STARTING_BASE_HEALTH);
  assert.ok(run.modifiers.towerDamageMultiplier > 1);
  assert.ok(run.modifiers.attackSpeedMultiplier > 1);
});

test("a no-upgrade opening defense usually falls in the intended waves 7–12", () => {
  const defeats = [];
  for (const seed of [1, 2, 3, 42, 99, 777, 2026, 9999]) {
    let run = createRun(createProfile(), { seed });
    const ashPad = bestPad(run, getEffectiveTowerStats(run, "ashbolt", 1).range);
    run = placeTower(run, ashPad.id, "ashbolt").state;
    const remainingPads = run.map.buildPads.filter((pad) => !run.towers.some((tower) => tower.padId === pad.id));
    const mortarPad = [...remainingPads].sort((a, b) => padCoverage(run, b, 2.75) - padCoverage(run, a, 2.75))[0];
    run = placeTower(run, mortarPad.id, "cinder_mortar").state;
    while (run.status !== "defeat" && run.waveNumber < 14) {
      if (run.pendingRelicChoice) run = chooseRunRelic(run, run.pendingRelicChoice.options[0]).state;
      run = startWave(run).state;
      run = finishActiveWave(run).run;
    }
    defeats.push(run.waveNumber);
  }
  assert.ok(defeats.every((wave) => wave >= 7 && wave <= 12), `unexpected first-run defeats: ${defeats.join(", ")}`);
  const sorted = [...defeats].sort((a, b) => a - b);
  assert.ok(sorted[Math.floor(sorted.length / 2)] >= 8 && sorted[Math.floor(sorted.length / 2)] <= 11);
});

test("all declared normal archetypes are functional, non-boss composition options", () => {
  const normals = Object.values(ENEMY_ARCHETYPES).filter((enemy) => !enemy.boss);
  assert.ok(normals.length >= 5);
  normals.forEach((enemy) => {
    assert.ok(enemy.health > 0);
    assert.ok(enemy.speed > 0);
    assert.ok(enemy.budgetCost > 0);
  });
});
