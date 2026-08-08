import "server-only";

import type { MatrixResult, RoleMatrix } from "@/lib/rbac";
import { apiFetch } from "@/lib/session";

/**
 * Read the signed-in user's permission matrix.
 *
 * The organisation is never passed in — the API derives it from the session,
 * so this page cannot be pointed at another tenant.
 */
export async function fetchRoleMatrix(): Promise<MatrixResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/v1/roles");
  } catch {
    return { status: "unavailable" };
  }

  if (response.status === 401) return { status: "unauthenticated" };
  if (response.status === 403) return { status: "forbidden" };
  if (!response.ok) return { status: "unavailable" };

  return { status: "ok", matrix: (await response.json()) as RoleMatrix };
}
