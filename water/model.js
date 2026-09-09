/** Operational consumption. Reference: de Vries-Gao (2025), doi:10.1016/j.patter.2025.101430.
 * Pre-2025 history is an illustrative backcast, NOT a historical observation. */
export const ANNUAL = Object.freeze({ low: 312_500_000_000, central: 538_550_000_000, high: 764_600_000_000 });
export const BASELINE_YEAR = 2012;
export const REFERENCE_YEAR = 2025;
export const HISTORICAL_GROWTH = 1.5;
export const DAY_MS = 86_400_000;
export function annualForYear(year, scenario = 'central') {
  if (!(scenario in ANNUAL)) throw new RangeError('Unknown scenario');
  return year < BASELINE_YEAR ? 0 : ANNUAL[scenario] / HISTORICAL_GROWTH ** Math.max(0, REFERENCE_YEAR - year);
}
export function estimateAt(timestamp, scenario = 'central') {
  if (!Number.isFinite(timestamp)) throw new RangeError('Invalid timestamp');
  const date = new Date(timestamp), year = date.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1), nextYear = Date.UTC(year + 1, 0, 1);
  const dayStart = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  const annual = annualForYear(year, scenario);
  const rate = annual / ((nextYear - yearStart) / 1000);
  let cumulative = 0;
  for (let y = BASELINE_YEAR; y < year; y++) cumulative += annualForYear(y, scenario);
  cumulative += annual * (timestamp - yearStart) / (nextYear - yearStart);
  return { annual, rate, cumulative, today: rate * (timestamp - dayStart) / 1000, dayFraction: (timestamp - dayStart) / DAY_MS, year };
}
/** Exact volume encoding for a unit sphere: f=(2+3h-h³)/4. */
export function sphereFillHeight(fraction) {
  const target = Math.max(0, Math.min(1, fraction));
  if (target === 0) return -1;
  if (target === 1) return 1;
  let low = -1, high = 1;
  for (let i = 0; i < 32; i++) {
    const h = (low + high) / 2;
    if ((2 + 3 * h - h ** 3) / 4 < target) low = h; else high = h;
  }
  return (low + high) / 2;
}
