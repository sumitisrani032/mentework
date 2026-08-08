import { type Timesheet, formatDuration } from "@/lib/timesheets";

/** The right-hand totals for a timesheet, all derived from its entries. */
export function SummaryPanel({ timesheet }: { timesheet: Timesheet }) {
  const rows = [
    {
      label: "Estimated time",
      value: formatDuration(timesheet.estimated_hours, timesheet.estimated_mins),
      tone: "text-foreground",
    },
    {
      label: "Total logged time",
      value: formatDuration(timesheet.logged_hours, timesheet.logged_mins),
      tone: "text-foreground",
    },
    {
      label: "Billed time",
      value: formatDuration(timesheet.billed_hours, timesheet.billed_mins),
      tone: "text-primary",
    },
    {
      label: "Billable time",
      value: formatDuration(timesheet.billable_hours, timesheet.billable_mins),
      tone: "text-primary",
    },
    {
      label: "Non-billable",
      value: formatDuration(timesheet.non_billable_hours, timesheet.non_billable_mins),
      tone: "text-muted",
    },
  ];

  return (
    <aside className="w-full shrink-0 xl:w-64">
      <h2 className="font-medium">Summary</h2>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-border bg-surface px-4 py-3">
            <dd className={`text-lg font-semibold ${row.tone}`}>{row.value}</dd>
            <dt className="mt-0.5 text-sm text-muted">{row.label}</dt>
          </div>
        ))}
      </dl>
    </aside>
  );
}
