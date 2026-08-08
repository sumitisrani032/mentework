import "server-only";

import type { Member } from "@/lib/members";
import { apiFetch } from "@/lib/session";

/**
 * Everyone in the signed-in user's organisation.
 *
 * Null means the caller may not see the list, which the page says out loud
 * rather than showing as an empty workspace.
 */
export async function fetchMembers(): Promise<Member[] | null> {
  try {
    const response = await apiFetch("/api/v1/users");
    if (!response.ok) return null;
    return (await response.json()) as Member[];
  } catch {
    return null;
  }
}
