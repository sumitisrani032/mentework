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
