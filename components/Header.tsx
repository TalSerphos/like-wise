import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthButton } from "./auth/AuthButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";

export async function Header() {
  const t = await getTranslations("Header");

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Link
          href="/"
          aria-label={t("home")}
          className="flex items-center gap-2 font-bold tracking-tight"
        >
          <Logo className="size-8" />
          <span className="text-lg">LikeWise</span>
        </Link>
        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
