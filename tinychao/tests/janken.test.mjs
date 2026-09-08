import test from 'node:test';
import assert from 'node:assert/strict';
import { TinyGarden } from '../game.js';

const context = new Proxy({}, { get: (target, key) => target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
globalThis.document = { createElement: () => ({ width: 240, height: 160, setAttribute() {}, getContext: () => context }) };
globalThis.localStorage = { getItem: () => null, setItem() {} };
function garden() { const game = new TinyGarden(); game.startJanken(); return game; }
function advance(game, seconds) { for (let t = 0; t < seconds - .00001; t += .01) game.update(Math.min(.01, seconds - t)); }
function card(hand, x, y = 72) { return { hand, x, y, position: 0, hit: false }; }
function freezeTargets(game, cards) { game.janken.cards = cards; game.positionJankenCards = () => {}; }

test('each selected card leaves its own left, middle or right slot with its hand artwork', () => {
  for (let slot = 0; slot < 3; slot++) {
    const game = garden(), g = game.janken; g.hands = [2, 0, 1]; g.hand = slot;
    const hand = g.hands[slot]; game.input('a');
    assert.equal(g.shots.length, 1); assert.equal(g.shots[0].x, 14 + slot * 66); assert.equal(g.shots[0].y, 124); assert.equal(g.shots[0].hand, hand);
    assert.equal(g.hands[slot], null); assert.equal(g.rings, 0); assert.equal(g.lives, 5); assert.ok(g.cards.every(c => !c.hit));
    const rendered = []; game.hand = (...args) => rendered.push(args); game.drawJanken();
    assert.ok(rendered.some(([h, x, y, size, selected, yellow]) => h === hand && x === 14 + slot * 66 && y === 124 && yellow));
    game.update(.05); assert.ok(g.shots[0].y < 124); assert.equal(g.shots[0].x, 14 + slot * 66);
    game.shoot(); assert.equal(g.shots.length, 1, 'cannot fire an empty slot again');
  }
});

test('touch selection uses the same three slot centers as the visible card layout', () => {
  const game = garden();
  for (let slot = 0; slot < 3; slot++) { game.touch(26 + slot * 66, 136); assert.equal(game.janken.hand, slot); }
  game.touch(158, 136); game.input('a'); assert.equal(game.janken.shots[0].x, 146);
});

test('a launched card scores only when its visible flight reaches a target in its own lane', () => {
  for (let slot = 0; slot < 3; slot++) {
    const game = garden(), g = game.janken; const target = card(0, 14 + slot * 66);
    freezeTargets(game, [target, card(0, 300)]); g.hand = slot; g.hands[slot] = 1;
    game.shoot(); advance(game, .08); assert.equal(target.hit, false); assert.equal(g.rings, 0); assert.equal(g.hands[slot], null);
    advance(game, .15); assert.equal(target.hit, true); assert.equal(g.rings, 1); assert.equal(g.lives, 5); assert.equal(typeof g.hands[slot], 'number'); assert.equal(g.shots.length, 0);
  }
});

test('collision follows the moving target at arrival, not its location at launch time', () => {
  const game = garden(), g = game.janken, target = card(0, 14);
  g.cards = [target, card(0, 300)]; g.hands[0] = 1;
  game.positionJankenCards = () => { target.x += 2; };
  game.shoot(); assert.equal(g.lives, 5); advance(game, .3);
  assert.equal(target.hit, false); assert.equal(g.rings, 0); assert.equal(g.lives, 5, 'miss has not left the screen yet');
  advance(game, .5); assert.equal(g.lives, 4); assert.equal(g.shots.length, 0); assert.equal(typeof g.hands[0], 'number');
});

test('ties clear targets for free; losses keep the target and visibly deflect the fired card', () => {
  const game = garden(), g = game.janken, target = card(2, 80);
  freezeTargets(game, [target, card(0, 300)]); g.hand = 1; g.hands = [0, 2, 1]; game.shoot(); advance(game, .2);
  assert.equal(target.hit, true); assert.equal(g.rings, 0); assert.equal(g.lives, 5); assert.equal(g.hands[0], 0); assert.equal(g.hands[2], 1);
  target.hit = false; target.hand = 1; g.hands[1] = 0; game.shoot(); advance(game, .2);
  assert.equal(target.hit, false); assert.equal(g.rings, 0); assert.equal(g.lives, 4); assert.equal(g.shots[0].state, 'deflected'); assert.equal(g.shots[0].hand, 0);
  assert.equal(typeof g.hands[1], 'number'); const x = g.shots[0].x; advance(game, .1); assert.notEqual(g.shots[0].x, x);
  advance(game, .7); assert.equal(g.shots.length, 0); assert.equal(g.lives, 4, 'a deflection spends one replacement only');
});

test('shots in different slots keep their own hand and refill their originating slot', () => {
  const game = garden(), g = game.janken;
  freezeTargets(game, [card(0, 14), card(1, 146), card(0, 300)]); g.hands = [1, 0, 2];
  game.shoot(); g.hand = 2; g.cooldown = 0; game.shoot();
  assert.deepEqual(g.shots.map(s => [s.slot, s.hand, s.x]), [[0, 1, 14], [2, 2, 146]]);
  assert.deepEqual(g.hands, [null, 0, null]); advance(game, .2);
  assert.equal(g.rings, 2); assert.equal(g.hands[1], 0); assert.equal(typeof g.hands[0], 'number'); assert.equal(typeof g.hands[2], 'number');
});

test('clearing the final card adds one new wave and ten seconds at impact', () => {
  const game = garden(), g = game.janken;
  freezeTargets(game, [card(0, 14)]); g.hands[0] = 1; game.shoot();
  assert.equal(g.wave, 0); assert.equal(g.remaining, 30); advance(game, .2);
  assert.equal(g.wave, 1); assert.equal(g.cards.length, 10); assert.ok(Math.abs(g.remaining - 39.8) < .0001); assert.equal(g.rings, 1);
});

test('timeout and pause stop in-flight card collisions', () => {
  const game = garden(), g = game.janken;
  freezeTargets(game, [card(0, 14), card(0, 300)]); g.hands[0] = 1; game.shoot(); game.input('start');
  advance(game, .5); assert.equal(g.shots[0].y, 124); assert.equal(g.remaining, 30); assert.equal(g.rings, 0);
  game.input('a'); g.remaining = .01; game.update(.02); assert.equal(game.mode, 'result'); assert.equal(g.rings, 0); assert.equal(game.result.earned, 0);
});
