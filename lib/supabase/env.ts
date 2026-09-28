// Supabase is optional until the project is connected: every caller checks
// `supabaseEnv` and degrades to signed-out behavior when it is null.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnv =
  url && publishableKey ? { url, publishableKey } : null;
