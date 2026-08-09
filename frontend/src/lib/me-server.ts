import "server-only";

import { apiFetch } from "@/lib/session";
import type { TimeEntry } from "@/lib/timesheets";

/** An entry as the cross-project listing returns it: with where it was logged. */
export type MyTimeEntry = TimeEntry & {
  project: { id: string; name: string };
  timesheet: { id: string; title: string };
};

/**
 * Time the signed-in user logged, newest first, across every project.
 *
 * One call rather than one per project: the home page cannot know which
 * projects have their time on it until it asks.
 */
export async function fetchMyTime(limit = 20): Promise<MyTimeEntry[]> {
  try {
    const response = await apiFetch(`/api/v1/me/time?limit=${limit}`);
    if (!response.ok) return [];
    return (await response.json()) as MyTimeEntry[];
  } catch {
    return [];
  }
}
