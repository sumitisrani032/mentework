export type Project = {
  id: number;
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
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (response.ok) return { ok: true, id: (payload as { id: number }).id };
  return { ok: false, error: describeError(payload) ?? `Could not create (${response.status}).` };
}

export type Timesheet = {
  id: number;
  title: string;
  project_id: number;
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

/** Sum a list of entries into an hours/minutes pair. */
export function totalDuration(entries: TimeEntry[]): { hours: number; mins: number } {
  const minutes = entries.reduce(
    (total, entry) => total + entry.logged_hours * 60 + entry.logged_mins,
    0,
  );
  return { hours: Math.floor(minutes / 60), mins: minutes % 60 };
}

export type TimeEntryPatch = {
  date?: string;
  logged_hours?: number;
  logged_mins?: number;
  status?: TimeEntry["status"];
  description?: string | null;
};

function entryUrl(projectId: number, timesheetId: number, entryId: number): string {
  return `/api/projects/${projectId}/timesheets/${timesheetId}/time/${entryId}`;
}

export async function updateTimeEntry(
  projectId: number,
  timesheetId: number,
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
  projectId: number,
  timesheetId: number,
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
  projectId: number,
  input: CreateTimesheetInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const response = await fetch(`/api/projects/${projectId}/timesheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);
  if (response.ok) {
    return { ok: true, id: (payload as { id: number }).id };
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
  projectId: number,
  timesheetId: number,
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
