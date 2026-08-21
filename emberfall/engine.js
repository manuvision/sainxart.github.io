export const BOARD_SIZE = 9;
export const HAND_SIZE = 5;
export const LOADOUT_SIZE = 12;

export const STAT_LABELS = {
  str: "Strength",
  agi: "Agility",
  con: "Constitution",
  wis: "Wisdom",
  int: "Intelligence",
  luk: "Luck",
};

export const CARDS = {
  strike: {
    id: "strike",
    name: "Oakstaff Strike",
    shortName: "Strike",
    family: "physical",
    resource: "stamina",
    cost: 1,
    target: "enemy",
    range: 1,
    damage: 5,
    icon: "blade",
    description: "Deal 5 damage to an adjacent enemy.",
    source: "Shared basic",
  },
  brace: {
    id: "brace",
    name: "Brace",
    shortName: "Brace",
    family: "physical",
    resource: "stamina",
    cost: 1,
    target: "none",
    block: 6,
    icon: "shield",
    description: "Gain 6 Block until your next turn.",
    source: "Shared basic",
  },
  advance: {
    id: "advance",
    name: "Advance",
    shortName: "Advance",
    family: "movement",
    resource: "stamina",
    cost: 0,
    target: "none",
    move: 1,
    icon: "forward",
    description: "Move 1 tile toward the enemy. Costs nothing.",
    source: "Shared basic",
  },
  retreat: {
    id: "retreat",
    name: "Withdraw",
    shortName: "Withdraw",
    family: "movement",
    resource: "stamina",
    cost: 0,
    target: "none",
    move: -1,
    icon: "back",
    description: "Move 1 tile away from the enemy. Costs nothing.",
    source: "Shared basic",
  },
  focus: {
    id: "focus",
    name: "Gather Thought",
    shortName: "Gather",
    family: "utility",
    resource: "stamina",
    cost: 1,
    target: "none",
    mana: 1,
    draw: 1,
    icon: "focus",
    description: "Gain 1 Mana and draw 1 card.",
    source: "Shared basic",
  },
  manaGem: {
    id: "manaGem",
    name: "Mana Gem",
    shortName: "Mana Gem",
    family: "magic",
    resource: "mana",
    cost: 0,
    target: "none",
    mana: 2,
    icon: "gem",
    description: "Gain 2 Mana. Costs nothing.",
    source: "INT 3",
  },
  firebolt: {
    id: "firebolt",
    name: "Firebolt",
    shortName: "Firebolt",
    family: "magic",
    resource: "mana",
    cost: 2,
    target: "enemy",
    range: 4,
    damage: 7,
    icon: "bolt",
    description: "Deal 7 damage to an enemy within 4 tiles.",
    source: "INT 5",
  },
  arcaneMissile: {
    id: "arcaneMissile",
    name: "Arcane Missile",
    shortName: "Missiles",
    family: "magic",
    resource: "mana",
    cost: 3,
    target: "none",
    damageAll: 4,
    icon: "missile",
    description: "Deal 4 damage to every enemy on the lane.",
    source: "INT 8",
  },
  overcharge: {
    id: "overcharge",
    name: "Overcharge",
    shortName: "Overcharge",
    family: "magic",
    resource: "mana",
    cost: 2,
    target: "none",
    overcharge: true,
    icon: "spark",
    description: "Your next spell costs 0 Mana and deals +50% damage.",
    source: "INT 10",
  },
  ward: {
    id: "ward",
    name: "Runic Ward",
    shortName: "Ward",
    family: "magic",
    resource: "mana",
    cost: 1,
    target: "none",
    block: 8,
    icon: "ward",
    description: "Gain 8 Block until your next turn.",
    source: "WIS 3",
  },
  sidestep: {
    id: "sidestep",
    name: "Cinderstep",
    shortName: "Cinderstep",
    family: "movement",
    resource: "stamina",
    cost: 1,
    target: "tile",
    range: 2,
    icon: "step",
    description: "Move to a free tile up to 2 spaces away.",
    source: "AGI 5",
  },
  fireball: {
    id: "fireball",
    name: "Fireball",
    shortName: "Fireball",
    family: "fire",
    resource: "mana",
    cost: 3,
    target: "enemy",
    range: 5,
    damage: 9,
    splash: 4,
    icon: "fireball",
    description: "Deal 9 damage. Enemies on adjacent tiles take 4.",
    source: "Fire Staff · T1",
  },
  burn: {
    id: "burn",
    name: "Brand",
    shortName: "Brand",
    family: "fire",
    resource: "mana",
    cost: 1,
    target: "enemy",
    range: 4,
    damage: 2,
    burn: { damage: 2, turns: 3 },
    icon: "brand",
    description: "Deal 2 damage, then 2 Burn for 3 enemy turns.",
    source: "Fire Staff · T1",
  },
  flameWall: {
    id: "flameWall",
    name: "Flame Wall",
    shortName: "Flame Wall",
    family: "fire",
    resource: "mana",
    cost: 4,
    target: "tile",
    range: 5,
    icon: "wall",
    description: "Ignite 3 tiles. Enemies there take 6 damage and Burn.",
    source: "Fire Staff · T2",
  },
};

export const CARD_ORDER = [
  "strike",
  "brace",
  "advance",
  "retreat",
  "focus",
  "manaGem",
  "firebolt",
  "arcaneMissile",
  "overcharge",
  "ward",
  "sidestep",
  "fireball",
  "burn",
  "flameWall",
];

const BASIC_LIBRARY = {
  strike: 2,
  brace: 2,
  advance: 2,
  retreat: 1,
  focus: 1,
};

const STAT_UNLOCKS = [
  { stat: "int", threshold: 3, cardId: "manaGem", count: 2 },
  { stat: "int", threshold: 5, cardId: "firebolt", count: 2 },
  { stat: "int", threshold: 8, cardId: "arcaneMissile", count: 1 },
  { stat: "int", threshold: 10, cardId: "overcharge", count: 1 },
  { stat: "wis", threshold: 3, cardId: "ward", count: 1 },
  { stat: "agi", threshold: 5, cardId: "sidestep", count: 1 },
];

export const ENCOUNTERS = {
  "ashen-road": {
    id: "ashen-road",
    eyebrow: "Encounter I",
    name: "The Ashen Road",
    description: "Raiders close around a courier carrying word from Cinderwatch.",
    region: "Greybank March",
    enemies: [
      { type: "ashRaider", position: 5 },
      { type: "cinderHound", position: 8 },
    ],
  },
  "scorched-keep": {
    id: "scorched-keep",
    eyebrow: "Dungeon",
    name: "Scorched Keep",
    description: "Attune the fire staff inside the ruin that forged it.",
    region: "The Charred Vale",
    enemies: [
      { type: "keepGuard", position: 5 },
      { type: "emberSeer", position: 8 },
    ],
  },
  emberfall: {
    id: "emberfall",
    eyebrow: "Boss",
    name: "The Emberfall",
    description: "Seal the waking ember before the old fire takes the valley.",
    region: "The Ember Crown",
    enemies: [
      { type: "emberling", position: 5 },
      { type: "fallenWarden", position: 8 },
    ],
  },
};

export const ENEMY_TYPES = {
  ashRaider: {
    name: "Ash Raider",
    maxHp: 18,
    portrait: "raider",
    description: "A road-cutting sellsword with a hooked blade.",
  },
  cinderHound: {
    name: "Cinder Hound",
    maxHp: 13,
    portrait: "hound",
    description: "Fast, brittle, and eager to pounce.",
  },
  keepGuard: {
    name: "Keep Guardian",
    maxHp: 25,
    portrait: "guard",
    description: "An armoured revenant that owns the close lane.",
  },
  emberSeer: {
    name: "Ember Seer",
    maxHp: 20,
    portrait: "seer",
    description: "A ranged caster whose hexes strike marked ground.",
  },
  emberling: {
    name: "Crown Ember",
    maxHp: 14,
    portrait: "emberling",
    description: "A splinter of the old flame.",
  },
  fallenWarden: {
    name: "The Fallen Warden",
    maxHp: 58,
    portrait: "boss",
    description: "The last keeper of the Ember Crown.",
  },
};

const copy = (value) => JSON.parse(JSON.stringify(value));

export function createCampaign() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    currentNode: "greybank",
    completed: [],
    day: 1,
    finished: false,
    player: {
      name: "Elowen",
      title: "Hedge Mage",
      maxHp: 42,
      hp: 42,
      gold: 24,
      xp: 0,
      unspentStats: 0,
      stats: { str: 2, agi: 3, con: 3, wis: 2, int: 5, luk: 1 },
      equipment: { weapon: null, staffTier: 0 },
      activeDeck: [
        "strike",
        "strike",
        "brace",
        "brace",
        "advance",
        "advance",
        "retreat",
        "focus",
        "manaGem",
        "manaGem",
        "firebolt",
        "firebolt",
      ],
    },
    inventory: { emberShard: 0 },
    flags: {
      cinderwatchVisited: false,
      staffAttuned: false,
      staffUpgraded: false,
    },
    stats: {
      battlesWon: 0,
      cardsPlayed: 0,
      damageDealt: 0,
      tilesMoved: 0,
    },
  };
}

export function totalStats(campaign) {
  return Object.values(campaign.player.stats).reduce((sum, value) => sum + value, 0);
}

export function characterLevel(campaign) {
  return Math.max(1, Math.floor((totalStats(campaign) - 12) / 3));
}

export function getLibrary(campaign) {
  const library = { ...BASIC_LIBRARY };
  for (const unlock of STAT_UNLOCKS) {
    if ((campaign.player.stats[unlock.stat] || 0) >= unlock.threshold) {
      library[unlock.cardId] = (library[unlock.cardId] || 0) + unlock.count;
    }
  }

  if (campaign.flags.staffAttuned && campaign.player.equipment.staffTier >= 1) {
    library.fireball = 1;
    library.burn = 1;
  }
  if (campaign.flags.staffAttuned && campaign.player.equipment.staffTier >= 2) {
    library.flameWall = 1;
  }
  return library;
}

export function getUnlockState(campaign, cardId) {
  const owned = getLibrary(campaign)[cardId] || 0;
  if (owned) return { owned: true, label: CARDS[cardId].source };

  const statUnlock = STAT_UNLOCKS.find((unlock) => unlock.cardId === cardId);
  if (statUnlock) {
    const current = campaign.player.stats[statUnlock.stat] || 0;
    return {
      owned: false,
      label: `${STAT_LABELS[statUnlock.stat]} ${current}/${statUnlock.threshold}`,
      progress: Math.min(1, current / statUnlock.threshold),
    };
  }

  if (["fireball", "burn"].includes(cardId)) {
    if (campaign.player.equipment.staffTier < 1) return { owned: false, label: "Find the Fire Staff" };
    return { owned: false, label: "Attune the Fire Staff in combat" };
  }
  if (cardId === "flameWall") {
    if (campaign.player.equipment.staffTier < 2) return { owned: false, label: "Upgrade the Fire Staff to T2" };
    return { owned: false, label: "Attune the Fire Staff" };
  }
  return { owned: false, label: "Undiscovered" };
}

export function activeCount(campaign, cardId) {
  return campaign.player.activeDeck.filter((id) => id === cardId).length;
}

export function canAdjustLoadout(campaign, cardId, delta) {
  const library = getLibrary(campaign);
  const count = activeCount(campaign, cardId);
  if (delta > 0) {
    return campaign.player.activeDeck.length < LOADOUT_SIZE && count < (library[cardId] || 0);
  }
  return count > 0;
}

export function adjustLoadout(campaign, cardId, delta) {
  const next = copy(campaign);
  if (!canAdjustLoadout(next, cardId, delta)) return next;
  if (delta > 0) {
    next.player.activeDeck.push(cardId);
  } else {
    const index = next.player.activeDeck.lastIndexOf(cardId);
    if (index >= 0) next.player.activeDeck.splice(index, 1);
  }
  return next;
}

export function spendStatPoint(campaign, stat) {
  if (!Object.hasOwn(STAT_LABELS, stat) || campaign.player.unspentStats <= 0) {
    return { campaign: copy(campaign), unlocked: [] };
  }
  const before = getLibrary(campaign);
  const next = copy(campaign);
  next.player.stats[stat] += 1;
  next.player.unspentStats -= 1;
  const after = getLibrary(next);
  const unlocked = Object.keys(after).filter((id) => !before[id] && after[id]);
  return { campaign: next, unlocked };
}

function shuffled(values, rng) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function makeDeck(cardIds) {
  return cardIds.map((cardId, index) => ({ uid: `card-${index + 1}`, cardId }));
}

function drawCardsMutable(combat, amount, rng) {
  for (let index = 0; index < amount; index += 1) {
    if (!combat.drawPile.length) {
      if (!combat.discardPile.length) break;
      combat.drawPile = shuffled(combat.discardPile, rng);
      combat.discardPile = [];
    }
    const drawn = combat.drawPile.pop();
    if (drawn) combat.hand.push(drawn);
  }
}

function makeEnemy(template, index) {
  const definition = ENEMY_TYPES[template.type];
  return {
    id: `${template.type}-${index + 1}`,
    type: template.type,
    name: definition.name,
    portrait: definition.portrait,
    description: definition.description,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    block: 0,
    position: template.position,
    burn: null,
    intent: null,
  };
}

export function startCombat(campaign, encounterId, rng = Math.random) {
  const encounter = ENCOUNTERS[encounterId];
  if (!encounter) throw new Error(`Unknown encounter: ${encounterId}`);
  if (campaign.player.activeDeck.length !== LOADOUT_SIZE) {
    throw new Error(`Active loadout must contain exactly ${LOADOUT_SIZE} cards.`);
  }

  const combat = {
    encounterId,
    status: "playing",
    turn: 1,
    player: {
      hp: Math.max(1, campaign.player.hp),
      maxHp: campaign.player.maxHp,
      block: 0,
      position: 1,
      stamina: 3,
      maxStamina: 3,
      mana: 1,
      maxMana: 6,
      overcharged: false,
    },
    enemies: encounter.enemies.map(makeEnemy),
    drawPile: shuffled(makeDeck(campaign.player.activeDeck), rng),
    discardPile: [],
    hand: [],
    hazards: [],
    log: [],
    totals: { cardsPlayed: 0, damageDealt: 0, tilesMoved: 0 },
  };
  drawCardsMutable(combat, HAND_SIZE, rng);
  planEnemyIntentsMutable(combat);
  combat.log.push({ tone: "system", text: `${encounter.name} begins.` });
  return combat;
}

function aliveEnemies(combat) {
  return combat.enemies.filter((enemy) => enemy.hp > 0);
}

function occupiedByEnemy(combat, position) {
  return aliveEnemies(combat).some((enemy) => enemy.position === position);
}

function freePlayerTile(combat, position) {
  return position >= 0 && position < BOARD_SIZE && !occupiedByEnemy(combat, position);
}

function effectiveCost(combat, card) {
  if (combat.player.overcharged && card.resource === "mana" && card.id !== "overcharge") return 0;
  return card.cost;
}

export function getCardCost(combat, cardId) {
  const card = CARDS[cardId];
  return card ? effectiveCost(combat, card) : 0;
}

export function getValidTargets(combat, cardId) {
  const card = CARDS[cardId];
  if (!card || combat.status !== "playing") return [];
  if (card.target === "enemy") {
    return aliveEnemies(combat)
      .filter((enemy) => Math.abs(enemy.position - combat.player.position) <= card.range)
      .map((enemy) => enemy.id);
  }
  if (card.target === "tile") {
    const targets = [];
    for (let tile = 0; tile < BOARD_SIZE; tile += 1) {
      if (Math.abs(tile - combat.player.position) > card.range) continue;
      if (card.id === "sidestep" && !freePlayerTile(combat, tile)) continue;
      targets.push(tile);
    }
    return targets;
  }
  return [];
}

export function canPlay(combat, uid) {
  if (combat.status !== "playing") return { ok: false, reason: "The battle is over." };
  const instance = combat.hand.find((item) => item.uid === uid);
  if (!instance) return { ok: false, reason: "That card is not in your hand." };
  const card = CARDS[instance.cardId];
  const cost = effectiveCost(combat, card);
  if (combat.player[card.resource] < cost) {
    const resource = card.resource === "mana" ? "Mana" : "Stamina";
    return { ok: false, reason: `Not enough ${resource}.` };
  }
  if (card.id === "advance" && !freePlayerTile(combat, combat.player.position + 1)) {
    return { ok: false, reason: "The tile ahead is blocked." };
  }
  if (card.id === "retreat" && !freePlayerTile(combat, combat.player.position - 1)) {
    return { ok: false, reason: "There is nowhere to withdraw." };
  }
  if (card.target !== "none" && getValidTargets(combat, card.id).length === 0) {
    return { ok: false, reason: card.target === "enemy" ? "No enemy is in range." : "No valid tile is in range." };
  }
  return { ok: true, reason: "" };
}

function addLog(combat, text, tone = "neutral") {
  combat.log.push({ text, tone });
  if (combat.log.length > 12) combat.log.splice(0, combat.log.length - 12);
}

function dealEnemyDamageMutable(combat, enemy, amount, source) {
  const incoming = Math.max(0, Math.round(amount));
  const absorbed = Math.min(enemy.block || 0, incoming);
  enemy.block = Math.max(0, (enemy.block || 0) - absorbed);
  const dealt = incoming - absorbed;
  enemy.hp = Math.max(0, enemy.hp - dealt);
  combat.totals.damageDealt += dealt;
  addLog(combat, `${source} deals ${dealt} to ${enemy.name}.`, "damage");
  if (enemy.hp <= 0) addLog(combat, `${enemy.name} falls.`, "victory");
  return dealt;
}

function spellMultiplier(combat, card) {
  return combat.player.overcharged && card.resource === "mana" && card.id !== "overcharge" ? 1.5 : 1;
}

function consumeOverchargeMutable(combat, card) {
  if (combat.player.overcharged && card.resource === "mana" && card.id !== "overcharge") {
    combat.player.overcharged = false;
  }
}

function movePlayerMutable(combat, destination) {
  const oldPosition = combat.player.position;
  combat.player.position = destination;
  const distance = Math.abs(destination - oldPosition);
  combat.totals.tilesMoved += distance;
  addLog(combat, `Elowen moves ${distance} tile${distance === 1 ? "" : "s"}.`, "move");
}

export function playCard(combatState, uid, target = null, rng = Math.random) {
  const combat = copy(combatState);
  const allowed = canPlay(combat, uid);
  if (!allowed.ok) return { combat, events: [], error: allowed.reason };

  const handIndex = combat.hand.findIndex((item) => item.uid === uid);
  const instance = combat.hand[handIndex];
  const card = CARDS[instance.cardId];
  const validTargets = getValidTargets(combat, card.id);
  if (card.target === "enemy" && !validTargets.includes(target)) {
    return { combat, events: [], error: "Choose a highlighted enemy." };
  }
  if (card.target === "tile" && !validTargets.includes(Number(target))) {
    return { combat, events: [], error: "Choose a highlighted tile." };
  }

  const events = [{ type: "card", cardId: card.id }];
  const cost = effectiveCost(combat, card);
  combat.player[card.resource] -= cost;
  const multiplier = spellMultiplier(combat, card);
  combat.hand.splice(handIndex, 1);
  combat.discardPile.push(instance);
  combat.totals.cardsPlayed += 1;
  addLog(combat, `Elowen plays ${card.name}.`, "player");

  if (card.damage) {
    const enemy = combat.enemies.find((item) => item.id === target);
    const dealt = dealEnemyDamageMutable(combat, enemy, card.damage * multiplier, card.name);
    events.push({ type: "hit", targetId: enemy.id, amount: dealt, element: card.family });
    if (card.splash) {
      for (const adjacent of aliveEnemies(combat)) {
        if (adjacent.id === enemy.id || Math.abs(adjacent.position - enemy.position) !== 1) continue;
        const splash = dealEnemyDamageMutable(combat, adjacent, card.splash * multiplier, `${card.name} splash`);
        events.push({ type: "hit", targetId: adjacent.id, amount: splash, element: card.family });
      }
    }
    if (card.burn && enemy.hp > 0) {
      enemy.burn = { ...card.burn };
      addLog(combat, `${enemy.name} is Branded.`, "fire");
      events.push({ type: "status", targetId: enemy.id, status: "burn" });
    }
  }

  if (card.damageAll) {
    for (const enemy of aliveEnemies(combat)) {
      const dealt = dealEnemyDamageMutable(combat, enemy, card.damageAll * multiplier, card.name);
      events.push({ type: "hit", targetId: enemy.id, amount: dealt, element: card.family });
    }
  }

  if (card.block) {
    combat.player.block += card.block;
    addLog(combat, `Elowen gains ${card.block} Block.`, "block");
    events.push({ type: "block", amount: card.block });
  }

  if (card.mana) {
    combat.player.mana = Math.min(combat.player.maxMana, combat.player.mana + card.mana);
    addLog(combat, `Elowen gathers ${card.mana} Mana.`, "mana");
    events.push({ type: "mana", amount: card.mana });
  }

  if (card.draw) {
    drawCardsMutable(combat, card.draw, rng);
    events.push({ type: "draw", amount: card.draw });
  }

  if (card.id === "advance" || card.id === "retreat") {
    const destination = combat.player.position + card.move;
    movePlayerMutable(combat, destination);
    events.push({ type: "move", target: destination });
  }

  if (card.id === "sidestep") {
    const destination = Number(target);
    movePlayerMutable(combat, destination);
    events.push({ type: "move", target: destination });
  }

  if (card.id === "flameWall") {
    const center = Number(target);
    const tiles = [center - 1, center, center + 1].filter((tile) => tile >= 0 && tile < BOARD_SIZE);
    combat.hazards = combat.hazards.filter((hazard) => !tiles.includes(hazard.tile));
    combat.hazards.push(...tiles.map((tile) => ({ tile, turns: 1, damage: 6 })));
    for (const enemy of aliveEnemies(combat).filter((item) => tiles.includes(item.position))) {
      const dealt = dealEnemyDamageMutable(combat, enemy, 6 * multiplier, card.name);
      enemy.burn = { damage: 2, turns: 2 };
      events.push({ type: "hit", targetId: enemy.id, amount: dealt, element: "fire" });
    }
    addLog(combat, `Flame rises across tiles ${tiles.map((tile) => tile + 1).join(", ")}.`, "fire");
    events.push({ type: "hazard", tiles });
  }

  if (card.overcharge) {
    combat.player.overcharged = true;
    addLog(combat, "The next spell is Overcharged.", "mana");
    events.push({ type: "overcharge" });
  } else {
    consumeOverchargeMutable(combat, card);
  }

  if (!aliveEnemies(combat).length) {
    combat.status = "victory";
    addLog(combat, "The lane is yours.", "victory");
    events.push({ type: "victory" });
  }
  return { combat, events, error: null };
}

function intent(kind, name, options = {}) {
  return { kind, name, tiles: [], damage: 0, move: 0, ...options };
}

function attackAtPlayer(name, damage, playerPosition, spread = 0) {
  const tiles = [];
  for (let offset = -spread; offset <= spread; offset += 1) {
    const tile = playerPosition + offset;
    if (tile >= 0 && tile < BOARD_SIZE) tiles.push(tile);
  }
  return intent("attack", name, { damage, tiles });
}

function buildIntent(enemy, combat) {
  const distance = Math.abs(enemy.position - combat.player.position);
  const target = combat.player.position;
  switch (enemy.type) {
    case "ashRaider":
      return distance <= 1
        ? attackAtPlayer("Hook Slash", 6, target)
        : intent("move", "Close In", { move: 1 });
    case "cinderHound":
      return distance <= 2
        ? attackAtPlayer("Ash Pounce", 5, target, 1)
        : intent("move", "Bound", { move: 2 });
    case "keepGuard":
      return distance <= 1
        ? attackAtPlayer("Shield Crush", 8, target)
        : intent("move", "Iron March", { move: 1 });
    case "emberSeer":
      return combat.turn % 3 === 0
        ? attackAtPlayer("Flame Rift", 7, target, 1)
        : attackAtPlayer("Cinder Hex", 5, target);
    case "emberling":
      return combat.turn % 2 === 0
        ? intent("guard", "Feed the Crown", { block: 5, ally: "fallenWarden" })
        : attackAtPlayer("Spark Shot", 4, target);
    case "fallenWarden": {
      const phase = combat.turn % 3;
      if (phase === 1) return attackAtPlayer("Falling Ember", 9, target);
      if (phase === 2) return attackAtPlayer("Crown Sweep", 7, target, 1);
      const parity = target % 2;
      const tiles = Array.from({ length: BOARD_SIZE }, (_, index) => index).filter((tile) => tile % 2 === parity);
      return intent("attack", "Emberfall", { damage: 10, tiles });
    }
    default:
      return intent("wait", "Watching");
  }
}

function planEnemyIntentsMutable(combat) {
  for (const enemy of aliveEnemies(combat)) {
    enemy.intent = buildIntent(enemy, combat);
  }
}

function moveEnemyMutable(combat, enemy, spaces) {
  const direction = combat.player.position < enemy.position ? -1 : 1;
  let moved = 0;
  for (let step = 0; step < spaces; step += 1) {
    const candidate = enemy.position + direction;
    const blocked = candidate === combat.player.position
      || candidate < 0
      || candidate >= BOARD_SIZE
      || aliveEnemies(combat).some((item) => item.id !== enemy.id && item.position === candidate);
    if (blocked) break;
    enemy.position = candidate;
    moved += 1;
  }
  addLog(combat, moved ? `${enemy.name} moves ${moved} tile${moved === 1 ? "" : "s"}.` : `${enemy.name} holds position.`, "enemy");
  return moved;
}

function damagePlayerMutable(combat, amount, source) {
  const absorbed = Math.min(combat.player.block, amount);
  combat.player.block -= absorbed;
  const dealt = amount - absorbed;
  combat.player.hp = Math.max(0, combat.player.hp - dealt);
  if (absorbed) addLog(combat, `Block absorbs ${absorbed} from ${source}.`, "block");
  if (dealt) addLog(combat, `${source} deals ${dealt} to Elowen.`, "enemy");
  return { dealt, absorbed };
}

function triggerHazardMutable(combat, enemy, events) {
  const hazard = combat.hazards.find((item) => item.tile === enemy.position);
  if (!hazard || enemy.hp <= 0) return;
  const dealt = dealEnemyDamageMutable(combat, enemy, hazard.damage, "Flame Wall");
  enemy.burn = { damage: 2, turns: 2 };
  events.push({ type: "hit", targetId: enemy.id, amount: dealt, element: "fire" });
}

export function endTurn(combatState, rng = Math.random) {
  const combat = copy(combatState);
  if (combat.status !== "playing") return { combat, events: [], error: "The battle is over." };
  const events = [{ type: "enemy-phase" }];
  combat.discardPile.push(...combat.hand);
  combat.hand = [];

  const actingEnemies = aliveEnemies(combat).sort((a, b) => a.position - b.position);
  for (const enemy of actingEnemies) {
    if (enemy.hp <= 0) continue;
    const currentIntent = enemy.intent || buildIntent(enemy, combat);
    if (currentIntent.kind === "attack") {
      if (currentIntent.tiles.includes(combat.player.position)) {
        const result = damagePlayerMutable(combat, currentIntent.damage, `${enemy.name}'s ${currentIntent.name}`);
        events.push({ type: "player-hit", sourceId: enemy.id, amount: result.dealt, absorbed: result.absorbed });
      } else {
        addLog(combat, `${enemy.name}'s ${currentIntent.name} misses.`, "miss");
        events.push({ type: "miss", sourceId: enemy.id });
      }
    } else if (currentIntent.kind === "move") {
      const moved = moveEnemyMutable(combat, enemy, currentIntent.move);
      events.push({ type: "enemy-move", sourceId: enemy.id, amount: moved });
      triggerHazardMutable(combat, enemy, events);
    } else if (currentIntent.kind === "guard") {
      const ally = aliveEnemies(combat).find((item) => item.type === currentIntent.ally) || enemy;
      ally.block += currentIntent.block;
      addLog(combat, `${enemy.name} grants ${currentIntent.block} Block to ${ally.name}.`, "block");
      events.push({ type: "enemy-block", sourceId: enemy.id, targetId: ally.id, amount: currentIntent.block });
    }
    if (combat.player.hp <= 0) break;
  }

  for (const enemy of aliveEnemies(combat)) {
    if (!enemy.burn) continue;
    const dealt = dealEnemyDamageMutable(combat, enemy, enemy.burn.damage, "Burn");
    events.push({ type: "hit", targetId: enemy.id, amount: dealt, element: "fire" });
    enemy.burn.turns -= 1;
    if (enemy.burn.turns <= 0) enemy.burn = null;
  }

  combat.hazards = combat.hazards
    .map((hazard) => ({ ...hazard, turns: hazard.turns - 1 }))
    .filter((hazard) => hazard.turns > 0);

  if (combat.player.hp <= 0) {
    combat.status = "defeat";
    addLog(combat, "Elowen falls—but the ember has not gone out.", "defeat");
    events.push({ type: "defeat" });
    return { combat, events, error: null };
  }

  if (!aliveEnemies(combat).length) {
    combat.status = "victory";
    addLog(combat, "The lane is yours.", "victory");
    events.push({ type: "victory" });
    return { combat, events, error: null };
  }

  combat.turn += 1;
  combat.player.block = 0;
  combat.player.stamina = combat.player.maxStamina;
  combat.player.mana = Math.min(combat.player.maxMana, combat.player.mana + 1);
  drawCardsMutable(combat, HAND_SIZE, rng);
  planEnemyIntentsMutable(combat);
  addLog(combat, `Turn ${combat.turn}. Read the lane.`, "system");
  events.push({ type: "new-turn", turn: combat.turn });
  return { combat, events, error: null };
}

export function encounterAvailable(campaign, encounterId) {
  if (campaign.completed.includes(encounterId)) return false;
  if (encounterId === "ashen-road") return true;
  if (encounterId === "scorched-keep") return campaign.flags.cinderwatchVisited;
  if (encounterId === "emberfall") return campaign.flags.staffUpgraded;
  return false;
}

export function applyVictory(campaignState, encounterId, combat) {
  const campaign = copy(campaignState);
  if (!campaign.completed.includes(encounterId)) campaign.completed.push(encounterId);
  campaign.player.hp = Math.max(1, combat.player.hp);
  campaign.stats.battlesWon += 1;
  campaign.stats.cardsPlayed += combat.totals.cardsPlayed;
  campaign.stats.damageDealt += combat.totals.damageDealt;
  campaign.stats.tilesMoved += combat.totals.tilesMoved;

  if (encounterId === "ashen-road") {
    campaign.currentNode = "cinderwatch";
    campaign.day = 2;
    campaign.player.xp += 80;
    campaign.player.gold += 18;
    campaign.player.unspentStats += 3;
    campaign.player.hp = campaign.player.maxHp;
  } else if (encounterId === "scorched-keep") {
    campaign.currentNode = "emberforge";
    campaign.day = 3;
    campaign.player.xp += 140;
    campaign.player.gold += 26;
    campaign.inventory.emberShard += 1;
    campaign.flags.staffAttuned = true;
    campaign.player.hp = Math.min(campaign.player.maxHp, campaign.player.hp + 14);
  } else if (encounterId === "emberfall") {
    campaign.currentNode = "ending";
    campaign.day = 4;
    campaign.player.xp += 300;
    campaign.player.gold += 60;
    campaign.finished = true;
    campaign.player.hp = Math.max(1, campaign.player.hp);
  }
  return campaign;
}

export function visitCinderwatch(campaignState) {
  const campaign = copy(campaignState);
  if (!campaign.flags.cinderwatchVisited) {
    campaign.flags.cinderwatchVisited = true;
    campaign.player.equipment = { weapon: "Fire Staff", staffTier: 1 };
  }
  campaign.currentNode = "scorched-keep";
  campaign.player.hp = campaign.player.maxHp;
  return campaign;
}

export function upgradeFireStaff(campaignState) {
  const campaign = copy(campaignState);
  if (!campaign.flags.staffAttuned || campaign.inventory.emberShard < 1) return campaign;
  campaign.inventory.emberShard -= 1;
  campaign.flags.staffUpgraded = true;
  campaign.player.equipment.staffTier = 2;
  campaign.currentNode = "emberfall";
  return campaign;
}

export function retryEncounter(campaignState) {
  const campaign = copy(campaignState);
  campaign.player.hp = campaign.player.maxHp;
  return campaign;
}

export function nextUnlocks(campaign) {
  return STAT_UNLOCKS
    .filter((unlock) => (campaign.player.stats[unlock.stat] || 0) < unlock.threshold)
    .sort((a, b) => (a.threshold - campaign.player.stats[a.stat]) - (b.threshold - campaign.player.stats[b.stat]));
}
