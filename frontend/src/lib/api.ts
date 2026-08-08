import { connection } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiHealth = {
  status: string;
  environment: string;
};

/**
 * Read the API liveness probe.
 *
 * Returns null when the API is unreachable so callers can render a degraded
 * state rather than throwing.
 */
export async function fetchApiHealth(): Promise<ApiHealth | null> {
  // The API is not running during `next build`, so keep this out of the prerender.
  await connection();

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ApiHealth;
  } catch {
    return null;
  }
}
