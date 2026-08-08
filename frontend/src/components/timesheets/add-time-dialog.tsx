"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { buttonClass } from "@/components/ui/button";
import { type Timesheet, createTimeEntry, formatDuration } from "@/lib/timesheets";

const FIELD_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm " +
  "placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring";

const STATUSES = [
  { value: "none", label: "None" },
  { value: "billable", label: "Billable" },
  { value: "billed", label: "Billed" },
] as const;

/** Today in the browser's own timezone, as the yyyy-mm-dd a date input wants. */
function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function AddTimeDialog({
  projectId,
  timesheets,
  selectedId,
}: {
  projectId: number;
  timesheets: Timesheet[];
  selectedId: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [timesheetId, setTimesheetId] = useState(selectedId);
  const [date, setDate] = useState(today());
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("none");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const chosen = timesheets.find((item) => item.id === timesheetId) ?? timesheets[0];

  function close() {
    setOpen(false);
    setDate(today());
    setHours("");
    setMinutes("");
    setDescription("");
    setStatus("none");
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createTimeEntry(projectId, timesheetId, {
      date,
      logged_hours: Number(hours) || 0,
      logged_mins: Number(minutes) || 0,
      status,
      description: description.trim() || null,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    close();
    router.push(`/projects/${projectId}/time?timesheet=${timesheetId}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTimesheetId(selectedId);
          setOpen(true);
        }}
        className={buttonClass("primary", "sm")}
      >
        Add time
      </button>

      <Dialog open={open} onClose={close} title="Add time">
        <form onSubmit={submit}>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <label className="text-sm font-medium">
              Timesheet
              <select
                value={timesheetId}
                onChange={(event) => setTimesheetId(Number(event.target.value))}
                className={FIELD_CLASS}
              >
                {timesheets
                  .filter((item) => !item.archived)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </label>

            <div className="text-sm">
              <span className="font-medium text-muted">Time logged</span>
              <p className="mt-1.5 border-t border-border pt-2 text-lg font-semibold">
                {chosen ? formatDuration(chosen.logged_hours, chosen.logged_mins) : "—"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium">
              Hours
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium">
              Minutes
              <input
                type="number"
                min={0}
                max={59}
                inputMode="numeric"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className={FIELD_CLASS}
              />
            </label>
          </div>

          <label className="mt-5 block text-sm font-medium">
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What did you work on?"
              className={`${FIELD_CLASS} resize-y`}
            />
          </label>

          <label className="mt-5 block text-sm font-medium sm:max-w-xs">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={FIELD_CLASS}
            >
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p role="alert" className="mt-5 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              disabled={pending || (Number(hours) || 0) * 60 + (Number(minutes) || 0) <= 0}
              className={buttonClass("primary", "md")}
            >
              {pending ? "Adding…" : "Add"}
            </button>
            <button type="button" onClick={close} className={buttonClass("secondary", "md")}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
