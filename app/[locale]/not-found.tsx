import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 font-medium text-brand-ink"
      >
        {t("back")}
      </Link>
    </div>
  );
}
