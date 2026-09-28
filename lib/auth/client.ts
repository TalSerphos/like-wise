import type { SupabaseClient, User } from "@supabase/supabase-js";

export type EmailOtpKind = "email" | "email_change";

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

async function currentUser(supabase: SupabaseClient): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// Guests (anonymous users) are upgraded in place so their history is kept.
// If the Google account already belongs to someone, the callback asks the
// client to retry as a normal sign-in (see `retryGoogleSignInIfRequested`).
export async function startGoogleSignIn(
  supabase: SupabaseClient,
  next: string,
): Promise<void> {
  const options = { redirectTo: callbackUrl(next) };
  if ((await currentUser(supabase))?.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options,
    });
    if (!error) return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options,
  });
  if (error) throw error;
}

export async function retryGoogleSignInIfRequested(
  supabase: SupabaseClient,
): Promise<void> {
  const url = new URL(window.location.href);
  if (url.searchParams.get("auth_retry") !== "google") return;
  url.searchParams.delete("auth_retry");
  window.history.replaceState(null, "", url);
  await supabase.auth.signOut({ scope: "local" });
  await startGoogleSignIn(supabase, url.pathname);
}

// Sends a 6-digit code (the email also contains a magic link). Returns the
// OTP type needed to verify it.
export async function sendEmailCode(
  supabase: SupabaseClient,
  email: string,
  next: string,
): Promise<EmailOtpKind> {
  const emailRedirectTo = callbackUrl(next);
  if ((await currentUser(supabase))?.is_anonymous) {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo },
    );
    if (!error) return "email_change";
    // The email already has an account: sign into it instead. The guest's
    // searches are not carried over in this case.
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: true },
  });
  if (error) throw error;
  return "email";
}

export async function verifyEmailCode(
  supabase: SupabaseClient,
  email: string,
  token: string,
  type: EmailOtpKind,
): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type });
  if (error) throw error;
}

// Guests get a real (anonymous) Supabase user so searches and quotas can be
// tracked server-side. Called when a guest starts their first search.
export async function ensureGuestSession(
  supabase: SupabaseClient,
): Promise<User> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error("Anonymous sign-in failed");
  return anon.user;
}
