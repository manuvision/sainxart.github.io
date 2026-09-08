/* Native Tiny Chao Garden cells from Sonikku's Sonic Advance Chao sheet.
 * The atlas's profile sprites face LEFT. Front-facing expression cells should
 * never inherit that profile mirroring. See REFERENCE-NOTES.md for sources.
 */
const cells = (xs, y) => xs.map(x => Object.freeze({ x, y, w: 24, h: 24 }));
const animation = (xs, y, fps = 3, profile = false) => Object.freeze({ frames: Object.freeze(cells(xs, y)), fps, profile });

export const CHAO_PALETTES = Object.freeze({
  normal: Object.freeze({ x: 0, y: 0 }),
  silver: Object.freeze({ x: 296, y: 200 }),
  gold: Object.freeze({ x: 0, y: 200 }),
  ruby: Object.freeze({ x: 296, y: 400 }),
  sapphire: Object.freeze({ x: 0, y: 600 }),
  amethyst: Object.freeze({ x: 592, y: 400 }),
  emerald: Object.freeze({ x: 592, y: 600 }),
  garnet: Object.freeze({ x: 0, y: 400 }),
  aquamarine: Object.freeze({ x: 296, y: 600 }),
  peridot: Object.freeze({ x: 0, y: 800 }),
  topaz: Object.freeze({ x: 296, y: 800 }),
  onyx: Object.freeze({ x: 592, y: 800 }),
});

const smile = animation([79, 104, 129], 115);
export const CHAO_ANIMATIONS = Object.freeze({
  idle: animation([1], 9, 1),
  walk: animation([1, 26, 51], 34, 7, true),
  walkDown: animation([1, 26, 51], 9, 7),
  walkUp: animation([1, 26, 51], 59, 7),
  // Row 87 / x1 is the frowning expression, not the petting reaction.
  happy: smile,
  pet: smile,
  play: smile,
  eat: animation([79, 104, 129], 87, 3, true),
  sleep: animation([79, 104], 143, 2, true),
  sit: animation([79, 104, 129], 9, 2),
  swim: animation([1, 26, 51], 143, 3, true),
});

/** Screen coordinates increase downwards, matching the original front walk. */
export function walkDirection(dx, dy, previous = 'down') {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return previous;
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'up' : 'down';
  return dx < 0 ? 'left' : 'right';
}

/** Return an atlas cell and the horizontal transform needed to face movement. */
export function getChaoSprite(kind, seconds = 0, { color = 'normal', facing = 1, direction } = {}) {
  let key = kind;
  if (kind === 'walk' && direction === 'up') key = 'walkUp';
  else if (kind === 'walk' && direction === 'down') key = 'walkDown';
  const sequence = CHAO_ANIMATIONS[key] || CHAO_ANIMATIONS.idle;
  const at = sequence.frames[Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * sequence.fps) % sequence.frames.length];
  const palette = CHAO_PALETTES[color] || CHAO_PALETTES.normal;
  const facesRight = direction === 'right' || (direction !== 'left' && facing > 0);
  return { x: at.x + palette.x, y: at.y + palette.y, w: at.w, h: at.h, flipX: sequence.profile && facesRight };
}
