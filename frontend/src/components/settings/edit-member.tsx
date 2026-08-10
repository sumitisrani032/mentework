"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { type Member, grantRole, renameMember, revokeRole } from "@/lib/members";
import type { Role } from "@/lib/rbac";
import type { Project } from "@/lib/timesheets";

const FIELD_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/**
 * Everything one person's access consists of, in one place.
 *
 * Roles are held per project — Member on one, Client on another — so this is a
 * list of pairings rather than a single choice. One column, three sections in
 * the order the questions get asked: who they are, what they have, what to add.
 *
 * One button. The name and the new role save together, because someone opening
 * this to fix a spelling and add a project should not have to find two separate
 * ways to commit. Taking a grant away is the exception: it is per row, it is
 * immediate, and it is a quiet × rather than a second call to action.
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
  const [fullName, setFullName] = useState(member.full_name);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? 0);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const role = roles.find((candidate) => candidate.id === roleId);
  const needsProject = role?.scope === "project";

  const trimmedName = fullName.trim();
  const nameChanged = trimmedName !== "" && trimmedName !== member.full_name;

  // What this role already covers for this person. Ticked and not tickable:
  // the API rejects a grant that exists, and a box that looks available but
  // always fails is worse than one plainly already done.
  const alreadyGranted = new Set(
    member.roles
      .filter((grant) => grant.role === role?.name && grant.project_id !== null)
      .map((grant) => grant.project_id as string),
  );
  const heldOrganizationWide = member.roles.some(
    (grant) => grant.role === role?.name && grant.project_id === null,
  );

  const addingRole = needsProject ? projectIds.length > 0 : !heldOrganizationWide && roleId !== 0;
  const hasChanges = nameChanged || addingRole;

  function toggleProject(id: string) {
    setProjectIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function save() {
    setSaving(true);
    setError(null);

    if (nameChanged) {
      const renamed = await renameMember(member.id, trimmedName);
      if (!renamed.ok) {
        setSaving(false);
        setError(renamed.error);
        return;
      }
    }

    if (addingRole) {
      const granted = await grantRole(member.id, roleId, needsProject ? projectIds : []);
      if (!granted.ok) {
        setSaving(false);
        // Said precisely: the name may already be saved, and a message that
        // implies otherwise would send someone looking for a problem that is
        // not there.
        setError(
          nameChanged ? `The name was saved. The role was not: ${granted.error}` : granted.error,
        );
        router.refresh();
        return;
      }
    }

    setSaving(false);
    router.refresh();
    onClose();
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

  return (
    <div className="space-y-7">
      <section>
        <Heading>Who they are</Heading>
        <label className="mt-3 block text-sm font-medium">
          Name
          <input
            required
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={`${FIELD_CLASS} sm:max-w-sm`}
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          Signs in as <span className="font-mono">{member.email}</span>, which cannot be changed for
          them.
        </p>
      </section>

      <section>
        <Heading>
          Access
          <span className="ml-2 font-normal text-muted normal-case">
            {member.roles.length} {member.roles.length === 1 ? "role" : "roles"}
          </span>
        </Heading>

        {member.roles.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
            No role yet. Nothing in the workspace is visible to them until one is added below.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {member.roles.map((grant) => (
              <li key={grant.id} className="flex items-center gap-3 bg-surface px-4 py-2.5">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{grant.role}</span>
                  <span className="text-muted">
                    {" in "}
                    {grant.project_id ? (
                      <Link
                        href={`/projects/${grant.project_id}/time`}
                        className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                      >
                        {grant.project}
                      </Link>
                    ) : (
                      "the whole workspace"
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(grant.id)}
                  disabled={removing !== null}
                  aria-label={`Take away ${grant.role}${grant.project ? ` in ${grant.project}` : ""}`}
                  title="Take this role away"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:pointer-events-none disabled:opacity-40"
                >
                  {removing === grant.id ? (
                    <span className="text-[10px]">…</span>
                  ) : (
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden
                      className="size-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <Heading>Add a role</Heading>

        <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
          <label className="text-sm font-medium">
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
              <span className="mt-1.5 block text-xs font-normal leading-snug text-muted">
                {role.description}
              </span>
            ) : null}
          </label>

          {needsProject ? (
            <fieldset className="min-w-0">
              <legend className="text-sm font-medium">Projects</legend>
              {projects.length === 0 ? (
                <p className="mt-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
                  This role applies inside a project, and there are none yet.
                </p>
              ) : (
                <>
                  <div className="mt-1.5 max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-surface p-1.5">
                    {projects.map((option) => {
                      const held = alreadyGranted.has(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
                            held ? "text-muted" : "cursor-pointer hover:bg-surface-strong"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={held || projectIds.includes(option.id)}
                            disabled={held}
                            onChange={() => toggleProject(option.id)}
                            className="size-4 accent-[var(--primary)]"
                          />
                          <span className="w-9 shrink-0 font-mono text-xs text-muted">
                            {option.key}
                          </span>
                          <span className="truncate">{option.name}</span>
                          {held ? (
                            <span className="ml-auto shrink-0 text-[11px] tracking-wide uppercase">
                              has it
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                  <span className="mt-1.5 block text-xs leading-snug text-muted">
                    The role applies inside each project you tick, so they can hold a different one
                    elsewhere.
                  </span>
                </>
              )}
            </fieldset>
          ) : (
            <p className="self-end pb-1 text-xs leading-snug text-muted">
              {heldOrganizationWide
                ? "They already hold this role across the workspace."
                : "This role covers the whole workspace, so there is no project to pick."}
            </p>
          )}
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <span className="mr-auto text-xs text-muted">
          {hasChanges ? "Unsaved changes" : "Nothing to save yet"}
        </span>
        <button type="button" onClick={onClose} className={buttonClass("ghost", "md")}>
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !hasChanges}
          className={buttonClass("primary", "md")}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/** A section marker. Uppercase and ruled, matching the page's own eyebrows. */
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 text-xs font-semibold tracking-wide text-muted uppercase">
      <span className="text-foreground">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </h3>
  );
}
