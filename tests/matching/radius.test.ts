import { describe, expect, it } from "vitest";
import {
  clampRadiusKm,
  defaultRadiusKm,
  expandedRadiusKm,
  MAX_RADIUS_KM,
  shouldExpandRadius,
} from "@/lib/matching/radius";

describe("smart radius", () => {
  it("scales with the kind of outing", () => {
    expect(defaultRadiusKm("food")).toBe(3);
    expect(defaultRadiusKm("museum")).toBe(15);
    expect(defaultRadiusKm("hiking")).toBe(40);
  });

  it("keeps slider values within bounds", () => {
    expect(clampRadiusKm(0.1)).toBe(0.5);
    expect(clampRadiusKm(500)).toBe(MAX_RADIUS_KM);
  });

  it("expands once when there are too few places", () => {
    expect(shouldExpandRadius(3, 3, false)).toBe(true);
    expect(shouldExpandRadius(3, 3, true)).toBe(false);
    expect(shouldExpandRadius(8, 3, false)).toBe(false);
    expect(shouldExpandRadius(0, MAX_RADIUS_KM, false)).toBe(false);
    expect(expandedRadiusKm(3)).toBe(6);
    expect(expandedRadiusKm(80)).toBe(MAX_RADIUS_KM);
  });
});
