import { AGE_BANDS, type PersonaProfile } from "@/lib/ai/schemas";

// Fields below this confidence are left out of the key.
const MIN_CONFIDENCE = 0.5;

/**
 * A canonical, coarse description of a persona, e.g.
 * `party=family;kids=toddler,child;country=IL;lang=he;needs=kosher`.
 * Similar users share it (child counts, adult counts and free tags are left
 * out), so cached summaries and results can be reused between them.
 */
export function personaKey(persona: PersonaProfile): string {
  const parts: string[] = [];
  const { party, children, background, access, lifeStage } = persona;

  if (party.kind !== "unknown" && party.confidence >= MIN_CONFIDENCE) {
    parts.push(`party=${party.kind}`);
  }

  if (children.confidence >= MIN_CONFIDENCE && children.bands.length > 0) {
    const bands = new Set(children.bands.map((b) => b.ageBand));
    parts.push(`kids=${AGE_BANDS.filter((band) => bands.has(band)).join(",")}`);
  }

  if (background.confidence >= MIN_CONFIDENCE) {
    if (background.originCountry) {
      parts.push(`country=${background.originCountry.toUpperCase()}`);
    }
    const languages = sortedUnique(background.languages.map((l) => l.toLowerCase()));
    if (languages.length) parts.push(`lang=${languages.join(",")}`);
    const needs = sortedUnique(background.culturalNeeds);
    if (needs.length) parts.push(`needs=${needs.join(",")}`);
  }

  if (access.confidence >= MIN_CONFIDENCE && access.needs.length > 0) {
    parts.push(`access=${sortedUnique(access.needs).join(",")}`);
  }

  if (lifeStage.stage && lifeStage.confidence >= MIN_CONFIDENCE) {
    parts.push(`life=${lifeStage.stage}`);
  }

  return parts.length ? parts.join(";") : "any";
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
