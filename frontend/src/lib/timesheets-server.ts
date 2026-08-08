import "server-only";

import type { Project, Timesheet } from "@/lib/timesheets";
import { apiFetch } from "@/lib/session";

/** Projects the signed-in user may see. Empty when they have none. */
export async function fetchProjects(): Promise<Project[]> {
  try {
    const response = await apiFetch("/api/v1/projects");
    if (!response.ok) return [];
    return (await response.json()) as Project[];
  } catch {
    return [];
  }
}

/**
 * Timesheets in a project.
 *
 * Null distinguishes "you cannot see this project" from "it has none", so the
 * page can say which.
 */
export async function fetchTimesheets(projectId: number): Promise<Timesheet[] | null> {
  try {
    const response = await apiFetch(`/api/v1/projects/${projectId}/timesheets`);
    if (!response.ok) return null;
    return (await response.json()) as Timesheet[];
  } catch {
    return null;
  }
}
