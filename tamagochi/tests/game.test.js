import test from 'node:test';
import assert from 'node:assert/strict';
import { PetGame, SAVE_KEY } from '../game.js';
import { PocketAudio } from '../audio.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

function fixture(storage = new MemoryStorage(), initialTime = 1_800_000_000_000) {
  let time = initialTime;
  const sounds = [];
  const now = () => time;
  const game = new PetGame({ storage, now, onSound: sound => sounds.push(sound) });
  return {
    game, storage, sounds, now,
    advance(ms, step = ms) {
      const end = time + ms;
      while (time < end) { time = Math.min(end, time + step); game.tick(time); }
      return game.getSnapshot();
    },
    hatch() { game.press('b'); this.advance(10_000); return game.getSnapshot(); },
    reload() { return new PetGame({ storage, now }); },
  };
}

function choose(game, id) {
  if (game.getSnapshot().mode === 'home') game.press('a');
  for (let i = 0; i < 6; i++) {
    const s = game.getSnapshot();
    if (s.menu.items[s.menu.selected].id === id) { game.press('b'); return; }
    game.press('a');
  }
  assert.fail(`Menu choice ${id} was not available`);
}

test('a fresh egg hatches once after ten seconds and restores the same pet', () => {
  const f = fixture();
  assert.equal(f.game.getSnapshot().stage, 'egg');
  f.game.press('b');
  assert.equal(f.game.getSnapshot().mode, 'hatching');
  f.advance(5000);
  assert.equal(f.game.getSnapshot().hatch.progress, 0.5);
  const halfway = f.reload();
  assert.equal(halfway.getSnapshot().mode, 'hatching');
  f.advance(5000);
  assert.equal(f.game.getSnapshot().stage, 'baby');
  assert.equal(f.game.getSnapshot().mode, 'home');
  assert.equal(f.sounds.filter(s => s === 'hatch').length, 1);
  assert.equal(f.reload().getSnapshot().stage, 'baby');
  assert.match(f.game.getSnapshot().summary, /MOMO, baby/);
});

test('three physical buttons navigate food, care, stats and return home', () => {
  const f = fixture();
  f.hatch();
  const before = f.game.getSnapshot().pet.hunger;
  choose(f.game, 'food');
  assert.equal(f.game.getSnapshot().mode, 'food');
  choose(f.game, 'meal');
  assert.ok(f.game.getSnapshot().pet.hunger > before);
  assert.equal(f.game.getSnapshot().mode, 'home');
  f.game.press('c');
  assert.equal(f.game.getSnapshot().mode, 'stats');
  f.game.press('b');
  assert.equal(f.game.getSnapshot().mode, 'home');
  choose(f.game, 'food');
  choose(f.game, 'snack');
  assert.equal(f.game.getSnapshot().coins, 3);
  assert.equal(f.reload().getSnapshot().coins, 3);
  assert.equal(f.game.getSnapshot().saveAvailable, true);
});

test('care needs decay, bath removes waste, medicine restores health and sleep restores energy', () => {
  const f = fixture();
  f.hatch();
  f.advance(100 * 60_000);
  const neglected = f.game.getSnapshot();
  assert.ok(neglected.poop > 0);
  assert.ok(neglected.pet.cleanliness < 100);
  choose(f.game, 'clean');
  assert.equal(f.game.getSnapshot().poop, 0);
  assert.equal(f.game.getSnapshot().pet.cleanliness, 100);
  choose(f.game, 'medicine');
  assert.equal(f.game.getSnapshot().pet.health, 100);
  const energy = f.game.getSnapshot().pet.energy;
  choose(f.game, 'sleep');
  assert.equal(f.game.getSnapshot().pet.sleeping, true);
  f.advance(5 * 60_000);
  assert.ok(f.game.getSnapshot().pet.energy > energy);
  choose(f.game, 'food');
  assert.equal(f.game.getSnapshot().mode, 'menu');
  assert.equal(f.game.getSnapshot().message.text, 'LIGHTS ON TO PLAY');
  choose(f.game, 'sleep');
  assert.equal(f.game.getSnapshot().pet.sleeping, false);
});

test('growth reaches child and adult, offline care is capped and pets never die', () => {
  const f = fixture();
  f.hatch();
  f.advance(6 * 60_000);
  assert.equal(f.game.getSnapshot().stage, 'child');
  f.advance(18 * 60_000);
  assert.equal(f.game.getSnapshot().stage, 'adult');
  const at = f.now();
  const later = new PetGame({ storage: f.storage, now: () => at + 90 * 24 * 60 * 60_000 });
  assert.equal(later.getSnapshot().stage, 'adult');
  assert.equal(later.getSnapshot().pet.ageMs, (24 + 240) * 60_000);
  assert.ok(later.getSnapshot().pet.health >= 15);
  assert.ok(later.getSnapshot().pet.energy >= 0);
  choose(later, 'food');
  choose(later, 'meal');
  assert.ok(later.getSnapshot().pet.hunger > 0);
});

test('corrupted, oversized and unavailable storage cannot break the game', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, 'not json');
  assert.equal(fixture(storage).game.getSnapshot().stage, 'egg');
  storage.setItem(SAVE_KEY, 'x'.repeat(100_001));
  assert.equal(fixture(storage).game.getSnapshot().stage, 'egg');
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, pet: { hatched: true, hunger: 5000, energy: -900, health: 'broken' }, coins: -2, highScores: { catch: 'oops' }, mode: 'unknown' }));
  const s = fixture(storage).game.getSnapshot();
  assert.equal(s.pet.hunger, 100);
  assert.equal(s.pet.energy, 0);
  assert.equal(s.pet.health, 100);
  assert.equal(s.coins, 0);
  assert.equal(s.mode, 'home');
  const unavailable = { getItem() { throw Error('disabled'); }, setItem() { throw Error('full'); } };
  const f = fixture(unavailable);
  assert.equal(f.hatch().stage, 'baby');
  assert.equal(f.game.getSnapshot().saveAvailable, false);
  assert.equal(fixture(null).game.getSnapshot().saveAvailable, false);
});

test('catch supports real lane collisions, rewards, highscores and session restoration', () => {
  const f = fixture();
  f.hatch();
  choose(f.game, 'games');
  choose(f.game, 'catch');
  assert.equal(f.game.getSnapshot().catch.active, false);
  f.game.press('b');
  f.game.press('a');
  assert.equal(f.game.getSnapshot().catch.lane, 0);
  f.game.press('b');
  assert.equal(f.game.getSnapshot().catch.lane, 1, 'B returns the basket to the middle');
  f.game.press('c');
  assert.equal(f.game.getSnapshot().catch.lane, 2);
  f.game.press('b');
  assert.equal(f.game.getSnapshot().catch.lane, 1);
  f.advance(500, 100);
  assert.equal(f.reload().getSnapshot().mode, 'catch');
  assert.equal(f.reload().getSnapshot().catch.active, true);
  for (let i = 0; i < 400 && f.game.getSnapshot().catch.active; i++) {
    let s = f.game.getSnapshot().catch;
    const next = [...s.objects].sort((a, b) => b.y - a.y)[0];
    if (next) {
      const target = next.kind === 'food' ? next.lane : (next.lane + 1) % 3;
      while (s.lane !== target) {
        f.game.press(s.lane < target ? 'c' : 'a');
        s = f.game.getSnapshot().catch;
      }
    }
    f.advance(100);
  }
  const result = f.game.getSnapshot();
  assert.equal(result.catch.complete, true);
  assert.ok(result.catch.score > 0);
  assert.ok(result.coins > 5);
  assert.equal(result.highScores.catch, result.catch.score);
  assert.equal(f.reload().getSnapshot().highScores.catch, result.catch.score);
  const earned = result.coins;
  f.advance(3000, 100);
  assert.equal(f.game.getSnapshot().coins, earned, 'finished games cannot pay twice');
  f.game.press('c');
  assert.equal(f.game.getSnapshot().mode, 'gameSelect');
});

test('memory accepts the shown sequence, advances rounds and saves earned coins', () => {
  const f = fixture();
  f.hatch();
  choose(f.game, 'games');
  choose(f.game, 'memory');
  f.game.press('b');
  f.advance(1500, 100);
  let s = f.game.getSnapshot().memory;
  assert.equal(s.phase, 'input');
  f.game.press(['a', 'b', 'c'][s.sequence[0]]);
  assert.equal(f.game.getSnapshot().memory.score, 1);
  f.advance(3500, 100);
  s = f.game.getSnapshot().memory;
  assert.equal(s.sequence.length, 2);
  assert.equal(s.phase, 'input');
  const restored = f.reload();
  assert.deepEqual(restored.getSnapshot().memory.sequence, s.sequence);
  f.game.press(['a', 'b', 'c'][(s.sequence[0] + 1) % 3]);
  assert.equal(f.game.getSnapshot().memory.complete, true);
  assert.equal(f.game.getSnapshot().highScores.memory, 1);
  assert.equal(f.game.getSnapshot().coins, 6);
  assert.equal(f.reload().getSnapshot().highScores.memory, 1);
});

test('backgrounding pauses active game action and cannot cost catch lives', () => {
  const f = fixture();
  f.hatch();
  choose(f.game, 'games');
  choose(f.game, 'catch');
  f.game.press('b');
  f.advance(1000, 100);
  const before = f.game.getSnapshot().catch;
  f.advance(10 * 60_000);
  const after = f.game.getSnapshot().catch;
  assert.equal(after.elapsed, before.elapsed);
  assert.deepEqual(after.objects, before.objects);
  assert.equal(after.lives, before.lives);
});

test('explicit exit allows quitting a game and rewards earned progress exactly once', () => {
  const f = fixture();
  f.hatch();
  choose(f.game, 'games');
  choose(f.game, 'memory');
  f.game.press('b');
  f.advance(1500, 100);
  const shown = f.game.getSnapshot().memory.sequence[0];
  f.game.press(['a', 'b', 'c'][shown]);
  f.game.back();
  assert.equal(f.game.getSnapshot().mode, 'gameSelect');
  assert.equal(f.game.getSnapshot().coins, 6);
  assert.equal(f.reload().getSnapshot().highScores.memory, 1);
  f.game.exitGame();
  assert.equal(f.game.getSnapshot().coins, 6);
  choose(f.game, 'catch');
  f.game.press('b');
  f.game.exitGame();
  assert.equal(f.game.getSnapshot().mode, 'gameSelect');
  assert.equal(f.game.getSnapshot().coins, 6);
});

test('public back never triggers a gameplay C action and follows the menu hierarchy', () => {
  const f = fixture();
  f.hatch();
  f.game.back();
  assert.equal(f.game.getSnapshot().mode, 'home');
  choose(f.game, 'games');
  choose(f.game, 'catch');
  f.game.press('b');
  f.game.back();
  assert.equal(f.game.getSnapshot().mode, 'gameSelect');
  assert.match(f.game.getSnapshot().summary, /Selected: FOOD CATCH/);
  f.game.back();
  assert.equal(f.game.getSnapshot().mode, 'menu');
  f.game.back();
  assert.equal(f.game.getSnapshot().mode, 'home');
});

test('returned snapshots are detached and reset creates a durable fresh egg', () => {
  const f = fixture();
  f.hatch();
  const snapshot = f.game.getSnapshot();
  snapshot.pet.hunger = -900;
  snapshot.menu.items[0].label = 'bad';
  assert.ok(f.game.getSnapshot().pet.hunger > 0);
  assert.equal(f.game.getSnapshot().menu.items[0].label, 'FOOD');
  f.game.reset();
  assert.equal(f.reload().getSnapshot().stage, 'egg');
  assert.equal(f.reload().getSnapshot().coins, 5);
});

test('audio is optional and safe when Web Audio is unavailable', async () => {
  const audio = new PocketAudio();
  assert.equal(await audio.unlock(), false);
  audio.play('hatch');
  audio.setMuted(true);
  audio.play('tone0');
  assert.equal(audio.muted, true);
});
