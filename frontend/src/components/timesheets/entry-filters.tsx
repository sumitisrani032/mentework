"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { type EntryFilters, activeFilterCount } from "@/lib/entry-filters";

type IconProps = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function FunnelIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M4 5h16l-6.2 7.3V19l-3.6-2v-4.7Z" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function PeopleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.3a3.5 3.5 0 0 1 0 6.4M17.5 20a6.5 6.5 0 0 0-2-4.7" />
    </svg>
  );
}

function GroupIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M7 20V5m0 0L4.5 7.5M7 5l2.5 2.5M17 4v15m0 0 2.5-2.5M17 19l-2.5-2.5" />
    </svg>
  );
}

function OrderIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M12 4v16M12 4 8.5 7.5M12 4l3.5 3.5M12 20l-3.5-3.5M12 20l3.5-3.5" />
    </svg>
  );
}

const CONTROL_CLASS =
  "min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm " +
  "text-primary hover:border-border hover:bg-surface " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * The filter panel over a timesheet listing.
 *
 * Every choice is written to the query string, so the server re-renders the
 * rows and the view can be linked to; nothing is filtered behind the reader's
 * back in component state.
 */
export function EntryFilterMenu({
  filters,
  people,
  params,
}: {
  filters: EntryFilters;
  people: { id: number; full_name: string }[];
  /** The page's current query string, so unrelated params survive a change. */
  params: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const count = activeFilterCount(filters);

  useEffect(() => {
    function close(event: MouseEvent | KeyboardEvent) {
      const element = menu.current;
      if (!element?.open) return;
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && element.contains(event.target as Node)) return;
      element.open = false;
    }

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  function change(next: Record<string, string | null>) {
    const query = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") query.delete(key);
      else query.set(key, value);
    }
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function clear() {
    change({ from: null, to: null, status: null, by: null });
  }

  return (
    <details ref={menu} className="relative">
      <summary
        title="Filter this listing"
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="relative">
          <FunnelIcon className="size-4" />
          {count > 0 ? (
            <span className="absolute -top-2 -right-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </span>
        <span className="sr-only">
          Filters{count > 0 ? `, ${count} active` : ""}
        </span>
      </summary>

      <div className="absolute top-full right-0 z-30 mt-2 w-80 rounded-xl border border-border bg-background p-4 shadow-xl">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="font-medium">Filters</h4>
          {count > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>

        <dl className="mt-3 divide-y divide-border">
          {/* Two date fields do not fit beside a label, so this row stacks. */}
          <Row icon={CalendarIcon} label="Date range" stack>
            <span className="flex w-full items-center gap-1">
              <input
                type="date"
                aria-label="From"
                value={filters.from ?? ""}
                max={filters.to ?? undefined}
                onChange={(event) => change({ from: event.target.value })}
                className={`${CONTROL_CLASS} border-border`}
              />
              <span aria-hidden className="text-muted">
                –
              </span>
              <input
                type="date"
                aria-label="To"
                value={filters.to ?? ""}
                min={filters.from ?? undefined}
                onChange={(event) => change({ to: event.target.value })}
                className={`${CONTROL_CLASS} border-border`}
              />
            </span>
          </Row>

          <Row icon={CheckCircleIcon} label="Status">
            <select
              value={filters.status}
              onChange={(event) => change({ status: event.target.value })}
              className={CONTROL_CLASS}
            >
              <option value="all">Any</option>
              <option value="none">Unmarked</option>
              <option value="billable">Billable</option>
              <option value="billed">Billed</option>
            </select>
          </Row>

          <Row icon={PeopleIcon} label="Logged by">
            <select
              value={filters.loggedBy ?? ""}
              onChange={(event) => change({ by: event.target.value })}
              className={CONTROL_CLASS}
            >
              <option value="">Anyone</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
          </Row>

          <Row icon={GroupIcon} label="Group by">
            <select
              value={filters.groupBy}
              onChange={(event) => change({ group: event.target.value })}
              className={CONTROL_CLASS}
            >
              <option value="date">Date</option>
              <option value="person">Person</option>
            </select>
          </Row>

          <Row icon={OrderIcon} label="Order by">
            <select
              value={filters.order}
              onChange={(event) => change({ order: event.target.value })}
              className={CONTROL_CLASS}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </Row>
        </dl>
      </div>
    </details>
  );
}

function Row({
  icon: Icon,
  label,
  stack = false,
  children,
}: {
  icon: (props: IconProps) => React.ReactElement;
  label: string;
  /** Put the control under the label instead of beside it, for wide controls. */
  stack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`gap-3 py-2.5 ${stack ? "" : "flex items-center"}`}>
      <dt className="flex w-28 shrink-0 items-center gap-2 text-sm text-muted">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className={`flex min-w-0 ${stack ? "mt-1.5 w-full" : "flex-1"}`}>{children}</dd>
    </div>
  );
}
