// Time-based review weighting: recency within the search window, and a boost
// for reviews from the same time of year as the planned visit.

const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000;

export const RECENCY_HALF_LIFE_MONTHS = 18;
export const SAME_SEASON_BOOST = 1.3;

export function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_MONTH;
}

// Reviews dated slightly in the future (clock skew) count as brand new.
export function isWithinWindow(publishedAt: Date, now: Date, windowMonths: number): boolean {
  return monthsBetween(publishedAt, now) <= windowMonths;
}

// Halves every RECENCY_HALF_LIFE_MONTHS: a 1.5-year-old review counts half.
export function recencyWeight(
  publishedAt: Date,
  now: Date,
  halfLifeMonths = RECENCY_HALF_LIFE_MONTHS,
): number {
  const age = Math.max(0, monthsBetween(publishedAt, now));
  return 0.5 ** (age / halfLifeMonths);
}

// Distance between months on the calendar circle: December to January is 1.
export function monthDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 12;
  return Math.min(distance, 12 - distance);
}

// Review and trip are at the same place, so they share a hemisphere and
// comparing calendar months is enough.
export function seasonWeight(
  visitMonth: number | null,
  tripMonth: number | null,
  seasonSensitive: boolean,
): number {
  if (!seasonSensitive || !visitMonth || !tripMonth) return 1;
  return monthDistance(visitMonth, tripMonth) <= 1 ? SAME_SEASON_BOOST : 1;
}
