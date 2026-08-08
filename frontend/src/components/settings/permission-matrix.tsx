"use client";

import { useMemo, useState } from "react";

import { buttonClass } from "@/components/ui/button";
import {
  ACTIONS,
  ACTION_LABELS,
  type Action,
  type FeatureRow,
  type Permission,
  type Role,
  type RoleMatrix,
  saveRolePermissions,
} from "@/lib/rbac";

type Draft = Record<string, Record<string, Permission>>;

function toDraft(roles: Role[]): Draft {
  return Object.fromEntries(
    roles.map((role) => [
      role.id,
      Object.fromEntries(role.permissions.map((permission) => [permission.feature, permission])),
    ]),
  );
}

/**
 * Applies one checkbox change, keeping the row internally consistent.
 *
 * The API and the database both reject create/edit/delete without view, so the
 * grid enforces the same rule rather than letting an admin build a state that
 * cannot be saved.
 */
function applyToggle(permission: Permission, action: Action, checked: boolean): Permission {
  const next = { ...permission, [action]: checked };

  if (action === "can_view" && !checked) {
    return { ...next, can_create: false, can_edit: false, can_delete: false };
  }
  if (action !== "can_view" && checked) {
    return { ...next, can_view: true };
  }
  return next;
}

function isSameMatrix(a: Record<string, Permission>, b: Record<string, Permission>): boolean {
  return Object.keys(a).every((feature) =>
    ACTIONS.every((action) => a[feature]?.[action] === b[feature]?.[action]),
  );
}

export function PermissionMatrix({ matrix }: { matrix: RoleMatrix }) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(matrix.roles));
  const [draft, setDraft] = useState<Draft>(() => toDraft(matrix.roles));
  const [activeRoleId, setActiveRoleId] = useState(matrix.roles[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const activeRole = matrix.roles.find((role) => role.id === activeRoleId) ?? matrix.roles[0];

  const isDirty = useMemo(() => {
    if (!activeRole) return false;
    return !isSameMatrix(draft[activeRole.id] ?? {}, saved[activeRole.id] ?? {});
  }, [activeRole, draft, saved]);

  if (!activeRole) {
    return <p className="text-muted">This organisation has no roles yet.</p>;
  }

  function toggle(feature: string, action: Action, checked: boolean) {
    setStatus("idle");
    setDraft((current) => {
      const roleDraft = current[activeRole.id];
      return {
        ...current,
        [activeRole.id]: {
          ...roleDraft,
          [feature]: applyToggle(roleDraft[feature], action, checked),
        },
      };
    });
  }

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const updated = await saveRolePermissions(
        activeRole.id,
        Object.values(draft[activeRole.id]),
      );
      const next = Object.fromEntries(updated.permissions.map((p) => [p.feature, p]));
      setSaved((current) => ({ ...current, [activeRole.id]: next }));
      setDraft((current) => ({ ...current, [activeRole.id]: next }));
      setStatus("saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save changes");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setDraft((current) => ({ ...current, [activeRole.id]: saved[activeRole.id] }));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      {/* Role picker */}
      <nav aria-label="Roles" className="flex flex-col gap-1.5">
        {matrix.roles.map((role) => {
          const isActive = role.id === activeRole.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setActiveRoleId(role.id)}
              aria-current={isActive}
              className={`rounded-lg border px-3.5 py-3 text-left transition-colors ${
                isActive
                  ? "border-primary/50 bg-primary/10"
                  : "border-border hover:bg-surface"
              }`}
            >
              <span className="block text-sm font-medium">{role.name}</span>
              <span className="mt-1 block text-xs text-muted capitalize">{role.scope} scope</span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{activeRole.name}</h2>
            {activeRole.description ? (
              <p className="mt-1 max-w-xl text-sm text-muted">{activeRole.description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isDirty ? (
              <button type="button" onClick={reset} className={buttonClass("ghost", "sm")}>
                Reset
              </button>
            ) : null}
            <button
              type="button"
              onClick={save}
              disabled={!isDirty || status === "saving"}
              className={buttonClass("primary", "sm")}
            >
              {status === "saving" ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <p aria-live="polite" className="mt-3 min-h-5 text-sm">
          {status === "saved" ? <span className="text-primary">Permissions updated.</span> : null}
          {status === "error" ? <span className="text-red-500">{error}</span> : null}
        </p>

        <MatrixTable
          features={matrix.features}
          permissions={draft[activeRole.id]}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}

function MatrixTable({
  features,
  permissions,
  onToggle,
}: {
  features: FeatureRow[];
  permissions: Record<string, Permission>;
  onToggle: (feature: string, action: Action, checked: boolean) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-lg border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Feature
            </th>
            {ACTIONS.map((action) => (
              <th key={action} scope="col" className="px-4 py-3 text-center font-semibold">
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => {
            const permission = permissions[feature.value];
            return (
              <tr key={feature.value} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-2.5 text-left font-medium">
                  {feature.label}
                </th>
                {ACTIONS.map((action) => (
                  <td key={action} className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={permission?.[action] ?? false}
                      onChange={(event) => onToggle(feature.value, action, event.target.checked)}
                      aria-label={`${ACTION_LABELS[action]} ${feature.label}`}
                      className="size-4 accent-primary"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
