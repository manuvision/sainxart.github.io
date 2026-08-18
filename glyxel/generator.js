export const CONTROL_DEFINITIONS = Object.freeze({
  colors: { min: 1, max: 8, step: 1, defaultValue: 3 },
  pixelSize: { min: 2, max: 36, step: 1, defaultValue: 36 },
  blackRatio: { min: 0, max: 90, step: 5, defaultValue: 50 },
  spriteWidth: { min: 3, max: 17, step: 1, defaultValue: 8 },
  spriteHeight: { min: 3, max: 17, step: 1, defaultValue: 8 },
  imageWidth: { min: 256, max: 1024, step: 64, defaultValue: 512 },
  imageHeight: { min: 256, max: 1024, step: 64, defaultValue: 512 },
});

export const DEFAULT_SETTINGS = Object.freeze(
  Object.fromEntries(
    Object.entries(CONTROL_DEFINITIONS).map(([key, definition]) => [key, definition.defaultValue]),
  ),
);

export const BACKGROUND_COLOR = '#050807';

// Digital color references from Copic's official Color System chart.
export const COPIC_MARKERS = Object.freeze([
  Object.freeze({ code: 'B00', name: 'Frost Blue', hex: '#EAF6F9', set: 'Perfect Primaries', tone: 'light' }),
  Object.freeze({ code: 'B04', name: 'Tahitian Blue', hex: '#8DD1E7', set: 'Perfect Primaries', tone: 'rich' }),
  Object.freeze({ code: 'R43', name: 'Bougainvillaea', hex: '#F18F96', set: 'Perfect Primaries', tone: 'light' }),
  Object.freeze({ code: 'R46', name: 'Strong Red', hex: '#E6506D', set: 'Perfect Primaries', tone: 'rich' }),
  Object.freeze({ code: 'Y13', name: 'Lemon Yellow', hex: '#FCF9B7', set: 'Perfect Primaries', tone: 'light' }),
  Object.freeze({ code: 'Y19', name: 'Napoli Yellow', hex: '#FFEE39', set: 'Perfect Primaries', tone: 'rich' }),
  Object.freeze({ code: 'G02', name: 'Spectrum Green', hex: '#DBECD9', set: 'Secondary Tones', tone: 'light' }),
  Object.freeze({ code: 'G09', name: 'Veronese Green', hex: '#8FC460', set: 'Secondary Tones', tone: 'rich' }),
  Object.freeze({ code: 'V04', name: 'Lilac', hex: '#EDB9D1', set: 'Secondary Tones', tone: 'light' }),
  Object.freeze({ code: 'V09', name: 'Violet', hex: '#97599A', set: 'Secondary Tones', tone: 'rich' }),
  Object.freeze({ code: 'YR61', name: 'Spring Orange', hex: '#FEE2CC', set: 'Secondary Tones', tone: 'light' }),
  Object.freeze({ code: 'YR68', name: 'Orange', hex: '#F67700', set: 'Secondary Tones', tone: 'rich' }),
]);

export const COPIC_COLORS = Object.freeze(COPIC_MARKERS.map(({ hex }) => hex));

const markerByCode = new Map(COPIC_MARKERS.map((marker) => [marker.code, marker]));
const markerColor = (code) => markerByCode.get(code).hex;

const PALETTE_FAMILIES = Object.freeze([
  { name: 'Blue', light: markerColor('B00'), rich: markerColor('B04') },
  { name: 'Red', light: markerColor('R43'), rich: markerColor('R46') },
  { name: 'Yellow', light: markerColor('Y13'), rich: markerColor('Y19') },
  { name: 'Green', light: markerColor('G02'), rich: markerColor('G09') },
  { name: 'Violet', light: markerColor('V04'), rich: markerColor('V09') },
  { name: 'Orange', light: markerColor('YR61'), rich: markerColor('YR68') },
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function snapToStep(value, definition) {
  const snapped = definition.min
    + Math.round((value - definition.min) / definition.step) * definition.step;
  return clamp(snapped, definition.min, definition.max);
}

export function normalizeSettings(input = {}) {
  return Object.fromEntries(
    Object.entries(CONTROL_DEFINITIONS).map(([key, definition]) => {
      const candidate = Number(input[key]);
      const value = Number.isFinite(candidate) ? candidate : definition.defaultValue;
      return [key, snapToStep(value, definition)];
    }),
  );
}

export function createSeededRandom(seed) {
  let state = Number(seed) >>> 0;

  return function random() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }

  return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
}

export function makeDailySeed(date = new Date()) {
  const localDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(localDate.getTime())) throw new TypeError('A valid date is required.');

  const dateKey = [
    localDate.getFullYear(),
    String(localDate.getMonth() + 1).padStart(2, '0'),
    String(localDate.getDate()).padStart(2, '0'),
  ].join('-');
  const input = `glyxel:${dateKey}`;
  let hash = 0x811C9DC5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function randomInteger(random, minimum, maximumExclusive) {
  return Math.floor(minimum + random() * (maximumExclusive - minimum));
}

function shuffled(random, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createPalette(random, colorCount, family, companion) {
  if (colorCount === 1) {
    return [random() < 0.5 ? family.rich : companion.rich];
  }

  const selected = random() < 0.5
    ? [family.rich, companion.light]
    : [companion.rich, family.light];
  const pool = [
    family.light,
    family.rich,
    companion.light,
    companion.rich,
    ...shuffled(random, COPIC_COLORS),
  ];

  for (const color of pool) {
    if (selected.length >= colorCount) break;
    if (!selected.includes(color)) selected.push(color);
  }

  return shuffled(random, selected);
}

function createSprite(random, settings, palette) {
  const placements = [];
  const cells = [];
  const randomizedColumns = Math.ceil(settings.spriteWidth / 2);
  const fillProbability = 1 - settings.blackRatio / 100;

  for (let y = 0; y < settings.spriteHeight; y += 1) {
    for (let x = 0; x < randomizedColumns; x += 1) {
      if (random() >= fillProbability) continue;
      placements.push({ x, y });
    }
  }

  if (placements.length === 0) {
    placements.push({
      x: Math.floor((settings.spriteWidth - 1) / 2),
      y: Math.floor(settings.spriteHeight / 2),
    });
  }

  const openingColors = shuffled(random, palette);
  placements.forEach(({ x, y }, index) => {
    const color = index < openingColors.length
      ? openingColors[index]
      : palette[randomInteger(random, 0, palette.length)];
    const reflectedX = settings.spriteWidth - x - 1;
    cells.push({ x, y, color });
    if (reflectedX !== x) cells.push({ x: reflectedX, y, color });
  });

  return { cells };
}

function createUniqueSpritePalette(random, colorCount, familyIndex, usedPalettes) {
  let palette;
  let paletteKey;
  let family;
  let companion;

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const candidateFamilyIndex = (familyIndex + attempt) % PALETTE_FAMILIES.length;
    const companionOffset = 1 + randomInteger(random, 0, PALETTE_FAMILIES.length - 1);
    family = PALETTE_FAMILIES[candidateFamilyIndex];
    companion = PALETTE_FAMILIES[(candidateFamilyIndex + companionOffset) % PALETTE_FAMILIES.length];
    palette = createPalette(random, colorCount, family, companion);
    paletteKey = [...palette].sort().join('|');

    if (!usedPalettes.has(paletteKey)) {
      usedPalettes.add(paletteKey);
      return { palette, paletteName: `${family.name} + ${companion.name}` };
    }
  }

  usedPalettes.add(paletteKey);
  return { palette, paletteName: `${family.name} + ${companion.name}` };
}

export function createArtwork(inputSettings = {}, seed = makeSeed()) {
  const settings = normalizeSettings(inputSettings);
  const normalizedSeed = Number(seed) >>> 0;
  const random = createSeededRandom(normalizedSeed);
  const startingFamilyIndex = randomInteger(random, 0, PALETTE_FAMILIES.length);
  const unitWidth = (settings.spriteWidth + 2) * settings.pixelSize;
  const unitHeight = (settings.spriteHeight + 2) * settings.pixelSize;
  const columns = Math.max(1, Math.floor(settings.imageWidth / unitWidth));
  const rows = Math.max(1, Math.floor(settings.imageHeight / unitHeight));
  const offsetX = Math.max(0, Math.floor((settings.imageWidth - columns * unitWidth) / 2));
  const offsetY = Math.max(0, Math.floor((settings.imageHeight - rows * unitHeight) / 2));
  const sprites = [];
  const usedPalettes = new Set();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const spriteIndex = row * columns + column;
      const { palette, paletteName } = createUniqueSpritePalette(
        random,
        settings.colors,
        (startingFamilyIndex + spriteIndex) % PALETTE_FAMILIES.length,
        usedPalettes,
      );
      sprites.push({
        row,
        column,
        palette,
        paletteName,
        ...createSprite(random, settings, palette),
      });
    }
  }

  const coloredCells = sprites.reduce((total, sprite) => total + sprite.cells.length, 0);

  return {
    seed: normalizedSeed,
    settings,
    background: BACKGROUND_COLOR,
    palette: sprites[0]?.palette || [],
    paletteName: 'Copic Sketch / Perfect Primaries + Secondary Tones',
    sprites,
    layout: { unitWidth, unitHeight, columns, rows, offsetX, offsetY },
    stats: {
      sprites: sprites.length,
      coloredCells,
      totalCells: sprites.length * settings.spriteWidth * settings.spriteHeight,
    },
  };
}

export function renderArtwork(canvas, artwork) {
  const context = canvas?.getContext?.('2d');
  if (!context) throw new TypeError('A 2D canvas is required to render Glyxel artwork.');

  const { settings, layout } = artwork;
  canvas.width = settings.imageWidth;
  canvas.height = settings.imageHeight;
  context.imageSmoothingEnabled = false;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = artwork.background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const sprite of artwork.sprites) {
    const spriteX = layout.offsetX
      + sprite.column * layout.unitWidth
      + settings.pixelSize;
    const spriteY = layout.offsetY
      + sprite.row * layout.unitHeight
      + settings.pixelSize;

    for (const cell of sprite.cells) {
      context.fillStyle = cell.color;
      context.fillRect(
        spriteX + cell.x * settings.pixelSize,
        spriteY + cell.y * settings.pixelSize,
        settings.pixelSize,
        settings.pixelSize,
      );
    }
  }

  return canvas;
}

export function describeArtwork(artwork) {
  const { settings, layout, stats } = artwork;
  return `A ${settings.imageWidth} by ${settings.imageHeight} pixel image containing ${stats.sprites} colorful, horizontally symmetrical pixel sprites in a ${layout.columns} by ${layout.rows} grid.`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function makePngFilename(artwork, date = new Date()) {
  const dateStamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('');
  const seed = artwork.seed.toString(16).toUpperCase().padStart(8, '0');
  return `glyxel-${dateStamp}-${seed}.png`;
}
