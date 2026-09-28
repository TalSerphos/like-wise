"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const t = useTranslations("Auth");
  const router = useRouter();

  async function signOut() {
    await getBrowserSupabase()?.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-xl border border-line px-4 py-2 text-sm hover:bg-surface-2"
    >
      {t("signOut")}
    </button>
  );
}
