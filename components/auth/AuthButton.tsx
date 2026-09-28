"use client";

import type { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { retryGoogleSignInIfRequested } from "@/lib/auth/client";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { AuthSheet } from "./AuthSheet";

export function AuthButton() {
  const t = useTranslations("Header");
  // undefined = still loading; null = signed out (or Supabase not configured).
  const [user, setUser] = useState<User | null | undefined>(() =>
    getBrowserSupabase() ? undefined : null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    retryGoogleSignInIfRequested(supabase).catch(() => {});
    return () => data.subscription.unsubscribe();
  }, []);

  if (user === undefined) return <div className="h-9 w-20" aria-hidden />;

  if (user && !user.is_anonymous) {
    return (
      <Link
        href="/me"
        className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        {t("account")}
      </Link>
    );
  }

  return (
    <>
      {user?.is_anonymous && (
        <Link href="/me" className="text-sm text-muted hover:underline">
          {t("guest")}
        </Link>
      )}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand-strong"
      >
        {t("signIn")}
      </button>
      <AuthSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
