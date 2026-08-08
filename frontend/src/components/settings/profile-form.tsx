"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { updateProfile } from "@/lib/profile";

const FIELD_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm " +
  "placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring disabled:cursor-not-allowed disabled:text-muted";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updateProfile(name.trim());

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    // The rail shows your name and initials, so it has to hear about this.
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-medium">Profile</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Full name
          <input
            required
            maxLength={120}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            className={FIELD_CLASS}
          />
        </label>

        <label className="text-sm font-medium text-muted">
          Email
          <input disabled value={email} className={FIELD_CLASS} />
          <span className="mt-1 block text-xs font-normal text-muted">
            Your email signs you in and identifies your account. An administrator changes it.
          </span>
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
          disabled={pending || name.trim() === "" || name.trim() === fullName}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved ? <span className="text-sm text-primary">Saved.</span> : null}
      </div>
    </form>
  );
}
