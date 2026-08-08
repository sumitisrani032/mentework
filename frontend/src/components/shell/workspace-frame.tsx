import { IconRail } from "@/components/shell/icon-rail";
import type { Session } from "@/lib/session";

/**
 * The signed-in frame: the icon rail on the left, the page beside it.
 *
 * Lives in a component rather than only in the (workspace) layout because the
 * Me page sits at "/", which the marketing page also owns — that route decides
 * which of the two to render, and reaches for this when you are signed in.
 */
export function WorkspaceFrame({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const canCreateProject = session.permissions.some(
    (grant) => grant.feature === "projects" && grant.can_create,
  );
  // Same rule the left panel uses, so the two never disagree about who may
  // reach the role matrix.
  const canManageRoles = session.permissions.some(
    (grant) => grant.feature === "roles" && grant.can_view,
  );

  return (
    <div className="flex min-h-full flex-1">
      <IconRail
        fullName={session.user.full_name}
        organizationName={session.organization.name}
        canCreateProject={canCreateProject}
        canManageRoles={canManageRoles}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
