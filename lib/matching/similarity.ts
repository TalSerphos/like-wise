import {
  AGE_BANDS,
  type AgeBand,
  LIFE_STAGES,
  type LifeStage,
  type PartyKind,
  type PersonaProfile,
} from "@/lib/ai/schemas";

export type Dimension =
  | "party"
  | "children"
  | "background"
  | "access"
  | "lifeStage"
  | "tags";

export const DEFAULT_WEIGHTS: Readonly<Record<Dimension, number>> = {
  party: 0.3,
  children: 0.25,
  background: 0.25,
  access: 0.1,
  lifeStage: 0.05,
  tags: 0.05,
};

// Reviews scoring at least this much go to the "Like me" tab. Tunable once
// "is this person like you?" feedback comes in.
export const LIKE_ME_THRESHOLD = 0.45;

export type MatchReason = {
  dimension: Dimension;
  // Contribution before weighting: reviewer confidence × match, 0..1.
  strength: number;
  evidence: string | null;
};

export type Similarity = { score: number; reasons: MatchReason[] };

// `match` and `confidence` are 0..1. A dimension the reviewer says nothing
// about has confidence 0, so it simply adds no evidence (it is not a penalty
// beyond missing out on the match).
type DimensionResult = { match: number; confidence: number; evidence: string | null };

// Partial credit between related group types.
const PARTY_AFFINITY: Readonly<Record<string, number>> = {
  "family|parent_child": 0.7,
  "family|multigen": 0.6,
  "multigen|parent_child": 0.4,
  "couple|friends": 0.3,
  "business|solo": 0.3,
};

function partyAffinity(a: PartyKind, b: PartyKind): number {
  if (a === b) return 1;
  return PARTY_AFFINITY[[a, b].sort().join("|")] ?? 0;
}

// Same age band = 1, neighbouring band = 0.5. Averaged in both directions so
// a reviewer with toddlers and teens only half-matches a user with toddlers.
function ageBandOverlap(user: AgeBand[], reviewer: AgeBand[]): number {
  const closeness = (a: AgeBand, b: AgeBand) => {
    const distance = Math.abs(AGE_BANDS.indexOf(a) - AGE_BANDS.indexOf(b));
    return distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
  };
  const bestFrom = (from: AgeBand[], to: AgeBand[]) =>
    average(from.map((a) => Math.max(...to.map((b) => closeness(a, b)))));
  return (bestFrom(user, reviewer) + bestFrom(reviewer, user)) / 2;
}

function stageCloseness(a: LifeStage, b: LifeStage): number {
  const distance = Math.abs(LIFE_STAGES.indexOf(a) - LIFE_STAGES.indexOf(b));
  return distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
}

// "Israeli" is several signals at once: country of origin, the review's
// language and shared cultural needs (kosher, Shabbat…). The strongest signal
// counts, and each additional agreeing signal adds a small bonus.
function backgroundMatch(user: PersonaProfile, reviewer: PersonaProfile): number {
  const u = user.background;
  const r = reviewer.background;
  const signals: number[] = [];

  if (u.originCountry && r.originCountry &&
      u.originCountry.toUpperCase() === r.originCountry.toUpperCase()) {
    signals.push(1);
  }

  const sharedNeeds = intersect(u.culturalNeeds, r.culturalNeeds);
  if (sharedNeeds.length > 0) {
    signals.push(0.8 * (sharedNeeds.length / new Set(u.culturalNeeds).size));
  }

  const sharedLanguages = intersect(lower(u.languages), lower(r.languages));
  if (sharedLanguages.length > 0) {
    // English is the lingua franca of reviews, so it says little about who
    // the reviewer is.
    signals.push(sharedLanguages.some((lang) => lang !== "en") ? 0.7 : 0.3);
  }

  if (signals.length === 0) return 0;
  return Math.min(1, Math.max(...signals) + 0.1 * (signals.length - 1));
}

function compareDimension(
  dimension: Dimension,
  user: PersonaProfile,
  reviewer: PersonaProfile,
): DimensionResult | null {
  switch (dimension) {
    case "party": {
      if (user.party.kind === "unknown") return null;
      if (reviewer.party.kind === "unknown") return unknown();
      return {
        match: partyAffinity(user.party.kind, reviewer.party.kind),
        confidence: reviewer.party.confidence,
        evidence: reviewer.party.evidence,
      };
    }
    case "children": {
      const userBands = unique(user.children.bands.map((b) => b.ageBand));
      if (userBands.length === 0) return null;
      const reviewerBands = unique(reviewer.children.bands.map((b) => b.ageBand));
      if (reviewerBands.length === 0) return unknown();
      return {
        match: ageBandOverlap(userBands, reviewerBands),
        confidence: reviewer.children.confidence,
        evidence: reviewer.children.evidence,
      };
    }
    case "background": {
      const u = user.background;
      if (!u.originCountry && u.languages.length === 0 && u.culturalNeeds.length === 0) {
        return null;
      }
      return {
        match: backgroundMatch(user, reviewer),
        confidence: reviewer.background.confidence,
        evidence: reviewer.background.evidence,
      };
    }
    case "access": {
      const userNeeds = unique(user.access.needs);
      if (userNeeds.length === 0) return null;
      if (reviewer.access.needs.length === 0) return unknown();
      return {
        match: intersect(userNeeds, reviewer.access.needs).length / userNeeds.length,
        confidence: reviewer.access.confidence,
        evidence: reviewer.access.evidence,
      };
    }
    case "lifeStage": {
      if (!user.lifeStage.stage) return null;
      if (!reviewer.lifeStage.stage) return unknown();
      return {
        match: stageCloseness(user.lifeStage.stage, reviewer.lifeStage.stage),
        confidence: reviewer.lifeStage.confidence,
        evidence: reviewer.lifeStage.evidence,
      };
    }
    case "tags": {
      const userTags = unique(lower(user.tags));
      if (userTags.length === 0) return null;
      const shared = intersect(userTags, lower(reviewer.tags));
      return { match: shared.length / userTags.length, confidence: 1, evidence: null };
    }
  }
}

/**
 * How much a reviewer is "like" the user: the weighted share of what the user
 * said about themselves that the reviewer's persona confirms, 0..1. Only
 * dimensions the user specified count, so the weights re-normalize.
 */
export function personaSimilarity(
  user: PersonaProfile,
  reviewer: PersonaProfile,
  weights: Readonly<Record<Dimension, number>> = DEFAULT_WEIGHTS,
): Similarity {
  let weightSum = 0;
  let scoreSum = 0;
  const reasons: (MatchReason & { weighted: number })[] = [];

  for (const dimension of Object.keys(weights) as Dimension[]) {
    const result = compareDimension(dimension, user, reviewer);
    if (!result) continue;
    const weight = weights[dimension];
    const strength = clamp01(result.confidence) * clamp01(result.match);
    weightSum += weight;
    scoreSum += weight * strength;
    if (strength > 0) {
      reasons.push({ dimension, strength, evidence: result.evidence, weighted: weight * strength });
    }
  }

  reasons.sort((a, b) => b.weighted - a.weighted);
  return {
    score: weightSum > 0 ? scoreSum / weightSum : 0,
    reasons: reasons.map(({ dimension, strength, evidence }) => ({
      dimension,
      strength,
      evidence,
    })),
  };
}

export function isLikeMe(similarity: Similarity): boolean {
  return similarity.score >= LIKE_ME_THRESHOLD;
}

function unknown(): DimensionResult {
  return { match: 0, confidence: 0, evidence: null };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function intersect<T>(a: T[], b: T[]): T[] {
  const other = new Set(b);
  return unique(a).filter((value) => other.has(value));
}

function lower(values: string[]): string[] {
  return values.map((value) => value.trim().toLowerCase()).filter(Boolean);
}
