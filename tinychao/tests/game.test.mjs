import test from 'node:test';
import assert from 'node:assert/strict';
import { TinyGarden, freshState, restoreState, SAVE_KEY, FRUITS } from '../game.js';

const memory = new Map();
const context = new Proxy({}, { get: (target, key) => target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
globalThis.document = { createElement: () => ({ width: 240, height: 160, setAttribute() {}, getContext: () => context }) };
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v) };
function garden() { memory.clear(); return new TinyGarden(); }
function advance(game, seconds) { for (let i = 0; i < Math.ceil(seconds / .1); i++) game.update(.1); }
function hatch(game) { for (let i = 0; i < 12; i++) game.input('a'); advance(game, 1.7); assert.equal(game.state.hatched, true); }

test('egg hatching, feeding, stat progress, saving and reloading form a complete care loop', () => {
  const game = garden(); assert.equal(game.state.hatched, false); hatch(game);
  assert.equal(game.state.totalHatches, 1); const before = game.state.mood; game.input('a'); assert.ok(game.state.mood >= before);
  game.state.belly = 20; game.input('l'); assert.equal(game.mode, 'shop'); game.input('a'); game.input('a'); game.input('l'); game.input('r'); game.input('a'); assert.equal(game.heldItem, 'orange'); game.touch(game.state.x, game.state.y-8);
  assert.equal(game.mode, 'garden'); assert.equal(game.state.inventory.orange, 1); assert.equal(game.state.belly, 45);
  assert.equal(game.state.stats.swim.xp, 30); assert.equal(game.state.stats.power.xp, 30); assert.equal(game.state.totalFeeds, 1);
  game.save(); const restored = new TinyGarden(); assert.equal(restored.state.hatched, true); assert.equal(restored.state.totalFeeds, 1); assert.equal(restored.state.inventory.orange, 1);
});

test('market enforces rings and an eight-fruit bag without charging failed purchases', () => {
  const game = garden(); game.state.rings = 500; game.state.inventory.orange = 7;
  assert.equal(game.buy(0), true); assert.equal(game.state.rings, 470); assert.equal(game.state.inventory.orange, 8);
  assert.equal(game.buy(0), false); assert.equal(game.state.rings, 470);
  game.state.inventory.orange = 0; game.state.rings = 1; assert.equal(game.buy(1), false); assert.equal(game.state.inventory.blue, 0);
  game.state.rings = 1000; assert.equal(game.buy(FRUITS.length), true); assert.deepEqual(game.state.toys, ['trumpet']); assert.equal(game.state.rings, 0);
});

test('memory has seven pairs on thirty spaces, moves cards, pays a perfect board once', () => {
  const game = garden(); const rings = game.state.rings; game.startMemory();
  assert.equal(game.memory.cards.filter(v => v !== null).length, 14); game.flipCard(game.memory.cursor); assert.equal(game.memory.open.length, 0);
  advance(game, 5.2); assert.equal(game.memory.shuffles, 0);
  const cards = [...game.memory.cards]; let expected = 60;
  for (let i = 0; i < cards.length; i++) if (cards[i] !== null) expected += [1,3,5][Math.min(i % 6, 5-i%6, Math.floor(i/6), 4-Math.floor(i/6))];
  for (let fruit = 0; fruit < 7; fruit++) { const indices = cards.map((v,i) => v === fruit ? i : -1).filter(i => i >= 0); game.flipCard(indices[0]); game.flipCard(indices[1]); }
  assert.equal(game.mode, 'result'); assert.equal(game.result.perfect, true); assert.equal(game.result.pairs, 7); assert.equal(game.result.earned, expected); assert.equal(game.state.rings, rings + expected);
  game.finishGame('memory'); assert.equal(game.state.rings, rings + expected);
});

test('memory ends at three mistakes and preserves rings already earned', () => {
  const game = garden(); game.startMemory(); advance(game, 5.2);
  const one = game.memory.cards.findIndex(v => v === 0), two = game.memory.cards.findIndex(v => v === 1);
  for (let i = 0; i < 3; i++) { game.flipCard(one); game.flipCard(two); advance(game, 1); }
  assert.equal(game.mode, 'result'); assert.equal(game.result.mistakes, 3); assert.equal(game.result.earned, 0);
});

test('janken implements winning, tied, losing and missed shots with original ring rewards', () => {
  const game = garden(); game.startJanken(); const g = game.janken;
  function shoot(hand, target) { g.cooldown = 0; g.hands[g.hand] = hand; g.cards = [{ x: 95, y: 50, hand: target, hit: false, position: 200 }, { x: 12, y: 20, hand: 0, hit: false, position: 0 }]; game.shoot(); }
  shoot(1, 0); assert.equal(g.rings, 1); assert.equal(g.lives, 5); assert.equal(g.cards[0].hit, true);
  shoot(2, 2); assert.equal(g.rings, 1); assert.equal(g.lives, 5); assert.equal(g.cards[0].hit, true);
  shoot(0, 1); assert.equal(g.rings, 1); assert.equal(g.lives, 4); assert.equal(g.cards[0].hit, false);
  g.cooldown = 0; g.cards = [{ x: 12, y: 20, hand: 0, hit: false }]; game.shoot(); assert.equal(g.lives, 3);
});

test('minigame pause freezes the timer and exiting keeps earned rings', () => {
  const game = garden(); game.startJanken(); game.janken.rings = 7; const before = game.state.rings;
  game.input('start'); assert.equal(game.mode, 'pause'); advance(game, 2); assert.equal(game.janken.remaining, 30);
  game.input('down'); game.input('a'); assert.equal(game.mode, 'result'); assert.equal(game.state.rings, before + 7);
  game.input('down'); game.input('a'); assert.equal(game.mode, 'garden');
});

test('save import rejects unrelated files, sanitizes values and keeps long absences kind', () => {
  const game = garden(); assert.throws(() => game.importSave({ hello: 'world' }), /not a Tiny/);
  const data = freshState(); data.name = '<BAD>NAME!'; data.rings = 9e9; data.mood = 70; data.belly = 60; data.lastSaved = Date.now() - 86400000;
  game.importSave(data); assert.equal(game.state.name, 'BADNAME'); assert.equal(game.state.rings, 99999); assert.equal(game.state.belly, 60); assert.equal(game.state.mood, 70);
  assert.equal(game.state.energy, 100); const exported = game.exportSave(); assert.equal(exported.version, 3); assert.notEqual(exported, game.state);
  assert.ok(memory.get(SAVE_KEY)); assert.equal(restoreState(null).hatched, false);
});

test('full original fruit stat effects never make progress negative', () => {
  const game = garden(); hatch(game); game.state.inventory.red = 1; game.state.stats.stamina.xp = 20;
  game.feed('red'); assert.equal(game.state.stats.stamina.xp, 0); assert.equal(game.state.stats.run.xp, 30);
});

test('a saved cracking egg resumes hatching once after reload', () => {
  const game = garden(); for (let i = 0; i < 12; i++) game.input('a');
  assert.equal(game.state.hatched, false); assert.equal(game.state.eggProgress, 12);
  const restored = new TinyGarden(); advance(restored, 2); assert.equal(restored.state.hatched, true); assert.equal(restored.state.totalHatches, 1);
  restored.save(); const again = new TinyGarden(); advance(again, 2); assert.equal(again.state.totalHatches, 1);
});

test('corrupt local storage starts a clean garden and storage denial is reported', () => {
  memory.set(SAVE_KEY, '{oops'); const game = new TinyGarden(); assert.equal(game.state.hatched, false); assert.equal(game.state.rings, 120);
  const storage = globalThis.localStorage; globalThis.localStorage = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Denied'); } };
  const denied = new TinyGarden(); assert.equal(denied.storageError, true); denied.save(); assert.equal(denied.storageError, true);
  globalThis.localStorage = storage; denied.save(); assert.equal(denied.storageError, false);
});

test('garden toys cannot act on an unhatched egg', () => {
  const game = garden(); game.state.toys = ['trumpet', 'duck', 'tv']; game.touch(42, 126);
  assert.equal(game.state.hatched, false); assert.equal(game.state.x, 88); assert.equal(game.state.y, 105); assert.equal(game.state.stats.swim.xp, 0);
});

test('quitting a memory game claims earned rings once and result navigation cannot claim again', () => {
  const game = garden(); game.startMemory(); advance(game, 5.2); const cards = game.memory.cards;
  const pair = cards.map((v,i) => v === 0 ? i : -1).filter(i => i >= 0); game.flipCard(pair[0]); game.flipCard(pair[1]);
  const reward = game.memory.rings, before = game.state.rings; game.input('b'); game.input('down'); game.input('a');
  assert.equal(game.state.rings, before + reward); game.input('start'); game.input('b'); assert.equal(game.mode, 'garden'); assert.equal(game.state.rings, before + reward);
});

test('native name UI has working ASCII keys, caret arrows, OK and cancel', () => {
  const game = garden(); game.enter('rename'); for(let i=0;i<4;i++)game.input('b');
  game.touch(20,35); game.touch(36,35); assert.equal(game.nameDraft,'AB');
  game.touch(171,86); game.touch(52,35); assert.equal(game.nameDraft,'ACB');
  game.touch(193,103); assert.equal(game.mode,'garden');assert.equal(game.state.name,'ACB');
  game.enter('rename');game.chooseName(25);game.touch(195,118);assert.equal(game.mode,'garden');assert.equal(game.state.name,'ACB');
});

test('native top-left memory cell is not intercepted by a back-header hit area', () => {
  const game=garden();game.startMemory();advance(game,5.2);game.memory.cards[0]=0;game.touch(16,16);
  assert.equal(game.mode,'memory');assert.deepEqual(game.memory.open,[0]);
});

test('START follows the native DONE label and empty-name deletion stays in the editor',()=>{const game=garden();game.enter('rename');for(let i=0;i<5;i++)game.input('b');assert.equal(game.mode,'rename');game.chooseName(12);game.input('start');assert.equal(game.mode,'garden');assert.equal(game.state.name,'M');assert.equal(JSON.parse(memory.get(SAVE_KEY)).name,'M');});
