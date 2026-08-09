"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { createTimesheet } from "@/lib/timesheets";

const FIELD_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm " +
  "placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring";

export function CreateTimesheet({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    setOpen(false);
    setTitle("");
    setHours("");
    setIsPrivate(false);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createTimesheet(projectId, {
      title: title.trim(),
      estimated_hours: hours.trim() === "" ? null : Number(hours),
      estimated_mins: null,
      private: isPrivate,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    close();
    // Land on the timesheet that was just created.
    router.push(`/timesheets?project=${projectId}&timesheet=${result.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary", "sm")}>
        New timesheet
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full rounded-xl border border-border bg-surface p-5 sm:max-w-md"
    >
      <h3 className="font-medium">New timesheet</h3>

      <div className="mt-4">
        <label htmlFor="timesheet-title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="timesheet-title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="August 2026"
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="timesheet-estimate" className="text-sm font-medium">
          Estimated hours <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="timesheet-estimate"
          type="number"
          min={0}
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          placeholder="100"
          className={FIELD_CLASS}
        />
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(event) => setIsPrivate(event.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          Private
          <span className="mt-0.5 block text-xs text-muted">
            Only you, the people you assign, and anyone who can manage timesheets will see it.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={close} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || title.trim() === ""}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Creating…" : "Create timesheet"}
        </button>
      </div>
    </form>
  );
}
