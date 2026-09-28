import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { getServerSupabase } from "@/lib/supabase/server";

// Handles both OAuth/PKCE redirects (?code=) and email links (?token_hash=).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const target = new URL(safeNextPath(searchParams.get("next")), origin);

  // A guest tried to link a Google account that already has a LikeWise user:
  // let the client retry as a regular sign-in.
  if (searchParams.get("error_code") === "identity_already_exists") {
    target.searchParams.set("auth_retry", "google");
    return NextResponse.redirect(target);
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.redirect(target);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (!ok) target.searchParams.set("auth_error", "1");
  return NextResponse.redirect(target);
}
