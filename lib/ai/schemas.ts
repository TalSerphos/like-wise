import { z } from "zod";

// One shape describes both the searching user ("who are you right now?") and
// each reviewer (inferred from review text and source metadata), so the two
// can be compared field by field in lib/matching.

export const PARTY_KINDS = [
  "family",
  "couple",
  "friends",
  "solo",
  "parent_child",
  "multigen",
  "business",
  "unknown",
] as const;

// infant <1, toddler 1–3, child 4–8, preteen 9–12, teen 13–17.
export const AGE_BANDS = ["infant", "toddler", "child", "preteen", "teen"] as const;

export const CULTURAL_NEEDS = [
  "kosher",
  "shabbat",
  "halal",
  "vegetarian",
  "vegan",
  "hebrew_speaking",
] as const;

export const ACCESS_NEEDS = ["stroller", "wheelchair", "limited_mobility", "dog"] as const;

export const LIFE_STAGES = ["young_adult", "adult", "senior"] as const;

export type PartyKind = (typeof PARTY_KINDS)[number];
export type AgeBand = (typeof AGE_BANDS)[number];
export type CulturalNeed = (typeof CULTURAL_NEEDS)[number];
export type AccessNeed = (typeof ACCESS_NEEDS)[number];
export type LifeStage = (typeof LIFE_STAGES)[number];

// How sure the reader is about a field: 0 = no information, 1 = stated outright.
const confidence = z.number().min(0).max(1);
// A short quote from the review supporting the field, shown as "why matched".
const evidence = z.string().nullable();

export const PersonaProfileSchema = z.object({
  party: z.object({
    kind: z.enum(PARTY_KINDS),
    adults: z.number().int().min(0).nullable(),
    confidence,
    evidence,
  }),
  children: z.object({
    bands: z.array(
      z.object({ ageBand: z.enum(AGE_BANDS), count: z.number().int().min(1) }),
    ),
    confidence,
    evidence,
  }),
  background: z.object({
    // ISO 3166-1 alpha-2, e.g. "IL".
    originCountry: z.string().nullable(),
    // ISO 639-1, e.g. "he". For reviewers this includes the review's language.
    languages: z.array(z.string()),
    culturalNeeds: z.array(z.enum(CULTURAL_NEEDS)),
    confidence,
    evidence,
  }),
  access: z.object({
    needs: z.array(z.enum(ACCESS_NEEDS)),
    confidence,
    evidence,
  }),
  lifeStage: z.object({
    stage: z.enum(LIFE_STAGES).nullable(),
    confidence,
    evidence,
  }),
  // Free-form interests, lowercase ("loves trains", "photography").
  tags: z.array(z.string()),
});

export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;

export function emptyPersona(): PersonaProfile {
  return {
    party: { kind: "unknown", adults: null, confidence: 0, evidence: null },
    children: { bands: [], confidence: 0, evidence: null },
    background: {
      originCountry: null,
      languages: [],
      culturalNeeds: [],
      confidence: 0,
      evidence: null,
    },
    access: { needs: [], confidence: 0, evidence: null },
    lifeStage: { stage: null, confidence: 0, evidence: null },
    tags: [],
  };
}

export const INTENT_CATEGORIES = [
  "food",
  "nightlife",
  "shopping",
  "lodging",
  "museum",
  "attraction",
  "activity",
  "beach",
  "nature",
  "hiking",
] as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[number];

export const SearchIntentSchema = z.object({
  category: z.enum(INTENT_CATEGORIES),
  // Text-search queries for place discovery, in English and the local language.
  queries: z.array(z.string()).min(1),
  // Google Places (New) primary types, e.g. "museum", "hiking_area".
  googleTypes: z.array(z.string()),
  tripadvisorCategory: z.enum(["attractions", "restaurants", "hotels", "geos"]),
  // True when the time of year changes the experience (trails, beaches).
  seasonSensitive: z.boolean(),
  // Month of the planned visit if the text mentions one ("in August").
  tripMonth: z.number().int().min(1).max(12).nullable(),
  // Concrete requirements to look for in reviews ("shade", "stroller access").
  mustHaves: z.array(z.string()),
});

export type SearchIntent = z.infer<typeof SearchIntentSchema>;
