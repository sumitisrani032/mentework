import { headers } from "next/headers";

/**
 * The domain tenant subdomains hang off.
 *
 * Locally this is `localhost`, so a workspace lives at
 * `acme.localhost:3000` — browsers resolve any `*.localhost` name to the
 * loopback address without touching /etc/hosts.
 */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

/** Subdomains that belong to the product itself, never to a tenant. */
const RESERVED = new Set(["www", "app", "api", "admin", "static", "assets"]);

/**
 * Read the workspace slug from the request's hostname.
 *
 * Returns null on the bare root domain, on a reserved subdomain, or on
 * anything nested more than one level deep.
 */
export async function getTenantSlug(): Promise<string | null> {
  const host = (await headers()).get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();

  const suffix = `.${ROOT_DOMAIN}`;
  if (!hostname.endsWith(suffix)) {
    return null;
  }

  const subdomain = hostname.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes(".") || RESERVED.has(subdomain)) {
    return null;
  }
  return subdomain;
}
