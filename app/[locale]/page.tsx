import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SearchForm } from "@/components/SearchForm";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t("tagline")}
      </h1>
      <p className="mt-3 max-w-prose text-muted">{t("intro")}</p>
      <div className="mt-8">
        <SearchForm />
      </div>
    </div>
  );
}
