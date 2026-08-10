"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Avatar } from "@/components/timesheets/avatar";
import { EntryFilterMenu } from "@/components/timesheets/entry-filters";
import {
  type EntryFilters,
  activeFilterCount,
  groupEntries,
} from "@/lib/entry-filters";
import {
  type FeaturePermission,
  type TimeEntry,
  deleteTimeEntry,
  formatDuration,
  totalDuration,
  updateTimeEntry,
} from "@/lib/timesheets";

const STATUSES: TimeEntry["status"][] = ["none", "billable", "billed"];

const STATUS_LABEL: Record<TimeEntry["status"], string> = {
  none: "—",
  billable: "Billable",
  billed: "Billed",
};

const STATUS_CLASS: Record<TimeEntry["status"], string> = {
  none: "text-muted",
  billable: "text-primary",
  billed: "text-muted",
};

const INPUT_CLASS =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

export function EntriesTable({
  projectId,
  timesheetId,
  entries,
  permission,
  filters,
  people,
  params,
}: {
  projectId: string;
  timesheetId: string;
  /** Already narrowed by `filters`; the menu only decides what arrives here. */
  entries: TimeEntry[];
  permission: FeaturePermission;
  filters: EntryFilters;
  people: { id: number; full_name: string }[];
  params: Record<string, string>;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtering = activeFilterCount(filters) > 0;

  if (entries.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-end">
          <EntryFilterMenu filters={filters} people={people} params={params} />
        </div>
        <div className="mt-3 rounded-xl border border-border bg-surface p-6">
          <h3 className="font-medium">
            {filtering ? "Nothing matches these filters" : "No time logged yet"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {filtering
              ? "Widen the date range, or clear the filters to see the whole timesheet."
              : "Upload a CSV above, and the entries will appear here."}
          </p>
        </div>
      </section>
    );
  }

  const total = totalDuration(entries);
  // Delete is the manage-level grant, so holding it also allows acting on
  // other people's entries.
  const canManageOthers = permission.delete;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">
          Logged time
          <span className="ml-2 text-sm font-normal text-muted">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
            {filtering ? " shown" : ""}
          </span>
        </h3>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">
            Total{" "}
            <span className="font-medium text-foreground">
              {formatDuration(total.hours, total.mins)}
            </span>
          </p>
          <EntryFilterMenu filters={filters} people={people} params={params} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Logged by
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Time
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Description
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          {groupEntries(entries, filters).map((day) => (
            <tbody key={day.key}>
              <tr className="border-b border-border bg-surface/60">
                <th
                  scope="colgroup"
                  colSpan={4}
                  className="px-4 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  {day.label}
                </th>
                <td className="px-4 py-2 text-right text-xs text-muted">
                  {formatDuration(
                    totalDuration(day.entries).hours,
                    totalDuration(day.entries).mins,
                  )}
                </td>
              </tr>
              {day.entries.map((entry) => {
              const mine = entry.by_me;
              const mayChange = permission.edit && (mine || canManageOthers);
              const mayRemove = permission.delete;

              return editing === entry.id ? (
                <EditRow
                  key={entry.id}
                  projectId={projectId}
                  timesheetId={timesheetId}
                  entry={entry}
                  onDone={() => {
                    setEditing(null);
                    setError(null);
                  }}
                  onError={setError}
                />
              ) : (
                <ReadRow
                  key={entry.id}
                  projectId={projectId}
                  timesheetId={timesheetId}
                  entry={entry}
                  mayChange={mayChange}
                  mayRemove={mayRemove}
                  confirming={confirming === entry.id}
                  onEdit={() => {
                    setEditing(entry.id);
                    setConfirming(null);
                    setError(null);
                  }}
                  onAskDelete={() => setConfirming(entry.id)}
                  onCancelDelete={() => setConfirming(null)}
                  onError={setError}
                />
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

function ReadRow({
  projectId,
  timesheetId,
  entry,
  mayChange,
  mayRemove,
  confirming,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onError,
}: {
  projectId: string;
  timesheetId: string;
  entry: TimeEntry;
  mayChange: boolean;
  mayRemove: boolean;
  confirming: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    onError(null);
    const result = await deleteTimeEntry(projectId, timesheetId, entry.id);
    setPending(false);
    if (result.ok) {
      onCancelDelete();
      router.refresh();
    } else {
      onError(result.error);
      onCancelDelete();
    }
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className="flex items-center gap-2">
          <Avatar person={entry.logged_by} />
          <span className={entry.by_me ? "font-medium" : ""}>
            {entry.logged_by?.full_name ?? "Unknown"}
          </span>
        </span>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {formatDuration(entry.logged_hours, entry.logged_mins)}
        {entry.timer ? (
          <span className="ml-2 text-xs text-muted" title="Recorded with a timer">
            timer
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        {entry.description ?? <span className="text-muted">—</span>}
      </td>
      <td className={`px-4 py-2.5 whitespace-nowrap ${STATUS_CLASS[entry.status]}`}>
        {STATUS_LABEL[entry.status]}
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        {confirming ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-xs text-muted">Delete this entry?</span>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
            >
              {pending ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface"
            >
              Keep
            </button>
          </span>
        ) : (
          <span className="inline-flex gap-1">
            {mayChange ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface hover:text-foreground"
              >
                Edit
              </button>
            ) : null}
            {mayRemove ? (
              <button
                type="button"
                onClick={onAskDelete}
                className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-red-500/10 hover:text-red-500"
              >
                Delete
              </button>
            ) : null}
          </span>
        )}
      </td>
    </tr>
  );
}

function EditRow({
  projectId,
  timesheetId,
  entry,
  onDone,
  onError,
}: {
  projectId: string;
  timesheetId: string;
  entry: TimeEntry;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(entry.date);
  const [hours, setHours] = useState(String(entry.logged_hours));
  const [mins, setMins] = useState(String(entry.logged_mins));
  const [description, setDescription] = useState(entry.description ?? "");
  const [status, setStatus] = useState<TimeEntry["status"]>(entry.status);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    onError(null);
    const result = await updateTimeEntry(projectId, timesheetId, entry.id, {
      date,
      logged_hours: Number(hours) || 0,
      logged_mins: Number(mins) || 0,
      status,
      description: description.trim() === "" ? null : description.trim(),
    });
    setPending(false);
    if (result.ok) {
      onDone();
      router.refresh();
    } else {
      onError(result.error);
    }
  }

  // One full-width cell rather than one input per column: the fields need more
  // room than the read-only columns allow, and this lets them wrap instead of
  // pushing the buttons out of view.
  return (
    <tr className="border-b border-border bg-surface last:border-b-0">
      <td colSpan={5} className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="text-xs text-muted">
            Date
            <DateField
              label="Date"
              value={date}
              onChange={setDate}
              required
              className={`${INPUT_CLASS} mt-1 block w-40`}
            />
          </div>

          <label className="text-xs text-muted">
            Time
            <span className="mt-1 flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                aria-label="Hours"
                className={`${INPUT_CLASS} w-16`}
              />
              <span aria-hidden>h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={mins}
                onChange={(event) => setMins(event.target.value)}
                aria-label="Minutes"
                className={`${INPUT_CLASS} w-16`}
              />
              <span aria-hidden>m</span>
            </span>
          </label>

          <label className="min-w-52 flex-1 text-xs text-muted">
            Description
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What did you work on?"
              className={`${INPUT_CLASS} mt-1 block w-full`}
            />
          </label>

          <label className="text-xs text-muted">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TimeEntry["status"])}
              className={`${INPUT_CLASS} mt-1 block`}
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === "none" ? "No status" : STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button type="button" onClick={onDone} className={buttonClass("ghost", "sm")}>
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={buttonClass("primary", "sm")}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
