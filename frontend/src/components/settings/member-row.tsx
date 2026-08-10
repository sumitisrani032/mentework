"use client";

import { useState } from "react";

import { EditMember } from "@/components/settings/edit-member";
import { MemberAccess } from "@/components/settings/member-access";
import { RoleChip } from "@/components/settings/role-chip";
import { buttonClass } from "@/components/ui/button";
import type { Member } from "@/lib/members";
import type { Role } from "@/lib/rbac";
import type { Project } from "@/lib/timesheets";

/**
 * One person in the listing, and their editor when it is open.
 *
 * The editor opens as a full-width row underneath rather than inside the
 * actions cell: access is a list of role-and-project pairings, which needs the
 * width of the table and reads better directly under the person it belongs to.
 */
export function MemberRow({
  member,
  roles,
  projects,
  canEditAccess,
  canRemovePeople,
  isSelf,
  columns,
}: {
  member: Member;
  roles: Role[];
  projects: Project[];
  canEditAccess: boolean;
  canRemovePeople: boolean;
  isSelf: boolean;
  /** How wide the editor row has to span to line up with the header. */
  columns: number;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <tr
        className={`border-b border-border ${editing ? "bg-surface/60" : "last:border-b-0"} ${
          member.is_active ? "" : "text-muted"
        }`}
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
                  onClick={() => setEditing((open) => !open)}
                  aria-expanded={editing}
                  className={buttonClass("ghost", "sm")}
                >
                  {editing ? "Close" : "Edit"}
                </button>
              ) : null}
              {canRemovePeople ? <MemberAccess member={member} isSelf={isSelf} /> : null}
            </span>
          </td>
        ) : null}
      </tr>

      {editing ? (
        <tr className="border-b border-border last:border-b-0">
          <td colSpan={columns} className="bg-surface/60 px-4 pt-1 pb-4">
            <EditMember
              member={member}
              roles={roles}
              projects={projects}
              onClose={() => setEditing(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}
