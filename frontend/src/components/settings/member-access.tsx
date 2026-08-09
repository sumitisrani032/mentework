"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { type Member, deleteMember, setMemberActive } from "@/lib/members";

const DANGER_BUTTON =
  "inline-flex h-9 items-center rounded-lg bg-red-500/15 px-3.5 text-sm font-medium " +
  "text-red-500 transition-colors hover:bg-red-500/25 disabled:pointer-events-none " +
  "disabled:opacity-50";

/**
 * Take someone out of the workspace, or bring them back.
 *
 * Two ways out, offered together with what each costs: removing access keeps
 * their history intact, deleting the account keeps the entries but blanks the
 * name on them. The second is spelled out with the number of entries it
 * affects, because "delete" is where people find that out too late.
 */
export function MemberAccess({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"remove" | "delete" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "remove" | "delete" | "restore") {
    setPending(action);
    setError(null);

    const result =
      action === "delete"
        ? await deleteMember(member.id)
        : await setMemberActive(member.id, action === "restore");

    setPending(null);
    if (!result.ok) {
      setError(result.error);
      setOpen(false);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (isSelf) {
    return (
      <span className="text-xs text-muted" title="Another administrator has to do this">
        You
      </span>
    );
  }

  if (!open) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        {member.is_active ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${buttonClass("ghost", "sm")} hover:bg-red-500/10 hover:text-red-500`}
          >
            Remove
          </button>
        ) : (
          <span className="inline-flex gap-1">
            <button
              type="button"
              onClick={() => run("restore")}
              disabled={pending !== null}
              className={buttonClass("ghost", "sm")}
            >
              {pending === "restore" ? "Restoring…" : "Restore"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`${buttonClass("ghost", "sm")} hover:bg-red-500/10 hover:text-red-500`}
            >
              Delete
            </button>
          </span>
        )}
        {error ? <Problem>{error}</Problem> : null}
      </span>
    );
  }

  return (
    <div className="w-72 space-y-3 rounded-lg border border-border bg-background p-3 text-left">
      <p className="text-sm font-medium">Remove {member.full_name}?</p>

      <div className="space-y-2">
        <Choice
          title="Remove access"
          detail="They cannot sign in and lose every project. Their logged time keeps their name."
          action={
            <button
              type="button"
              onClick={() => run("remove")}
              disabled={pending !== null || !member.is_active}
              className={buttonClass("secondary", "sm")}
            >
              {pending === "remove" ? "Removing…" : member.is_active ? "Remove" : "Already removed"}
            </button>
          }
        />

        <Choice
          title="Delete the account"
          detail={
            member.logged_entries > 0
              ? `Permanent. Their ${member.logged_entries} logged ${
                  member.logged_entries === 1 ? "entry stays" : "entries stay"
                } on the timesheet, with no one named against ${
                  member.logged_entries === 1 ? "it" : "them"
                }.`
              : "Permanent. They have logged no time, so nothing is left behind."
          }
          action={
            <button
              type="button"
              onClick={() => run("delete")}
              disabled={pending !== null}
              className={DANGER_BUTTON}
            >
              {pending === "delete" ? "Deleting…" : "Delete"}
            </button>
          }
        />
      </div>

      {error ? <Problem>{error}</Problem> : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonClass("ghost", "sm")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Choice({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-2.5">
      <span className="min-w-0">
        <span className="block text-sm">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{detail}</span>
      </span>
      <span className="shrink-0">{action}</span>
    </div>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="block max-w-72 text-[11px] leading-snug text-red-500">
      {children}
    </span>
  );
}
