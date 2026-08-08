import type { ProjectPermissions } from "@/lib/timesheets";

/**
 * The project sections in the left panel.
 *
 * `feature` is the permission that reveals an item, so the panel shows only
 * what a role can actually reach. `built` marks the sections that exist today —
 * the rest are listed so the shape of the product is visible, but they are
 * inert and labelled rather than pretending to be links.
 */
export type NavItem = {
  key: string;
  label: string;
  feature: string;
  href?: string;
  built: boolean;
};

export function projectNav(projectId: number): NavItem[] {
  return [
    { key: "tasks", label: "Tasks", feature: "tasks", built: false },
    { key: "discussions", label: "Discussions", feature: "discussions", built: false },
    { key: "gantt", label: "Gantt", feature: "gantt", built: false },
    { key: "calendar", label: "Calendar", feature: "calendar", built: false },
    { key: "files", label: "Files", feature: "files", built: false },
    {
      key: "time",
      label: "Time",
      feature: "timesheet",
      href: `/projects/${projectId}/time`,
      built: true,
    },
    { key: "reports", label: "Reports", feature: "reports", built: false },
  ];
}

/** Sections that sit below the project list rather than inside a project. */
export function organizationNav(): NavItem[] {
  return [
    { key: "roles", label: "Roles & permissions", feature: "roles", href: "/settings/roles", built: true },
    { key: "members", label: "Members", feature: "members", built: false },
    { key: "billing", label: "Billing", feature: "billing", built: false },
  ];
}

export function isVisible(item: NavItem, permissions: ProjectPermissions): boolean {
  return permissions[item.feature]?.view ?? false;
}
