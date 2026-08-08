import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/session";

/** Stream the blank CSV template back with the session attached. */
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;

  let response: Response;
  try {
    response = await apiFetch(`/api/v1/projects/${projectId}/timesheets/import-template`);
  } catch {
    return NextResponse.json({ detail: "Could not reach the server." }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ detail: "Template unavailable." }, { status: response.status });
  }

  return new NextResponse(await response.text(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="time-import-template.csv"',
    },
  });
}
