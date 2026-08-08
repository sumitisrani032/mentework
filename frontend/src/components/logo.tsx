export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-7 shrink-0">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M9 22V10.5l7 6 7-6V22"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg">Mentework</span>
    </span>
  );
}
