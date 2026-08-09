import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssignRole } from "@/components/settings/assign-role";
import { CreateMember } from "@/components/settings/create-member";
import { MemberAccess } from "@/components/settings/member-access";
import { RoleChip } from "@/components/settings/role-chip";
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
                    {(canAssignRoles && roles.length > 0) || canRemovePeople ? (
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className={`border-b border-border last:border-b-0 ${
                        member.is_active ? "" : "text-muted"
                      }`}
                    >
                      <th scope="row" className="px-4 py-2.5 text-left align-top font-medium">
                        {member.full_name}
                        {member.is_active ? null : (
                          <span className="ml-2 text-xs text-muted">deactivated</span>
                        )}
                      </th>
                      <td className="px-4 py-2.5 align-top text-muted">{member.email}</td>
                      <td className="px-4 py-2.5 align-top">
                        {member.roles.length === 0 ? (
                          <span className="text-muted">No role yet</span>
                        ) : (
                          <span className="flex flex-wrap items-start gap-1.5">
                            {member.roles.map((grant) => (
                              <RoleChip
                                key={grant.id}
                                member={member}
                                grant={grant}
                                removable={canAssignRoles}
                              />
                            ))}
                          </span>
                        )}
                      </td>
                      {(canAssignRoles && roles.length > 0) || canRemovePeople ? (
                        <td className="px-4 py-2.5 text-right align-top">
                          <span className="inline-flex items-start justify-end gap-2">
                            {canAssignRoles && roles.length > 0 && member.is_active ? (
                              <AssignRole member={member} roles={roles} projects={projects} />
                            ) : null}
                            {canRemovePeople ? (
                              <MemberAccess member={member} isSelf={member.id === session.user.id} />
                            ) : null}
                          </span>
                        </td>
                      ) : null}
                    </tr>
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
