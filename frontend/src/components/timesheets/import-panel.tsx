"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { buttonClass } from "@/components/ui/button";
import {
  type ImportRejection,
  type ImportResult,
  type Timesheet,
  formatDate,
  formatDuration,
  uploadTimeCsv,
} from "@/lib/timesheets";

/** Mirrors MAX_ROWS in the backend parser, which is what actually enforces it. */
const MAX_ROWS = 31;

type Stage =
  | { name: "idle" }
  | { name: "checking" }
  | { name: "preview"; result: ImportResult; file: File }
  | { name: "importing"; file: File }
  | { name: "done"; result: ImportResult }
  | { name: "rejected"; rejection: ImportRejection };

const STATUS_LABEL: Record<string, string> = {
  none: "—",
  billable: "Billable",
  billed: "Billed",
};

export function ImportPanel({
  projectId,
  timesheet,
  // Inside a dialog the surrounding card and heading are already provided.
  bare = false,
}: {
  projectId: string;
  timesheet: Timesheet;
  bare?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [dragging, setDragging] = useState(false);

  async function check(file: File) {
    setStage({ name: "checking" });
    // Always validate first, so nothing is written until it has been seen.
    const outcome = await uploadTimeCsv(projectId, timesheet.id, file, { dryRun: true });
    setStage(
      outcome.ok
        ? { name: "preview", result: outcome.result, file }
        : { name: "rejected", rejection: outcome.rejection },
    );
  }

  async function commit(file: File) {
    setStage({ name: "importing", file });
    const outcome = await uploadTimeCsv(projectId, timesheet.id, file, { dryRun: false });
    if (outcome.ok) {
      setStage({ name: "done", result: outcome.result });
      router.refresh();
    } else {
      setStage({ name: "rejected", rejection: outcome.rejection });
    }
  }

  function reset() {
    setStage({ name: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = stage.name === "checking" || stage.name === "importing";

  return (
    <div className={bare ? "" : "rounded-xl border border-border bg-surface p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {bare ? null : <h3 className="font-medium">Upload a month of time</h3>}
          <p className={`text-sm text-muted ${bare ? "" : "mt-1"}`}>
            A CSV with <code className="font-mono text-xs">date</code>,{" "}
            <code className="font-mono text-xs">logged_hours</code>,{" "}
            <code className="font-mono text-xs">logged_minutes</code>,{" "}
            <code className="font-mono text-xs">description</code> and{" "}
            <code className="font-mono text-xs">status</code>. You will see it before anything is
            saved.
          </p>
        </div>
        <a
          href={`/api/projects/${projectId}/timesheets/template`}
          className={buttonClass("secondary", "sm")}
        >
          Download template
        </a>
      </div>

      {stage.name === "idle" || stage.name === "checking" ? (
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void check(file);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:bg-background"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void check(file);
            }}
          />
          <span className="text-sm font-medium">
            {stage.name === "checking" ? "Checking the file…" : "Drop a CSV here, or browse"}
          </span>
          <span className="mt-1 text-xs text-muted">
            Dates as DD/MM/YYYY, hours as 1:40 or 1.5, minutes as a whole number under 60
          </span>
        </label>
      ) : null}

      {stage.name === "idle" || stage.name === "checking" ? (
        <p className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
          <span className="font-medium text-foreground">Note:</span> one upload covers at most{" "}
          {MAX_ROWS} rows of time — a month, a row per day. A longer file is rejected in full
          rather than partly imported, so split it and upload each month separately.
        </p>
      ) : null}

      {stage.name === "rejected" ? (
        <Rejected rejection={stage.rejection} onRetry={reset} />
      ) : null}

      {stage.name === "preview" || stage.name === "importing" ? (
        <Preview
          result={stage.name === "preview" ? stage.result : null}
          busy={stage.name === "importing"}
          onCancel={reset}
          onConfirm={() => void commit(stage.file)}
        />
      ) : null}

      {stage.name === "done" ? <Done result={stage.result} onAgain={reset} /> : null}
    </div>
  );
}

function Rejected({
  rejection,
  onRetry,
}: {
  rejection: ImportRejection;
  onRetry: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
      <p role="alert" className="text-sm font-medium text-red-500">
        {rejection.message}
      </p>
      <p className="mt-1 text-xs text-muted">
        Nothing was saved. Fix these lines and upload the file again.
      </p>

      {rejection.errors.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {rejection.errors.map((error, index) => (
            <li key={`${error.row}-${error.column}-${index}`} className="text-sm">
              <span className="font-mono text-xs text-muted">
                row {error.row} · {error.column}
              </span>{" "}
              — {error.message}
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" onClick={onRetry} className={`${buttonClass("secondary", "sm")} mt-4`}>
        Choose another file
      </button>
    </div>
  );
}

function Preview({
  result,
  busy,
  onCancel,
  onConfirm,
}: {
  result: ImportResult | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!result) {
    return <p className="mt-4 text-sm text-muted">Importing…</p>;
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">{result.imported}</span> row
          {result.imported === 1 ? "" : "s"} ready ·{" "}
          {formatDuration(result.logged_hours, result.logged_mins)}
          {result.skipped_duplicates > 0 ? (
            <span className="text-muted">
              {" "}
              · {result.skipped_duplicates} already logged, will be skipped
            </span>
          ) : null}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm")}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || result.imported === 0}
            className={buttonClass("primary", "sm")}
          >
            {busy ? "Importing…" : `Import ${result.imported} rows`}
          </button>
        </div>
      </div>

      <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border">
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Row
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Date
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Time
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Description
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {result.preview.map((row) => (
              <tr
                key={row.row}
                className={`border-b border-border last:border-b-0 ${
                  row.duplicate ? "opacity-50" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs text-muted">{row.row}</td>
                <td className="px-3 py-2 font-mono text-xs">{formatDate(row.date)}</td>
                <td className="px-3 py-2">
                  {formatDuration(row.logged_hours, row.logged_mins)}
                </td>
                <td className="px-3 py-2">
                  {row.description ?? <span className="text-muted">—</span>}
                  {row.duplicate ? (
                    <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                      already logged
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted">{STATUS_LABEL[row.status] ?? row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Done({ result, onAgain }: { result: ImportResult; onAgain: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p role="status" className="text-sm font-medium text-primary">
        Imported {result.imported} row{result.imported === 1 ? "" : "s"} ·{" "}
        {formatDuration(result.logged_hours, result.logged_mins)}
      </p>
      {result.skipped_duplicates > 0 ? (
        <p className="mt-1 text-xs text-muted">
          {result.skipped_duplicates} row
          {result.skipped_duplicates === 1 ? " was" : "s were"} skipped as already logged.
        </p>
      ) : null}
      <button type="button" onClick={onAgain} className={`${buttonClass("secondary", "sm")} mt-3`}>
        Upload another file
      </button>
    </div>
  );
}
