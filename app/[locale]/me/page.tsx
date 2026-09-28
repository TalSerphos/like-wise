import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function MePage({ params }: PageProps<"/[locale]/me">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Me");
  const supabase = await getServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  const sections = ["personas", "history", "favorites", "myReviews"] as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-muted">
        {!user
          ? t("notSignedIn")
          : user.is_anonymous
            ? t("guestNotice")
            : t("signedInAs", { email: user.email ?? "" })}
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {sections.map((key) => (
          <li
            key={key}
            className="flex items-center justify-between rounded-xl border border-line bg-surface p-4"
          >
            <span className="font-medium">{t(key)}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {t("soon")}
            </span>
          </li>
        ))}
      </ul>

      {user && (
        <div className="mt-8">
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
