import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/session";

/** Delete a custom role, forwarding the session to the API. */
export async function DELETE(_request: Request, context: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await context.params;

  let response: Response;
  try {
    response = await apiFetch(`/api/v1/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
  } catch {
    return NextResponse.json({ detail: "Could not reach the server." }, { status: 502 });
  }

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? {}, { status: response.status });
}
