import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SETTINGS,
  RESURRECT_64,
  createArtwork,
  createSeededRandom,
  makeDailySeed,
  makePngFilename,
  normalizeSettings,
} from '../generator.js';

test('uses the requested defaults', () => {
  assert.deepEqual(DEFAULT_SETTINGS, {
    colors: 4,
    pixelSize: 36,
    blackRatio: 50,
    spriteWidth: 8,
    spriteHeight: 8,
    imageWidth: 512,
    imageHeight: 512,
  });
});

test('normalizes invalid settings and snaps them to supported steps', () => {
  const settings = normalizeSettings({
    colors: 99,
    pixelSize: -10,
    blackRatio: 53,
    imageWidth: 541,
    imageHeight: 'not-a-number',
  });

  assert.equal(settings.colors, 8);
  assert.equal(settings.pixelSize, 2);
  assert.equal(settings.blackRatio, 55);
  assert.equal(settings.imageWidth, 512);
  assert.equal(settings.imageHeight, DEFAULT_SETTINGS.imageHeight);
});

test('allows pixel sizes up to 36 px', () => {
  assert.equal(normalizeSettings({ pixelSize: 24 }).pixelSize, 24);
  assert.equal(normalizeSettings({ pixelSize: 36 }).pixelSize, 36);
  assert.equal(normalizeSettings({ pixelSize: 99 }).pixelSize, 36);
});

test('seeded random values are repeatable', () => {
  const first = createSeededRandom(123456);
  const second = createSeededRandom(123456);
  assert.deepEqual(
    Array.from({ length: 12 }, () => first()),
    Array.from({ length: 12 }, () => second()),
  );
});

test('daily seeds are stable for a local calendar day and change the next day', () => {
  const morning = new Date(2026, 7, 16, 1, 15);
  const evening = new Date(2026, 7, 16, 23, 45);
  const nextDay = new Date(2026, 7, 17, 0, 1);

  assert.equal(makeDailySeed(morning), makeDailySeed(evening));
  assert.notEqual(makeDailySeed(morning), makeDailySeed(nextDay));
});

test('the same settings and seed create identical artwork', () => {
  const first = createArtwork(DEFAULT_SETTINGS, 42);
  const second = createArtwork(DEFAULT_SETTINGS, 42);
  assert.deepEqual(first, second);
});

test('artwork uses an exact-size curated subset of Resurrect 64', () => {
  for (let colors = 1; colors <= 8; colors += 1) {
    const artwork = createArtwork({ ...DEFAULT_SETTINGS, colors }, 800 + colors);
    assert.equal(artwork.palette.length, colors);
    assert.ok(artwork.palette.every((color) => RESURRECT_64.includes(color)));
    assert.match(artwork.paletteName, /^Resurrect 64 \/ /);
  }
});

test('every ship receives its own Resurrect 64 color combination', () => {
  const artwork = createArtwork(DEFAULT_SETTINGS, 0xEB64);
  const paletteKeys = artwork.sprites.map((sprite) => [...sprite.palette].sort().join('|'));

  assert.equal(new Set(paletteKeys).size, artwork.sprites.length);
  for (const sprite of artwork.sprites) {
    assert.equal(sprite.palette.length, DEFAULT_SETTINGS.colors);
    assert.ok(sprite.palette.every((color) => RESURRECT_64.includes(color)));
    assert.ok(sprite.cells.every((cell) => sprite.palette.includes(cell.color)));
  }
});

test('every generated sprite is horizontally symmetrical', () => {
  const artwork = createArtwork({ ...DEFAULT_SETTINGS, spriteWidth: 10 }, 777);

  for (const sprite of artwork.sprites) {
    const cells = new Map(sprite.cells.map((cell) => [`${cell.x}:${cell.y}`, cell.color]));
    for (const cell of sprite.cells) {
      const reflectedX = artwork.settings.spriteWidth - cell.x - 1;
      assert.equal(cells.get(`${reflectedX}:${cell.y}`), cell.color);
    }
  }
});

test('zero black ratio fills every logical cell', () => {
  const artwork = createArtwork({
    ...DEFAULT_SETTINGS,
    blackRatio: 0,
    imageWidth: 256,
    imageHeight: 256,
  }, 99);

  assert.equal(artwork.stats.coloredCells, artwork.stats.totalCells);
});

test('very sparse settings still produce at least one mirrored mark per sprite', () => {
  const artwork = createArtwork({ ...DEFAULT_SETTINGS, blackRatio: 90 }, 14);
  assert.ok(artwork.sprites.every((sprite) => sprite.cells.length >= 1));
});

test('PNG filenames include a stable timestamp and seed', () => {
  const artwork = createArtwork(DEFAULT_SETTINGS, 0x00C0FFEE);
  const date = new Date(2026, 7, 16, 9, 8, 7);
  assert.equal(makePngFilename(artwork, date), 'glyxel-20260816-090807-00C0FFEE.png');
});
