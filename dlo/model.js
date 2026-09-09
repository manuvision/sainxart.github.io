/** Guadeloupe potable-water distribution balance, 2023 (Observatoire de l'eau).
 * 76.9 Mm³ distributed - 32.3 Mm³ accounted as consumed = 44.6 Mm³.
 * Includes physical leakage AND consumed water not correctly accounted for.
 * The historical average is a reference rate, not a live 2026 measurement.
 */
export const REFERENCE_YEAR = 2023;
export const ANNUAL_LITRES = 44_600_000_000;
export const LOSS_PERCENT = 58;
export const DAY_MS = 86_400_000;
export const DAILY_LITRES = ANNUAL_LITRES / 365;
export const LITRES_PER_SECOND = DAILY_LITRES / 86400;
export const TIME_ZONE = 'America/Guadeloupe';
const OFFSET_MS = -4 * 3600_000;

export function estimateAt(timestamp) {
  if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) throw new RangeError('Invalid timestamp');
  // Guadeloupe uses UTC-4 throughout the year. Never use the visitor's time zone.
  const localTimestamp = timestamp + OFFSET_MS;
  const dayStart = Math.floor(localTimestamp / DAY_MS) * DAY_MS - OFFSET_MS;
  const secondsElapsed = (timestamp - dayStart) / 1000;
  return {
    today: LITRES_PER_SECOND * secondsElapsed,
    dayFraction: secondsElapsed / 86400,
    rate: LITRES_PER_SECOND,
    dayCapacity: DAILY_LITRES,
    dayStart,
  };
}
