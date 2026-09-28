import { describe, expect, it } from "vitest";
import { personaKey } from "@/lib/matching/persona-key";
import { israeliFamilyWithToddlers, persona } from "./personas";

describe("personaKey", () => {
  it("describes the persona in canonical coarse buckets", () => {
    expect(personaKey(israeliFamilyWithToddlers)).toBe(
      "party=family;kids=toddler,child;country=IL;lang=he",
    );
  });

  it("is shared by similar users", () => {
    const a = persona({
      party: { kind: "family", adults: 2, confidence: 1 },
      children: {
        bands: [
          { ageBand: "child", count: 1 },
          { ageBand: "toddler", count: 3 },
        ],
        confidence: 0.9,
      },
      background: {
        originCountry: "il",
        languages: ["HE", "he"],
        culturalNeeds: ["shabbat", "kosher"],
        confidence: 1,
      },
      tags: ["loves trains"],
    });
    const b = persona({
      party: { kind: "family", adults: 1, confidence: 0.8 },
      children: {
        bands: [
          { ageBand: "toddler", count: 1 },
          { ageBand: "child", count: 2 },
        ],
        confidence: 1,
      },
      background: {
        originCountry: "IL",
        languages: ["he"],
        culturalNeeds: ["kosher", "shabbat"],
        confidence: 1,
      },
    });
    expect(personaKey(a)).toBe(personaKey(b));
    expect(personaKey(a)).toBe(
      "party=family;kids=toddler,child;country=IL;lang=he;needs=kosher,shabbat",
    );
  });

  it("leaves out low-confidence fields", () => {
    const unsure = persona({
      party: { kind: "couple", confidence: 0.3 },
      lifeStage: { stage: "senior", confidence: 0.9 },
    });
    expect(personaKey(unsure)).toBe("life=senior");
    expect(personaKey(persona())).toBe("any");
  });
});
