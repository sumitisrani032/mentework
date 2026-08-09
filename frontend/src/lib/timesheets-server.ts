import "server-only";

import type { Project, ProjectPermissions, TimeEntry, Timesheet } from "@/lib/timesheets";
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
export async function fetchTimesheets(projectId: string): Promise<Timesheet[] | null> {
  try {
    const response = await apiFetch(`/api/v1/projects/${projectId}/timesheets`);
    if (!response.ok) return null;
    return (await response.json()) as Timesheet[];
  } catch {
    return null;
  }
}

/** What the signed-in user may do in this project, so the UI can hide the rest. */
export async function fetchProjectPermissions(projectId: string): Promise<ProjectPermissions> {
  try {
    const response = await apiFetch(`/api/v1/projects/${projectId}/permissions`);
    if (!response.ok) return {};
    return (await response.json()) as ProjectPermissions;
  } catch {
    return {};
  }
}

/** The time already logged against a timesheet, oldest first. */
export async function fetchTimeEntries(
  projectId: string,
  timesheetId: string,
): Promise<TimeEntry[]> {
  try {
    const response = await apiFetch(
      `/api/v1/projects/${projectId}/timesheets/${timesheetId}/time`,
    );
    if (!response.ok) return [];
    return (await response.json()) as TimeEntry[];
  } catch {
    return [];
  }
}
