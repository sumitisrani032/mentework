import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateMember } from "@/components/settings/create-member";
import { MemberRow } from "@/components/settings/member-row";
import { Container } from "@/components/ui/section";
import { fetchMembers } from "@/lib/members-server";
import { fetchRoleMatrix } from "@/lib/roles-server";
import { getSession } from "@/lib/session";
import { fetchProjects } from "@/lib/timesheets-server";

export const metadata: Metadata = {
  title: "People — Mentework",
  robots: { index: false, follow: false },
};

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export default async function MembersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const canCreate = session.permissions.some(
    (grant) => grant.feature === "members" && grant.can_create,
  );
  // Granting a role is a change to the role assignments, which the API guards
  // with the roles permission rather than members.
  const canAssignRoles = session.permissions.some(
    (grant) => grant.feature === "roles" && grant.can_edit,
  );
  // Taking someone out of the workspace is the delete-level right, which the
  // API guards separately from adding them.
  const canRemovePeople = session.permissions.some(
    (grant) => grant.feature === "members" && grant.can_delete,
  );
  const needsRoleList = canCreate || canAssignRoles;

  const [members, matrix, projects] = await Promise.all([
    fetchMembers(),
    needsRoleList ? fetchRoleMatrix() : Promise.resolve(null),
    needsRoleList ? fetchProjects() : Promise.resolve([]),
  ]);

  const roles = matrix?.status === "ok" ? matrix.matrix.roles : [];
  const showActions = (canAssignRoles && roles.length > 0) || canRemovePeople;

  return (
    <main className="flex-1">
      <Container className="py-12">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">People</h1>
          <p className="mt-3 leading-relaxed text-muted">
            Everyone in {session.organization.name}, and the roles they hold. Accounts are created
            here — there is no self sign-up.
          </p>
        </header>

        {members === null ? (
          <div className="mt-10">
            <Notice title="You do not have access to this page">
              Seeing who is in the workspace needs the <code className="font-mono">members</code>{" "}
              permission, which the Organization Admin role has by default.
            </Notice>
          </div>
        ) : (
          <>
            {canCreate ? (
              <div className="mt-10">
                {roles.length > 0 ? (
                  <CreateMember roles={roles} projects={projects} />
                ) : (
                  <Notice title="Roles could not be loaded">
                    Creating someone means choosing their role, and the role list needs the{" "}
                    <code className="font-mono">roles</code> view permission.
                  </Notice>
                )}
              </div>
            ) : null}

            <div className="mt-8 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">
                      Roles
                    </th>
                    {showActions ? (
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      roles={roles}
                      projects={projects}
                      canEditAccess={canAssignRoles && roles.length > 0}
                      canRemovePeople={canRemovePeople}
                      isSelf={member.id === session.user.id}
                      columns={showActions ? 4 : 3}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Container>
    </main>
  );
}
