import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/session";

type Params = { params: Promise<{ projectId: string; timesheetId: string; entryId: string }> };

function apiPath(projectId: string, timesheetId: string, entryId: string): string {
  return `/api/v1/projects/${projectId}/timesheets/${timesheetId}/time/${entryId}`;
}

/** Change one entry, forwarding the session to the API. */
export async function PATCH(request: Request, context: Params) {
  const { projectId, timesheetId, entryId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Malformed request." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await apiFetch(apiPath(projectId, timesheetId, entryId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ detail: "Could not reach the server." }, { status: 502 });
  }

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? {}, { status: response.status });
}

/** Remove one entry. */
export async function DELETE(_request: Request, context: Params) {
  const { projectId, timesheetId, entryId } = await context.params;

  let response: Response;
  try {
    response = await apiFetch(apiPath(projectId, timesheetId, entryId), { method: "DELETE" });
  } catch {
    return NextResponse.json({ detail: "Could not reach the server." }, { status: 502 });
  }

  // 204 carries no body, so there is nothing to parse or pass on.
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? {}, { status: response.status });
}
