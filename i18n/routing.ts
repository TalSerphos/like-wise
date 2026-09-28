import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
});

export type Locale = (typeof routing.locales)[number];

export function localeDirection(locale: string): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
