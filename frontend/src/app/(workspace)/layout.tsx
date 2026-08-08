import { redirect } from "next/navigation";

import { IconRail } from "@/components/shell/icon-rail";
import { getSession } from "@/lib/session";

/**
 * The frame every signed-in page shares: the icon rail on the left, the page
 * beside it. Pages inside this group never render their own rail, and a new
 * page gets it for free by living here.
 */
export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const canCreateProject = session.permissions.some(
    (grant) => grant.feature === "projects" && grant.can_create,
  );

  return (
    <div className="flex min-h-full flex-1">
      <IconRail
        fullName={session.user.full_name}
        organizationName={session.organization.name}
        canCreateProject={canCreateProject}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
