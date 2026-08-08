import { type TimeEntry, formatDuration, totalDuration } from "@/lib/timesheets";

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

export function EntriesTable({ entries }: { entries: TimeEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="font-medium">No time logged yet</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Upload a CSV above, and the entries will appear here.
        </p>
      </div>
    );
  }

  const total = totalDuration(entries);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">
          Logged time
          <span className="ml-2 text-sm font-normal text-muted">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </h3>
        <p className="text-sm text-muted">
          Total <span className="font-medium text-foreground">{formatDuration(total.hours, total.mins)}</span>
        </p>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Date
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
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{entry.date}</td>
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
                  {!entry.by_me ? (
                    <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                      someone else
                    </span>
                  ) : null}
                </td>
                <td className={`px-4 py-2.5 whitespace-nowrap ${STATUS_CLASS[entry.status]}`}>
                  {STATUS_LABEL[entry.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
