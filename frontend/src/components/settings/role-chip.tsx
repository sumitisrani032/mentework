"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type Member, type MemberRole, revokeRole } from "@/lib/members";

/**
 * One role someone holds, with a way to take it back.
 *
 * The removal asks first — a grant is easy to click away and, for the person
 * on the other end, losing one is losing a project.
 */
export function RoleChip({
  member,
  grant,
  removable,
}: {
  member: Member;
  grant: MemberRole;
  removable: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = grant.project ? `${grant.role} on ${grant.project}` : grant.role;

  async function remove() {
    setPending(true);
    setError(null);

    const result = await revokeRole(member.id, grant.id);

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 rounded-full border border-border py-0.5 pr-1 pl-2 text-xs">
        {grant.role}
        {grant.project ? (
          <span className="text-muted">
            ·{" "}
            {grant.project_id ? (
              // The grant is about a project, so say which one and go there.
              <Link
                href={`/projects/${grant.project_id}/time`}
                title={`Open ${grant.project}`}
                className="underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
              >
                {grant.project}
              </Link>
            ) : (
              grant.project
            )}
          </span>
        ) : null}

        {removable ? (
          confirming ? (
            <span className="ml-1 inline-flex items-center gap-1">
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="rounded-full px-1.5 py-0.5 font-medium text-red-500 transition-colors hover:bg-red-500/10"
              >
                {pending ? "Removing…" : "Remove"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full px-1.5 py-0.5 text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Remove ${label} from ${member.full_name}`}
              title={`Remove ${label}`}
              className="ml-0.5 flex size-4 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden
                className="size-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
              </svg>
            </button>
          )
        ) : null}
      </span>

      {error ? (
        <span role="alert" className="max-w-56 text-[11px] leading-snug text-red-500">
          {error}
        </span>
      ) : null}
    </span>
  );
}
