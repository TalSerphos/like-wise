import { recencyWeight, seasonWeight } from "./season";

export type Confidence = "low" | "medium" | "high";

export type WeightedRating = { rating: number; weight: number };

export type LikeMeAggregate = {
  // Null when no review carries any like-you evidence.
  rating: number | null;
  // Roughly "how many perfect matches this is worth": min(Σw, n_eff).
  evidence: number;
  nEff: number;
  confidence: Confidence;
};

// Pulls thin like-me ratings toward the overall rating, as if the overall
// rating were this many extra perfect-match reviews.
export const PRIOR_STRENGTH = 2;

/**
 * Review weight = similarity × recency × season. When the reviewer's visit
 * month is unknown, the publish month stands in for it.
 */
export function reviewWeight(input: {
  similarity: number;
  publishedAt: Date;
  visitMonth: number | null;
  now: Date;
  tripMonth: number | null;
  seasonSensitive: boolean;
}): number {
  const visitMonth = input.visitMonth ?? input.publishedAt.getUTCMonth() + 1;
  return (
    input.similarity *
    recencyWeight(input.publishedAt, input.now) *
    seasonWeight(visitMonth, input.tripMonth, input.seasonSensitive)
  );
}

export function confidenceLevel(evidence: number): Confidence {
  if (evidence >= 6) return "high";
  if (evidence >= 2.5) return "medium";
  return "low";
}

/**
 * The "like-me" rating: a weighted average of star ratings, shrunk toward the
 * place's overall rating when evidence is thin. Confidence uses min(Σw, n_eff):
 * Σw measures how much like-you evidence exists, n_eff guards against one
 * review dominating (n_eff alone would call ten weak matches "high").
 */
export function aggregateLikeMe(
  reviews: WeightedRating[],
  overallRating: number | null,
  priorStrength = PRIOR_STRENGTH,
): LikeMeAggregate {
  const usable = reviews.filter(
    (r) => r.weight > 0 && Number.isFinite(r.weight) && Number.isFinite(r.rating),
  );
  const sumW = usable.reduce((sum, r) => sum + r.weight, 0);
  const sumW2 = usable.reduce((sum, r) => sum + r.weight ** 2, 0);
  if (sumW === 0) return { rating: null, evidence: 0, nEff: 0, confidence: "low" };

  const nEff = sumW ** 2 / sumW2;
  const evidence = Math.min(sumW, nEff);
  const weightedSum = usable.reduce((sum, r) => sum + r.weight * r.rating, 0);
  const rating =
    overallRating == null
      ? weightedSum / sumW
      : (weightedSum + priorStrength * overallRating) / (sumW + priorStrength);

  return { rating, evidence, nEff, confidence: confidenceLevel(evidence) };
}

/**
 * Ordering for the "Like me" tab. Uncertain like-me ratings are discounted,
 * places without any like-you evidence fall back to their overall rating with
 * the largest discount, and distance beyond the radius costs a little.
 * `relevance` (0..1) is how well the place fits what the user is looking for.
 */
export function placeRankScore(input: {
  likeMeRating: number | null;
  overallRating: number | null;
  evidence: number;
  distanceKm: number;
  radiusKm: number;
  relevance?: number;
}): number {
  const base = input.likeMeRating ?? input.overallRating ?? 0;
  const uncertainty = 0.5 / Math.sqrt(1 + input.evidence);
  const distancePenalty =
    input.radiusKm > 0 ? 0.3 * Math.min(input.distanceKm / input.radiusKm, 1.5) : 0;
  return base - uncertainty + 0.2 * (input.relevance ?? 0) - distancePenalty;
}
