import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (!supabaseEnv) return null;
  browserClient ??= createBrowserClient(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
  );
  return browserClient;
}
