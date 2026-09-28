# LikeWise (working title)

**Reviews from people like you.** Describe who you are right now ("an Israeli family with 4 little kids") and what you're looking for ("an easy trail with water, in August"). LikeWise gathers reviews from Google Maps, TripAdvisor, Reddit and its own users, and surfaces the ones written by people like you. Each place gets a "like-me" rating, pros and cons, and practical tips.

It's an installable web app (PWA) in Hebrew and English. The full product and technical plan is in [`docs/PLAN.md`](docs/PLAN.md).

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Foundations: app shell, Hebrew/English + RTL, PWA, database schema, sign-in | ✅ done |
| 1 | Place & review sources (Google, TripAdvisor, DataForSEO) | waiting for API keys |
| 2 | AI understanding & "people like me" matching | 🟡 scoring done; AI reading + model comparison wait for an Anthropic API key |
| 3 | Search experience (progressive results, tabs, map, summaries) | |
| 4 | Personas, history, favorites, sharing, feedback, guest limit | |
| 5 | In-app reviews | |
| 6 | Reddit (after API approval) | |
| 7 | Hardening & tester launch | |

## Run it

```bash
pnpm install
cp .env.example .env.local   # optional at first; see docs/SETUP.md
pnpm dev                     # http://localhost:3000 → redirects to /he
```

The app runs without any keys. Sign-in stays disabled until Supabase is configured ([`docs/SETUP.md`](docs/SETUP.md)).

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test        # unit tests (Vitest)
pnpm build
pnpm db:test     # migrations + row-level-security tests; needs DATABASE_URL
                 # pointing at a Postgres with PostGIS (superuser)
```

CI runs all of these on every push (`.github/workflows/ci.yml`).

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · next-intl · Supabase (Postgres + PostGIS, Auth, Realtime) · Claude (Haiku 4.5 + Sonnet 5) · Inngest · Vercel.

## Layout

```
app/[locale]/        pages (he / en)
app/auth/callback/   OAuth + email-link sign-in callback
components/          UI
i18n/                locale routing
lib/ai/schemas.ts    persona + search-intent shapes shared by AI and scoring
lib/matching/        "people like me" scoring: similarity, like-me rating,
                     recency/season weights, smart radius, persona cache key
lib/                 supabase and auth helpers
messages/            he.json, en.json
proxy.ts             locale routing + session refresh (Next 16's "middleware")
public/sw.js         service worker (offline fallback)
supabase/            migrations and database tests
docs/                plan and setup guide
```
