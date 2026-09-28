import { describe, expect, it } from "vitest";
import {
  isWithinWindow,
  monthDistance,
  recencyWeight,
  SAME_SEASON_BOOST,
  seasonWeight,
} from "@/lib/matching/season";

const now = new Date("2026-09-28T00:00:00Z");
const monthsAgo = (months: number) =>
  new Date(now.getTime() - months * 30.4375 * 24 * 60 * 60 * 1000);

describe("time window and recency", () => {
  it("keeps reviews inside the window only", () => {
    expect(isWithinWindow(monthsAgo(23), now, 24)).toBe(true);
    expect(isWithinWindow(monthsAgo(25), now, 24)).toBe(false);
    expect(isWithinWindow(monthsAgo(-1), now, 6)).toBe(true);
  });

  it("halves the weight every 18 months", () => {
    expect(recencyWeight(now, now)).toBe(1);
    expect(recencyWeight(monthsAgo(18), now)).toBeCloseTo(0.5);
    expect(recencyWeight(monthsAgo(36), now)).toBeCloseTo(0.25);
    expect(recencyWeight(monthsAgo(-2), now)).toBe(1);
  });
});

describe("season", () => {
  it("measures months around the calendar", () => {
    expect(monthDistance(12, 1)).toBe(1);
    expect(monthDistance(1, 7)).toBe(6);
    expect(monthDistance(3, 3)).toBe(0);
    expect(monthDistance(11, 2)).toBe(3);
  });

  it("boosts same-season reviews only when the season matters", () => {
    expect(seasonWeight(8, 7, true)).toBe(SAME_SEASON_BOOST);
    expect(seasonWeight(1, 12, true)).toBe(SAME_SEASON_BOOST);
    expect(seasonWeight(1, 7, true)).toBe(1);
    expect(seasonWeight(8, 8, false)).toBe(1);
    expect(seasonWeight(null, 8, true)).toBe(1);
    expect(seasonWeight(8, null, true)).toBe(1);
  });
});
