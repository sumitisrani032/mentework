import { describeError } from "@/lib/rbac";

export type Result = { ok: true } | { ok: false; error: string };

/** Change your own display name. */
export async function updateProfile(fullName: string): Promise<Result> {
  const response = await fetch("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName }),
  });
  if (response.ok) return { ok: true };

  const payload = await response.json().catch(() => null);
  return { ok: false, error: describeError(payload) ?? `Could not save (${response.status}).` };
}

/** Replace your own password, proving you know the current one. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<Result> {
  const response = await fetch("/api/me/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (response.ok) return { ok: true };

  const payload = await response.json().catch(() => null);
  return {
    ok: false,
    error: describeError(payload) ?? `Could not change your password (${response.status}).`,
  };
}
