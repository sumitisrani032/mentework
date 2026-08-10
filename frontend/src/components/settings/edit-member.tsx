"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { type Member, grantRole, revokeRole } from "@/lib/members";
import type { Role } from "@/lib/rbac";
import type { Project } from "@/lib/timesheets";

const FIELD_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * Everything one person's access consists of, in one place.
 *
 * Roles are granted per project, so the same person is often a Member on one
 * project and a Client on another. That is the shape this has to show: what
 * they hold now, project by project, and a way to add another pairing without
 * leaving the row.
 */
export function EditMember({
  member,
  roles,
  projects,
  onClose,
}: {
  member: Member;
  roles: Role[];
  projects: Project[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? 0);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const role = roles.find((candidate) => candidate.id === roleId);
  const needsProject = role?.scope === "project";

  // What this role already covers for this person. Ticked and not tickable:
  // the API rejects a grant that exists, and a box that looks available but
  // always fails is worse than one that is plainly already done.
  const alreadyGranted = new Set(
    member.roles
      .filter((grant) => grant.role === role?.name && grant.project_id !== null)
      .map((grant) => grant.project_id as string),
  );
  const heldOrganizationWide = member.roles.some(
    (grant) => grant.role === role?.name && grant.project_id === null,
  );

  function toggleProject(id: string) {
    setProjectIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function add() {
    setPending(true);
    setError(null);

    const result = await grantRole(member.id, roleId, needsProject ? projectIds : []);

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProjectIds([]);
    router.refresh();
  }

  async function remove(assignmentId: number) {
    setRemoving(assignmentId);
    setError(null);

    const result = await revokeRole(member.id, assignmentId);

    setRemoving(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const nothingToAdd = needsProject ? projectIds.length === 0 : heldOrganizationWide;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{member.full_name}</h3>
          <p className="mt-0.5 text-sm text-muted">{member.email}</p>
        </div>
        <button type="button" onClick={onClose} className={buttonClass("ghost", "sm")}>
          Done
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section>
          <h4 className="text-sm font-medium">Access now</h4>
          {member.roles.length === 0 ? (
            <p className="mt-2 rounded-lg border border-border bg-background px-3 py-3 text-sm text-muted">
              No role yet. Nothing in the workspace is visible to them until one is added.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-background">
              {member.roles.map((grant) => (
                <li key={grant.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{grant.role}</span>
                    <span className="text-muted">
                      {" · "}
                      {grant.project_id ? (
                        <Link
                          href={`/projects/${grant.project_id}/time`}
                          className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                        >
                          {grant.project}
                        </Link>
                      ) : (
                        "Whole organisation"
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(grant.id)}
                    disabled={removing !== null}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {removing === grant.id ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="text-sm font-medium">Give them another role</h4>

          <label className="mt-2 block text-sm font-medium">
            Role
            <select
              value={roleId}
              onChange={(event) => {
                // Which projects are already covered depends on the role, so a
                // selection made against the previous one means nothing here.
                setRoleId(Number(event.target.value));
                setProjectIds([]);
                setError(null);
              }}
              className={FIELD_CLASS}
            >
              {roles.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.scope === "project" ? " (project)" : ""}
                </option>
              ))}
            </select>
            {role?.description ? (
              <span className="mt-1 block text-xs font-normal text-muted">{role.description}</span>
            ) : null}
          </label>

          {needsProject ? (
            <fieldset className="mt-3">
              <legend className="text-sm font-medium">Projects</legend>
              <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                {projects.map((option) => {
                  const held = alreadyGranted.has(option.id);
                  return (
                    <label
                      key={option.id}
                      title={held ? `Already ${role?.name} here` : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
                        held ? "text-muted" : "hover:bg-surface-strong"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={held || projectIds.includes(option.id)}
                        disabled={held}
                        onChange={() => toggleProject(option.id)}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <span className="font-mono text-xs text-muted">{option.key}</span>
                      <span className="truncate">{option.name}</span>
                      {held ? <span className="ml-auto shrink-0 text-[11px]">added</span> : null}
                    </label>
                  );
                })}
              </div>
              <span className="mt-1 block text-xs text-muted">
                This role applies inside each project you pick, so they can hold a different one
                elsewhere.
              </span>
            </fieldset>
          ) : (
            <p className="mt-3 text-xs text-muted">
              This role covers the whole organisation, so there is no project to choose.
            </p>
          )}

          {needsProject && projects.length === 0 ? (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
              This role applies inside a project, and there are none yet.
            </p>
          ) : null}

          <button
            type="button"
            onClick={add}
            disabled={pending || roleId === 0 || nothingToAdd}
            className={`${buttonClass("primary", "sm")} mt-3`}
          >
            {pending ? "Adding…" : "Add role"}
          </button>
          {heldOrganizationWide && !needsProject ? (
            <span className="mt-2 block text-xs text-muted">They already hold this role.</span>
          ) : null}
        </section>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
