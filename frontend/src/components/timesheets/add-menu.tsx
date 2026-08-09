"use client";

import { useEffect, useRef, useState } from "react";

import { AddTimeDialog } from "@/components/timesheets/add-time-dialog";
import { ImportDialog } from "@/components/timesheets/import-dialog";
import { buttonClass } from "@/components/ui/button";
import type { Timesheet } from "@/lib/timesheets";

type Choice = "time" | "bulk";

/**
 * One "Add" button covering both ways to get time onto a timesheet: a row at a
 * time, or a month at once.
 *
 * They were two buttons side by side, which read as two unrelated features and
 * grew the header every time another way to add time appeared. A menu keeps
 * the header to one control and puts the choice one click in.
 */
export function AddMenu({
  projectId,
  timesheets,
  timesheet,
}: {
  projectId: string;
  timesheets: Timesheet[];
  /** The timesheet on screen — what a bulk upload lands in. */
  timesheet: Timesheet;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [choice, setChoice] = useState<Choice | null>(null);

  // Same dismissal as the filter menu: anywhere outside, or Escape.
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

  function pick(next: Choice) {
    if (menu.current) menu.current.open = false;
    setChoice(next);
  }

  return (
    <>
      <details ref={menu} className="relative">
        <summary
          className={`${buttonClass("primary", "sm")} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
        >
          <PlusIcon className="size-4" />
          Add
          <ChevronIcon className="size-4 opacity-80" />
        </summary>

        <div className="absolute top-full right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-background py-1 shadow-xl">
          <MenuItem icon={ClockIcon} onSelect={() => pick("time")}>
            Add time
          </MenuItem>
          <MenuItem icon={UploadIcon} onSelect={() => pick("bulk")}>
            Bulk upload time
          </MenuItem>
        </div>
      </details>

      {/* Mounted only while open, so each visit starts from a clean form and a
          clean upload rather than whatever the last one was left showing. */}
      {choice === "time" ? (
        <AddTimeDialog
          projectId={projectId}
          timesheets={timesheets}
          selectedId={timesheet.id}
          open
          onClose={() => setChoice(null)}
        />
      ) : null}

      {choice === "bulk" ? (
        <ImportDialog
          projectId={projectId}
          timesheet={timesheet}
          open
          onClose={() => setChoice(null)}
        />
      ) : null}
    </>
  );
}

function MenuItem({
  icon: Icon,
  onSelect,
  children,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface"
    >
      <Icon className="size-4 shrink-0 text-muted" />
      {children}
    </button>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4.2l2.6 1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13v2A1.5 1.5 0 005 16.5h10a1.5 1.5 0 001.5-1.5v-2" strokeLinecap="round" />
    </svg>
  );
}
