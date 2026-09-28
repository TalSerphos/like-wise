import { describe, expect, it } from "vitest";
import {
  isLikeMe,
  LIKE_ME_THRESHOLD,
  personaSimilarity,
} from "@/lib/matching/similarity";
import { israeliFamilyWithToddlers, persona } from "./personas";

const user = israeliFamilyWithToddlers;

describe("personaSimilarity", () => {
  it("scores an Israeli family with small kids as very similar", () => {
    const reviewer = persona({
      party: { kind: "family", confidence: 1, evidence: "Trip type: Family" },
      children: {
        bands: [{ ageBand: "toddler", count: 1 }, { ageBand: "child", count: 1 }],
        confidence: 0.9,
        evidence: "our 2 and 5 year olds",
      },
      background: { originCountry: "IL", languages: ["he"], confidence: 0.9 },
    });
    const result = personaSimilarity(user, reviewer);
    expect(result.score).toBeGreaterThan(0.85);
    expect(isLikeMe(result)).toBe(true);
    expect(result.reasons[0]).toMatchObject({ dimension: "party", evidence: "Trip type: Family" });
    expect(result.reasons.map((r) => r.dimension)).toEqual(["party", "children", "background"]);
  });

  it("scores a foreign couple as not similar", () => {
    const reviewer = persona({
      party: { kind: "couple", confidence: 1 },
      background: { originCountry: "US", languages: ["en"], confidence: 1 },
    });
    const result = personaSimilarity(user, reviewer);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
    expect(isLikeMe(result)).toBe(false);
  });

  it("gives partial credit for only writing in Hebrew", () => {
    const reviewer = persona({ background: { languages: ["he"], confidence: 0.9 } });
    const { score } = personaSimilarity(user, reviewer);
    // background weight 0.25 of 0.8 specified, × confidence 0.9 × language 0.7
    expect(score).toBeCloseTo((0.25 * 0.9 * 0.7) / 0.8);
    expect(score).toBeLessThan(LIKE_ME_THRESHOLD);
  });

  it("finds nothing in common with a reviewer who reveals nothing", () => {
    expect(personaSimilarity(user, persona())).toEqual({ score: 0, reasons: [] });
  });

  it("re-normalizes weights to what the user specified", () => {
    const justIsraeli = persona({ background: { originCountry: "IL", confidence: 1 } });
    const reviewer = persona({
      party: { kind: "couple", confidence: 1 },
      background: { originCountry: "il", confidence: 1 },
    });
    expect(personaSimilarity(justIsraeli, reviewer).score).toBe(1);
  });

  it("returns 0 when the user specified nothing", () => {
    expect(personaSimilarity(persona(), user).score).toBe(0);
  });

  it("gives partial credit between related group types", () => {
    const dadAndSon = persona({ party: { kind: "parent_child", confidence: 1 } });
    const family = persona({ party: { kind: "family", confidence: 1 } });
    expect(personaSimilarity(dadAndSon, family).score).toBeCloseTo(0.7);
    expect(personaSimilarity(family, dadAndSon).score).toBeCloseTo(0.7);
  });

  it("gives half credit for neighbouring kids' ages and none for distant ones", () => {
    const toddlerParent = persona({
      children: { bands: [{ ageBand: "toddler", count: 1 }], confidence: 1 },
    });
    const withChild = persona({
      children: { bands: [{ ageBand: "child", count: 1 }], confidence: 1 },
    });
    const withTeen = persona({
      children: { bands: [{ ageBand: "teen", count: 1 }], confidence: 1 },
    });
    expect(personaSimilarity(toddlerParent, withChild).score).toBeCloseTo(0.5);
    expect(personaSimilarity(toddlerParent, withTeen).score).toBe(0);
  });

  it("combines background signals and treats English as weak", () => {
    const kosherIsraeli = persona({
      background: {
        originCountry: "IL",
        languages: ["he"],
        culturalNeeds: ["kosher"],
        confidence: 1,
      },
    });
    const allThree = persona({
      background: {
        originCountry: "IL",
        languages: ["he"],
        culturalNeeds: ["kosher"],
        confidence: 1,
      },
    });
    const kosherOnly = persona({ background: { culturalNeeds: ["kosher"], confidence: 1 } });
    expect(personaSimilarity(kosherIsraeli, allThree).score).toBe(1);
    expect(personaSimilarity(kosherIsraeli, kosherOnly).score).toBeCloseTo(0.8);

    const englishSpeaker = persona({ background: { languages: ["en"], confidence: 1 } });
    expect(personaSimilarity(englishSpeaker, englishSpeaker).score).toBeCloseTo(0.3);
  });

  it("scales by how confident the reviewer's persona is", () => {
    const family = persona({ party: { kind: "family", confidence: 1 } });
    const unsure = persona({ party: { kind: "family", confidence: 0.4 } });
    expect(personaSimilarity(family, unsure).score).toBeCloseTo(0.4);
  });
});
