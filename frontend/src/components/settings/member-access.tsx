"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { type Member, setMemberActive } from "@/lib/members";

/**
 * Take someone out of the workspace, or bring them back.
 *
 * "Remove" deactivates rather than deletes: they lose access everywhere, and
 * the time they logged stays attributed to them. The confirmation says so,
 * because "remove" usually reads as "erase".
 */
export function MemberAccess({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(isActive: boolean) {
    setPending(true);
    setError(null);

    const result = await setMemberActive(member.id, isActive);

    setPending(false);
    setConfirming(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!member.is_active) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => apply(true)}
          disabled={pending}
          className={buttonClass("ghost", "sm")}
        >
          {pending ? "Restoring…" : "Restore"}
        </button>
        {error ? <Problem>{error}</Problem> : null}
      </span>
    );
  }

  if (isSelf) {
    return (
      <span className="text-xs text-muted" title="Another administrator has to do this">
        You
      </span>
    );
  }

  if (!confirming) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${buttonClass("ghost", "sm")} hover:bg-red-500/10 hover:text-red-500`}
        >
          Remove
        </button>
        {error ? <Problem>{error}</Problem> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1.5 text-left">
      <span className="max-w-56 text-xs leading-snug text-muted">
        {member.full_name} loses access everywhere. The time they logged stays, with their name on
        it.
      </span>
      <span className="inline-flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={buttonClass("ghost", "sm")}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => apply(false)}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-red-500/15 px-3.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/25"
        >
          {pending ? "Removing…" : "Remove"}
        </button>
      </span>
    </span>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="max-w-56 text-[11px] leading-snug text-red-500">
      {children}
    </span>
  );
}
