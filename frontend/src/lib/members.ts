import { describeError } from "@/lib/rbac";

export type MemberRole = {
  /** The assignment's id, which is what a removal names. */
  id: number;
  role: string;
  scope: "organization" | "project";
  project: string | null;
};

export type Member = {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: MemberRole[];
};

export type NewMember = {
  email: string;
  full_name: string;
  password: string;
  role_id: number;
  /** One grant per project. Empty for an organisation-wide role. */
  project_ids: number[];
};

/**
 * Grant a role to someone who already has an account, on each project given.
 *
 * The API grants one project at a time, so several projects are several calls;
 * the first failure is reported rather than swallowed, and the grants that
 * already succeeded stand — refreshing shows exactly where it got to.
 */
export async function grantRole(
  userId: number,
  roleId: number,
  projectIds: number[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const projectId of projectIds.length > 0 ? projectIds : [null]) {
    const response = await fetch(`/api/users/${userId}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: roleId, project_id: projectId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return {
        ok: false,
        error: describeError(payload) ?? `Could not grant this role (${response.status}).`,
      };
    }
  }
  return { ok: true };
}

/**
 * Take someone out of the workspace, or put them back.
 *
 * Deactivation, not deletion: their access ends everywhere while the time they
 * logged keeps their name on it.
 */
export async function setMemberActive(
  userId: number,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (response.ok) return { ok: true };

  const payload = await response.json().catch(() => null);
  return {
    ok: false,
    error: describeError(payload) ?? `Could not change this account (${response.status}).`,
  };
}

/** Take one grant away, leaving the person's other roles alone. */
export async function revokeRole(
  userId: number,
  assignmentId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(`/api/users/${userId}/roles/${assignmentId}`, { method: "DELETE" });
  if (response.ok) return { ok: true };

  const payload = await response.json().catch(() => null);
  return {
    ok: false,
    error: describeError(payload) ?? `Could not remove this role (${response.status}).`,
  };
}

/** Create an account and grant it the role it was created for. */
export async function createMember(
  input: NewMember,
): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);
  if (response.ok) return { ok: true, member: payload as Member };

  return {
    ok: false,
    error: describeError(payload) ?? `Could not create this person (${response.status}).`,
  };
}
