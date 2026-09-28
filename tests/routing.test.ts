import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import he from "@/messages/he.json";
import { localeDirection, routing } from "@/i18n/routing";

describe("locales", () => {
  it("defaults to Hebrew, right-to-left", () => {
    expect(routing.defaultLocale).toBe("he");
    expect(localeDirection("he")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });

  it("has the same message keys in every language", () => {
    const keys = (messages: object, prefix = ""): string[] =>
      Object.entries(messages).flatMap(([key, value]) =>
        typeof value === "object"
          ? keys(value, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      );
    expect(keys(he).sort()).toEqual(keys(en).sort());
  });
});
