import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/session";

/** Log one time entry, forwarding the session to the API. */
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; timesheetId: string }> },
) {
  const { projectId, timesheetId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Malformed request." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await apiFetch(`/api/v1/projects/${projectId}/timesheets/${timesheetId}/time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ detail: "Could not reach the server." }, { status: 502 });
  }

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? {}, { status: response.status });
}
