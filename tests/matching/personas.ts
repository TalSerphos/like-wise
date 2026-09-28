import { emptyPersona, type PersonaProfile } from "@/lib/ai/schemas";

type Patch = {
  [K in keyof PersonaProfile]?: PersonaProfile[K] extends unknown[]
    ? PersonaProfile[K]
    : Partial<PersonaProfile[K]>;
};

// Builds a persona from an empty one, overriding only the given fields.
export function persona(patch: Patch = {}): PersonaProfile {
  const base = emptyPersona();
  return {
    party: { ...base.party, ...patch.party },
    children: { ...base.children, ...patch.children },
    background: { ...base.background, ...patch.background },
    access: { ...base.access, ...patch.access },
    lifeStage: { ...base.lifeStage, ...patch.lifeStage },
    tags: patch.tags ?? base.tags,
  };
}

// "An Israeli family with 4 little kids" as the parser would read it.
export const israeliFamilyWithToddlers = persona({
  party: { kind: "family", adults: 2, confidence: 1 },
  children: {
    bands: [
      { ageBand: "toddler", count: 2 },
      { ageBand: "child", count: 2 },
    ],
    confidence: 1,
  },
  background: { originCountry: "IL", languages: ["he"], confidence: 1 },
});
