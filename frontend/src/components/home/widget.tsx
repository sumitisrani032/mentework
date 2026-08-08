type IconProps = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function MegaphoneIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M4 10v4a1 1 0 0 0 1 1h3l7 4V5L8 9H5a1 1 0 0 0-1 1Z" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" />
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

export function ChecklistIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M4 7.5 5.5 9 8 6M4 16.5 5.5 18 8 15M11 7.5h9M11 16.5h9" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function NoteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M5 5h14v9l-5 5H5Z" />
      <path d="M19 14h-5v5" />
    </svg>
  );
}

export function BookmarkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M7 4h10v16l-5-4-5 4Z" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** One card on the home page: a titled box the widgets all share. */
export function Widget({
  title,
  icon: Icon,
  id,
  action,
  wide = false,
  children,
}: {
  title: string;
  icon: (props: IconProps) => React.ReactElement;
  id?: string;
  action?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`flex scroll-mt-6 flex-col overflow-hidden rounded-xl border border-border bg-surface ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="size-4 shrink-0 text-muted" />
        <h2 className="text-sm font-medium">{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </header>
      <div className="flex min-h-44 flex-1 flex-col">{children}</div>
    </section>
  );
}

/**
 * What a widget shows when it has nothing to show.
 *
 * `soon` marks the widgets whose feature does not exist yet, so an empty card
 * is not mistaken for "you have no announcements".
 */
export function Empty({
  icon: Icon,
  children,
  soon = false,
}: {
  icon: (props: IconProps) => React.ReactElement;
  children: React.ReactNode;
  soon?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-10 text-center">
      <Icon className="size-8 text-muted/40" />
      <p className="max-w-56 text-xs leading-relaxed text-muted">{children}</p>
      {soon ? (
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] tracking-wide text-muted uppercase">
          soon
        </span>
      ) : null}
    </div>
  );
}
