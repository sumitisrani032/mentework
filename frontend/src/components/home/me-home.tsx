import Link from "next/link";

import {
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  ChecklistIcon,
  ClockIcon,
  Empty,
  FolderIcon,
  GridIcon,
  MegaphoneIcon,
  NoteIcon,
  Widget,
} from "@/components/home/widget";
import { Container } from "@/components/ui/section";
import { type MyTimeEntry, fetchMyTime } from "@/lib/me-server";
import type { Session } from "@/lib/session";
import { type Project, formatDate, formatDuration, totalDuration } from "@/lib/timesheets";
import { fetchProjects } from "@/lib/timesheets-server";

type IconComponent = (props: { className?: string }) => React.ReactElement;

const SHORTCUTS: { label: string; icon: IconComponent; href?: string }[] = [
  { label: "My tasks", icon: ChecklistIcon },
  { label: "My events & milestones", icon: CalendarIcon },
  { label: "My logged time", icon: ClockIcon, href: "#logged-time" },
  { label: "My activities", icon: CheckIcon },
  { label: "Stickies", icon: NoteIcon },
  { label: "Bookmarks", icon: BookmarkIcon },
];

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

type TimeGroup = {
  project: MyTimeEntry["project"];
  timesheet: MyTimeEntry["timesheet"];
  entries: MyTimeEntry[];
};

/** Gather entries under the timesheet they were logged against, order kept. */
function groupByTimesheet(entries: MyTimeEntry[]): TimeGroup[] {
  const groups = new Map<number, TimeGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.timesheet.id);
    if (group) group.entries.push(entry);
    else
      groups.set(entry.timesheet.id, {
        project: entry.project,
        timesheet: entry.timesheet,
        entries: [entry],
      });
  }
  return [...groups.values()];
}

/**
 * The Me page: your own corner of the workspace, and what the workspace root
 * shows once you are signed in.
 *
 * The widgets whose features exist — your projects, your logged time — carry
 * real data. The rest are laid out and labelled "soon" rather than filled with
 * plausible-looking nothing.
 */
export async function MeHome({ session }: { session: Session }) {
  const [projects, entries] = await Promise.all([fetchProjects(), fetchMyTime(20)]);
  const groups = groupByTimesheet(entries);
  const firstName = session.user.full_name.split(" ")[0];

  return (
    <main className="flex-1">
      <header className="border-b border-border bg-gradient-to-br from-primary/20 via-surface to-background px-5 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-strong text-lg font-semibold ring-1 ring-border"
            >
              {initialsOf(session.user.full_name)}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {greetingFor(new Date().getHours())}, {firstName}!
            </h1>
          </div>

          <input
            disabled
            aria-label="Jump to a project, person or bookmark"
            title="Search is not built yet"
            placeholder="Jump to a project, person or bookmark"
            className="w-full max-w-2xl cursor-not-allowed rounded-lg border border-border bg-background/70 px-4 py-2.5 text-sm placeholder:text-muted/70"
          />
        </div>
      </header>

      <Container className="grid max-w-5xl gap-5 py-6 lg:grid-cols-2">
        <Widget title="Announcements" icon={MegaphoneIcon}>
          <Empty icon={MegaphoneIcon} soon>
            Announcements will appear here — birthdays, welcomes and anything the workspace should
            know.
          </Empty>
        </Widget>

        <Widget title="My shortcuts" icon={GridIcon}>
          <ul className="grid flex-1 grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.label}>
                <Shortcut {...shortcut} />
              </li>
            ))}
          </ul>
        </Widget>

        <Widget
          title="My projects"
          icon={FolderIcon}
          action={
            <Link href="/projects" className="text-xs text-primary hover:underline">
              All projects
            </Link>
          }
        >
          {projects.length === 0 ? (
            <Empty icon={FolderIcon}>
              You are not on a project yet. Ask an administrator to add you to one.
            </Empty>
          ) : (
            <ProjectTable projects={projects} />
          )}
        </Widget>

        <Widget title="Agenda" icon={CalendarIcon}>
          <Empty icon={CalendarIcon} soon>
            Events and milestones due today will collect here.
          </Empty>
        </Widget>

        <Widget title="My tasks" icon={ChecklistIcon}>
          <Empty icon={ChecklistIcon} soon>
            Tasks assigned to you will collect here.
          </Empty>
        </Widget>

        <Widget
          title="My logged time"
          icon={ClockIcon}
          id="logged-time"
          action={
            entries.length > 0 ? (
              <span className="text-xs text-muted">
                {formatDuration(
                  totalDuration(entries).hours,
                  totalDuration(entries).mins,
                )}{" "}
                recently
              </span>
            ) : null
          }
        >
          {groups.length === 0 ? (
            <Empty icon={ClockIcon}>
              Nothing logged yet. Open a project&apos;s Time section to add some.
            </Empty>
          ) : (
            <div className="flex-1 divide-y divide-border">
              {groups.map((group) => (
                <TimeGroupRows key={group.timesheet.id} group={group} />
              ))}
            </div>
          )}
        </Widget>

      </Container>
    </main>
  );
}

const TILE_CLASS =
  "flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-border px-2 py-4 text-center text-xs";

function Shortcut({ label, icon: Icon, href }: { label: string; icon: IconComponent; href?: string }) {
  if (!href) {
    return (
      <span
        aria-disabled
        title={`${label} — not built yet`}
        className={`${TILE_CLASS} cursor-default text-muted/45`}
      >
        <Icon className="size-5" />
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${TILE_CLASS} text-muted transition-colors hover:border-primary/40 hover:bg-surface-strong hover:text-foreground`}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-xs text-muted">
          <th scope="col" className="px-4 py-2 text-left font-medium">
            Title
          </th>
          <th scope="col" className="px-4 py-2 text-right font-medium">
            Start
          </th>
          <th scope="col" className="px-4 py-2 text-right font-medium">
            End
          </th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-2">
              <Link
                href={`/projects/${project.id}/time`}
                className="flex items-baseline gap-2 hover:text-primary"
              >
                <span className="font-mono text-xs text-muted">{project.key}</span>
                <span className="truncate">{project.name}</span>
              </Link>
            </td>
            <td className="px-4 py-2 text-right text-xs text-muted">
              {project.start_date ? formatDate(project.start_date) : "—"}
            </td>
            <td className="px-4 py-2 text-right text-xs text-muted">
              {project.end_date ? formatDate(project.end_date) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimeGroupRows({ group }: { group: TimeGroup }) {
  const total = totalDuration(group.entries);

  return (
    <div>
      <Link
        href={`/projects/${group.project.id}/time?timesheet=${group.timesheet.id}`}
        className="flex items-baseline gap-2 px-4 py-2.5 text-xs transition-colors hover:bg-surface-strong"
      >
        <span aria-hidden className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-primary" />
        <span className="truncate font-medium">{group.project.name}</span>
        <span className="truncate text-muted">{group.timesheet.title}</span>
        <span className="ml-auto shrink-0 text-muted">
          {formatDuration(total.hours, total.mins)}
        </span>
      </Link>

      <ul className="pb-1">
        {group.entries.map((entry) => (
          <li key={entry.id} className="flex items-baseline gap-3 px-4 py-1.5 text-sm">
            <span className="w-20 shrink-0 text-xs text-muted">{formatDate(entry.date)}</span>
            <span className="min-w-0 flex-1 truncate text-muted">
              {entry.description ?? "No description"}
            </span>
            <span className="shrink-0 text-xs">
              {formatDuration(entry.logged_hours, entry.logged_mins)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

