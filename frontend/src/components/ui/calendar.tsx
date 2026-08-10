"use client";

import { useState } from "react";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** How many years a page of the year grid shows. */
const YEAR_PAGE = 12;

/** Local yyyy-mm-dd, built from local parts so "today" is the reader's today. */
export function isoDay(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Midday avoids a yyyy-mm-dd landing on the wrong side of a DST change. */
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function startOfMonth(date: Date): Date {
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

const WIDE_CELL =
  "flex h-9 items-center justify-center rounded-lg text-sm transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

type View = "days" | "months" | "years";

/**
 * A month of days, with the month and the year reachable in one click each.
 *
 * The title is a button: days → months → years. Stepping a year at a time
 * through the arrows is fine for last March and useless for 2019, and a date
 * of birth or a project that started three years ago is exactly what a picker
 * gets asked for. Picking a year lands on its months, picking a month lands on
 * its days, so the way back down is the same path in reverse.
 *
 * Selection is described rather than owned: `start` and `end` say which days
 * read as chosen, and `onPick` reports the day that was clicked. A single date
 * passes the same value as both.
 */
export function Calendar({
  start,
  end,
  onPick,
  footer,
}: {
  start: string | null;
  end: string | null;
  onPick: (iso: string) => void;
  footer?: React.ReactNode;
}) {
  const today = isoDay(new Date());
  const [month, setMonth] = useState(() => startOfMonth(parseDay(start ?? today)));
  const [view, setView] = useState<View>("days");

  const year = month.getFullYear();
  const yearPageStart = Math.floor(year / YEAR_PAGE) * YEAR_PAGE;

  const title =
    view === "days"
      ? month.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "months"
        ? String(year)
        : `${yearPageStart} – ${yearPageStart + YEAR_PAGE - 1}`;

  // What the arrows move by, which is one level coarser than what is on screen:
  // a grid of days pages by month, a grid of months by year.
  const stepName = view === "days" ? "month" : view === "months" ? "year" : `${YEAR_PAGE} years`;

  function step(direction: 1 | -1) {
    if (view === "days") return setMonth(addMonths(month, direction));
    if (view === "months") return setMonth(addMonths(month, direction * 12));
    return setMonth(addMonths(month, direction * 12 * YEAR_PAGE));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <Arrow onClick={() => step(-1)} label={`Previous ${stepName}`} back />
        <button
          type="button"
          onClick={() => setView(view === "days" ? "months" : view === "months" ? "years" : "days")}
          aria-live="polite"
          aria-label={`${title}. Choose a ${view === "days" ? "month" : view === "months" ? "year" : "date"}`}
          className="rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          {title}
        </button>
        <Arrow onClick={() => step(1)} label={`Next ${stepName}`} />
      </div>

      {view === "days" ? (
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
                onClick={() => onPick(iso)}
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
      ) : null}

      {view === "months" ? (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {MONTHS.map((label, index) => {
            const current = index === month.getMonth();
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setMonth(new Date(year, index, 1, 12));
                  setView("days");
                }}
                aria-pressed={current}
                className={`${WIDE_CELL} ${
                  current
                    ? "bg-primary font-medium text-primary-foreground hover:bg-primary-hover"
                    : "hover:bg-surface-strong"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {view === "years" ? (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {Array.from({ length: YEAR_PAGE }, (_, index) => yearPageStart + index).map((value) => {
            const current = value === year;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMonth(new Date(value, month.getMonth(), 1, 12));
                  setView("months");
                }}
                aria-pressed={current}
                className={`${WIDE_CELL} ${
                  current
                    ? "bg-primary font-medium text-primary-foreground hover:bg-primary-hover"
                    : "hover:bg-surface-strong"
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMonth(startOfMonth(new Date()));
            setView("days");
          }}
          className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          Today
        </button>
        {footer}
      </div>
    </div>
  );
}

function Arrow({
  onClick,
  label,
  back = false,
}: {
  onClick: () => void;
  label: string;
  back?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className={`size-4 ${back ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.5 4.5 13 10l-5.5 5.5" />
      </svg>
    </button>
  );
}
