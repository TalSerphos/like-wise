<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LikeWise project notes

- Product/technical plan: `docs/PLAN.md`. Account/key setup: `docs/SETUP.md`.
- Locales: Hebrew (`he`, default, RTL) and English. Every UI string lives in both `messages/he.json` and `messages/en.json` (a test enforces matching keys). Use logical Tailwind classes (`ms-`, `pe-`, `text-start`) so layouts mirror in RTL.
- Supabase is optional at runtime: helpers in `lib/supabase/` return `null` when env vars are missing, and callers must degrade gracefully.
- Schema changes go in a new file under `supabase/migrations/`; extend `supabase/tests/rls_test.sql` and run `pnpm db:test`.
