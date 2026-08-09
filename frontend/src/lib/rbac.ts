export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const ACTIONS = ["can_view", "can_create", "can_edit", "can_delete"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<Action, string> = {
  can_view: "View",
  can_create: "Create",
  can_edit: "Edit",
  can_delete: "Delete",
};

export type Permission = { feature: string } & Record<Action, boolean>;

export type Role = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  scope: "organization" | "project";
  is_system: boolean;
  permissions: Permission[];
};

export type FeatureRow = { value: string; label: string };

export type RoleMatrix = { features: FeatureRow[]; roles: Role[] };

export type Organization = { id: number; name: string; slug: string; is_active: boolean };

/** Why the matrix could not be shown, so the page can explain itself. */
export type MatrixResult =
  | { status: "ok"; matrix: RoleMatrix }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" };

/**
 * Save a role's permissions.
 *
 * Goes through this app's own route handler rather than straight to the API:
 * the session lives in an httpOnly cookie that client code cannot read.
 */
export async function saveRolePermissions(
  roleId: number,
  permissions: Permission[],
): Promise<Role> {
  const response = await fetch(`/api/roles/${roleId}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(describeError(detail) ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as Role;
}

/**
 * Delete a custom role.
 *
 * The API refuses the built-in ones, and refuses any role that is the last way
 * anyone can reach the matrix — its message comes back for the page to show.
 */
export async function deleteRole(
  roleId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(`/api/roles/${roleId}`, { method: "DELETE" });
  if (response.ok) return { ok: true };

  const detail = await response.json().catch(() => null);
  return {
    ok: false,
    error: describeError(detail) ?? `Could not delete this role (${response.status}).`,
  };
}

export function describeError(detail: unknown): string | null {
  if (detail && typeof detail === "object" && "detail" in detail) {
    const value = (detail as { detail: unknown }).detail;
    if (typeof value === "string") return value;
    // FastAPI validation errors arrive as a list of {msg, loc}.
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0] as { msg?: string };
      return first.msg ?? null;
    }
  }
  return null;
}
