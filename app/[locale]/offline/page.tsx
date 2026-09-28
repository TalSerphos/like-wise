import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { RetryButton } from "@/components/RetryButton";

export default function OfflinePage({ params }: PageProps<"/[locale]/offline">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Offline");

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-muted">{t("body")}</p>
      <RetryButton label={t("retry")} />
    </div>
  );
}
