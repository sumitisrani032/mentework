import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/session";

/**
 * Forward a permission-matrix update to the API with the session attached.
 *
 * The browser cannot call the API directly because the token is httpOnly.
 * Authorization itself stays on the API — this only carries the request.
 */
export async function PUT(request: Request, context: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Malformed request." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await apiFetch(`/api/v1/roles/${encodeURIComponent(roleId)}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ detail: "Could not reach the server." }, { status: 502 });
  }

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? {}, { status: response.status });
}
