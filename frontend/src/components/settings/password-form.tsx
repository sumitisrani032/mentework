"use client";

import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { changePassword } from "@/lib/profile";

const FIELD_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** Matches the minimum the API enforces, so the message arrives before the trip. */
const MIN_LENGTH = 8;

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [pending, setPending] = useState(false);

  const mismatch = confirm !== "" && confirm !== next;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setChanged(false);

    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }

    setPending(true);
    const result = await changePassword(current, next);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setChanged(true);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-medium">Change password</h2>
      <p className="mt-1 text-sm text-muted">
        You stay signed in here. Sessions on other devices keep running until they expire.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Current password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="text-sm font-medium">
          New password
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className={FIELD_CLASS}
          />
          <span className="mt-1 block text-xs font-normal text-muted">
            At least {MIN_LENGTH} characters.
          </span>
        </label>

        <label className="text-sm font-medium">
          Confirm new password
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={FIELD_CLASS}
            aria-invalid={mismatch}
          />
          {mismatch ? (
            <span className="mt-1 block text-xs font-normal text-red-500">
              These do not match.
            </span>
          ) : null}
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || current === "" || next.length < MIN_LENGTH || mismatch}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Changing…" : "Change password"}
        </button>
        {changed ? <span className="text-sm text-primary">Password changed.</span> : null}
      </div>
    </form>
  );
}
