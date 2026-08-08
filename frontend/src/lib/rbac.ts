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

/**
 * Read the first organization.
 *
 * Stands in for "the organization the signed-in admin belongs to" until
 * authentication exists.
 */
export async function fetchFirstOrganization(): Promise<Organization | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/organizations`, { cache: "no-store" });
    if (!response.ok) return null;
    const organizations = (await response.json()) as Organization[];
    return organizations[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchRoleMatrix(organizationId: string): Promise<RoleMatrix | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/organizations/${organizationId}/roles`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    return (await response.json()) as RoleMatrix;
  } catch {
    return null;
  }
}

export async function saveRolePermissions(
  roleId: number,
  permissions: Permission[],
): Promise<Role> {
  const response = await fetch(`${API_BASE_URL}/api/v1/roles/${roleId}/permissions`, {
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

function describeError(detail: unknown): string | null {
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
