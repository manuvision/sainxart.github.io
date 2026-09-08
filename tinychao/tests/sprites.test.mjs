import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAO_ANIMATIONS, CHAO_PALETTES, getChaoSprite, walkDirection } from '../sprites.js';

test('Chao walking faces its motion in all four directions', () => {
  for (const [dx, dy, direction, row, flip] of [[-10, 1, 'left', 34, false], [10, 1, 'right', 34, true], [1, -10, 'up', 59, false], [1, 10, 'down', 9, false]]) {
    const actualDirection = walkDirection(dx, dy);
    assert.equal(actualDirection, direction);
    const sprite = getChaoSprite('walk', 0, { direction: actualDirection });
    assert.equal(sprite.y, row);
    assert.equal(sprite.flipX, flip);
  }
  assert.equal(getChaoSprite('walk', 0, { facing: -1 }).flipX, false);
  assert.equal(getChaoSprite('walk', 0, { facing: 1 }).flipX, true);
  assert.equal(walkDirection(0, 0, 'left'), 'left');
});

test('petting uses the smiling original frames regardless of previous walking direction', () => {
  for (const facing of [-1, 1]) for (const t of [0, .34, .67]) {
    const sprite = getChaoSprite('happy', t, { facing });
    assert.equal(sprite.y, 115);
    assert.ok([79, 104, 129].includes(sprite.x));
    assert.equal(sprite.flipX, false);
  }
  assert.deepEqual(getChaoSprite('pet', .5), getChaoSprite('happy', .5));
});

test('every original jewel palette retains complete bounded animation cells', () => {
  assert.equal(Object.keys(CHAO_PALETTES).length, 12);
  assert.deepEqual(CHAO_PALETTES.silver, { x: 296, y: 200 });
  for (const color of Object.keys(CHAO_PALETTES)) for (const kind of Object.keys(CHAO_ANIMATIONS)) for (let t = 0; t < 1; t += .15) {
    const sprite = getChaoSprite(kind, t, { color });
    assert.ok(sprite.x >= 0 && sprite.y >= 0 && sprite.x + sprite.w <= 882 && sprite.y + sprite.h <= 1018, `${color}: ${kind}`);
    assert.equal(sprite.w, 24); assert.equal(sprite.h, 24);
  }
  assert.deepEqual(getChaoSprite('unknown', 0, { color: 'unknown' }), getChaoSprite('idle'));
});
