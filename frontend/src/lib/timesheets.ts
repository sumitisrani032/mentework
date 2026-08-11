export type Project = {
  /** The project's public id — a UUID. The row key never reaches the browser. */
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  owner_id: number | null;
};

export type CreateProjectInput = {
  name: string;
  key: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

/** Create a project. The API also puts the creator on it as Project Manager. */
export async function createProject(
  input: CreateProjectInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (response.ok) return { ok: true, id: (payload as { id: string }).id };
  return { ok: false, error: describeError(payload) ?? `Could not create (${response.status}).` };
}

export type Timesheet = {
  /** Public id, as with a project. */
  id: string;
  title: string;
  project_id: string;
  estimated_hours: number | null;
  estimated_mins: number | null;
  logged_hours: number | null;
  logged_mins: number | null;
  billable_hours: number | null;
  billable_mins: number | null;
  billed_hours: number | null;
  billed_mins: number | null;
  non_billable_hours: number | null;
  non_billable_mins: number | null;
  archived: boolean;
  private: boolean;
};

export type LoggedBy = { id: number; full_name: string; initials: string };

export type TimeEntry = {
  id: number;
  logged_by: LoggedBy | null;
  status: "none" | "billable" | "billed";
  description: string | null;
  date: string;
  logged_hours: number;
  logged_mins: number;
  timer: boolean;
  by_me: boolean;
};

export type FeaturePermission = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

/** The caller's permissions inside one project, keyed by feature. */
export type ProjectPermissions = Record<string, FeaturePermission>;

export const NO_PERMISSION: FeaturePermission = {
  view: false,
  create: false,
  edit: false,
  delete: false,
};

export type ImportPreviewRow = {
  row: number;
  date: string;
  logged_hours: number;
  logged_mins: number;
  description: string | null;
  status: "none" | "billable" | "billed";
  duplicate: boolean;
};

export type ImportResult = {
  imported: number;
  skipped_duplicates: number;
  logged_hours: number;
  logged_mins: number;
  dry_run: boolean;
  preview: ImportPreviewRow[];
};

export type ImportRowError = { row: number; column: string; message: string };

export type ImportRejection = { message: string; errors: ImportRowError[] };

/** Either the file parsed, or it did not and we have a list of problems. */
export type ImportOutcome =
  | { ok: true; result: ImportResult }
  | { ok: false; rejection: ImportRejection };

/** Pull a readable message out of a FastAPI error body. */
function describeError(payload: unknown): string | null {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    return first.msg?.replace(/^Value error, /, "") ?? null;
  }
  return null;
}

export function formatDuration(hours: number | null, mins: number | null): string {
  if (hours === null && mins === null) return "—";
  const h = hours ?? 0;
  const m = mins ?? 0;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Render a yyyy-mm-dd date as DD/MM/YYYY — the one date format the workspace
 * shows, everywhere, so a date reads the same on every screen.
 *
 * Built from the string's own parts rather than through toLocaleDateString:
 * the locale decides day-first or month-first, which is exactly the variation
 * this is meant to remove.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * A day as a heading: "8 July".
 *
 * The exception to DD/MM/YYYY, and deliberately so. A heading is read, not
 * compared: "8 July" says what it is at a glance where 08/07 has to be decoded.
 * The year is dropped because a timesheet is a month of work and repeating
 * 2026 down the page tells nobody anything.
 *
 * Day-first and spelled in English rather than through toLocaleDateString,
 * which would put the month first for a US reader and break step with every
 * other date here.
 */
export function formatDayHeading(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const name = MONTH_NAMES[month - 1];
  if (!name || !day || !year) return isoDate;
  return `${day} ${name}`;
}

/** Group entries under their date, newest first, preserving order within a day. */
export function groupByDate(entries: TimeEntry[]): { date: string; entries: TimeEntry[] }[] {
  const byDate = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const bucket = byDate.get(entry.date);
    if (bucket) bucket.push(entry);
    else byDate.set(entry.date, [entry]);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, group]) => ({ date, entries: group }));
}

/** Sum a list of entries into an hours/minutes pair. */
export function totalDuration(entries: TimeEntry[]): { hours: number; mins: number } {
  const minutes = entries.reduce(
    (total, entry) => total + entry.logged_hours * 60 + entry.logged_mins,
    0,
  );
  return { hours: Math.floor(minutes / 60), mins: minutes % 60 };
}

export type NewTimeEntry = {
  date: string;
  logged_hours: number;
  logged_mins: number;
  status: string;
  description: string | null;
};

/** Log one entry against a timesheet. */
export async function createTimeEntry(
  projectId: string,
  timesheetId: string,
  entry: NewTimeEntry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(`/api/projects/${projectId}/timesheets/${timesheetId}/time`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (response.ok) return { ok: true };

  const payload = await response.json().catch(() => null);
  return { ok: false, error: describeError(payload) ?? `Could not add time (${response.status}).` };
}

export type TimeEntryPatch = {
  date?: string;
  logged_hours?: number;
  logged_mins?: number;
  status?: TimeEntry["status"];
  description?: string | null;
};

function entryUrl(projectId: string, timesheetId: string, entryId: number): string {
  return `/api/projects/${projectId}/timesheets/${timesheetId}/time/${entryId}`;
}

export async function updateTimeEntry(
  projectId: string,
  timesheetId: string,
  entryId: number,
  patch: TimeEntryPatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(entryUrl(projectId, timesheetId, entryId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (response.ok) return { ok: true };

  const payload = await response.json().catch(() => null);
  return { ok: false, error: describeError(payload) ?? `Could not save (${response.status}).` };
}

export async function deleteTimeEntry(
  projectId: string,
  timesheetId: string,
  entryId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(entryUrl(projectId, timesheetId, entryId), { method: "DELETE" });
  if (response.ok) return { ok: true };

  const payload = await response.json().catch(() => null);
  return { ok: false, error: describeError(payload) ?? `Could not delete (${response.status}).` };
}

export type CreateTimesheetInput = {
  title: string;
  estimated_hours: number | null;
  estimated_mins: number | null;
  private: boolean;
};

/** Create a timesheet through this app's route handler, which holds the session. */
export async function createTimesheet(
  projectId: string,
  input: CreateTimesheetInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const response = await fetch(`/api/projects/${projectId}/timesheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);
  if (response.ok) {
    return { ok: true, id: (payload as { id: string }).id };
  }

  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return { ok: false, error: detail };
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    return { ok: false, error: first.msg ?? "That did not work." };
  }
  return { ok: false, error: `Could not create the timesheet (${response.status}).` };
}

/**
 * Send a CSV to be validated or imported.
 *
 * Goes through this app's route handler, which attaches the session — the
 * token is httpOnly, so the browser cannot call the API itself.
 */
export async function uploadTimeCsv(
  projectId: string,
  timesheetId: string,
  file: File,
  options: { dryRun: boolean; allowDuplicates?: boolean },
): Promise<ImportOutcome> {
  const body = new FormData();
  body.append("file", file);

  const query = new URLSearchParams({
    dry_run: String(options.dryRun),
    allow_duplicates: String(options.allowDuplicates ?? false),
  });

  const response = await fetch(
    `/api/projects/${projectId}/timesheets/${timesheetId}/import?${query}`,
    { method: "POST", body },
  );

  const payload = await response.json().catch(() => null);

  if (response.ok) {
    return { ok: true, result: payload as ImportResult };
  }

  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (detail && typeof detail === "object" && "errors" in detail) {
    return { ok: false, rejection: detail as ImportRejection };
  }
  return {
    ok: false,
    rejection: {
      message:
        typeof detail === "string" ? detail : `The upload failed (${response.status}).`,
      errors: [],
    },
  };
}
