import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { CreateTimesheet } from "@/components/timesheets/create-timesheet";
import { EntriesTable } from "@/components/timesheets/entries-table";
import { AddTimeDialog } from "@/components/timesheets/add-time-dialog";
import { ImportDialog } from "@/components/timesheets/import-dialog";
import { SummaryPanel } from "@/components/timesheets/summary-panel";
import {
  type FilterParams,
  applyFilters,
  parseFilters,
  peopleIn,
} from "@/lib/entry-filters";
import { getSession, organizationPermissions } from "@/lib/session";
import { NO_PERMISSION, formatDuration } from "@/lib/timesheets";
import {
  fetchProjectPermissions,
  fetchProjects,
  fetchTimeEntries,
  fetchTimesheets,
} from "@/lib/timesheets-server";

export const metadata: Metadata = {
  title: "Time — Mentework",
  robots: { index: false, follow: false },
};

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export default async function ProjectTimePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ timesheet?: string } & FilterParams>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { projectId } = await params;
  const query = await searchParams;
  const { timesheet: timesheetParam } = query;
  const filters = parseFilters(query);

  const projects = await fetchProjects();
  const project = projects.find((item) => item.id === Number(projectId));
  if (!project) {
    notFound();
  }

  const [timesheets, permissions] = await Promise.all([
    fetchTimesheets(project.id),
    fetchProjectPermissions(project.id),
  ]);

  const timesheetPermission = permissions.timesheet ?? NO_PERMISSION;
  const canLogTime = timesheetPermission.create;

  const selected =
    timesheets?.find((item) => item.id === Number(timesheetParam)) ??
    timesheets?.find((item) => !item.archived) ??
    null;
  const entries = selected ? await fetchTimeEntries(project.id, selected.id) : [];

  return (
    <AppShell
      session={session}
      projects={projects}
      project={project}
      permissions={permissions}
      organizationPermissions={organizationPermissions(session)}
      active="time"
      timesheets={timesheets ?? []}
      activeTimesheetId={selected?.id ?? null}
    >
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {selected ? selected.title : "Time"}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {project.name}
              {selected
                ? ` · ${formatDuration(selected.logged_hours, selected.logged_mins)} logged`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canLogTime && selected && !selected.archived ? (
              <>
                <AddTimeDialog
                  projectId={project.id}
                  timesheets={timesheets ?? []}
                  selectedId={selected.id}
                />
                <ImportDialog projectId={project.id} timesheet={selected} />
              </>
            ) : null}
            {canLogTime ? <CreateTimesheet projectId={project.id} /> : null}
          </div>
        </div>

      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {timesheets === null ? (
          <Notice title="You cannot view time on this project">
            Viewing timesheets needs the <code className="font-mono">timesheet</code> view
            permission.
          </Notice>
        ) : timesheets.length === 0 ? (
          <Notice title="No timesheets in this project">
            {canLogTime
              ? "Create one with the button above, then log time against it."
              : "Ask someone who can manage timesheets to create one."}
          </Notice>
        ) : !selected ? (
          <Notice title="Select a timesheet">Choose one above to see the time logged.</Notice>
        ) : (
          <div className="flex flex-col gap-8 xl:flex-row">
            <div className="min-w-0 flex-1 space-y-8">
              {selected.archived ? (
                <Notice title="This timesheet is archived">
                  Archived timesheets cannot take new time.
                </Notice>
              ) : null}

              <EntriesTable
                projectId={project.id}
                timesheetId={selected.id}
                entries={applyFilters(entries, filters)}
                permission={timesheetPermission}
                filters={filters}
                people={peopleIn(entries)}
                params={Object.fromEntries(
                  Object.entries(query).filter(([, value]) => typeof value === "string"),
                )}
              />
            </div>

            <SummaryPanel timesheet={selected} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
