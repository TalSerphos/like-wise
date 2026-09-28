"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type EmailOtpKind,
  sendEmailCode,
  startGoogleSignIn,
  verifyEmailCode,
} from "@/lib/auth/client";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Props = { open: boolean; onClose: () => void };

export function AuthSheet({ open, onClose }: Props) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"start" | "code">("start");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpKind, setOtpKind] = useState<EmailOtpKind>("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = getBrowserSupabase();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function run(action: () => Promise<void>, errorKey = "genericError") {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(t(errorKey));
    } finally {
      setBusy(false);
    }
  }

  function onGoogle() {
    if (!supabase) return;
    run(() => startGoogleSignIn(supabase, window.location.pathname));
  }

  function onSendCode(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    run(async () => {
      setOtpKind(await sendEmailCode(supabase, email.trim(), window.location.pathname));
      setStep("code");
    });
  }

  function onVerify(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    run(async () => {
      await verifyEmailCode(supabase, email.trim(), code.trim(), otpKind);
      onClose();
      router.refresh();
    }, "invalidCode");
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="auth-title"
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl bg-surface p-6 text-ink shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="auth-title" className="text-xl font-bold">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="rounded-full p-1 text-muted hover:bg-surface-2"
        >
          ✕
        </button>
      </div>

      {!supabase ? (
        <p className="mt-6 rounded-lg bg-surface-2 p-3 text-sm">{t("notConfigured")}</p>
      ) : step === "start" ? (
        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 font-medium hover:bg-surface-2 disabled:opacity-50"
          >
            <GoogleMark />
            {t("google")}
          </button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            {t("or")}
            <span className="h-px flex-1 bg-line" />
          </div>
          <form onSubmit={onSendCode} className="space-y-3">
            <label className="block text-sm font-medium" htmlFor="auth-email">
              {t("emailLabel")}
            </label>
            <input
              id="auth-email"
              type="email"
              required
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-brand-ink hover:bg-brand-strong disabled:opacity-50"
            >
              {t("sendCode")}
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={onVerify} className="mt-6 space-y-3">
          <p className="text-sm">{t("codeSent", { email })}</p>
          <label className="block text-sm font-medium" htmlFor="auth-code">
            {t("codeLabel")}
          </label>
          <input
            id="auth-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            required
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-brand-ink hover:bg-brand-strong disabled:opacity-50"
          >
            {t("verify")}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("start");
              setCode("");
              setError(null);
            }}
            className="w-full text-sm text-muted hover:underline"
          >
            {t("changeEmail")}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </dialog>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
