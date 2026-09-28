"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

const WINDOWS = [6, 12, 24, 36, 60] as const;
const EXAMPLES = [1, 2, 3] as const;

export function SearchForm() {
  const t = useTranslations("Home");
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState<"near" | "area">("near");
  const [area, setArea] = useState("");
  const [windowMonths, setWindowMonths] = useState<(typeof WINDOWS)[number]>(24);
  const [notice, setNotice] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    // The search pipeline arrives in Phase 3.
    setNotice(true);
  }

  const field =
    "w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand";

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="who" className="block font-semibold">
            {t("whoLabel")}
          </label>
          <textarea
            id="who"
            required
            rows={2}
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder={t("whoPlaceholder")}
            className={`${field} resize-none`}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="what" className="block font-semibold">
            {t("whatLabel")}
          </label>
          <textarea
            id="what"
            required
            rows={2}
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder={t("whatPlaceholder")}
            className={`${field} resize-none`}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-semibold">{t("whereLabel")}</legend>
          <div className="flex gap-2">
            {(["near", "area"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={where === mode}
                onClick={() => setWhere(mode)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  where === mode
                    ? "border-brand bg-brand-soft font-medium"
                    : "border-line bg-surface hover:bg-surface-2"
                }`}
              >
                {mode === "near" ? `📍 ${t("nearMe")}` : t("chooseArea")}
              </button>
            ))}
          </div>
          {where === "area" && (
            <input
              aria-label={t("areaPlaceholder")}
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder={t("areaPlaceholder")}
              className={field}
            />
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="window" className="text-muted">
            {t("windowLabel")}
          </label>
          <select
            id="window"
            value={windowMonths}
            onChange={(e) =>
              setWindowMonths(Number(e.target.value) as (typeof WINDOWS)[number])
            }
            className="rounded-lg border border-line bg-surface px-2 py-1.5"
          >
            {WINDOWS.map((months) => (
              <option key={months} value={months}>
                {t(`window${months}`)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-brand px-4 py-3.5 text-lg font-semibold text-brand-ink hover:bg-brand-strong"
        >
          {t("search")}
        </button>

        {notice && (
          <p role="status" className="rounded-xl bg-brand-soft p-3 text-sm">
            {t("comingSoon")}
          </p>
        )}
      </form>

      <section aria-labelledby="examples-title">
        <h2 id="examples-title" className="mb-2 text-sm font-semibold text-muted">
          {t("examplesTitle")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {EXAMPLES.map((n) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => {
                  setWho(t(`example${n}Who`));
                  setWhat(t(`example${n}What`));
                }}
                className="rounded-2xl border border-line bg-surface px-3 py-2 text-start text-sm hover:bg-surface-2"
              >
                <span className="font-medium">{t(`example${n}Who`)}</span>
                <span className="text-muted"> · {t(`example${n}What`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
