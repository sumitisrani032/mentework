"use client";

import { Calendar } from "@/components/ui/calendar";

/**
 * A month at a time, picking a start day and then an end day.
 *
 * One calendar rather than two date fields: choosing "the 3rd to the 17th" is
 * a thing you do by looking at a month. The grid, the month and year jumps and
 * the styling all come from the shared Calendar, so this is only the rule for
 * what a second click means.
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
  function pick(iso: string) {
    // A complete range starts over; an incomplete one is completed, in
    // whichever direction the second click lands.
    if (!start || (start && end)) return onChange(iso, null);
    return iso < start ? onChange(iso, start) : onChange(start, iso);
  }

  return <Calendar start={start} end={end} onPick={pick} />;
}
