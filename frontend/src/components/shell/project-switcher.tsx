"use client";

import Link from "next/link";
import { useState } from "react";

import type { Project } from "@/lib/timesheets";

export function ProjectSwitcher({
  projects,
  current,
}: {
  projects: Project[];
  current: Project;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-strong"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{current.name}</span>
          <span className="font-mono text-xs text-muted">{current.key}</span>
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-background p-1 shadow-lg">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}/time`}
                onClick={() => setOpen(false)}
                aria-current={project.id === current.id}
                className={`block rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-surface ${
                  project.id === current.id ? "bg-surface font-medium" : ""
                }`}
              >
                <span className="font-mono text-xs text-muted">{project.key}</span> {project.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
