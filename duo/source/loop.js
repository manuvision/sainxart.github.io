// Shared timing with the baked native AR assets: 7 seconds, 30 fps.
export const LOOP_SECONDS = 7;
export const HOLD_SECONDS = 1;
export const MOVE_SECONDS = 2.5;
export function foldAt(seconds) {
  const t = ((seconds % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  if (t <= HOLD_SECONDS) return 0;
  if (t < 3.5) return (1 - Math.cos(Math.PI * (t - HOLD_SECONDS) / MOVE_SECONDS)) / 2;
  if (t <= 4.5) return 1;
  return (1 + Math.cos(Math.PI * (t - 4.5) / MOVE_SECONDS)) / 2;
}
export function openingTimeForFold(value) {
  const p = Math.max(0, Math.min(1, value));
  if (p === 0) return 0;
  if (p === 1) return 3.5;
  return HOLD_SECONDS + Math.acos(1 - 2 * p) / Math.PI * MOVE_SECONDS;
}
