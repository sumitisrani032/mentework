"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { createMember } from "@/lib/members";
import type { Role } from "@/lib/rbac";
import type { Project } from "@/lib/timesheets";

const FIELD_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm " +
  "placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring";

const MIN_PASSWORD = 8;

/**
 * Create a person and the role they are being hired into, in one step.
 *
 * The role is part of the form rather than a follow-up, because an account
 * with no role can see nothing — handing one over would look broken.
 */
export function CreateMember({ roles, projects }: { roles: Role[]; projects: Project[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? 0);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const role = roles.find((candidate) => candidate.id === roleId);
  const needsProject = role?.scope === "project";

  function close() {
    setOpen(false);
    setEmail("");
    setFullName("");
    setPassword("");
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setCreated(null);

    const result = await createMember({
      email: email.trim(),
      full_name: fullName.trim(),
      password,
      role_id: roleId,
      project_id: needsProject ? projectId : null,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCreated(result.member.email);
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary", "sm")}>
          Add person
        </button>
        {created ? (
          <span className="text-sm text-primary">
            {created} can sign in now. Pass on the password you set.
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-border bg-surface p-5">
      <h2 className="font-medium">Add someone to this workspace</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Full name
          <input
            required
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Dara Nwosu"
            className={FIELD_CLASS}
          />
        </label>

        <label className="text-sm font-medium">
          Email
          <input
            required
            type="email"
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="dara@acme.test"
            className={FIELD_CLASS}
          />
          <span className="mt-1 block text-xs font-normal text-muted">
            This is what they sign in with, and it cannot be changed here afterwards.
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Role
          <select
            value={roleId}
            onChange={(event) => setRoleId(Number(event.target.value))}
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
          <label className="text-sm font-medium">
            Project
            <select
              required
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className={FIELD_CLASS}
            >
              {projects.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">
              A project role applies inside that project only.
            </span>
          </label>
        ) : null}
      </div>

      <label className="mt-4 block text-sm font-medium sm:max-w-xs">
        First password
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD_CLASS}
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          At least {MIN_PASSWORD} characters. Nothing is emailed yet, so pass it on yourself — they
          can change it from their own profile.
        </span>
      </label>

      {needsProject && projects.length === 0 ? (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          This role applies inside a project, and there are none yet. Create a project first.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={close} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            pending ||
            roleId === 0 ||
            password.length < MIN_PASSWORD ||
            (needsProject && projectId === "")
          }
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Creating…" : "Create person"}
        </button>
      </div>
    </form>
  );
}
