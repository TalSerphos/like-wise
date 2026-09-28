import type { IntentCategory } from "@/lib/ai/schemas";

// "Smart radius": how far people typically go for this kind of outing.
const DEFAULT_RADIUS_KM: Readonly<Record<IntentCategory, number>> = {
  food: 3,
  nightlife: 3,
  shopping: 5,
  lodging: 10,
  museum: 15,
  attraction: 15,
  activity: 20,
  beach: 30,
  nature: 40,
  hiking: 40,
};

export const MIN_RADIUS_KM = 0.5;
export const MAX_RADIUS_KM = 100;
// Fewer candidates than this triggers one automatic radius expansion.
export const MIN_CANDIDATES = 5;

export function defaultRadiusKm(category: IntentCategory): number {
  return DEFAULT_RADIUS_KM[category];
}

export function clampRadiusKm(km: number): number {
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, km));
}

export function shouldExpandRadius(
  candidateCount: number,
  radiusKm: number,
  alreadyExpanded: boolean,
): boolean {
  return !alreadyExpanded && candidateCount < MIN_CANDIDATES && radiusKm < MAX_RADIUS_KM;
}

export function expandedRadiusKm(radiusKm: number): number {
  return clampRadiusKm(radiusKm * 2);
}
