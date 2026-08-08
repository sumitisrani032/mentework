import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { CreateProject } from "@/components/projects/create-project";
import { Container } from "@/components/ui/section";
import { getSession } from "@/lib/session";
import { fetchProjects } from "@/lib/timesheets-server";

export const metadata: Metadata = {
  title: "Projects — Mentework",
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<string, string> = {
  active: "text-primary",
  planning: "text-muted",
  on_hold: "text-amber-500",
  completed: "text-muted",
  archived: "text-muted",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // The rail's + button lands here with the form already open.
  const { new: newProject } = await searchParams;
  const projects = await fetchProjects();
  const canCreate = session.permissions.some(
    (grant) => grant.feature === "projects" && grant.can_create,
  );

  return (
    <>
      <header className="border-b border-border">
        <Container className="flex h-16 items-center gap-3">
          <Link href="/">
            <Logo />
          </Link>
          <span className="hidden text-sm text-muted sm:inline">{session.organization.name}</span>
        </Container>
      </header>

      <main className="flex-1">
        <Container className="py-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
              <p className="mt-2 text-muted">
                {canCreate
                  ? "Everything you have access to. Create another whenever you need one."
                  : "Everything you have access to."}
              </p>
            </div>
            {canCreate ? (
              // Keyed on the flag so arriving from the rail's + button remounts
              // the form open, even when the page itself is already rendered.
              <CreateProject key={newProject === "1" ? "new" : "list"} defaultOpen={newProject === "1"} />
            ) : null}
          </div>

          {projects.length === 0 ? (
            <div className="mt-10 rounded-xl border border-border bg-surface p-6">
              <h2 className="font-medium">No projects yet</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {canCreate
                  ? "Create one with the button above."
                  : "You have not been added to a project. Ask an administrator to put you on one."}
              </p>
            </div>
          ) : (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}/time`}
                    className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-surface-strong"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-muted">{project.key}</span>
                      <span className={`text-xs ${STATUS_TONE[project.status] ?? "text-muted"}`}>
                        {project.status.replace("_", " ")}
                      </span>
                    </span>
                    <span className="mt-1 font-medium">{project.name}</span>
                    {project.description ? (
                      <span className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                        {project.description}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </main>
    </>
  );
}
