"use client";

import { useState } from "react";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Local yyyy-mm-dd, built from local parts so "today" is the reader's today. */
function isoDay(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Midday avoids a yyyy-mm-dd landing on the wrong side of a DST change. */
function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
}

/**
 * The days to draw for a month: the whole month, padded out to full weeks with
 * the days either side so the grid never has holes.
 */
function daysAround(month: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(month);
  // Monday-first, matching the M T W T F S S headings.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - lead);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, inMonth: date.getMonth() === month.getMonth() };
  });
}

const CELL =
  "flex size-8 items-center justify-center rounded-lg text-sm transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * A month at a time, picking a start day and then an end day.
 *
 * One calendar rather than two date fields: choosing "the 3rd to the 17th"
 * is a thing you do by looking at a month, and the arrows make the month
 * before this one a single click away.
 */
export function RangeCalendar({
  start,
  end,
  onChange,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const today = isoDay(new Date());
  const [month, setMonth] = useState(() => startOfMonth(parseDay(start ?? today)));

  function pick(iso: string) {
    // A complete range starts over; an incomplete one is completed, in
    // whichever direction the second click lands.
    if (!start || (start && end)) return onChange(iso, null);
    return iso < start ? onChange(iso, start) : onChange(start, iso);
  }

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Previous month"
          className="flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <Chevron className="size-4 rotate-180" />
        </button>
        <span aria-live="polite" className="text-sm font-medium">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Next month"
          className="flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <Chevron className="size-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`} className="text-[11px] font-medium text-muted">
            {day}
          </span>
        ))}

        {daysAround(month).map(({ date, inMonth }) => {
          const iso = isoDay(date);
          const isEdge = iso === start || iso === end;
          const within = Boolean(start && end && iso > start && iso < end);

          if (!inMonth) {
            return (
              <span key={iso} aria-hidden className={`${CELL} text-muted/30`}>
                {date.getDate()}
              </span>
            );
          }

          return (
            <button
              key={iso}
              type="button"
              onClick={() => pick(iso)}
              aria-pressed={isEdge || within}
              className={`${CELL} ${
                isEdge
                  ? "bg-primary font-medium text-primary-foreground hover:bg-primary-hover"
                  : within
                    ? "bg-primary/15 text-foreground hover:bg-primary/25"
                    : "hover:bg-surface-strong"
              } ${iso === today && !isEdge ? "ring-1 ring-primary/50" : ""}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => setMonth(startOfMonth(new Date()))}
          className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          Today
        </button>
      </div>
    </div>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </svg>
  );
}
