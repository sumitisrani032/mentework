import Link from "next/link";

import { Logo } from "@/components/logo";
import { ProjectSwitcher } from "@/components/shell/project-switcher";
import { TimeNav } from "@/components/shell/time-nav";
import { isVisible, organizationNav, projectNav } from "@/lib/navigation";
import type { Session } from "@/lib/session";
import type { Project, ProjectPermissions, Timesheet } from "@/lib/timesheets";

/**
 * The application frame: a left panel of project sections beside the page.
 *
 * Every item is gated on a permission, so two people on the same project can
 * see different panels — which is the point of the role matrix.
 */
export function AppShell({
  session,
  projects,
  project,
  permissions,
  organizationPermissions,
  active,
  timesheets = [],
  activeTimesheetId = null,
  children,
}: {
  session: Session;
  projects: Project[];
  project: Project | null;
  permissions: ProjectPermissions;
  organizationPermissions: ProjectPermissions;
  active: string;
  timesheets?: Timesheet[];
  activeTimesheetId?: number | null;
  children: React.ReactNode;
}) {
  const projectItems = project
    ? projectNav(project.id).filter((item) => isVisible(item, permissions))
    : [];
  const organizationItems = organizationNav().filter((item) =>
    isVisible(item, organizationPermissions),
  );

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border px-3 py-4">
          <Link
            href="/"
            className="block rounded-lg px-2.5 py-1 transition-opacity hover:opacity-80"
          >
            <Logo />
          </Link>
        </div>

        {project ? (
          <div className="border-b border-border p-3">
            <ProjectSwitcher projects={projects} current={project} />
          </div>
        ) : null}

        <nav aria-label="Project" className="flex-1 overflow-y-auto p-3">
          {projectItems.length > 0 ? (
            <ul className="space-y-0.5">
              {projectItems.map((item) =>
                item.key === "time" && project ? (
                  <li key={item.key}>
                    <TimeNav
                      projectId={project.id}
                      timesheets={timesheets}
                      activeTimesheetId={activeTimesheetId}
                      active={active === "time"}
                    />
                  </li>
                ) : (
                  <li key={item.key}>
                    <NavLink item={item} active={active === item.key} />
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="px-2.5 text-sm text-muted">No project sections available to you.</p>
          )}

          {organizationItems.length > 0 ? (
            <>
              <p className="mt-6 px-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
                Organisation
              </p>
              <ul className="mt-2 space-y-0.5">
                {organizationItems.map((item) => (
                  <li key={item.key}>
                    <NavLink item={item} active={active === item.key} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </nav>

        <div className="border-t border-border px-5.5 py-3">
          <p className="text-xs text-muted">{session.organization.name}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function NavLink({
  item,
  active,
}: {
  item: ReturnType<typeof projectNav>[number];
  active: boolean;
}) {
  const shared = "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm";

  if (!item.built) {
    return (
      <span
        className={`${shared} cursor-default text-muted/60`}
        title="Not built yet"
        aria-disabled
      >
        {item.label}
        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
          soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href ?? "#"}
      aria-current={active ? "page" : undefined}
      className={`${shared} transition-colors ${
        active
          ? "bg-primary/12 font-medium text-foreground hover:bg-primary/20"
          : "text-muted hover:bg-surface-strong hover:text-foreground"
      }`}
    >
      {item.label}
    </Link>
  );
}
