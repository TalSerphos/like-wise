"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextLocale = locale === "he" ? "en" : "he";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => router.replace(pathname, { locale: nextLocale }))
      }
      className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 disabled:opacity-50"
      lang={nextLocale}
    >
      {t("switchLanguage")}
    </button>
  );
}
