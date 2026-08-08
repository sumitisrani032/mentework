"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { type Member, grantRole } from "@/lib/members";
import type { Role } from "@/lib/rbac";
import type { Project } from "@/lib/timesheets";

const FIELD_CLASS =
  "block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * Put someone already in the workspace onto more projects.
 *
 * People move between projects constantly, so this is a row action rather than
 * something you redo by recreating the account.
 */
export function AssignRole({
  member,
  roles,
  projects,
}: {
  member: Member;
  roles: Role[];
  projects: Project[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? 0);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const role = roles.find((candidate) => candidate.id === roleId);
  const needsProject = role?.scope === "project";

  function toggleProject(id: number) {
    setProjectIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function save() {
    setPending(true);
    setError(null);

    const result = await grantRole(member.id, roleId, needsProject ? projectIds : []);

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setProjectIds([]);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("ghost", "sm")}
        aria-label={`Add a role for ${member.full_name}`}
      >
        Add role
      </button>
    );
  }

  return (
    <div className="min-w-56 space-y-2 rounded-lg border border-border bg-background p-3 text-left">
      <select
        value={roleId}
        onChange={(event) => setRoleId(Number(event.target.value))}
        aria-label="Role"
        className={FIELD_CLASS}
      >
        {roles.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
            {option.scope === "project" ? " (project)" : ""}
          </option>
        ))}
      </select>

      {needsProject ? (
        <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
          {projects.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-surface-strong"
            >
              <input
                type="checkbox"
                checked={projectIds.includes(option.id)}
                onChange={() => toggleProject(option.id)}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="truncate">{option.name}</span>
            </label>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-500">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className={buttonClass("ghost", "sm")}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || roleId === 0 || (needsProject && projectIds.length === 0)}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}
