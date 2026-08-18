import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COPIC_COLORS,
  COPIC_MARKERS,
  DEFAULT_SETTINGS,
  createArtwork,
  createSeededRandom,
  makeDailySeed,
  makePngFilename,
  normalizeSettings,
} from '../generator.js';

const EXPECTED_COPIC_COLORS = Object.freeze({
  B00: '#EAF6F9',
  B04: '#8DD1E7',
  R43: '#F18F96',
  R46: '#E6506D',
  Y13: '#FCF9B7',
  Y19: '#FFEE39',
  G02: '#DBECD9',
  G09: '#8FC460',
  V04: '#EDB9D1',
  V09: '#97599A',
  YR61: '#FEE2CC',
  YR68: '#F67700',
});

test('uses the requested defaults', () => {
  assert.deepEqual(DEFAULT_SETTINGS, {
    colors: 3,
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

test('palette contains only the two requested Copic Sketch sets', () => {
  assert.deepEqual(
    Object.fromEntries(COPIC_MARKERS.map(({ code, hex }) => [code, hex])),
    EXPECTED_COPIC_COLORS,
  );
  assert.deepEqual(COPIC_COLORS, Object.values(EXPECTED_COPIC_COLORS));
  assert.deepEqual(
    [...new Set(COPIC_MARKERS.map(({ set }) => set))].sort(),
    ['Perfect Primaries', 'Secondary Tones'],
  );
});

test('artwork uses an exact-size subset of the Copic marker palette', () => {
  for (let colors = 1; colors <= 8; colors += 1) {
    const artwork = createArtwork({ ...DEFAULT_SETTINGS, colors }, 800 + colors);
    assert.equal(artwork.palette.length, colors);
    assert.ok(artwork.palette.every((color) => COPIC_COLORS.includes(color)));
    assert.match(artwork.paletteName, /^Copic Sketch \/ /);
  }
});

test('every sprite receives its own Copic color combination', () => {
  const artwork = createArtwork({
    ...DEFAULT_SETTINGS,
    pixelSize: 12,
  }, 0xEB64);
  const paletteKeys = artwork.sprites.map((sprite) => [...sprite.palette].sort().join('|'));

  assert.equal(new Set(paletteKeys).size, artwork.sprites.length);
  for (const sprite of artwork.sprites) {
    assert.equal(sprite.palette.length, DEFAULT_SETTINGS.colors);
    assert.ok(sprite.palette.every((color) => COPIC_COLORS.includes(color)));
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

test('PNG filenames include the local date and seed without the time', () => {
  const artwork = createArtwork(DEFAULT_SETTINGS, 0x00C0FFEE);
  const morning = new Date(2026, 7, 16, 9, 8, 7);
  const evening = new Date(2026, 7, 16, 21, 22, 23);
  const expected = 'glyxel-20260816-00C0FFEE.png';

  assert.equal(makePngFilename(artwork, morning), expected);
  assert.equal(makePngFilename(artwork, evening), expected);
});
