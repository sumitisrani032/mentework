"use client";

import { useEffect, useRef, useState } from "react";

import { Calendar, isoDay } from "@/components/ui/calendar";
import { formatDate } from "@/lib/timesheets";

/**
 * One date, picked from the same calendar the filters use.
 *
 * Replaces `<input type="date">`, which each browser draws its own way and in
 * its own order — a US Chrome shows mm/dd/yyyy whatever the rest of the
 * workspace has agreed to. This shows DD/MM/YYYY like every other date here,
 * and opens the calendar people already know from the time filters.
 *
 * The value stays yyyy-mm-dd, so callers and the API are unaffected.
 */
export function DateField({
  value,
  onChange,
  required = false,
  className = "",
  label,
}: {
  /** yyyy-mm-dd, or empty for no date. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  /** Names the field for a screen reader when the visible label is elsewhere. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

  // Same dismissal as the other menus: anywhere outside, or Escape.
  useEffect(() => {
    if (!open) return;

    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && wrapper.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={wrapper} className="relative block">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={label}
        className={`${className} text-left ${value ? "" : "text-muted"}`}
      >
        {value ? formatDate(value) : "Pick a date"}
      </button>

      {open ? (
        <span className="absolute top-full left-0 z-40 mt-1.5 block w-72 rounded-xl border border-border bg-background p-3 shadow-xl">
          <Calendar
            start={value || null}
            end={value || null}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
            footer={
              <>
                <button
                  type="button"
                  onClick={() => {
                    onChange(isoDay(new Date()));
                    setOpen(false);
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                >
                  Pick today
                </button>
                {value && !required ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
                  >
                    Clear
                  </button>
                ) : null}
              </>
            }
          />
        </span>
      ) : null}
    </span>
  );
}
