"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { RangeCalendar } from "@/components/timesheets/range-calendar";
import { buttonClass } from "@/components/ui/button";
import { type EntryFilters, activeFilterCount, rangeLabel } from "@/lib/entry-filters";

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
          <Row icon={CalendarIcon} label="Date range">
            <DateRangeField
              from={filters.from}
              to={filters.to}
              onApply={(from, to) => change({ from, to })}
            />
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
  children,
}: {
  icon: (props: IconProps) => React.ReactElement;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-sm text-muted">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1">{children}</dd>
    </div>
  );
}

/** Local yyyy-mm-dd. Built from the local parts so "today" is the user's today. */
function isoDay(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** A window ending today, `days` long, as the pair the filter stores. */
function lastDays(days: number): { from: string; to: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: isoDay(start), to: isoDay(end) };
}

const PRESETS = [
  { key: "all", label: "All", range: () => ({ from: null, to: null }) },
  { key: "today", label: "Today", range: () => lastDays(1) },
  { key: "week", label: "Last week", range: () => lastDays(7) },
  { key: "fortnight", label: "Last 2 weeks", range: () => lastDays(14) },
  { key: "month", label: "Last month", range: () => lastDays(30) },
] as const;

/**
 * The date range as a menu of the ranges people actually ask for, with a
 * custom start and end underneath.
 *
 * Presets resolve to real dates the moment they are picked rather than being
 * stored as "last week": the query string then says exactly which days are on
 * screen, and a link to it still shows those days tomorrow.
 */
function DateRangeField({
  from,
  to,
  onApply,
}: {
  from: string | null;
  to: string | null;
  onApply: (from: string | null, to: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // Dates already set can only have come from a custom range or a preset that
  // has since drifted, so the panel opens on Custom showing them.
  const [custom, setCustom] = useState(Boolean(from || to));
  const [start, setStart] = useState(from ?? "");
  const [end, setEnd] = useState(to ?? "");
  const calendar = useRef<HTMLDivElement>(null);

  // The presets alone can fill a short window, so choosing Custom brings the
  // calendar into view rather than leaving it below the fold.
  useEffect(() => {
    if (custom) calendar.current?.scrollIntoView({ block: "nearest" });
  }, [custom]);

  function choose(preset: (typeof PRESETS)[number]) {
    const range = preset.range();
    setCustom(false);
    setStart(range.from ?? "");
    setEnd(range.to ?? "");
    setOpen(false);
    onApply(range.from, range.to);
  }

  return (
    <span className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`${CONTROL_CLASS} w-full text-left`}
      >
        {rangeLabel(from, to)}
      </button>

      {open ? (
        <div className="absolute top-0 right-full z-40 mr-3 max-h-[75vh] w-72 overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-xl">
          <h5 className="font-medium">Date range</h5>

          <div role="radiogroup" aria-label="Date range" className="mt-2 space-y-0.5">
            {PRESETS.map((preset) => (
              <label
                key={preset.key}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm hover:bg-surface"
              >
                <input
                  type="radio"
                  name="date-range"
                  checked={!custom && rangeMatches(preset, from, to)}
                  onChange={() => choose(preset)}
                  className="size-4 accent-[var(--primary)]"
                />
                {preset.label}
              </label>
            ))}
            <label className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm hover:bg-surface">
              <input
                type="radio"
                name="date-range"
                checked={custom}
                onChange={() => setCustom(true)}
                className="size-4 accent-[var(--primary)]"
              />
              Custom
            </label>
          </div>

          {custom ? (
            <div ref={calendar} className="mt-3 space-y-3 border-t border-border pt-3">
              <RangeCalendar
                start={start || null}
                end={end || null}
                onChange={(nextStart, nextEnd) => {
                  setStart(nextStart ?? "");
                  setEnd(nextEnd ?? "");
                }}
              />

              <p className="text-center text-xs text-muted">
                {start ? rangeLabel(start, end || null) : "Pick a start day, then an end day."}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStart(from ?? "");
                    setEnd(to ?? "");
                    setOpen(false);
                  }}
                  className={buttonClass("ghost", "sm")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onApply(start || null, end || null);
                  }}
                  className={buttonClass("primary", "sm")}
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

/** Whether the dates on screen are exactly what this preset would produce. */
function rangeMatches(
  preset: (typeof PRESETS)[number],
  from: string | null,
  to: string | null,
): boolean {
  const range = preset.range();
  return (range.from ?? null) === from && (range.to ?? null) === to;
}
