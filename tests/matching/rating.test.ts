import { describe, expect, it } from "vitest";
import {
  aggregateLikeMe,
  confidenceLevel,
  placeRankScore,
  reviewWeight,
} from "@/lib/matching/rating";

describe("aggregateLikeMe", () => {
  it("has no like-me rating without like-you evidence", () => {
    expect(aggregateLikeMe([], 4.2)).toEqual({
      rating: null,
      evidence: 0,
      nEff: 0,
      confidence: "low",
    });
    expect(aggregateLikeMe([{ rating: 5, weight: 0 }], 4.2).rating).toBeNull();
  });

  it("shrinks a single match toward the overall rating", () => {
    const result = aggregateLikeMe([{ rating: 5, weight: 1 }], 4);
    expect(result.rating).toBeCloseTo((5 + 2 * 4) / 3);
    expect(result.confidence).toBe("low");
  });

  it("trusts many strong matches", () => {
    const reviews = Array.from({ length: 8 }, () => ({ rating: 5, weight: 1 }));
    const result = aggregateLikeMe(reviews, 3);
    expect(result.rating).toBeCloseTo((40 + 6) / 10);
    expect(result.confidence).toBe("high");
  });

  it("does not call many weak matches high confidence", () => {
    const reviews = Array.from({ length: 10 }, () => ({ rating: 5, weight: 0.1 }));
    const result = aggregateLikeMe(reviews, 4);
    expect(result.nEff).toBeCloseTo(10);
    expect(result.evidence).toBeCloseTo(1);
    expect(result.confidence).toBe("low");
  });

  it("does not let one review dominate", () => {
    const reviews = [
      { rating: 5, weight: 5 },
      ...Array.from({ length: 5 }, () => ({ rating: 3, weight: 0.05 })),
    ];
    const result = aggregateLikeMe(reviews, null);
    expect(result.evidence).toBeLessThan(1.2);
    expect(result.confidence).toBe("low");
  });

  it("uses a plain weighted mean when there is no overall rating", () => {
    const result = aggregateLikeMe(
      [
        { rating: 5, weight: 1 },
        { rating: 2, weight: 0.5 },
      ],
      null,
    );
    expect(result.rating).toBeCloseTo((5 + 1) / 1.5);
  });
});

describe("confidenceLevel", () => {
  it("uses the documented thresholds", () => {
    expect(confidenceLevel(2.4)).toBe("low");
    expect(confidenceLevel(2.5)).toBe("medium");
    expect(confidenceLevel(5.9)).toBe("medium");
    expect(confidenceLevel(6)).toBe("high");
  });
});

describe("placeRankScore", () => {
  const base = { overallRating: 4, distanceKm: 1, radiusKm: 10 };

  it("ranks the same rating higher with more evidence", () => {
    const thin = placeRankScore({ ...base, likeMeRating: 4.6, evidence: 1 });
    const solid = placeRankScore({ ...base, likeMeRating: 4.6, evidence: 8 });
    expect(solid).toBeGreaterThan(thin);
  });

  it("puts places without like-you evidence below comparable ones", () => {
    const none = placeRankScore({ ...base, likeMeRating: null, evidence: 0 });
    const some = placeRankScore({ ...base, likeMeRating: 4, evidence: 3 });
    expect(some).toBeGreaterThan(none);
  });

  it("penalizes distance", () => {
    const near = placeRankScore({ ...base, likeMeRating: 4.5, evidence: 4, distanceKm: 1 });
    const far = placeRankScore({ ...base, likeMeRating: 4.5, evidence: 4, distanceKm: 12 });
    expect(near).toBeGreaterThan(far);
  });
});

describe("reviewWeight", () => {
  const now = new Date("2026-09-28T00:00:00Z");

  it("multiplies similarity, recency and season", () => {
    const weight = reviewWeight({
      similarity: 0.8,
      publishedAt: now,
      visitMonth: 8,
      now,
      tripMonth: 8,
      seasonSensitive: true,
    });
    expect(weight).toBeCloseTo(0.8 * 1 * 1.3);
  });

  it("falls back to the publish month when the visit month is unknown", () => {
    const publishedInAugust = new Date("2026-08-15T00:00:00Z");
    const withFallback = reviewWeight({
      similarity: 1,
      publishedAt: publishedInAugust,
      visitMonth: null,
      now,
      tripMonth: 9,
      seasonSensitive: true,
    });
    const withoutSeason = reviewWeight({
      similarity: 1,
      publishedAt: publishedInAugust,
      visitMonth: null,
      now,
      tripMonth: 9,
      seasonSensitive: false,
    });
    expect(withFallback / withoutSeason).toBeCloseTo(1.3);
  });
});
