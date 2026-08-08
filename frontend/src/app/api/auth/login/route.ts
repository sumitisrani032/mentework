import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/lib/rbac";
import { SESSION_COOKIE } from "@/lib/session";
import { getTenantSlug } from "@/lib/tenant";

/**
 * Exchange credentials for a session cookie.
 *
 * The token never reaches client-side JavaScript: the browser posts here, this
 * handler calls the API, and the token comes back only inside an httpOnly
 * cookie. The workspace is taken from the request's own hostname rather than
 * the request body, so a form cannot be pointed at another tenant.
 */
export async function POST(request: Request) {
  const slug = await getTenantSlug();
  if (!slug) {
    return NextResponse.json({ error: "No workspace on this address." }, { status: 400 });
  }

  let email = "";
  let password = "";
  try {
    ({ email, password } = (await request.json()) as { email: string; password: string });
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_slug: slug, email, password }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the server." }, { status: 502 });
  }

  if (!response.ok) {
    // Pass the API's single generic message through unchanged.
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };

  (await cookies()).set(SESSION_COOKIE, body.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: body.expires_in,
    // No `domain`, deliberately. That makes this a host-only cookie, so a
    // session on acme.example.com is never sent to another tenant's subdomain.
  });

  return NextResponse.json({ ok: true });
}
