import test from "node:test";
import assert from "node:assert/strict";

import {
  CARDS,
  LOADOUT_SIZE,
  adjustLoadout,
  applyVictory,
  createCampaign,
  endTurn,
  getLibrary,
  getValidTargets,
  playCard,
  spendStatPoint,
  startCombat,
  upgradeFireStaff,
  visitCinderwatch,
} from "../engine.js";

const fixedRandom = () => 0.42;

test("a new Mage starts with a valid 12-card history", () => {
  const campaign = createCampaign();
  const library = getLibrary(campaign);
  assert.equal(campaign.player.activeDeck.length, LOADOUT_SIZE);
  assert.equal(library.manaGem, 2);
  assert.equal(library.firebolt, 2);
  assert.equal(library.arcaneMissile, undefined);
});

test("investing three earned points into INT deterministically unlocks Arcane Missile", () => {
  let campaign = createCampaign();
  campaign.player.unspentStats = 3;
  let lastUnlocks = [];
  for (let index = 0; index < 3; index += 1) {
    const result = spendStatPoint(campaign, "int");
    campaign = result.campaign;
    lastUnlocks = result.unlocked;
  }
  assert.equal(campaign.player.stats.int, 8);
  assert.deepEqual(lastUnlocks, ["arcaneMissile"]);
  assert.equal(getLibrary(campaign).arcaneMissile, 1);
});

test("the Fire Staff reveals cards only after attunement, then adds Flame Wall at T2", () => {
  let campaign = visitCinderwatch(createCampaign());
  assert.equal(campaign.player.equipment.staffTier, 1);
  assert.equal(getLibrary(campaign).fireball, undefined);

  campaign.flags.staffAttuned = true;
  campaign.inventory.emberShard = 1;
  assert.equal(getLibrary(campaign).fireball, 1);
  assert.equal(getLibrary(campaign).burn, 1);

  campaign = upgradeFireStaff(campaign);
  assert.equal(campaign.player.equipment.staffTier, 2);
  assert.equal(getLibrary(campaign).flameWall, 1);
});

test("loadout editing cannot exceed owned copies or twelve active cards", () => {
  let campaign = createCampaign();
  campaign = adjustLoadout(campaign, "strike", -1);
  assert.equal(campaign.player.activeDeck.length, 11);
  campaign = adjustLoadout(campaign, "strike", 1);
  assert.equal(campaign.player.activeDeck.length, 12);
  campaign = adjustLoadout(campaign, "strike", 1);
  assert.equal(campaign.player.activeDeck.length, 12);
});

test("Firebolt spends Mana and damages an in-range enemy", () => {
  const campaign = createCampaign();
  const combat = startCombat(campaign, "ashen-road", fixedRandom);
  combat.hand = [{ uid: "spell", cardId: "firebolt" }];
  combat.player.mana = 3;
  const target = combat.enemies[0];
  assert.ok(getValidTargets(combat, "firebolt").includes(target.id));

  const result = playCard(combat, "spell", target.id, fixedRandom);
  assert.equal(result.error, null);
  assert.equal(result.combat.player.mana, 1);
  assert.equal(result.combat.enemies[0].hp, target.hp - CARDS.firebolt.damage);
});

test("moving off a telegraphed tile makes the fixed attack miss", () => {
  const campaign = createCampaign();
  let combat = startCombat(campaign, "scorched-keep", fixedRandom);
  const seer = combat.enemies.find((enemy) => enemy.type === "emberSeer");
  assert.deepEqual(seer.intent.tiles, [combat.player.position]);
  combat.hand = [{ uid: "move", cardId: "advance" }];

  const moved = playCard(combat, "move", null, fixedRandom);
  assert.equal(moved.combat.player.position, 2);
  const hpBefore = moved.combat.player.hp;
  combat = endTurn(moved.combat, fixedRandom).combat;
  assert.equal(combat.player.hp, hpBefore);
  assert.ok(combat.log.some((entry) => entry.text.includes("Cinder Hex misses")));
});

test("Stamina refills while unused Mana banks across turns", () => {
  const campaign = createCampaign();
  const combat = startCombat(campaign, "ashen-road", fixedRandom);
  combat.player.stamina = 0;
  combat.player.mana = 3;
  combat.hand = [];
  const next = endTurn(combat, fixedRandom).combat;
  assert.equal(next.player.stamina, next.player.maxStamina);
  assert.equal(next.player.mana, 4);
});

test("victory advances the campaign and preserves battle totals", () => {
  const campaign = createCampaign();
  const combat = startCombat(campaign, "ashen-road", fixedRandom);
  combat.player.hp = 31;
  combat.totals = { cardsPlayed: 7, damageDealt: 31, tilesMoved: 2 };
  const next = applyVictory(campaign, "ashen-road", combat);
  assert.ok(next.completed.includes("ashen-road"));
  assert.equal(next.currentNode, "cinderwatch");
  assert.equal(next.player.unspentStats, 3);
  assert.equal(next.stats.cardsPlayed, 7);
  assert.equal(next.player.hp, next.player.maxHp);
});
