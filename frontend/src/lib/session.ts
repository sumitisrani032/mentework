import { cookies } from "next/headers";

import { API_BASE_URL } from "@/lib/rbac";

export const SESSION_COOKIE = "mentework_session";

export type SessionUser = { id: number; email: string; full_name: string };
export type SessionOrganization = { name: string; slug: string };
export type PermissionGrant = {
  feature: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type Session = {
  user: SessionUser;
  organization: SessionOrganization;
  roles: string[];
  permissions: PermissionGrant[];
};

export type Workspace = { name: string; slug: string };

/**
 * Reshape the session's organisation-wide grants to match the per-project
 * permission map. The API spells these `can_view` while the project endpoint
 * spells them `view`, and the navigation reads one shape.
 */
export function organizationPermissions(session: Session): Record<
  string,
  { view: boolean; create: boolean; edit: boolean; delete: boolean }
> {
  return Object.fromEntries(
    session.permissions.map((grant) => [
      grant.feature,
      {
        view: grant.can_view,
        create: grant.can_create,
        edit: grant.can_edit,
        delete: grant.can_delete,
      },
    ]),
  );
}

/** Look up the workspace a sign-in page belongs to. Null when it does not exist. */
export async function fetchWorkspace(slug: string): Promise<Workspace | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/auth/organizations/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    return (await response.json()) as Workspace;
  } catch {
    return null;
  }
}

/**
 * Call the API as the signed-in user.
 *
 * Server-side only: it reads the httpOnly session cookie, which client
 * components cannot see. Anything the browser needs to trigger goes through a
 * route handler that calls this.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
}

/**
 * Resolve the signed-in user from the session cookie.
 *
 * The token is verified by the API on every call rather than trusted locally,
 * so a deactivated user or a revoked tenant stops working immediately.
 */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as Session;
  } catch {
    return null;
  }
}
