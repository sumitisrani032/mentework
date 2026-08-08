import { describeError } from "@/lib/rbac";

export type MemberRole = {
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
