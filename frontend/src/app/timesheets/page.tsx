import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreateTimesheet } from "@/components/timesheets/create-timesheet";
import { EntriesTable } from "@/components/timesheets/entries-table";
import { ImportPanel } from "@/components/timesheets/import-panel";
import { Container } from "@/components/ui/section";
import { getSession } from "@/lib/session";
import type { ProjectPermissions, Timesheet } from "@/lib/timesheets";
import { NO_PERMISSION, formatDuration } from "@/lib/timesheets";
import {
  fetchProjectPermissions,
  fetchProjects,
  fetchTimeEntries,
  fetchTimesheets,
} from "@/lib/timesheets-server";

export const metadata: Metadata = {
  title: "Timesheets — Mentework",
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

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; timesheet?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { project: projectParam, timesheet: timesheetParam } = await searchParams;
  const projects = await fetchProjects();
  const project = projects.find((item) => item.id === projectParam) ?? projects[0];

  const [timesheets, permissions]: [Timesheet[] | null, ProjectPermissions] = project
    ? await Promise.all([fetchTimesheets(project.id), fetchProjectPermissions(project.id)])
    : [null, {}];

  const canLogTime = (permissions.timesheet ?? NO_PERMISSION).create;

  const selected =
    timesheets?.find((item) => item.id === Number(timesheetParam)) ??
    timesheets?.find((item) => !item.archived) ??
    null;

  const entries = selected && project ? await fetchTimeEntries(project.id, selected.id) : [];

  return (
    <>
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <span className="hidden text-sm text-muted sm:inline">
              {session.organization.name}
            </span>
          </div>
          <ThemeToggle />
        </Container>
      </header>

      <main className="flex-1">
        <Container className="py-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Timesheets</h1>
              <p className="mt-2 text-muted">
                Log time as you go, or upload a whole month at once.
              </p>
            </div>
            {project && canLogTime ? <CreateTimesheet projectId={project.id} /> : null}
          </div>

          {projects.length === 0 ? (
            <div className="mt-8">
              <Notice title="No projects yet">
                You have not been given access to a project. Ask an administrator to add you to one,
                then seed the demo data with <code className="font-mono">npm run db:seed</code> if
                you are running this locally.
              </Notice>
            </div>
          ) : (
            <>
              {/* Project picker — plain links, so it works without JavaScript. */}
              <nav aria-label="Projects" className="mt-8 flex flex-wrap gap-2">
                {projects.map((item) => {
                  const isActive = item.id === project?.id;
                  return (
                    <Link
                      key={item.id}
                      href={`/timesheets?project=${item.id}`}
                      aria-current={isActive}
                      className={`rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                        isActive
                          ? "border-primary/50 bg-primary/10 font-medium"
                          : "border-border text-muted hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      <span className="font-mono text-xs">{item.key}</span> {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-8">
                {timesheets === null ? (
                  <Notice title="Could not load timesheets">
                    You may not have permission to view timesheets on this project.
                  </Notice>
                ) : timesheets.length === 0 ? (
                  <Notice title="No timesheets in this project">
                    {canLogTime
                      ? "Create one with the button above, then log time against it."
                      : "Ask someone who can manage timesheets to create one."}
                  </Notice>
                ) : (
                  <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
                    <nav aria-label="Timesheets" className="flex flex-col gap-1.5">
                      {timesheets.map((item) => {
                        const isActive = item.id === selected?.id;
                        return (
                          <Link
                            key={item.id}
                            href={`/timesheets?project=${project!.id}&timesheet=${item.id}`}
                            aria-current={isActive}
                            className={`rounded-lg border px-3.5 py-3 transition-colors ${
                              isActive
                                ? "border-primary/50 bg-primary/10"
                                : "border-border hover:bg-surface"
                            }`}
                          >
                            <span className="block text-sm font-medium">{item.title}</span>
                            <span className="mt-1 block text-xs text-muted">
                              {formatDuration(item.logged_hours, item.logged_mins)} logged
                              {item.estimated_hours !== null
                                ? ` of ${formatDuration(item.estimated_hours, item.estimated_mins)}`
                                : ""}
                              {item.private ? " · private" : ""}
                              {item.archived ? " · archived" : ""}
                            </span>
                          </Link>
                        );
                      })}
                    </nav>

                    <div className="min-w-0 space-y-8">
                      {selected ? (
                        <>
                          {selected.archived ? (
                            <Notice title="This timesheet is archived">
                              Archived timesheets cannot take new time.
                            </Notice>
                          ) : canLogTime ? (
                            <ImportPanel projectId={project!.id} timesheet={selected} />
                          ) : (
                            <Notice title="You can view this timesheet but not add to it">
                              Logging time needs the <code className="font-mono">timesheet</code>{" "}
                              create permission.
                            </Notice>
                          )}

                          <EntriesTable entries={entries} />
                        </>
                      ) : (
                        <Notice title="Select a timesheet">
                          Choose one on the left to see the time logged against it.
                        </Notice>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Container>
      </main>
    </>
  );
}
