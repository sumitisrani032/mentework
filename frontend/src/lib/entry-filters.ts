import { type TimeEntry, formatDate, formatDayHeading } from "@/lib/timesheets";

export type StatusFilter = "all" | TimeEntry["status"];
export type GroupBy = "date" | "person";
export type Order = "desc" | "asc";

/**
 * How a timesheet listing is narrowed and arranged.
 *
 * Kept in the URL rather than component state: a filtered month is something
 * people send to each other, and it survives an edit reloading the page.
 */
export type EntryFilters = {
  /** Inclusive yyyy-mm-dd bounds. */
  from: string | null;
  to: string | null;
  status: StatusFilter;
  /** The id of whoever logged the entry. */
  loggedBy: string | null;
  groupBy: GroupBy;
  order: Order;
};

/** The query string this reads, straight off the page's searchParams. */
export type FilterParams = {
  from?: string;
  to?: string;
  status?: string;
  by?: string;
  group?: string;
  order?: string;
};

const STATUSES: StatusFilter[] = ["all", "none", "billable", "billed"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(params: FilterParams): EntryFilters {
  const status = STATUSES.find((value) => value === params.status) ?? "all";
  return {
    from: params.from && DATE.test(params.from) ? params.from : null,
    to: params.to && DATE.test(params.to) ? params.to : null,
    status,
    loggedBy: params.by || null,
    groupBy: params.group === "person" ? "person" : "date",
    order: params.order === "asc" ? "asc" : "desc",
  };
}

/**
 * How many filters are hiding something.
 *
 * Grouping and ordering rearrange the same rows, so they are not counted — a
 * badge that says "2" should mean two things are being left out.
 */
export function activeFilterCount(filters: EntryFilters): number {
  return [filters.from ?? filters.to, filters.status !== "all" || null, filters.loggedBy].filter(
    Boolean,
  ).length;
}

export function applyFilters(entries: TimeEntry[], filters: EntryFilters): TimeEntry[] {
  return entries.filter((entry) => {
    if (filters.from && entry.date < filters.from) return false;
    if (filters.to && entry.date > filters.to) return false;
    if (filters.status !== "all" && entry.status !== filters.status) return false;
    // loggedBy arrives off the query string, so it is compared as text — an
    // id is a number now, and number !== string is true for every entry.
    if (filters.loggedBy && String(entry.logged_by?.id) !== filters.loggedBy) return false;
    return true;
  });
}

/** How the chosen range reads on the Filters row. */
export function rangeLabel(from: string | null, to: string | null): string {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Until ${formatDate(to)}`;
  return "All";
}

export type EntryGroup = { key: string; label: string; entries: TimeEntry[] };

/** Everyone who has logged time here, for the "Logged by" choices. */
export function peopleIn(entries: TimeEntry[]): { id: number; full_name: string }[] {
  const people = new Map<number, string>();
  for (const entry of entries) {
    if (entry.logged_by) people.set(entry.logged_by.id, entry.logged_by.full_name);
  }
  return [...people.entries()]
    .map(([id, full_name]) => ({ id, full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Arrange entries into the sections the table draws, in the chosen order. */
export function groupEntries(entries: TimeEntry[], filters: EntryFilters): EntryGroup[] {
  const direction = filters.order === "asc" ? 1 : -1;
  const groups = new Map<string, EntryGroup>();

  for (const entry of entries) {
    const key =
      filters.groupBy === "person" ? String(entry.logged_by?.id ?? "unknown") : entry.date;
    const label =
      filters.groupBy === "person"
        ? (entry.logged_by?.full_name ?? "Unknown")
        : formatDayHeading(entry.date);

    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { key, label, entries: [entry] });
  }

  const sorted = [...groups.values()].sort((a, b) =>
    filters.groupBy === "person"
      ? a.label.localeCompare(b.label)
      : direction * a.key.localeCompare(b.key),
  );

  // Within a section the date still leads, so a person's block reads like their
  // own diary rather than the order things happened to be typed in.
  for (const group of sorted) {
    group.entries.sort((a, b) => direction * a.date.localeCompare(b.date));
  }
  return sorted;
}
