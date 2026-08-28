import * as Content from "./content.js";
import * as Engine from "./engine.js";
import { drawBattlefield, hitTestBattlefield } from "./renderer.js";
import { icon, flameSigil, towerIcon, towerSeal } from "./art.js";
import { SoundEngine } from "./audio.js";

const PROFILE_KEY = "cairnloom-profile-v1";
const RUN_KEY = "cairnloom-run-v1";
const SETTINGS_KEY = "cairnloom-settings-v1";
const TUTORIAL_KEY = "cairnloom-tutorial-v1";
const STEP_MS = (Engine.ENGINE_CONSTANTS?.fixedStepSeconds ?? (1 / 30)) * 1000;

const gameShell = document.querySelector("#gameShell");
const modalLayer = document.querySelector("#modalLayer");
const toastRegion = document.querySelector("#toastRegion");
const announcer = document.querySelector("#announcer");
const ambientEmbers = document.querySelector("#ambientEmbers");

const sound = new SoundEngine();
let settings = loadSettings();
let profile = loadProfile();
let run = loadRun();
let screen = "title";
let citadelTab = "towers";
let selectedTowerType = null;
let selectedTowerId = null;
let paused = false;
let simulationSpeed = 1;
let accumulator = 0;
let previousFrame = performance.now();
let lastHudUpdate = 0;
let lastShotSound = 0;
let lastWaveHandled = run?.wavesCleared ?? -1;
let preWaveSnapshot = null;
let visualEffects = [];
let modalState = null;
let mapSignature = "";
let lastDrawLayout = null;

applySettings();
createAmbientEmbers();
render();
requestAnimationFrame(frame);

function loadSettings() {
  const defaults = { haptics: true, particles: true, screenShake: true, highContrast: false };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return defaults;
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
}

function applySettings() {
  document.documentElement.classList.toggle("reduce-particles", !settings.particles);
  document.documentElement.classList.toggle("high-contrast", settings.highContrast);
}

function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return Engine.createProfile();
  try {
    return Engine.deserializeProfile(raw);
  } catch {
    return Engine.createProfile();
  }
}

function saveProfile() {
  const serialized = Engine.serializeProfile?.(profile) ?? JSON.stringify(profile);
  localStorage.setItem(PROFILE_KEY, serialized);
}

function loadRun() {
  try {
    const saved = JSON.parse(localStorage.getItem(RUN_KEY) || "null");
    return saved?.map ? saved : null;
  } catch {
    return null;
  }
}

function saveRun(force = false) {
  if (!run) {
    localStorage.removeItem(RUN_KEY);
    return;
  }
  if (run.status === "wave" && !force) return;
  localStorage.setItem(RUN_KEY, JSON.stringify(run));
}

function clearRunSave() {
  localStorage.removeItem(RUN_KEY);
}

function createAmbientEmbers() {
  const count = window.innerWidth > 680 ? 14 : 7;
  ambientEmbers.innerHTML = Array.from({ length: count }, (_, index) => {
    const left = (index * 71 + 13) % 100;
    const duration = 9 + (index % 6) * 1.6;
    const delay = -(index * 1.73) % duration;
    const drift = -22 + (index % 7) * 8;
    return `<i class="ambient-ember" style="--left:${left}%;--duration:${duration}s;--delay:${delay}s;--drift:${drift}px"></i>`;
  }).join("");
}

function render() {
  closeModal(true);
  if (screen === "title") renderTitle();
  if (screen === "citadel") renderCitadel();
  if (screen === "play") renderPlay();
}

function renderTitle() {
  sound.startAmbient(false);
  const hasRun = Boolean(run);
  const wave = getUpcomingWaveNumber();
  gameShell.innerHTML = `
    <section class="title-screen" aria-labelledby="game-title">
      <div class="title-top">
        ${flameSigil("title-sigil")}
        <h1 class="title-wordmark" id="game-title">Cairn<span>loom</span></h1>
        <p class="title-subtitle">Weave the last light</p>
      </div>
      <div class="title-actions">
        <p class="title-pitch">Play towers from living cards. Read the horde. Let every fallen watch make the next one stronger.</p>
        ${hasRun
          ? `<button class="primary-button" type="button" data-action="resume-run">Resume · Wave ${wave}</button>
             <button class="secondary-button" type="button" data-action="enter-citadel">Visit the Forge</button>`
          : `<button class="primary-button" type="button" data-action="enter-citadel">Enter the Citadel</button>`}
        <div class="title-utility">
          <button class="quiet-button" type="button" data-action="open-rules">${icon("info")} How to play</button>
          <button class="icon-button" type="button" data-action="toggle-sound" aria-label="${sound.enabled ? "Mute sound" : "Turn sound on"}">${icon(sound.enabled ? "sound" : "mute")}</button>
          <button class="icon-button" type="button" data-action="open-settings" aria-label="Settings">${icon("settings")}</button>
        </div>
        <p class="title-credit">A Manu.Vision game · Progress saves on this device</p>
      </div>
    </section>`;
}

function renderCitadel() {
  sound.startAmbient(false);
  const cinders = getCinders(profile);
  const sigils = getSigils(profile);
  const bestWave = profile?.lifetime?.bestWave ?? profile?.stats?.bestWave ?? profile?.bestWave ?? 0;
  gameShell.innerHTML = `
    <section class="citadel-screen" aria-labelledby="citadel-title">
      <header class="citadel-header">
        <button class="icon-button" type="button" data-action="go-title" aria-label="Back to title">${icon("back")}</button>
        <div class="citadel-header__title">
          <h1 id="citadel-title">The Ember Forge</h1>
          <small>What falls returns stronger</small>
        </div>
        <div class="citadel-wallet" aria-label="Permanent currencies">
          <span class="currency currency--cinder" title="Cinders">${icon("cinder")} ${formatNumber(cinders)}</span>
          <span class="currency currency--sigil" title="Boss Sigils">${icon("sigil")} ${formatNumber(sigils)}</span>
        </div>
        <button class="icon-button" type="button" data-action="open-settings" aria-label="Settings">${icon("settings")}</button>
      </header>

      <div class="citadel-hero">
        <div>
          <p class="eyebrow">Permanent refuge</p>
          <h2>${bestWave ? `The flame reached wave ${bestWave}.` : "The first watch awaits."}</h2>
          <p>Spend Cinders on tower blueprints. Boss Sigils shape every future expedition.</p>
        </div>
        <div class="best-seal" aria-label="Best wave ${bestWave}"><small>Best</small><strong>${bestWave}</strong></div>
      </div>

      <nav class="citadel-tabs" aria-label="Forge sections">
        <button type="button" data-action="select-citadel-tab" data-tab="towers" class="${citadelTab === "towers" ? "is-active" : ""}">Tower cards</button>
        <button type="button" data-action="select-citadel-tab" data-tab="talents" class="${citadelTab === "talents" ? "is-active" : ""}">Sigil tree</button>
      </nav>

      <div class="citadel-content" id="citadelContent">
        ${citadelTab === "towers" ? renderArsenal() : renderTalentTree()}
      </div>

      <footer class="citadel-footer">
        <button class="primary-button" type="button" data-action="${run ? "resume-run" : "start-run"}">${run ? `Resume wave ${getUpcomingWaveNumber()}` : "Begin a new watch"}</button>
      </footer>
    </section>`;
}

function renderArsenal() {
  const towers = towerRecords();
  const unlocked = getUnlockedTowerIds(profile);
  const mastery = profile?.towerMastery ?? profile?.mastery ?? Object.fromEntries(Object.entries(profile?.towers ?? {}).map(([id, value]) => [id, value?.mastery ?? 0]));
  return `
    <div class="section-intro">
      <div><h3>Your blueprints</h3><p>Unlock a new damage language, or temper a favorite card across every run.</p></div>
    </div>
    <div class="arsenal-grid">
      ${towers.map((tower, index) => {
        const isUnlocked = unlocked.includes(tower.id);
        const rank = mastery[tower.id] ?? 0;
        const maxRank = tower.maxMastery ?? tower.masteryMax ?? 3;
        const unlockCost = tower.unlockCost ?? tower.emberCost ?? 0;
        const masteryCost = getMasteryCost(tower, rank);
        const maxed = rank >= maxRank;
        const action = isUnlocked ? "master-tower" : "unlock-tower";
        const cost = isUnlocked ? masteryCost : unlockCost;
        const canAfford = cindersCanAfford(cost) && !maxed;
        return `
          <article class="blueprint-card ${isUnlocked ? "" : "is-locked"}" style="--tilt:${index % 2 ? ".45deg" : "-.45deg"};--tower-color:${towerColor(tower.id)}">
            <div class="blueprint-card__art">${towerIcon(tower.id)}</div>
            <h4>${escapeHtml(tower.name ?? tower.id)}</h4>
            <span class="blueprint-card__role">${escapeHtml(tower.role ?? tower.archetype ?? towerRole(tower.id))}</span>
            <p>${escapeHtml(tower.description ?? tower.shortDescription ?? towerDescription(tower.id))}</p>
            <div class="blueprint-card__footer">
              <small>${isUnlocked ? `Mastery ${rank}/${maxRank}` : "Blueprint locked"}</small>
              <button type="button" data-action="${action}" data-tower-id="${tower.id}" ${maxed ? "disabled" : ""} aria-label="${maxed ? `${tower.name} mastered` : `${isUnlocked ? "Improve" : "Unlock"} ${tower.name} for ${cost} Cinders`}">
                ${maxed ? "Mastered" : `${icon("cinder")} ${cost}`}
              </button>
            </div>
          </article>`;
      }).join("")}
    </div>`;
}

function renderTalentTree() {
  const nodes = talentRecords();
  const talents = profile?.talents ?? profile?.talentRanks ?? {};
  return `
    <div class="section-intro">
      <div><h3>The living flame</h3><p>Boss Sigils buy modest advantages. Placement and tower synergy still decide each watch.</p></div>
    </div>
    <div class="talent-tree">
      ${nodes.map((node) => {
        const rank = talents[node.id] ?? 0;
        const maxRank = node.maxRank ?? node.maxLevel ?? node.ranks ?? 1;
        const maxed = rank >= maxRank;
        const cost = getTalentCost(node, rank);
        const iconName = node.icon ?? talentIcon(node.id);
        return `
          <article class="talent-card ${rank ? "is-bought" : ""}">
            <span class="talent-card__icon">${icon(iconName)}</span>
            <div><h4>${escapeHtml(node.name ?? node.id)} · ${rank}/${maxRank}</h4><p>${escapeHtml(node.description ?? node.effect ?? "A permanent advantage for every watch.")}</p></div>
            <button type="button" data-action="buy-talent" data-talent-id="${node.id}" ${maxed ? "disabled" : ""} aria-label="${maxed ? `${node.name} complete` : `Buy ${node.name} rank ${rank + 1} for ${cost} Sigils`}">${maxed ? "Done" : `${icon("sigil")} ${cost}`}</button>
          </article>`;
      }).join("")}
    </div>`;
}

function renderPlay() {
  if (!run) {
    screen = "citadel";
    renderCitadel();
    return;
  }
  sound.startAmbient(true);
  const preview = normalizeWavePreview(Engine.getWavePreview(run));
  const isWave = run.status === "wave";
  gameShell.innerHTML = `
    <section class="play-screen" aria-label="Cairnloom battlefield">
      <header class="play-hud">
        <div class="hud-wave"><small id="hudChapter">Chapter ${run.chapter ?? 1}</small><strong id="hudWave">Wave ${preview.waveNumber}</strong></div>
        <div class="hud-base">
          <span class="hud-base__label">${icon("heart")} Ward <strong id="baseHpText">${Math.ceil(run.baseHp)}/${run.maxBaseHp}</strong></span>
          <span class="health-bar" aria-hidden="true"><i id="baseHealthFill" style="--health:${healthPercent()}%"></i></span>
        </div>
        <div class="hud-wallet">
          <span class="currency" aria-label="${run.gold} Gold">${icon("coin")} <span id="goldText">${formatNumber(run.gold)}</span></span>
          <button class="icon-button" type="button" data-action="open-settings" aria-label="Pause and settings">${icon("settings")}</button>
        </div>
      </header>

      <div class="wave-preview" id="wavePreview">
        ${renderWavePreview(preview, isWave)}
      </div>

      <div class="battlefield" id="battlefield">
        <canvas id="battleCanvas" role="img" aria-label="A winding route from the ash gate to your base. Select a tower card, then choose an available rune pad."></canvas>
        <div class="map-controls" id="mapControls" aria-label="Build pads and placed towers"></div>
        <div class="speed-controls" aria-label="Battle speed">
          <button type="button" data-action="toggle-pause" class="${paused ? "is-active" : ""}" aria-label="${paused ? "Resume" : "Pause"}">${icon(paused ? "play" : "pause")}</button>
          <button type="button" data-action="set-speed" data-speed="1" class="${simulationSpeed === 1 ? "is-active" : ""}" aria-label="Normal speed">1×</button>
          <button type="button" data-action="set-speed" data-speed="2" class="${simulationSpeed === 2 ? "is-active" : ""}" aria-label="Double speed">2×</button>
        </div>
        <p class="battlefield-instruction" id="battleInstruction">${instructionText()}</p>
      </div>

      <div class="build-dock ${isWave ? "is-active" : ""}" id="buildDock">
        <div class="dock-head"><strong>Tower hand</strong><span>Tap a card, then a glowing rune.</span></div>
        <div class="tower-hand" id="towerHand" aria-label="Available tower cards">
          ${renderTowerHand(isWave)}
        </div>
      </div>
    </section>`;
  mapSignature = "";
  syncMapControls();
  updatePlayChrome(true);
}

function renderWavePreview(preview, active) {
  const summary = preview.summary || preview.composition.map((entry) => `${entry.count} ${entry.name}`).join(" · ") || "Unknown shapes gather";
  const pips = preview.composition.slice(0, 5).map((entry) => `<span class="enemy-pip" title="${entry.count} ${escapeHtml(entry.name)}">${entry.count}</span>`).join("");
  return `
    <div class="wave-preview__copy"><small>${active ? `${run.mobs?.length ?? 0} on the road` : preview.isBoss ? "Boss wave" : "Incoming composition"}</small><strong>${active ? activeWaveLabel() : escapeHtml(summary)}</strong></div>
    <div class="enemy-pips" aria-hidden="true">${pips}</div>
    ${active ? "" : `<button class="pill-button" type="button" data-action="start-wave">${icon(preview.isBoss ? "skull" : "play")} ${preview.isBoss ? "Call boss" : "Call wave"}</button>`}`;
}

function renderTowerHand(isWave) {
  const unlocked = run.unlockedTowerIds ?? getUnlockedTowerIds(profile);
  return unlocked.map((id, index) => {
    const tower = getTower(id);
    const stats = Engine.getEffectiveTowerStats(run, id, 1) ?? tower;
    const cost = stats.placementCost ?? stats.cost ?? stats.buildCost ?? tower.baseCost ?? tower.cost ?? tower.buildCost ?? 0;
    const unavailable = isWave || run.gold < cost;
    return `
      <button class="tower-card ${selectedTowerType === id ? "is-selected" : ""}" style="--tilt:${(index % 3 - 1) * .55}deg;--tower-color:${towerColor(id)}" type="button" data-action="select-tower" data-tower-id="${id}" aria-pressed="${selectedTowerType === id}" aria-disabled="${unavailable}" aria-label="${tower.name}, ${cost} Gold. ${tower.description ?? towerDescription(id)}">
        <span class="tower-card__cost">${cost}</span>
        <span class="tower-card__art">${towerIcon(id)}</span>
        <strong>${escapeHtml(tower.name ?? id)}</strong>
        <small>${escapeHtml(tower.role ?? towerRole(id))}</small>
      </button>`;
  }).join("");
}

function updatePlayChrome(force = false) {
  if (screen !== "play" || !run) return;
  const now = performance.now();
  if (!force && now - lastHudUpdate < 120) return;
  lastHudUpdate = now;
  const preview = normalizeWavePreview(Engine.getWavePreview(run));
  setText("#hudChapter", `Chapter ${run.chapter ?? 1}`);
  setText("#hudWave", run.status === "wave" ? `Wave ${run.waveNumber}` : `Wave ${preview.waveNumber}`);
  setText("#baseHpText", `${Math.max(0, Math.ceil(run.baseHp))}/${run.maxBaseHp}`);
  setText("#goldText", formatNumber(run.gold));
  const fill = document.querySelector("#baseHealthFill");
  if (fill) fill.style.setProperty("--health", `${healthPercent()}%`);
  const instruction = document.querySelector("#battleInstruction");
  if (instruction) instruction.textContent = instructionText();
  if (force) {
    const previewElement = document.querySelector("#wavePreview");
    if (previewElement) previewElement.innerHTML = renderWavePreview(preview, run.status === "wave");
    const dock = document.querySelector("#buildDock");
    if (dock) dock.classList.toggle("is-active", run.status === "wave");
    const hand = document.querySelector("#towerHand");
    if (hand) hand.innerHTML = renderTowerHand(run.status === "wave");
    syncMapControls();
  }
}

function syncMapControls() {
  const container = document.querySelector("#mapControls");
  if (!container || !run?.map) return;
  const width = run.map.width ?? run.map.cols ?? 7;
  const height = run.map.height ?? run.map.rows ?? 12;
  const pads = run.map.buildPads ?? run.map.pads ?? [];
  const towers = run.towers ?? [];
  const signature = `${run.map.seed}:${pads.length}:${towers.map((tower) => `${tower.id}-${tower.level}`).join("|")}:${selectedTowerType}`;
  if (signature === mapSignature) return;
  mapSignature = signature;
  container.innerHTML = pads.map((pad) => {
    const tower = towers.find((candidate) => candidate.padId === pad.id || (candidate.x === pad.x && candidate.y === pad.y));
    const action = tower ? "map-tower" : "map-pad";
    const label = tower ? `${getTower(tower.typeId).name} level ${tower.level}. Inspect tower.` : `${selectedTowerType ? `Place ${getTower(selectedTowerType).name}` : "Empty"} rune pad at column ${pad.x + 1}, row ${pad.y + 1}`;
    return `<button class="map-control ${selectedTowerType && !tower ? "is-valid" : ""}" style="--map-x:${((pad.x + .5) / width) * 100}%;--map-y:${((pad.y + .5) / height) * 100}%" type="button" data-action="${action}" data-pad-id="${pad.id}" ${tower ? `data-tower-id="${tower.id}"` : ""} aria-label="${escapeHtml(label)}"></button>`;
  }).join("");
}

function frame(now) {
  const elapsed = Math.min(250, now - previousFrame);
  previousFrame = now;
  if (screen === "play" && run) {
    if (run.status === "wave" && !paused && !modalState) {
      accumulator += elapsed * simulationSpeed;
      while (accumulator >= STEP_MS && run?.status === "wave") {
        stepOnce();
        accumulator -= STEP_MS;
      }
    }
    visualEffects = visualEffects.filter((effect) => now - effect.startedAt < (effect.duration ?? 650));
    const canvas = document.querySelector("#battleCanvas");
    if (canvas) {
      lastDrawLayout = drawBattlefield(canvas, run, {
        selectedTowerType,
        selectedTowerId,
        validPadIds: selectedTowerType ? (run.map.buildPads ?? run.map.pads ?? []).filter((pad) => !(run.towers ?? []).some((tower) => tower.padId === pad.id)).map((pad) => pad.id) : [],
        effects: visualEffects,
        time: now,
        placementRange: selectedTowerType ? (Engine.getEffectiveTowerStats(run, selectedTowerType, 1)?.range ?? getTower(selectedTowerType).range) : null,
      });
    }
    updatePlayChrome();
  }
  requestAnimationFrame(frame);
}

function stepOnce() {
  const previousStatus = run.status;
  const previousClears = run.wavesCleared;
  const previousBase = run.baseHp;
  const previousChapter = run.chapter;
  const result = Engine.stepSimulation(run, 1);
  if (result?.error) {
    paused = true;
    toast(result.error, "!");
    return;
  }
  run = extractRunState(result, run);
  handleEngineEvents(result?.events ?? []);
  if (run.baseHp < previousBase) onBaseHit(previousBase - run.baseHp);
  if (run.wavesCleared > previousClears && lastWaveHandled < run.wavesCleared) {
    lastWaveHandled = run.wavesCleared;
    onWaveCleared({ previousChapter, events: result?.events ?? [] });
  }
  if (previousStatus !== "defeat" && run.status === "defeat") onDefeat();
}

function handleEngineEvents(events) {
  for (const event of events) {
    const type = String(event.type ?? event.kind ?? "").toLowerCase();
    if (type.includes("fire") || type.includes("shot") || type.includes("attack")) {
      const towerType = event.towerTypeId ?? event.towerType ?? event.typeId;
      const now = performance.now();
      if (now - lastShotSound > 72) {
        sound.play(towerSound(towerType));
        lastShotSound = now;
      }
    }
    if (type.includes("damage") || type.includes("hit")) addEffectFromEvent(event, "hit");
    if (type.includes("kill") || type.includes("defeat-mob")) addEffectFromEvent(event, "burst");
    if (type.includes("burn")) addEffectFromEvent(event, "burn");
    if (type.includes("slow")) addEffectFromEvent(event, "slow");
    if (type.includes("chain")) addEffectFromEvent(event, "chain");
  }
}

function addEffectFromEvent(event, kind) {
  if (!settings.particles && kind !== "hit") return;
  let x = event.x ?? event.targetX;
  let y = event.y ?? event.targetY;
  const mobId = event.mobId ?? event.targetId;
  if ((x == null || y == null) && mobId) {
    const mob = run.mobs?.find((candidate) => candidate.id === mobId);
    if (mob) ({ x, y } = Engine.getMobPosition(run.map, mob));
  }
  if (x == null || y == null) return;
  visualEffects.push({ kind, x, y, value: event.amount ?? event.damage, startedAt: performance.now(), duration: kind === "chain" ? 420 : 620, ...event });
}

function onBaseHit(amount) {
  sound.play("leak");
  vibrate([35, 30, 50]);
  announce(`The Ward took ${Math.ceil(amount)} damage. ${Math.max(0, Math.ceil(run.baseHp))} health remains.`);
  if (settings.screenShake) gameShell.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 250 });
  flash("hit");
}

function onWaveCleared({ previousChapter, events }) {
  paused = true;
  saveRun();
  sound.play("victory");
  vibrate([20, 40, 28]);
  flash("win");
  const cleared = run.wavesCleared;
  const boss = cleared % 10 === 0;
  const chapterChanged = run.chapter !== previousChapter;
  const rewardEvent = events.find((event) => /reward|clear/i.test(event.type ?? "")) ?? {};
  const goldEarned = rewardEvent.gold ?? rewardEvent.reward ?? Math.max(0, run.gold - (preWaveSnapshot?.gold ?? run.gold));
  announce(`${boss ? "Boss" : "Wave"} ${cleared} cleared. ${goldEarned} Gold earned.`);

  const relicChoices = getPendingRelicChoices();
  window.setTimeout(() => {
    if (relicChoices.length) showRelicChoice(relicChoices, cleared, boss, chapterChanged, goldEarned);
    else showWaveResult(cleared, boss, chapterChanged, goldEarned);
  }, 280);
}

function showWaveResult(cleared, boss, chapterChanged, goldEarned) {
  openModal(`
    <div class="result-modal">
      <p class="eyebrow">${boss ? "The great shape falls" : "The road is quiet"}</p>
      <div class="result-sigil">${icon(boss ? "sigil" : "ward")}</div>
      <h2>${boss ? `Chapter ${Math.max(1, run.chapter - (chapterChanged ? 1 : 0))} held` : `Wave ${cleared} held`}</h2>
      <p>${chapterChanged ? "Every tower returned to Gold. A new road has formed, ready for a completely different defense." : "Use the breathing room to place, upgrade, or inspect the next composition."}</p>
      <div class="result-stats">
        <div><small>Gold earned</small><strong>+${formatNumber(goldEarned)}</strong></div>
        <div><small>Ward health</small><strong>${Math.ceil(run.baseHp)}/${run.maxBaseHp}</strong></div>
        <div><small>Next wave</small><strong>${getUpcomingWaveNumber()}</strong></div>
      </div>
      ${boss ? `<div class="reward-row"><span class="reward-chip">${icon("sigil")} Boss Sigil secured</span></div>` : ""}
      <div class="modal-actions"><button class="primary-button" type="button" data-action="continue-building">${chapterChanged ? "Survey the new road" : "Return to the map"}</button></div>
    </div>`, { dismissable: false });
}

function showRelicChoice(choices, cleared, boss, chapterChanged, goldEarned) {
  openModal(`
    <div class="result-modal">
      <p class="eyebrow">Wave ${cleared} reward</p>
      <h2>Choose a field card</h2>
      <p>This card lasts for the current watch and follows you into every new chapter.</p>
      <div class="relic-grid">
        ${choices.map((choice) => {
          const relic = typeof choice === "string" ? getRelic(choice) : choice;
          return `<button class="relic-card" type="button" data-action="choose-relic" data-relic-id="${relic.id}">${icon(relic.icon ?? "spark")}<strong>${escapeHtml(relic.name ?? relic.id)}</strong><span>${escapeHtml(relic.description ?? relic.effect ?? "Strengthen this watch.")}</span></button>`;
        }).join("")}
      </div>
      <button class="quiet-button skip-relic" type="button" data-action="skip-relic" data-cleared="${cleared}" data-boss="${boss}" data-chapter-changed="${chapterChanged}" data-gold="${goldEarned}">Skip · take 40 Gold</button>
    </div>`, { dismissable: false });
  modalState.waveResult = { cleared, boss, chapterChanged, goldEarned };
}

function onDefeat() {
  paused = true;
  sound.play("defeat");
  vibrate([80, 60, 120]);
  saveRun();
  const rewards = Engine.calculateDefeatRewards(run) ?? {};
  const cinders = rewards.cinders ?? rewards.embers ?? run.cinderBank ?? 0;
  const sigils = rewards.sigils ?? run.sigilBank ?? 0;
  announce(`The Ward has fallen after ${run.wavesCleared} waves. ${cinders} Cinders return to the Forge.`);
  window.setTimeout(() => openModal(`
    <div class="result-modal">
      <p class="eyebrow">The flame remembers</p>
      <div class="result-sigil">${icon("flame")}</div>
      <h2>The Ward has fallen</h2>
      <p>The road ends here, but this watch becomes fuel for the next. Nothing permanent is lost.</p>
      <div class="result-stats">
        <div><small>Waves held</small><strong>${run.wavesCleared}</strong></div>
        <div><small>Bosses</small><strong>${run.stats?.bossesKilled ?? run.sigilBank ?? 0}</strong></div>
        <div><small>Mobs stopped</small><strong>${formatNumber(run.stats?.kills ?? 0)}</strong></div>
      </div>
      <div class="reward-row">
        <span class="reward-chip">${icon("cinder")} +${formatNumber(cinders)} Cinders</span>
        ${sigils ? `<span class="reward-chip">${icon("sigil")} +${sigils} Sigil${sigils === 1 ? "" : "s"}</span>` : ""}
      </div>
      <div class="modal-actions"><button class="primary-button" type="button" data-action="claim-defeat">Carry the flame home</button></div>
    </div>`, { dismissable: false }), 420);
}

function showTowerSheet(towerId) {
  const tower = run.towers?.find((candidate) => candidate.id === towerId);
  if (!tower) return;
  selectedTowerId = towerId;
  const content = getTower(tower.typeId);
  const stats = Engine.getEffectiveTowerStats(run, tower.typeId, tower.level) ?? content;
  const upgradeCost = Engine.getTowerUpgradeCost?.(tower.typeId, tower.level, run) ?? stats.upgradeCost ?? 0;
  const sellValue = Engine.getTowerSellValue?.(run, tower) ?? Math.floor((tower.invested ?? content.cost ?? 0) * .7);
  const canEdit = run.status === "build";
  const maxLevel = tower.level >= (content.maxLevel ?? Engine.ENGINE_CONSTANTS?.maxTowerLevel ?? 3);
  const wasPaused = paused;
  paused = true;
  openModal(`
    <div class="tower-sheet-head">
      ${towerSeal(tower.typeId)}
      <div><h2>${escapeHtml(content.name ?? tower.typeId)} · II${tower.level}</h2><span>${escapeHtml(content.role ?? towerRole(tower.typeId))}</span></div>
    </div>
    <p>${escapeHtml(content.description ?? towerDescription(tower.typeId))}</p>
    <div class="stat-grid">
      <div><small>Damage</small><strong>${formatStat(stats.damage ?? stats.directDamage ?? "—")}</strong></div>
      <div><small>Rate</small><strong>${formatRate(stats)}</strong></div>
      <div><small>Range</small><strong>${formatStat(stats.range ?? "—")}</strong></div>
      <div><small>Special</small><strong>${escapeHtml(towerSpecialStat(tower.typeId, stats))}</strong></div>
      <div><small>Invested</small><strong>${tower.invested ?? "—"}</strong></div>
      <div><small>Targeting</small><strong>First</strong></div>
    </div>
    <div class="modal-actions modal-actions--row">
      <button class="primary-button" type="button" data-action="upgrade-tower" data-tower-id="${tower.id}" ${!canEdit || maxLevel || run.gold < upgradeCost ? "disabled" : ""}>${maxLevel ? "Max tier" : `Upgrade · ${upgradeCost}`}</button>
      <button class="secondary-button" type="button" data-action="sell-tower" data-tower-id="${tower.id}" ${!canEdit ? "disabled" : ""}>Sell · ${sellValue}</button>
    </div>
    ${!canEdit ? "<p><small>Building pauses during a wave. You can inspect now and change it when the road is quiet.</small></p>" : ""}`, {
    sheet: true,
    onClose: () => { selectedTowerId = null; paused = wasPaused; },
  });
}

function showRules() {
  const wasPaused = paused;
  if (screen === "play") paused = true;
  openModal(`
    <h2>How to hold the Ward</h2>
    <p>Cairnloom is designed around short, deliberate preparation and readable automatic combat.</p>
    <div class="rules-list">
      <div class="rule-row"><span class="rule-row__icon">${icon("map")}</span><div><strong>1 · Read the road</strong><p>Every chapter creates a functional new path. Preview the exact mob composition before you call it.</p></div></div>
      <div class="rule-row"><span class="rule-row__icon">${icon("forge")}</span><div><strong>2 · Play tower cards</strong><p>Tap a card, then a glowing rune pad. Tap a placed tower to upgrade or sell it.</p></div></div>
      <div class="rule-row"><span class="rule-row__icon">${icon("clock")}</span><div><strong>3 · Shape the run</strong><p>Every third wave offers a temporary field card. Every tenth wave brings a boss and a fresh map.</p></div></div>
      <div class="rule-row"><span class="rule-row__icon">${icon("branch")}</span><div><strong>4 · Make defeat useful</strong><p>Gold resets when the Ward falls. Cinders unlock towers, and boss Sigils permanently strengthen your talent tree.</p></div></div>
    </div>`, { onClose: () => { paused = wasPaused; } });
}

function showSettings(restorePaused = paused) {
  const wasPaused = restorePaused;
  if (screen === "play") paused = true;
  openModal(`
    <h2>Settings</h2>
    <p>Keep the battlefield comfortable and readable. These preferences stay on this device.</p>
    <div class="setting-list">
      ${settingRow("sound", "Sound effects", "Tactile paper, towers, warnings, and ambient crackle.", sound.enabled)}
      ${settingRow("haptics", "Haptics", "Light feedback for placement, upgrades, leaks, bosses, and defeat.", settings.haptics)}
      ${settingRow("particles", "Ambient effects", "Embers, impact marks, and other nonessential motion.", settings.particles)}
      ${settingRow("screenShake", "Screen shake", "A short movement when the Ward takes damage.", settings.screenShake)}
      ${settingRow("highContrast", "High contrast", "Stronger route, rune, and health boundaries.", settings.highContrast)}
    </div>
    ${run ? `<p class="seed-note">Run seed · <strong>${escapeHtml(String(run.seed))}</strong></p>` : ""}
    <div class="modal-actions">
      ${screen === "play" ? `<button class="secondary-button" type="button" data-action="return-title">Return to title</button>` : ""}
      <button class="quiet-button danger-button" type="button" data-action="confirm-reset">Reset all progress</button>
    </div>`, { restorePaused: wasPaused, onClose: () => { paused = wasPaused; } });
}

function settingRow(id, title, description, enabled) {
  return `<button class="setting-row" type="button" data-action="toggle-setting" data-setting="${id}" aria-pressed="${enabled}"><span><strong>${title}</strong><small>${description}</small></span><i class="toggle-switch ${enabled ? "is-on" : ""}" aria-hidden="true"><b></b></i></button>`;
}

function openModal(html, options = {}) {
  const lastFocus = document.activeElement;
  modalState = { ...options, dismissable: options.dismissable !== false, onClose: options.onClose, lastFocus, waveResult: null };
  modalLayer.innerHTML = `<div class="modal-backdrop ${options.sheet ? "is-sheet" : ""}" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">${options.dismissable === false ? "" : `<button class="icon-button modal-close" type="button" data-action="close-modal" aria-label="Close">${icon("close")}</button>`}${html}</section></div>`;
  requestAnimationFrame(() => modalLayer.querySelector("button:not([disabled]), [tabindex]")?.focus());
}

function closeModal(force = false) {
  if (!modalState) {
    modalLayer.innerHTML = "";
    return;
  }
  if (!force && modalState.dismissable === false) return;
  const state = modalState;
  modalState = null;
  modalLayer.innerHTML = "";
  state.onClose?.();
  state.lastFocus?.focus?.();
}

function startNewRun() {
  const seedArray = new Uint32Array(1);
  crypto.getRandomValues(seedArray);
  run = Engine.createRun(profile, { seed: seedArray[0] });
  saveRun();
  lastWaveHandled = run.wavesCleared ?? 0;
  selectedTowerType = null;
  selectedTowerId = null;
  paused = false;
  simulationSpeed = 1;
  screen = "play";
  sound.play("unlock");
  renderPlay();
  if (!localStorage.getItem(TUTORIAL_KEY)) {
    localStorage.setItem(TUTORIAL_KEY, "seen");
    window.setTimeout(showRules, 180);
  }
}

function startNextWave() {
  if (!run || run.status !== "build") return;
  saveRun();
  preWaveSnapshot = { gold: run.gold, baseHp: run.baseHp, chapter: run.chapter, wavesCleared: run.wavesCleared };
  const result = Engine.startWave(run);
  if (!applyRunActionResult(result)) return;
  selectedTowerType = null;
  selectedTowerId = null;
  paused = false;
  accumulator = 0;
  sound.play(run.waveNumber % 10 === 0 ? "boss" : "wave");
  if (run.waveNumber % 10 === 0) vibrate([45, 50, 75]);
  announce(`Wave ${run.waveNumber} begins. ${activeWaveLabel()}`);
  updatePlayChrome(true);
}

function selectTowerCard(typeId) {
  if (!run || run.status !== "build") {
    toast("Building pauses while the horde is moving.", "Ⅱ");
    return;
  }
  const tower = getTower(typeId);
  const stats = Engine.getEffectiveTowerStats(run, typeId, 1) ?? tower;
  const cost = stats.placementCost ?? stats.cost ?? stats.buildCost ?? tower.baseCost ?? tower.cost ?? 0;
  if (run.gold < cost) {
    toast(`Need ${cost - run.gold} more Gold for ${tower.name}.`, "¤");
    sound.play("paper");
    return;
  }
  selectedTowerType = selectedTowerType === typeId ? null : typeId;
  selectedTowerId = null;
  sound.play("card");
  vibrate(12);
  mapSignature = "";
  updatePlayChrome(true);
  announce(selectedTowerType ? `${tower.name} selected. Choose a glowing rune pad.` : `${tower.name} cancelled.`);
}

function placeSelectedTower(padId, targetElement) {
  if (!selectedTowerType) {
    toast("Choose a tower card first.", "?");
    return;
  }
  if (run.status !== "build") return;
  const typeId = selectedTowerType;
  const source = document.querySelector(`[data-action="select-tower"][data-tower-id="${CSS.escape(typeId)}"]`);
  const result = Engine.placeTower(run, padId, typeId);
  if (!applyRunActionResult(result)) return;
  animateCardToPad(source, targetElement);
  sound.play("build");
  vibrate(22);
  addPadEffect(padId, "build");
  saveRun();
  mapSignature = "";
  updatePlayChrome(true);
  announce(`${getTower(typeId).name} placed. ${run.gold} Gold remains.`);
}

function upgradeTower(towerId) {
  const result = Engine.upgradeTower(run, towerId);
  if (!applyRunActionResult(result)) return;
  sound.play("upgrade");
  vibrate([18, 30, 25]);
  saveRun();
  closeModal(true);
  mapSignature = "";
  updatePlayChrome(true);
  toast("Tower tempered to a new tier.", "↑");
}

function sellTower(towerId) {
  const result = Engine.sellTower(run, towerId);
  if (!applyRunActionResult(result)) return;
  sound.play("sell");
  saveRun();
  closeModal(true);
  mapSignature = "";
  updatePlayChrome(true);
  toast("Tower returned to the hand.", "¤");
}

function applyRunActionResult(result) {
  if (!result || result.error) {
    toast(result?.error ?? "The Ward could not do that.", "!");
    sound.play("paper");
    return false;
  }
  run = extractRunState(result, run);
  handleEngineEvents(result.events ?? []);
  return true;
}

function applyProfileAction(result) {
  if (!result || result.error) {
    toast(result?.error ?? "That path is not open yet.", "!");
    sound.play("paper");
    return false;
  }
  profile = result.state ?? result.profile ?? (result.version ? result : profile);
  saveProfile();
  sound.play("unlock");
  vibrate([15, 25, 22]);
  renderCitadel();
  return true;
}

function extractRunState(result, fallback) {
  return result?.state ?? result?.run ?? (result?.map ? result : fallback);
}

function claimDefeat() {
  const result = Engine.settleDefeat(profile, run);
  if (result?.error) {
    toast(result.error, "!");
    return;
  }
  profile = result?.profile ?? result?.state ?? profile;
  saveProfile();
  run = null;
  clearRunSave();
  closeModal(true);
  citadelTab = "towers";
  screen = "citadel";
  renderCitadel();
  toast("The Forge received your Cinders.", "✦");
}

function chooseRelic(relicId) {
  const result = Engine.chooseRunRelic?.(run, relicId) ?? Engine.chooseRelic?.(run, relicId);
  if (!applyRunActionResult(result)) return;
  const resultInfo = modalState?.waveResult;
  closeModal(true);
  saveRun();
  sound.play("unlock");
  toast(`${getRelic(relicId).name} joined this watch.`, "✦");
  if (resultInfo?.boss || resultInfo?.chapterChanged) showWaveResult(resultInfo.cleared, resultInfo.boss, resultInfo.chapterChanged, resultInfo.goldEarned);
  else {
    paused = false;
    updatePlayChrome(true);
  }
}

function skipRelic(button) {
  let result = null;
  if (Engine.skipRunRelic) result = Engine.skipRunRelic(run);
  else if (Engine.skipRelic) result = Engine.skipRelic(run);
  if (result) applyRunActionResult(result);
  else run.gold += 40;
  const info = modalState?.waveResult ?? {
    cleared: Number(button.dataset.cleared),
    boss: button.dataset.boss === "true",
    chapterChanged: button.dataset.chapterChanged === "true",
    goldEarned: Number(button.dataset.gold),
  };
  closeModal(true);
  saveRun();
  if (info.boss || info.chapterChanged) showWaveResult(info.cleared, info.boss, info.chapterChanged, info.goldEarned + 40);
  else {
    paused = false;
    updatePlayChrome(true);
    toast("40 Gold added to the war chest.", "¤");
  }
}

function handleMapPointer(event) {
  if (!run) return;
  const canvas = event.target;
  const hit = hitTestBattlefield(canvas, run, event.clientX, event.clientY);
  if (!hit) return;
  const type = hit.type ?? hit.kind;
  if (type === "tower") showTowerSheet(hit.id ?? hit.towerId);
  if (type === "pad") placeSelectedTower(hit.id ?? hit.padId, canvas);
}

function addPadEffect(padId, kind) {
  const pad = (run.map.buildPads ?? run.map.pads ?? []).find((candidate) => candidate.id === padId);
  if (pad) visualEffects.push({ kind, x: pad.x, y: pad.y, startedAt: performance.now(), duration: 720 });
}

function animateCardToPad(source, target) {
  if (!source || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const ghost = source.cloneNode(true);
  ghost.className = "card-ghost";
  Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.appendChild(ghost);
  const animation = ghost.animate([
    { transform: "translate3d(0,0,0) rotate(-1deg) scale(1)", opacity: 1 },
    { transform: `translate3d(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top + to.height / 2 - from.top - from.height / 2}px, 0) rotate(3deg) scale(.28)`, opacity: .55 },
  ], { duration: 380, easing: "cubic-bezier(.2,.8,.25,1)" });
  animation.finished.finally(() => ghost.remove());
}

function flash(kind) {
  const element = document.createElement("i");
  element.className = `screen-flash screen-flash--${kind}`;
  gameShell.appendChild(element);
  element.addEventListener("animationend", () => element.remove(), { once: true });
}

function toast(message, mark = "✦") {
  const element = document.createElement("div");
  element.className = "toast";
  element.innerHTML = `<i>${mark}</i><span>${escapeHtml(String(message))}</span>`;
  toastRegion.appendChild(element);
  window.setTimeout(() => element.remove(), 3200);
}

function announce(message) {
  announcer.textContent = "";
  requestAnimationFrame(() => { announcer.textContent = message; });
}

function vibrate(pattern) {
  if (!settings.haptics || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}

function normalizeWavePreview(raw) {
  const fallbackNumber = (run?.waveNumber ?? run?.wavesCleared ?? 0) + (run?.status === "wave" ? 0 : 1);
  if (!raw) return { waveNumber: fallbackNumber, isBoss: fallbackNumber % 10 === 0, composition: [], summary: "The mist hides their shapes" };
  const waveNumber = raw.waveNumber ?? raw.wave ?? raw.number ?? fallbackNumber;
  const sourceValue = raw.composition ?? raw.groups ?? raw.enemies ?? raw.roster ?? (Array.isArray(raw) ? raw : []);
  const source = Array.isArray(sourceValue)
    ? sourceValue
    : Object.entries(sourceValue ?? {}).map(([typeId, count]) => ({ typeId, count }));
  const aggregate = new Map();
  for (const item of source) {
    const id = typeof item === "string" ? item : item.typeId ?? item.enemyId ?? item.id ?? item.type;
    const count = typeof item === "string" ? 1 : item.count ?? item.amount ?? 1;
    if (!id) continue;
    aggregate.set(id, (aggregate.get(id) ?? 0) + count);
  }
  const composition = [...aggregate].map(([id, count]) => ({ id, count, name: getEnemy(id).name ?? titleCase(id) }));
  return { waveNumber, isBoss: raw.isBoss ?? raw.boss ?? waveNumber % 10 === 0, composition, summary: raw.summary ?? raw.label ?? "" };
}

function activeWaveLabel() {
  const remaining = run.mobs?.filter((mob) => mob.hp > 0).length ?? 0;
  const queued = run.activeWave?.remaining ?? run.activeWave?.queue?.length ?? run.activeWave?.spawnQueue?.length ?? 0;
  return `${remaining + queued} ${remaining + queued === 1 ? "creature remains" : "creatures remain"}`;
}

function getPendingRelicChoices() {
  const choices = run?.pendingRelicChoice?.options ?? run?.pendingRelicChoices ?? run?.relicChoices ?? run?.pendingChoice?.options ?? [];
  return Array.isArray(choices) ? choices : [];
}

function getUpcomingWaveNumber() {
  if (!run) return 1;
  return normalizeWavePreview(Engine.getWavePreview(run)).waveNumber;
}

function instructionText() {
  if (!run) return "";
  if (run.status === "wave") return paused ? "The road is paused. Inspect freely." : activeWaveLabel();
  if (selectedTowerType) return `Choose a glowing rune for ${getTower(selectedTowerType).name}.`;
  return "Choose a tower card or inspect a placed tower.";
}

function healthPercent() {
  return Math.max(0, Math.min(100, (run.baseHp / run.maxBaseHp) * 100));
}

function towerRecords() {
  return normalizeRecords(Content.TOWER_ARCHETYPES ?? Content.TOWERS ?? {});
}

function enemyRecords() {
  return normalizeRecords(Content.ENEMY_ARCHETYPES ?? Content.ENEMIES ?? {});
}

function talentRecords() {
  const value = Content.TALENT_TREE ?? Content.TALENTS ?? [];
  if (Array.isArray(value)) return value.flatMap((entry) => entry.nodes ?? entry);
  return Object.entries(value).flatMap(([key, entry]) => {
    if (Array.isArray(entry)) return entry.map((node) => ({ ...node, branch: node.branch ?? key }));
    if (entry?.nodes) return entry.nodes.map((node) => ({ ...node, branch: node.branch ?? key }));
    return [{ id: entry.id ?? key, ...entry }];
  });
}

function relicRecords() {
  return normalizeRecords(Content.RUN_RELICS ?? Content.RELICS ?? {});
}

function normalizeRecords(value) {
  if (Array.isArray(value)) return value.map((entry, index) => ({ id: entry.id ?? String(index), ...entry }));
  return Object.entries(value).map(([id, entry]) => ({ id, ...entry }));
}

function getTower(id) {
  return towerRecords().find((tower) => tower.id === id) ?? { id, name: titleCase(id), cost: 0 };
}

function getEnemy(id) {
  return enemyRecords().find((enemy) => enemy.id === id) ?? { id, name: titleCase(id) };
}

function getRelic(id) {
  return relicRecords().find((relic) => relic.id === id) ?? { id, name: titleCase(id), description: "A lasting advantage for this watch." };
}

function getUnlockedTowerIds(sourceProfile) {
  if (sourceProfile?.unlockedTowerIds) return sourceProfile.unlockedTowerIds;
  if (sourceProfile?.unlockedTowers) return sourceProfile.unlockedTowers;
  if (sourceProfile?.towers) return Object.entries(sourceProfile.towers).filter(([, tower]) => tower?.unlocked).map(([id]) => id);
  return ["ashbolt", "cinder_mortar"];
}

function getCinders(sourceProfile) {
  return sourceProfile?.currencies?.cinders ?? sourceProfile?.cinders ?? sourceProfile?.embers ?? 0;
}

function getSigils(sourceProfile) {
  return sourceProfile?.currencies?.sigils ?? sourceProfile?.sigils ?? sourceProfile?.bossSigils ?? 0;
}

function getMasteryCost(tower, rank) {
  if (Engine.getTowerMasteryCost) return Engine.getTowerMasteryCost(profile, tower.id);
  const costs = tower.masteryCosts ?? tower.masteryCost ?? [];
  return Array.isArray(costs) ? (costs[rank] ?? costs[costs.length - 1] ?? 0) : Number(costs) || 0;
}

function getTalentCost(node, rank) {
  if (Engine.getTalentCost) return Engine.getTalentCost(profile, node.id);
  const costs = node.costs ?? node.cost ?? 1;
  return Array.isArray(costs) ? (costs[rank] ?? costs[costs.length - 1] ?? 1) : costs;
}

function cindersCanAfford(cost) {
  return getCinders(profile) >= cost;
}

function towerColor(id) {
  return { sentinel: "#536153", ashbolt: "#536153", mortar: "#7b4a3c", cinder_mortar: "#7b4a3c", pyre: "#b85e37", brand_brazier: "#b85e37", frost: "#688897", rime_bell: "#688897", arc: "#8b754a", storm_reliquary: "#8b754a" }[id] ?? "#536153";
}

function towerRole(id) {
  return { sentinel: "Single target", ashbolt: "Single target", mortar: "Area damage", cinder_mortar: "Area damage", pyre: "Burn · DOT", brand_brazier: "Burn · DOT", frost: "Slow · control", rime_bell: "Slow · control", arc: "Diminishing chain", storm_reliquary: "Diminishing chain" }[id] ?? "Tower";
}

function towerDescription(id) {
  return {
    sentinel: "Reliable bolts seek the creature nearest the Ward.",
    ashbolt: "Reliable bolts seek the creature nearest the Ward.",
    mortar: "Slow shells bloom across dense groups.",
    cinder_mortar: "Slow shells bloom across dense groups.",
    pyre: "Ignites targets and lets damage linger.",
    brand_brazier: "Ignites targets and lets damage linger.",
    frost: "Rings a glass-cold note that slows the road.",
    rime_bell: "Rings a glass-cold note that slows the road.",
    arc: "Leaps through several enemies, losing force each time.",
    storm_reliquary: "Leaps through several enemies, losing force each time.",
  }[id] ?? "A tower card for the living road.";
}

function towerSound(id) {
  return { sentinel: "arrow", ashbolt: "arrow", mortar: "mortar", cinder_mortar: "mortar", pyre: "fire", brand_brazier: "fire", frost: "frost", rime_bell: "frost", arc: "arc", storm_reliquary: "arc" }[id] ?? "hit";
}

function towerSpecialStat(id, stats) {
  if (["mortar", "cinder_mortar"].includes(id)) return `Ø ${formatStat(stats.splashRadius ?? stats.aoeRadius ?? stats.radius ?? "—")}`;
  if (["pyre", "brand_brazier"].includes(id)) return `${formatStat(stats.dotDamage ?? stats.dotDps ?? stats.burnDamage ?? "—")} burn`;
  if (["frost", "rime_bell"].includes(id)) return `${Math.round((1 - (stats.slowMultiplier ?? 1)) * 100)}% slow`;
  if (["arc", "storm_reliquary"].includes(id)) return `${stats.chainCount ?? stats.chainTargets ?? stats.chains ?? 4} jumps`;
  return "First";
}

function talentIcon(id) {
  if (/health|foundation|mend|ember/i.test(id)) return "heart";
  if (/gold|chest|tithe|reclaim/i.test(id)) return "coin";
  if (/speed|quick|rate/i.test(id)) return "clock";
  if (/range|sight/i.test(id)) return "focus";
  return "sword";
}

function formatRate(stats) {
  const seconds = stats.attackInterval ?? stats.interval ?? (stats.attackRate ? 1 / stats.attackRate : null);
  return seconds ? `${Number(seconds).toFixed(seconds < 1 ? 2 : 1)}s` : "—";
}

function formatStat(value) {
  return typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : String(value ?? "—");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", { notation: Math.abs(Number(value)) >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function titleCase(value) {
  return String(value ?? "").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && element.textContent !== String(value)) element.textContent = value;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "modal-backdrop" && event.target === button && modalState?.dismissable) closeModal();
  if (action === "close-modal") closeModal();
  if (action === "go-title") { screen = "title"; renderTitle(); }
  if (action === "enter-citadel") { screen = "citadel"; renderCitadel(); }
  if (action === "resume-run") { screen = "play"; paused = run?.status !== "wave" ? false : paused; renderPlay(); }
  if (action === "start-run") startNewRun();
  if (action === "open-rules") showRules();
  if (action === "open-settings") showSettings();
  if (action === "toggle-sound") { sound.setEnabled(!sound.enabled); if (screen === "title") renderTitle(); }
  if (action === "select-citadel-tab") { citadelTab = button.dataset.tab; renderCitadel(); }
  if (action === "unlock-tower") applyProfileAction(Engine.purchaseTowerUnlock(profile, button.dataset.towerId));
  if (action === "master-tower") applyProfileAction(Engine.purchaseTowerMastery(profile, button.dataset.towerId));
  if (action === "buy-talent") applyProfileAction(Engine.purchaseTalent(profile, button.dataset.talentId));
  if (action === "start-wave") startNextWave();
  if (action === "select-tower") selectTowerCard(button.dataset.towerId);
  if (action === "map-pad") placeSelectedTower(button.dataset.padId, button);
  if (action === "map-tower") showTowerSheet(button.dataset.towerId);
  if (action === "toggle-pause") { paused = !paused; sound.play("paper"); renderPlay(); }
  if (action === "set-speed") { simulationSpeed = Number(button.dataset.speed); paused = false; renderPlay(); }
  if (action === "upgrade-tower") upgradeTower(button.dataset.towerId);
  if (action === "sell-tower") sellTower(button.dataset.towerId);
  if (action === "continue-building") { closeModal(true); paused = false; selectedTowerId = null; updatePlayChrome(true); }
  if (action === "claim-defeat") claimDefeat();
  if (action === "choose-relic") chooseRelic(button.dataset.relicId);
  if (action === "skip-relic") skipRelic(button);
  if (action === "return-title") { closeModal(true); screen = "title"; renderTitle(); }
  if (action === "toggle-setting") {
    const restorePaused = modalState?.restorePaused ?? paused;
    const key = button.dataset.setting;
    if (key === "sound") sound.setEnabled(!sound.enabled);
    else settings[key] = !settings[key];
    saveSettings();
    showSettings(restorePaused);
  }
  if (action === "confirm-reset") {
    const restorePaused = modalState?.restorePaused ?? paused;
    openModal(`<div class="result-modal"><p class="eyebrow">Permanent action</p><h2>Extinguish every save?</h2><p>This removes tower unlocks, talents, currencies, records, and the active watch from this device.</p><div class="modal-actions modal-actions--row"><button class="secondary-button" type="button" data-action="close-modal">Keep progress</button><button class="primary-button" type="button" data-action="reset-progress">Reset everything</button></div></div>`, { restorePaused, onClose: () => { paused = restorePaused; } });
  }
  if (action === "reset-progress") {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(RUN_KEY);
    localStorage.removeItem(TUTORIAL_KEY);
    profile = Engine.createProfile();
    run = null;
    closeModal(true);
    screen = "title";
    renderTitle();
    toast("A new flame can begin.", "✦");
  }
});

document.addEventListener("pointerdown", (event) => {
  if (event.target?.id === "battleCanvas") handleMapPointer(event);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (modalState?.dismissable) closeModal();
    else if (selectedTowerType) { selectedTowerType = null; updatePlayChrome(true); }
  }
  if (modalState && event.key === "Tab") trapModalFocus(event);
  if (screen !== "play" || modalState) return;
  if (event.key.toLowerCase() === "p") { paused = !paused; renderPlay(); }
  if (event.code === "Space" && run?.status === "build") { event.preventDefault(); startNextWave(); }
  const number = Number(event.key);
  const ids = run?.unlockedTowerIds ?? [];
  if (number >= 1 && number <= ids.length) selectTowerCard(ids[number - 1]);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && run?.status === "wave") {
    paused = true;
    announce("Battle paused because the game left the foreground.");
  }
});

function trapModalFocus(event) {
  const focusable = [...modalLayer.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
