"use client";

import Link from "next/link";
import { useState } from "react";

import { type Timesheet, formatDuration } from "@/lib/timesheets";

/**
 * The Time section, which expands to list the project's timesheets.
 *
 * Open by default whenever Time is the section being viewed, so arriving on a
 * timesheet shows you where you are without a click.
 */
export function TimeNav({
  projectId,
  timesheets,
  activeTimesheetId,
  active,
}: {
  projectId: number;
  timesheets: Timesheet[];
  activeTimesheetId: number | null;
  active: boolean;
}) {
  const [open, setOpen] = useState(active);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
          active
            ? "bg-primary/12 font-medium text-foreground hover:bg-primary/20"
            : "text-muted hover:bg-surface-strong hover:text-foreground"
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M7.5 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Time
      </button>

      {open ? (
        <ul className="mt-0.5 space-y-0.5 border-l border-border pl-3 ml-3.5">
          {timesheets.length === 0 ? (
            <li className="px-2.5 py-1.5 text-xs text-muted">No timesheets yet</li>
          ) : (
            timesheets.map((timesheet) => (
              <li key={timesheet.id}>
                <Link
                  href={`/projects/${projectId}/time?timesheet=${timesheet.id}`}
                  aria-current={timesheet.id === activeTimesheetId ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    timesheet.id === activeTimesheetId
                      ? "font-medium text-primary hover:bg-primary/12"
                      : "text-muted hover:bg-surface-strong hover:text-foreground"
                  }`}
                >
                  <span className="truncate">{timesheet.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {formatDuration(timesheet.logged_hours, timesheet.logged_mins)}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
