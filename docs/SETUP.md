# Setup: accounts and keys

Everything goes into `.env.local` (copy from `.env.example`). The app runs without any keys: sign-in shows "not configured" until Supabase is connected.

## Do today: Reddit access (takes 2–4 weeks)

Reddit requires approval for any Data API use. Request **non-commercial** access for a prototype as soon as possible. The Reddit source is Phase 6 and nothing else waits on it. When approved, fill `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`.

## Phase 0: Supabase (database + sign-in)

1. Create a project at [supabase.com](https://supabase.com). Pick the Frankfurt region (closest to Israel).
2. **Apply the schema:** open the SQL Editor, paste `supabase/migrations/20260928000000_initial_schema.sql`, and run it. With the Supabase CLI you can instead run `supabase link` and then `supabase db push`.
3. **Authentication → Sign In / Providers:**
   - **Email:** enabled, "Confirm email" on. Set **Email OTP length to 6**.
   - **Allow anonymous sign-ins:** on. Guests get 2 free searches.
   - **Allow manual linking:** on. This lets a guest upgrade to Google without losing their history.
   - **Google:** enable it and paste the Client ID/secret from a Google Cloud OAuth client of type "Web application". Its authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
4. **Authentication → URL Configuration:** set Site URL to `http://localhost:3000` (later your production URL). Add redirect URLs `http://localhost:3000/auth/callback` and, later, `https://<your-domain>/auth/callback`.
5. **Authentication → Email Templates:** in both **Magic Link** and **Change Email Address**, include the code as well as the link, for example:
   ```html
   <p>Your LikeWise code: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
   ```
   The code matters for the installed app: the link opens in the browser, not in the app.
6. **SMTP** (before inviting testers): Supabase's built-in email is heavily rate-limited. Create a free [Resend](https://resend.com) account and set it under Authentication → SMTP Settings.
7. **Keys:** in Project Settings → API Keys, copy the Project URL to `NEXT_PUBLIC_SUPABASE_URL`, the **publishable** key to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the **secret** key to `SUPABASE_SECRET_KEY` (server only).

## Phase 1: place and review sources

- **Google Maps Platform** ([console.cloud.google.com](https://console.cloud.google.com)): enable *Places API (New)*, *Geocoding API* and *Maps JavaScript API*, then create two keys:
  - a server key restricted to Places + Geocoding → `GOOGLE_MAPS_SERVER_KEY`
  - a browser key restricted to Maps JavaScript and your domains → `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`

  Also create a Map ID → `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Set a billing budget alert; prototype usage should stay inside the monthly free caps.
- **TripAdvisor Content API** ([tripadvisor.com/developers](https://www.tripadvisor.com/developers)): sign up. It needs a card, and there's a free monthly allowance → `TRIPADVISOR_API_KEY`.
- **DataForSEO** ([dataforseo.com](https://dataforseo.com)): register and add a small prepaid balance → `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`.
- *(Optional)* **Apify** ([apify.com](https://apify.com)) as a fallback vendor → `APIFY_TOKEN`.

## Phase 2: Claude

- [console.anthropic.com](https://console.anthropic.com): create an API key → `ANTHROPIC_API_KEY`. Set a monthly spend limit there too, as a second safety net under the app's own $300 budget guard.

## Phase 3–4: jobs, analytics, abuse protection

- [Inngest](https://www.inngest.com) → `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- [PostHog](https://posthog.com) (EU cloud) → `NEXT_PUBLIC_POSTHOG_KEY`
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- Any random string → `GUEST_IP_SALT`

## Deploy (Phase 7)

[Vercel](https://vercel.com): import the GitHub repo and paste the same environment variables. Add the production URL to Supabase's redirect URLs.
