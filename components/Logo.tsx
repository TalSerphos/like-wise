// Two overlapping circles: "people like you" as the overlap of two groups.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <circle cx="25" cy="32" r="13" fill="none" stroke="var(--brand-ink)" strokeWidth="5" />
      <circle cx="39" cy="32" r="13" fill="none" stroke="var(--brand-ink)" strokeWidth="5" opacity="0.75" />
    </svg>
  );
}
