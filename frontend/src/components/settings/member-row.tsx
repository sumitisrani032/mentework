"use client";

import { useState } from "react";

import { EditMember } from "@/components/settings/edit-member";
import { MemberAccess } from "@/components/settings/member-access";
import { RoleChip } from "@/components/settings/role-chip";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Member } from "@/lib/members";
import type { Role } from "@/lib/rbac";
import type { Project } from "@/lib/timesheets";

/** One person in the listing, with their editor a click away. */
export function MemberRow({
  member,
  roles,
  projects,
  canEditAccess,
  canRemovePeople,
  isSelf,
}: {
  member: Member;
  roles: Role[];
  projects: Project[];
  canEditAccess: boolean;
  canRemovePeople: boolean;
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <tr
      className={`border-b border-border last:border-b-0 ${member.is_active ? "" : "text-muted"}`}
    >
      <th scope="row" className="px-4 py-2.5 text-left align-top font-medium">
        {member.full_name}
        {member.is_active ? null : <span className="ml-2 text-xs text-muted">deactivated</span>}
      </th>
      <td className="px-4 py-2.5 align-top text-muted">{member.email}</td>
      <td className="px-4 py-2.5 align-top">
        {member.roles.length === 0 ? (
          <span className="text-muted">No role yet</span>
        ) : (
          <span className="flex flex-wrap items-start gap-1.5">
            {member.roles.map((grant) => (
              // Read-only here. Adding and removing both live in the editor,
              // so there is one place where access is changed.
              <RoleChip key={grant.id} member={member} grant={grant} removable={false} />
            ))}
          </span>
        )}
      </td>
      {canEditAccess || canRemovePeople ? (
        <td className="px-4 py-2.5 text-right align-top">
          <span className="inline-flex items-start justify-end gap-2">
            {canEditAccess && member.is_active ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={buttonClass("ghost", "sm")}
              >
                Edit
              </button>
            ) : null}
            {canRemovePeople ? <MemberAccess member={member} isSelf={isSelf} /> : null}
          </span>

          {/* Mounted only while open, so each visit starts from the name as it
              stands and from a clean role selection. A modal dialog is drawn in
              the browser's top layer, so sitting inside a table cell costs it
              nothing. */}
          {editing ? (
            <Dialog open onClose={() => setEditing(false)} title={`Edit ${member.full_name}`}>
              <EditMember
                member={member}
                roles={roles}
                projects={projects}
                onClose={() => setEditing(false)}
              />
            </Dialog>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}
