"use client";

export function RetryButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-6 rounded-xl bg-brand px-5 py-2.5 font-medium text-brand-ink hover:bg-brand-strong"
    >
      {label}
    </button>
  );
}
