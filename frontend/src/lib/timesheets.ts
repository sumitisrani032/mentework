export type Project = {
  id: number;
  name: string;
  key: string;
  description: string | null;
  status: string;
};

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
  archived: boolean;
  private: boolean;
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

export function formatDuration(hours: number | null, mins: number | null): string {
  if (hours === null && mins === null) return "—";
  const h = hours ?? 0;
  const m = mins ?? 0;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
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
