import {
  BOARD_SIZE, CARD_ORDER, CARDS, ENCOUNTERS, LOADOUT_SIZE, STAT_LABELS,
  activeCount, adjustLoadout, applyVictory, canAdjustLoadout, canPlay,
  characterLevel, createCampaign, encounterAvailable, endTurn, getCardCost,
  getLibrary, getUnlockState, getValidTargets, nextUnlocks, playCard,
  retryEncounter, spendStatPoint, startCombat, upgradeFireStaff, visitCinderwatch,
} from "./engine.js";
import { enemySvg, flameSigil, icon, mageSvg, mapIcon, storyIllustration } from "./art.js";
import { SoundEngine } from "./audio.js";

const STORAGE_KEY = "emberfall-campaign-v1";
const root = document.querySelector("#gameRoot");
const topStatus = document.querySelector("#topStatus");
const modalLayer = document.querySelector("#modalLayer");
const toastRegion = document.querySelector("#toastRegion");
const announcer = document.querySelector("#announcer");
const soundButton = document.querySelector("#soundButton");
const rulesButton = document.querySelector("#rulesButton");
const emberField = document.querySelector("#ambientEmbers");

let campaign = loadCampaign();
let screen = "title";
let combat = null;
let pendingEncounter = null;
let selectedCardUid = null;
let combatLogOpen = false;
let currentModal = null;
let modalReturnFocus = null;
const timers = new Set();
const sound = new SoundEngine();

function loadCampaign() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return value?.version === 1 ? value : null;
  } catch {
    return null;
  }
}

function saveCampaign() {
  if (campaign) localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
}

function later(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function clearTimers() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function announce(message) {
  announcer.textContent = "";
  requestAnimationFrame(() => { announcer.textContent = message; });
}

function toast(message, tone = "default", mark = "✦") {
  const element = document.createElement("div");
  element.className = `toast toast--${tone}`;
  element.innerHTML = `<i aria-hidden="true">${mark}</i><span>${escapeHtml(message)}</span>`;
  toastRegion.append(element);
  later(() => element.remove(), 3150);
  announce(message);
}

function updateSoundButton() {
  document.body.classList.toggle("sound-enabled", sound.enabled);
  soundButton.setAttribute("aria-label", sound.enabled ? "Turn sound off" : "Turn sound on");
  soundButton.title = sound.enabled ? "Sound on" : "Sound off";
}

function addAmbientEmbers() {
  emberField.innerHTML = Array.from({ length: 16 }, (_, index) => {
    const left = (index * 17 + 7) % 101;
    return `<i class="ambient-ember" style="--left:${left}%;--duration:${8 + (index % 6) * 1.9}s;--delay:${-(index * 1.37)}s;--drift:${-35 + (index % 8) * 10}px"></i>`;
  }).join("");
}

function renderTopStatus() {
  if (!campaign || screen === "title") return void (topStatus.innerHTML = "");
  if (screen === "combat" && combat) {
    topStatus.innerHTML = `<span class="top-chip"><i></i>${escapeHtml(ENCOUNTERS[combat.encounterId].region)}</span>`;
    return;
  }
  topStatus.innerHTML = `<span class="top-chip"><i></i>Day ${campaign.day}</span><span class="top-chip">Level ${characterLevel(campaign)}</span><span class="top-chip">${campaign.player.gold} coin</span>`;
}

function setScreen(nextScreen) {
  clearTimers();
  screen = nextScreen;
  selectedCardUid = null;
  render();
  root.focus({ preventScroll: true });
}

function render() {
  renderTopStatus();
  if (screen === "map") renderMap();
  else if (screen === "briefing") renderBriefing();
  else if (screen === "town") renderTown();
  else if (screen === "forge") renderForge();
  else if (screen === "combat") renderCombat();
  else if (screen === "ending") renderEnding();
  else renderTitle();
}

function renderTitle() {
  root.innerHTML = `<section class="title-view view-enter">
    <svg class="title-contours" viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#e7dcc1" stroke-width="1"><path d="M-20 125c150-92 262-63 356 8s206 87 315 27 205-67 336-8 211 30 263-9"/><path d="M-10 169c124-82 247-74 347 2s218 79 318 27 206-52 320-2 214 41 256 4"/><path d="M-31 231c154-79 263-61 351 6s210 74 324 24 205-52 340-4 215 32 260-5"/><path d="M-18 515c183-88 281-65 374 3s192 72 315 24 204-42 314 3 208 52 270 5"/></g></svg>
    <svg class="title-landscape" viewBox="0 0 1440 650" preserveAspectRatio="none" aria-hidden="true"><path d="M0 563 122 436l82 47 104-163 94 83 134-225 91 138 90-102 114 178 96-67 104 139 109-113 122 212v87H0Z" fill="#1d211b"/><path d="M0 589 164 510l105 49 142-88 120 77 166-135 117 86 148-93 160 105 117-58 121 101v96H0Z" fill="#131611"/><path d="M719 135c4 22 28 30 27 56-1 18-12 29-28 38 7-14-2-22-10-30-7-8-9-18 13-34-2 12 10 19 13 30 9-22-17-31-15-60Z" fill="#ed6734" opacity=".65"/></svg>
    <div class="title-cards" aria-hidden="true"><div class="teaser-card"><div class="teaser-card__art">${icon("fireball")}</div><strong>Fireball</strong></div><div class="teaser-card"><div class="teaser-card__art">${icon("shield")}</div><strong>Brace</strong></div></div>
    <div class="title-copy"><span class="gift-note"><i></i>For Sandy Lions — the first ember</span>${flameSigil("title-sigil")}<h1 class="title-wordmark">Emberfall</h1><p class="title-subtitle">A tactical card–RPG</p><p class="title-pitch">Your build is your history. Read the enemy, shape the lane, and carry the fire into a world that remembers.</p>
      <div class="title-actions">${campaign ? `<button class="primary-action" type="button" data-action="continue">Continue journey</button><button class="secondary-action" type="button" data-action="new-journey">Begin again</button>` : `<button class="primary-action" type="button" data-action="new-journey">Enter the Greybank March</button>`}</div>
      <p class="title-meta"><span>Solo Mage vertical slice</span><span>Three battles</span><span>Saves on this device</span></p>
    </div></section>`;
}

const MAP_NODES = [
  { id: "greybank", name: "Greybank", type: "Camp", icon: "camp" },
  { id: "ashen-road", name: "Ashen Road", type: "Encounter I", icon: "swords" },
  { id: "cinderwatch", name: "Cinderwatch", type: "Settlement", icon: "town" },
  { id: "scorched-keep", name: "Scorched Keep", type: "Dungeon", icon: "keep" },
  { id: "emberforge", name: "Ember Forge", type: "Discovery", icon: "forge" },
  { id: "emberfall", name: "Ember Crown", type: "Boss", icon: "crown" },
];

function nodeState(nodeId) {
  if (nodeId === "greybank") return { unlocked: true, complete: true };
  if (nodeId === "ashen-road") return { unlocked: true, complete: campaign.completed.includes(nodeId) };
  if (nodeId === "cinderwatch") return { unlocked: campaign.completed.includes("ashen-road"), complete: campaign.flags.cinderwatchVisited };
  if (nodeId === "scorched-keep") return { unlocked: campaign.flags.cinderwatchVisited, complete: campaign.completed.includes(nodeId) };
  if (nodeId === "emberforge") return { unlocked: campaign.completed.includes("scorched-keep"), complete: campaign.flags.staffUpgraded };
  if (nodeId === "emberfall") return { unlocked: campaign.flags.staffUpgraded, complete: campaign.completed.includes(nodeId) };
  return { unlocked: false, complete: false };
}

function renderMapNode(node) {
  const state = nodeState(node.id);
  const current = campaign.currentNode === node.id;
  const status = !state.unlocked ? "Unknown" : state.complete ? "Complete" : current ? "Current" : "Available";
  return `<button class="map-node ${current ? "is-current" : ""} ${state.complete ? "is-complete" : ""}" type="button" data-action="map-node" data-node="${node.id}" ${state.unlocked ? "" : "disabled"} aria-label="${node.name}, ${status}"><span class="map-node__art">${mapIcon(node.icon)}${state.complete ? `<i class="map-node__stamp">✓</i>` : ""}</span><span class="map-node__copy"><small>${node.type}</small><strong>${node.name}</strong><em>${status}</em></span></button>`;
}

function journeyStep(id, title, description) {
  const state = nodeState(id);
  const current = campaign.currentNode === id;
  return `<li class="journey-item ${state.complete ? "is-complete" : ""} ${current ? "is-current" : ""}"><span class="journey-item__mark">${state.complete ? "✓" : current ? "•" : ""}</span><span><strong>${title}</strong><p>${description}</p></span></li>`;
}

function renderMap() {
  const player = campaign.player;
  const next = nextUnlocks(campaign)[0];
  const nextCard = next ? CARDS[next.cardId] : null;
  const libraryCount = Object.values(getLibrary(campaign)).reduce((sum, count) => sum + count, 0);
  root.innerHTML = `<section class="map-view view-enter">
    <aside class="campaign-rail" aria-label="Character sheet"><div class="rail-heading"><div><p class="eyebrow">Company / I</p><h2>Character</h2></div></div><article class="portrait-card"><div class="portrait-art">${mageSvg()}</div><div class="portrait-copy"><span><small>${escapeHtml(player.title)}</small><strong>${escapeHtml(player.name)}</strong></span><b class="level-token">L${characterLevel(campaign)}</b></div></article><div class="vital-block"><div class="vital-label"><span>Health</span><strong>${player.hp} / ${player.maxHp}</strong></div><div class="bar-track"><i style="width:${player.hp / player.maxHp * 100}%"></i></div></div><div class="resource-row"><div class="resource-tile"><small>Coin</small><strong>${player.gold}</strong></div><div class="resource-tile"><small>INT</small><strong>${player.stats.int}</strong></div><div class="resource-tile"><small>Cards</small><strong>${libraryCount}</strong></div></div><div class="rail-buttons"><button class="secondary-action" type="button" data-action="open-loadout">Active loadout · ${player.activeDeck.length}/${LOADOUT_SIZE}</button><button class="quiet-action" type="button" data-action="open-stats">Character stats${player.unspentStats ? ` · ${player.unspentStats} points` : ""}</button></div></aside>
    <section class="map-board" aria-label="Greybank March overworld map"><div class="map-board__top"><div><p class="eyebrow">Region I / The borderlands</p><h1>Greybank March</h1></div><span class="day-marker">Day ${campaign.day} · Dusk</span></div><svg class="world-map-svg" viewBox="0 0 900 650" preserveAspectRatio="none" aria-hidden="true"><path class="ridge" d="M-20 563 84 481l77 37 101-134 83 75 102-197 97 157 66-80 121 160 82-64 96 127v88H-20Z"/><path class="river" d="M-10 188c128 18 145 95 260 93s167-92 271-63 102 116 213 123 141-55 190-35"/><path class="road" d="M77 489c115-75 166-188 303-115s167-79 286-27 99 127 176 169"/><g class="contour"><path d="M-20 99c128-64 235-42 315 13s189 69 282 20 184-51 283-3"/><path d="M-20 135c118-60 225-44 307 10s195 65 289 21 188-48 294-2"/><path d="M-10 550c131-58 225-43 302 9s187 57 291 18 189-38 296 5"/></g></svg><div class="map-nodes">${MAP_NODES.map(renderMapNode).join("")}</div></section>
    <aside class="journey-rail" aria-label="Journey progress"><div class="rail-heading"><div><p class="eyebrow">Contract / Main</p><h2>Old fire, waking</h2></div></div><ol class="journey-list">${journeyStep("ashen-road", "Clear the Ashen Road", "Reach Cinderwatch before the courier's warning cools.")}${journeyStep("cinderwatch", "Take up the Fire Staff", "Choose your growth and accept the enchanter's weapon.")}${journeyStep("scorched-keep", "Attune at Scorched Keep", "Survive one full battle with the staff equipped.")}${journeyStep("emberforge", "Wake the second tier", "Use the Ember Shard to discover Flame Wall.")}${journeyStep("emberfall", "Face the Ember Crown", "Seal the old flame beneath the mountain.")}</ol>${nextCard ? `<article class="next-unlock-card"><small>Nearest stat unlock</small><strong>${nextCard.name}</strong><p class="muted">${STAT_LABELS[next.stat]} ${player.stats[next.stat]}/${next.threshold}</p><div class="unlock-progress"><i style="width:${Math.min(100, player.stats[next.stat] / next.threshold * 100)}%"></i></div></article>` : ""}</aside>
  </section>`;
}

function encounterQuote(id) {
  if (id === "ashen-road") return "The raiders have already chosen where to strike. Move before steel lands.";
  if (id === "scorched-keep") return "The staff remembers this place. Let it watch one battle through your hands.";
  return "The crown does not chase. It marks the ground, then makes the mountain answer.";
}

function renderBriefing() {
  const encounter = ENCOUNTERS[pendingEncounter];
  if (!encounter) return setScreen("map");
  const ready = campaign.player.activeDeck.length === LOADOUT_SIZE;
  root.innerHTML = `<section class="story-view view-enter"><article class="story-panel"><div class="story-panel__grid"><div class="story-illustration">${storyIllustration(encounter.id)}</div><div class="story-copy"><p class="eyebrow">${encounter.eyebrow} / ${encounter.region}</p><h1>${encounter.name}</h1><p>${encounter.description}</p><blockquote class="story-quote">${encounterQuote(encounter.id)}</blockquote><div class="story-reward-list"><div class="story-reward"><small>Opposition</small><strong>${encounter.enemies.length} enemies</strong></div><div class="story-reward"><small>Loadout</small><strong>${campaign.player.activeDeck.length}/${LOADOUT_SIZE} cards</strong></div><div class="story-reward"><small>Health</small><strong>${campaign.player.hp}/${campaign.player.maxHp}</strong></div></div><div class="story-actions"><button class="primary-action" type="button" data-action="start-encounter" ${ready ? "" : "disabled"}>${pendingEncounter === "emberfall" ? "Face the Warden" : "Enter combat"}</button><button class="secondary-action" type="button" data-action="open-loadout">Edit loadout</button><button class="quiet-action" type="button" data-action="back-map">Return to map</button></div>${ready ? "" : `<p class="story-quote">Your active loadout must contain exactly ${LOADOUT_SIZE} cards.</p>`}</div></div></article></section>`;
}

function renderTown() {
  const visited = campaign.flags.cinderwatchVisited;
  root.innerHTML = `<section class="story-view view-enter"><article class="story-panel"><div class="story-panel__grid"><div class="story-illustration">${storyIllustration("cinderwatch")}</div><div class="story-copy"><p class="eyebrow">Settlement / Cinderwatch</p><h1>The enchanter's bargain</h1><p>Maelin sets an ashwood staff across the table. Its iron veins are cold—for now. Carry it through the Keep and the weapon will surrender the cards buried in its history.</p><blockquote class="story-quote">“A weapon is a teacher, Elowen. Survive its lesson once and you will remember it forever.”</blockquote><div class="story-reward-list"><div class="story-reward"><small>Equipment</small><strong>Fire Staff · T1</strong></div><div class="story-reward"><small>Attunement</small><strong>One full combat</strong></div><div class="story-reward"><small>Unspent</small><strong>${campaign.player.unspentStats} stat points</strong></div></div><div class="story-actions">${visited ? `<button class="primary-action" type="button" data-action="back-map">Return to the road</button>` : `<button class="primary-action" type="button" data-action="claim-staff">Take the staff</button>`}<button class="secondary-action" type="button" data-action="open-stats">Invest stat points</button><button class="quiet-action" type="button" data-action="back-map">Not yet</button></div></div></div></article></section>`;
}

function renderForge() {
  const canUpgrade = campaign.flags.staffAttuned && campaign.inventory.emberShard > 0 && !campaign.flags.staffUpgraded;
  root.innerHTML = `<section class="story-view view-enter"><article class="story-panel"><div class="story-panel__grid"><div class="story-illustration">${storyIllustration("emberforge")}</div><div class="story-copy"><p class="eyebrow">Discovery / Ember Forge</p><h1>The staff remembers</h1><p>Heat travels through the ashwood in branching lines. Fireball and Brand settle into your memory—not loot granted by chance, but techniques earned by carrying the weapon into danger.</p><blockquote class="story-quote">The Ember Shard fits the staff's empty socket. A second pattern waits beneath the first.</blockquote><div class="story-reward-list"><div class="story-reward"><small>Discovered</small><strong>Fireball</strong></div><div class="story-reward"><small>Discovered</small><strong>Brand</strong></div><div class="story-reward"><small>T2 unlock</small><strong>Flame Wall</strong></div></div><div class="story-actions"><button class="primary-action" type="button" data-action="upgrade-staff" ${canUpgrade ? "" : "disabled"}>Socket the Ember Shard</button><button class="secondary-action" type="button" data-action="open-loadout">Curate loadout</button><button class="quiet-action" type="button" data-action="back-map">Return to map</button></div></div></div></article></section>`;
}

function cardMarkup(instance, index) {
  const card = CARDS[instance.cardId];
  const playable = canPlay(combat, instance.uid);
  const cost = getCardCost(combat, card.id);
  const selected = selectedCardUid === instance.uid;
  const free = combat.player.overcharged && card.resource === "mana" && card.id !== "overcharge";
  return `<button class="game-card ${selected ? "is-selected" : ""} ${free ? "is-overcharge-free" : ""}" type="button" data-action="play-card" data-uid="${instance.uid}" data-card-id="${card.id}" data-resource="${card.resource}" data-family="${card.family}" style="--order:${index}" ${playable.ok ? "" : "disabled"} title="${escapeHtml(playable.ok ? card.description : playable.reason)}"><span class="card-cost" aria-label="${cost} ${card.resource}">${cost}</span><span class="card-art">${icon(card.icon)}</span><strong class="card-title">${card.shortName || card.name}</strong><span class="card-description">${card.description}</span><small class="card-source">${card.source}</small></button>`;
}

function unitMarkup(enemy = null) {
  if (!enemy) {
    return `<div class="unit unit--player" id="playerUnit" aria-label="Elowen, ${combat.player.hp} health, ${combat.player.block} block"><span class="unit__health"><i></i>${combat.player.hp}${combat.player.block ? ` +${combat.player.block}` : ""}</span>${mageSvg()}${combat.player.overcharged ? `<span class="unit__status" title="Overcharged">✦</span>` : ""}<span class="unit-nameplate">Elowen</span></div>`;
  }
  const instance = selectedCardUid ? combat.hand.find((item) => item.uid === selectedCardUid) : null;
  const card = instance ? CARDS[instance.cardId] : null;
  const valid = card?.target === "enemy" && getValidTargets(combat, card.id).includes(enemy.id);
  const burn = enemy.burn ? `<span class="unit__status" title="Burn: ${enemy.burn.damage} for ${enemy.burn.turns} turns">${enemy.burn.turns}</span>` : "";
  return `<button class="unit unit--enemy ${valid ? "is-valid-target" : ""}" type="button" data-action="target-enemy" data-enemy-id="${enemy.id}" ${valid ? "" : `tabindex="-1"`} aria-label="${enemy.name}, ${enemy.hp} health${enemy.block ? `, ${enemy.block} block` : ""}"><span class="unit__health"><i></i>${enemy.hp}${enemy.block ? ` +${enemy.block}` : ""}</span>${enemySvg(enemy.type)}${burn}<span class="unit-nameplate">${enemy.name}</span></button>`;
}

function intentMarkup(enemy, index) {
  const current = enemy.intent;
  const summary = current.kind === "attack" ? `${current.damage} damage · ${current.tiles.length} tile${current.tiles.length === 1 ? "" : "s"}` : current.kind === "move" ? `Move ${current.move}` : current.kind === "guard" ? `${current.block} Block` : "Wait";
  const symbol = current.kind === "attack" ? current.damage : current.kind === "move" ? "→" : current.kind === "guard" ? "◆" : "·";
  return `<div class="intent-card" data-kind="${current.kind}" style="--tilt:${index % 2 ? 1 : -1}deg" title="${enemy.name}: ${current.name}, ${summary}"><i class="intent-card__icon">${symbol}</i><span><strong>${current.name}</strong><small>${enemy.name} · ${summary}</small></span></div>`;
}

function targetInstruction() {
  if (!selectedCardUid) return "";
  const instance = combat.hand.find((item) => item.uid === selectedCardUid);
  if (!instance) return "";
  const card = CARDS[instance.cardId];
  return `<div class="target-instruction">Choose ${card.target === "enemy" ? "a highlighted enemy" : "a highlighted tile"} for ${card.name}<button type="button" data-action="cancel-target">Cancel</button></div>`;
}

function renderCombatResult() {
  if (combat.status === "playing") return "";
  const victory = combat.status === "victory";
  return `<div class="result-overlay"><article class="result-card"><div class="result-rune">${victory ? "✦" : "×"}</div><p class="eyebrow">${victory ? "Encounter complete" : "The ember gutters"}</p><h2>${victory ? "The lane is yours" : "Elowen falls"}</h2><p>${victory ? "Every card played came from a choice already made. Carry what you learned back into the March." : "This prototype keeps the last checkpoint. Read the intent, move first, and try the puzzle again."}</p><div class="result-stats"><div><small>Turns</small><strong>${combat.turn}</strong></div><div><small>Cards</small><strong>${combat.totals.cardsPlayed}</strong></div><div><small>Damage</small><strong>${combat.totals.damageDealt}</strong></div></div>${victory ? `<button class="primary-action" type="button" data-action="accept-victory">Continue journey</button>` : `<div class="story-actions"><button class="primary-action" type="button" data-action="retry-combat">Try again</button><button class="quiet-action" type="button" data-action="leave-combat">Return to map</button></div>`}</article></div>`;
}

function renderCombat() {
  if (!combat) return setScreen("map");
  const encounter = ENCOUNTERS[combat.encounterId];
  const alive = combat.enemies.filter((enemy) => enemy.hp > 0);
  const threatened = new Set(alive.filter((enemy) => enemy.intent?.kind === "attack").flatMap((enemy) => enemy.intent.tiles));
  const selectedInstance = selectedCardUid ? combat.hand.find((item) => item.uid === selectedCardUid) : null;
  const selectedCard = selectedInstance ? CARDS[selectedInstance.cardId] : null;
  const validTileTargets = selectedCard?.target === "tile" ? new Set(getValidTargets(combat, selectedCard.id)) : new Set();
  const tiles = Array.from({ length: BOARD_SIZE }, (_, tile) => {
    const enemy = alive.find((item) => item.position === tile);
    const valid = validTileTargets.has(tile);
    const classes = [threatened.has(tile) ? "is-threatened" : "", combat.hazards.some((item) => item.tile === tile) ? "is-flame" : "", valid ? "is-valid-target" : ""].join(" ");
    return `<div class="lane-tile ${classes}" data-number="${tile + 1}" ${valid ? `role="button" tabindex="0" data-action="target-tile" data-tile="${tile}" aria-label="Target tile ${tile + 1}"` : ""}>${combat.player.position === tile ? unitMarkup() : ""}${enemy ? unitMarkup(enemy) : ""}</div>`;
  }).join("");
  root.innerHTML = `<section class="combat-view view-enter"><div class="combat-head"><div class="combat-title"><p class="eyebrow">${encounter.eyebrow} / ${encounter.region}</p><h1>${encounter.name}</h1></div><span class="turn-seal">Turn ${combat.turn} · Your move</span><div class="combat-resources"><div class="combat-resource"><i>S</i><small>Stamina</small><strong>${combat.player.stamina}/${combat.player.maxStamina}</strong></div><div class="combat-resource combat-resource--mana"><i>M</i><small>Mana</small><strong>${combat.player.mana}/${combat.player.maxMana}</strong></div></div></div>
    <div class="battlefield-wrap"><div class="enemy-intents">${alive.map(intentMarkup).join("")}</div><div class="lane-shell"><div class="lane">${tiles}</div>${targetInstruction()}</div></div>
    <div class="combat-footer"><div class="draw-pile" aria-label="${combat.drawPile.length} cards in draw pile"><div class="pile-card"><span>${combat.drawPile.length}</span></div><small class="pile-label">Draw pile</small></div><div class="hand-area"><div class="hand-label">Your hand</div><div class="card-hand">${combat.hand.map(cardMarkup).join("")}</div></div><button class="end-turn-button" type="button" data-action="end-turn" ${combat.status === "playing" ? "" : "disabled"}>End<br>turn</button></div>
    <button class="icon-button combat-log-toggle" type="button" data-action="toggle-log" aria-expanded="${combatLogOpen}" aria-label="${combatLogOpen ? "Close" : "Open"} combat log">${icon("focus")}</button><div class="combat-log" ${combatLogOpen ? "" : "hidden"}>${[...combat.log].reverse().map((entry) => `<p data-tone="${entry.tone}">${escapeHtml(entry.text)}</p>`).join("")}</div>${renderCombatResult()}</section>`;
}

function renderEnding() {
  root.innerHTML = `<section class="ending-view view-enter"><div class="ending-copy">${flameSigil("ending-sigil")}<p class="ending-kicker">Vertical slice complete</p><h1>The first ember holds.</h1><p class="ending-message">Sandy—this little world was built as a playable thank-you for the idea. Your cards, your character, and the choices between them deserve to become something much larger.</p><div class="ending-stats"><div><small>Battles won</small><strong>${campaign.stats.battlesWon}</strong></div><div><small>Cards played</small><strong>${campaign.stats.cardsPlayed}</strong></div><div><small>Damage dealt</small><strong>${campaign.stats.damageDealt}</strong></div><div><small>Tiles moved</small><strong>${campaign.stats.tilesMoved}</strong></div></div><div class="ending-actions"><button class="primary-action" type="button" data-action="return-map">Walk the March</button><button class="quiet-action" type="button" data-action="new-journey">Begin another history</button></div><p class="ending-signature">Made with care by Manu · August 2026 · Emberfall draft v0.1</p></div></section>`;
}

function burstAt(element, color = "#ed6734", amount = 11) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (let index = 0; index < amount; index += 1) {
    const particle = document.createElement("i");
    particle.className = "burst-particle";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.background = color;
    emberField.append(particle);
    const angle = Math.PI * 2 * index / amount + Math.random() * 0.35;
    const distance = 24 + Math.random() * 52;
    particle.animate([{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" }, { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(0)` }], { duration: 430 + Math.random() * 250, easing: "cubic-bezier(.15,.75,.2,1)" }).finished.finally(() => particle.remove());
  }
}

function floatingNumber(element, amount, tone = "damage") {
  if (!element || !amount) return;
  const rect = element.getBoundingClientRect();
  const number = document.createElement("b");
  number.className = "floating-number";
  number.textContent = tone === "block" ? `+${amount}` : `−${amount}`;
  number.style.left = `${rect.left + rect.width / 2}px`;
  number.style.top = `${rect.top + 14}px`;
  if (tone === "block") number.style.color = "#9ac4dc";
  document.body.append(number);
  later(() => number.remove(), 760);
}

function animateCardGhost(source, target) {
  if (!source) return;
  const from = source.getBoundingClientRect();
  const to = target?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight * 0.38, width: 0, height: 0 };
  const clone = source.cloneNode(true);
  clone.classList.add("card-ghost");
  Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, margin: "0" });
  clone.style.setProperty("--ghost-x", `${to.left + to.width / 2 - from.left - from.width / 2}px`);
  clone.style.setProperty("--ghost-y", `${to.top + to.height / 2 - from.top - from.height / 2}px`);
  document.body.append(clone);
  later(() => clone.remove(), 400);
}

function flashScreen() {
  const flash = document.createElement("i");
  flash.className = "screen-flash";
  document.body.append(flash);
  later(() => flash.remove(), 240);
}

function haptic(pattern = 9) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function applyCombatEvents(events) {
  events.forEach((event, index) => later(() => {
    if (event.type === "hit") {
      const unit = root.querySelector(`[data-enemy-id="${event.targetId}"]`);
      unit?.classList.add("is-hit");
      floatingNumber(unit, event.amount);
      burstAt(unit, event.element === "fire" ? "#ff8a42" : "#e7dcc1", 9);
      sound.play(event.element === "fire" ? "fire" : "hit");
      haptic(12);
    } else if (event.type === "player-hit") {
      const unit = root.querySelector("#playerUnit");
      unit?.classList.add("is-hit");
      floatingNumber(unit, event.amount);
      if (event.absorbed) floatingNumber(unit, event.absorbed, "block");
      burstAt(unit, "#d5543e", 8);
      sound.play(event.absorbed && !event.amount ? "block" : "hit");
      haptic([18, 20, 18]);
    } else if (event.type === "miss") {
      root.querySelector(`[data-enemy-id="${event.sourceId}"]`)?.classList.add("is-miss");
      sound.play("miss");
    } else if (["block", "enemy-block"].includes(event.type)) sound.play("block");
    else if (["mana", "overcharge"].includes(event.type)) sound.play("mana");
    else if (["move", "enemy-move"].includes(event.type)) sound.play("move");
    else if (event.type === "victory") { sound.play("victory"); flashScreen(); }
    else if (event.type === "defeat") sound.play("defeat");
  }, Math.min(index * 90, 450)));
}

function rulesModalMarkup() {
  return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="rulesTitle" tabindex="-1"><button class="modal-close" type="button" data-action="close-modal" aria-label="Close">×</button><p class="eyebrow">Field guide / Three rules</p><h2 id="rulesTitle">Read the lane.</h2><p class="modal-lede">Every action is a card. The puzzle is knowing what the enemy will do, then spending movement, Stamina, and Mana in the right order.</p><div class="rules-grid"><article class="rule-card"><i>1</i><strong>Intent is locked</strong><p>Red tiles show where attacks land. Move off them before ending your turn.</p></article><article class="rule-card"><i>2</i><strong>Movement is a card</strong><p>Advance and Withdraw cost hand space. Position is part of your build.</p></article><article class="rule-card"><i>3</i><strong>Mana banks</strong><p>Stamina refills fully. Mana carries over and restores by one each turn.</p></article></div><ol class="rules-steps"><li><b>A</b><span>Choose a card. If it needs a target, highlighted enemies or tiles become clickable.</span></li><li><b>B</b><span>Every card shows its origin—shared basic, stat threshold, or equipment discovery.</span></li><li><b>C</b><span>Block expires next turn. Enemy attacks do not retarget after you move.</span></li></ol><button class="primary-action" type="button" data-action="close-modal" style="margin-top:22px">Back to the game</button></section></div>`;
}

function libraryCardMarkup(cardId) {
  const card = CARDS[cardId];
  const owned = getLibrary(campaign)[cardId] || 0;
  const active = activeCount(campaign, cardId);
  const unlock = getUnlockState(campaign, cardId);
  const artColor = card.family === "fire" ? "#753a2d" : card.family === "magic" ? "#3b5366" : card.family === "movement" ? "#637151" : card.family === "physical" ? "#6c5141" : "#6d604b";
  return `<article class="library-card ${owned ? "" : "is-locked"}" data-card-id="${cardId}"><span class="card-art" style="background-color:${artColor}">${icon(card.icon)}</span><strong class="card-title">${card.name}</strong><span class="card-description">${card.description}</span><small class="card-source">${card.source}</small>${owned ? `<div class="library-card__controls"><button type="button" data-action="loadout-minus" data-card-id="${cardId}" ${canAdjustLoadout(campaign, cardId, -1) ? "" : "disabled"} aria-label="Remove ${card.name}">−</button><span>${active} active<br>${owned} owned</span><button type="button" data-action="loadout-plus" data-card-id="${cardId}" ${canAdjustLoadout(campaign, cardId, 1) ? "" : "disabled"} aria-label="Add ${card.name}">+</button></div>` : `<div class="library-lock">${escapeHtml(unlock.label)}</div>`}</article>`;
}

function loadoutModalMarkup() {
  const valid = campaign.player.activeDeck.length === LOADOUT_SIZE;
  return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="loadoutTitle" tabindex="-1"><button class="modal-close" type="button" data-action="close-modal" aria-label="Close">×</button><div class="loadout-head"><div><p class="eyebrow">Discovered cards / Active deck</p><h2 id="loadoutTitle">Build your history.</h2><p class="modal-lede">Your library is permanent. Your active loadout is the twelve-card story you bring into the next fight.</p></div><div class="loadout-count ${valid ? "is-valid" : ""}">${campaign.player.activeDeck.length} / ${LOADOUT_SIZE} active</div></div><div class="library-grid">${CARD_ORDER.map(libraryCardMarkup).join("")}</div><footer class="loadout-footer"><p>${valid ? "Loadout ready. Duplicate cards reflect copies unlocked by the same choice." : `Add or remove cards until exactly ${LOADOUT_SIZE} are active.`}</p><button class="primary-action" type="button" data-action="close-modal">${valid ? "Use this loadout" : "Save for later"}</button></footer></section></div>`;
}

function statHint(stat) {
  const unlock = CARD_ORDER.map((cardId) => ({ cardId, state: getUnlockState(campaign, cardId) })).find(({ state }) => !state.owned && state.label.startsWith(STAT_LABELS[stat]));
  return unlock ? `Next: ${CARDS[unlock.cardId].name} · ${unlock.state.label}` : "No nearby card unlock in this slice";
}

function statsModalMarkup() {
  return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="statsTitle" tabindex="-1"><button class="modal-close" type="button" data-action="close-modal" aria-label="Close">×</button><p class="eyebrow">Character sheet / Permanent choices</p><h2 id="statsTitle">Choose what Elowen learns.</h2><p class="modal-lede">Each point changes the character sheet first. Cards appear only when a visible threshold is crossed.</p><div class="unspent-banner"><span>Unspent stat points</span><strong>${campaign.player.unspentStats}</strong></div><div class="stats-list">${Object.entries(STAT_LABELS).map(([stat, label]) => `<div class="stat-row"><span><strong>${label}</strong><small>${statHint(stat)}</small></span><b class="stat-value">${campaign.player.stats[stat]}</b><button class="stat-add" type="button" data-action="stat-add" data-stat="${stat}" ${campaign.player.unspentStats ? "" : "disabled"} aria-label="Add one point to ${label}">+</button></div>`).join("")}</div><button class="primary-action" type="button" data-action="close-modal" style="margin-top:22px">Done</button></section></div>`;
}

function confirmationModalMarkup() {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" tabindex="-1"><button class="modal-close" type="button" data-action="close-modal" aria-label="Close">×</button><p class="eyebrow">New history</p><h2 id="confirmTitle">Let the old save go?</h2><p class="modal-lede">Beginning again replaces the journey saved on this device. Sandy's first ember can always be replayed.</p><div class="story-actions"><button class="danger-action" type="button" data-action="confirm-new-journey">Begin again</button><button class="secondary-action" type="button" data-action="close-modal">Keep this journey</button></div></section></div>`;
}

function showModal(type) {
  modalReturnFocus = document.activeElement;
  currentModal = type;
  modalLayer.classList.add("is-open");
  modalLayer.innerHTML = type === "rules" ? rulesModalMarkup() : type === "loadout" ? loadoutModalMarkup() : type === "stats" ? statsModalMarkup() : confirmationModalMarkup();
  requestAnimationFrame(() => modalLayer.querySelector(".modal")?.focus());
}

function refreshModal(scrollTop = null) {
  const oldScroll = modalLayer.querySelector(".modal")?.scrollTop || 0;
  if (currentModal === "loadout") modalLayer.innerHTML = loadoutModalMarkup();
  else if (currentModal === "stats") modalLayer.innerHTML = statsModalMarkup();
  const next = modalLayer.querySelector(".modal");
  if (next) next.scrollTop = scrollTop ?? oldScroll;
}

function closeModal() {
  modalLayer.classList.remove("is-open");
  modalLayer.innerHTML = "";
  currentModal = null;
  modalReturnFocus?.focus?.();
  modalReturnFocus = null;
  renderTopStatus();
  if (screen === "briefing") renderBriefing();
  else if (screen === "map") renderMap();
}

function beginNewJourney() {
  campaign = createCampaign();
  saveCampaign();
  combat = null;
  pendingEncounter = null;
  closeModal();
  sound.play("unlock");
  setScreen("map");
  toast("A new history begins in Greybank.", "success", "✦");
}

function openMapNode(nodeId) {
  const state = nodeState(nodeId);
  if (!state.unlocked) return;
  sound.play("paper");
  if (nodeId === "greybank") return showModal("loadout");
  if (nodeId === "cinderwatch") return setScreen("town");
  if (nodeId === "emberforge") return setScreen("forge");
  if (campaign.completed.includes(nodeId)) return toast("That encounter is already part of Elowen's history.");
  if (!encounterAvailable(campaign, nodeId)) return;
  pendingEncounter = nodeId;
  setScreen("briefing");
}

function beginCombat() {
  if (!pendingEncounter || campaign.player.activeDeck.length !== LOADOUT_SIZE) return;
  try {
    combat = startCombat(campaign, pendingEncounter);
    combatLogOpen = false;
    screen = "combat";
    sound.play("enemy");
    render();
    announce(`${ENCOUNTERS[pendingEncounter].name} begins. Enemy intents are marked on the lane.`);
  } catch (error) {
    toast(error.message);
  }
}

function performCard(uid, target, sourceElement, targetElement) {
  const instance = combat.hand.find((item) => item.uid === uid);
  if (!instance) return;
  const card = CARDS[instance.cardId];
  const result = playCard(combat, uid, target);
  if (result.error) { toast(result.error); sound.play("miss"); return; }
  animateCardGhost(sourceElement, targetElement);
  sound.play("card");
  if (card.family === "fire") sound.play("fire");
  else if (card.family === "movement") sound.play("move");
  else if (card.resource === "mana") sound.play("mana");
  haptic(8);
  combat = result.combat;
  selectedCardUid = null;
  renderCombat();
  applyCombatEvents(result.events);
  announce(`${card.name} played.`);
}

function selectOrPlayCard(button) {
  if (!combat || combat.status !== "playing") return;
  const uid = button.dataset.uid;
  const instance = combat.hand.find((item) => item.uid === uid);
  if (!instance) return;
  const allowed = canPlay(combat, uid);
  if (!allowed.ok) return toast(allowed.reason);
  const card = CARDS[instance.cardId];
  if (card.target === "none") return performCard(uid, null, button, root.querySelector("#playerUnit"));
  selectedCardUid = selectedCardUid === uid ? null : uid;
  sound.play("paper");
  renderCombat();
  if (selectedCardUid) announce(`${card.name} selected. Choose ${card.target === "enemy" ? "an enemy" : "a lane tile"}.`);
}

function finishTurn() {
  if (!combat || combat.status !== "playing") return;
  selectedCardUid = null;
  sound.play("enemy");
  const result = endTurn(combat);
  if (result.error) return toast(result.error);
  combat = result.combat;
  renderCombat();
  applyCombatEvents(result.events);
  haptic(10);
}

function acceptVictory() {
  const encounterId = combat.encounterId;
  campaign = applyVictory(campaign, encounterId, combat);
  saveCampaign();
  combat = null;
  pendingEncounter = null;
  if (encounterId === "ashen-road") {
    sound.play("unlock");
    setScreen("map");
    toast("Milestone reached: 3 stat points earned.", "success", "+");
  } else if (encounterId === "scorched-keep") {
    sound.play("unlock");
    setScreen("map");
    toast("Fireball and Brand discovered.", "success", "✦");
  } else setScreen("ending");
}

function handleRootClick(event) {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  if (action === "continue") setScreen(campaign.finished ? "ending" : "map");
  else if (action === "new-journey") campaign ? showModal("confirm") : beginNewJourney();
  else if (action === "map-node") openMapNode(control.dataset.node);
  else if (action === "open-loadout") showModal("loadout");
  else if (action === "open-stats") showModal("stats");
  else if (action === "back-map" || action === "return-map") { pendingEncounter = null; setScreen("map"); }
  else if (action === "start-encounter") beginCombat();
  else if (action === "claim-staff") {
    campaign = visitCinderwatch(campaign); saveCampaign(); sound.play("unlock");
    setScreen("map"); toast("Fire Staff equipped. Its cards are attuning.", "success", "✦");
  } else if (action === "upgrade-staff") {
    campaign = upgradeFireStaff(campaign); saveCampaign(); sound.play("unlock"); flashScreen();
    setScreen("map"); toast("Fire Staff T2: Flame Wall discovered.", "success", "✦"); later(() => showModal("loadout"), 400);
  } else if (action === "play-card") selectOrPlayCard(control);
  else if (action === "target-enemy" && selectedCardUid) performCard(selectedCardUid, control.dataset.enemyId, root.querySelector(`[data-uid="${selectedCardUid}"]`), control);
  else if (action === "target-tile" && selectedCardUid) performCard(selectedCardUid, Number(control.dataset.tile), root.querySelector(`[data-uid="${selectedCardUid}"]`), control);
  else if (action === "cancel-target") { selectedCardUid = null; renderCombat(); }
  else if (action === "end-turn") finishTurn();
  else if (action === "toggle-log") { combatLogOpen = !combatLogOpen; renderCombat(); }
  else if (action === "accept-victory") acceptVictory();
  else if (action === "retry-combat") { campaign = retryEncounter(campaign); saveCampaign(); pendingEncounter = combat.encounterId; combat = startCombat(campaign, pendingEncounter); sound.play("enemy"); renderCombat(); }
  else if (action === "leave-combat") { campaign = retryEncounter(campaign); saveCampaign(); combat = null; pendingEncounter = null; setScreen("map"); }
}

function handleModalClick(event) {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  if (action === "backdrop-close" && event.target !== control) return;
  if (action === "close-modal" || action === "backdrop-close") closeModal();
  else if (action === "loadout-minus" || action === "loadout-plus") {
    const scroll = modalLayer.querySelector(".modal")?.scrollTop || 0;
    campaign = adjustLoadout(campaign, control.dataset.cardId, action === "loadout-plus" ? 1 : -1);
    saveCampaign(); sound.play("paper"); refreshModal(scroll);
  } else if (action === "stat-add") {
    const result = spendStatPoint(campaign, control.dataset.stat);
    campaign = result.campaign; saveCampaign(); sound.play(result.unlocked.length ? "unlock" : "card");
    result.unlocked.forEach((cardId) => toast(`${CARDS[cardId].name} unlocked by ${CARDS[cardId].source}.`, "success", "✦"));
    refreshModal();
  } else if (action === "confirm-new-journey") beginNewJourney();
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    if (currentModal) closeModal();
    else if (selectedCardUid && screen === "combat") { selectedCardUid = null; renderCombat(); }
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches('[data-action="target-tile"]')) { event.preventDefault(); event.target.click(); }
  if (currentModal && event.key === "Tab") {
    const focusable = [...modalLayer.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}

soundButton.addEventListener("click", () => { sound.setEnabled(!sound.enabled); updateSoundButton(); });
rulesButton.addEventListener("click", () => showModal("rules"));
root.addEventListener("click", handleRootClick);
modalLayer.addEventListener("click", handleModalClick);
document.addEventListener("keydown", handleKeydown);
document.addEventListener("visibilitychange", () => { if (!document.hidden && sound.enabled) sound.startAmbient(screen === "combat"); });

addAmbientEmbers();
updateSoundButton();
if (sound.enabled) sound.startAmbient(false);
render();
