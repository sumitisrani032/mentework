import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/session";

/**
 * Forward a CSV upload to the API with the session attached.
 *
 * The multipart body is passed straight through; validation and authorization
 * both stay on the API, so this only carries the request and its cookie.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; timesheetId: string }> },
) {
  const { projectId, timesheetId } = await context.params;
  const incoming = new URL(request.url);

  const query = new URLSearchParams({
    dry_run: incoming.searchParams.get("dry_run") ?? "false",
    allow_duplicates: incoming.searchParams.get("allow_duplicates") ?? "false",
  });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Expected a file upload." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await apiFetch(
      `/api/v1/projects/${projectId}/timesheets/${timesheetId}/time/import?${query}`,
      { method: "POST", body: form },
    );
  } catch {
    return NextResponse.json({ detail: "Could not reach the server." }, { status: 502 });
  }

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? {}, { status: response.status });
}
