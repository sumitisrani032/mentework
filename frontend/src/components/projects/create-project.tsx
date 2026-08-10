"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { createProject } from "@/lib/timesheets";

const FIELD_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm " +
  "placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring";

const STATUSES = ["planning", "active", "on_hold", "completed", "archived"];

export function CreateProject({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planning");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    setOpen(false);
    // Drop the ?new=1 the rail's + button adds, so pressing it again reopens
    // the form rather than navigating to a URL the page is already on.
    if (defaultOpen) {
      router.replace("/projects");
    }
    setName("");
    setKey("");
    setDescription("");
    setStatus("planning");
    setStartDate("");
    setEndDate("");
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createProject({
      name: name.trim(),
      key: key.trim().toUpperCase(),
      description: description.trim() || null,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    close();
    router.push(`/projects/${result.id}/time`);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary", "sm")}>
        New project
      </button>
    );
  }

  return (
    <form method="post" onSubmit={submit} className="w-full rounded-xl border border-border bg-surface p-5">
      <h2 className="font-medium">New project</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Name
          <input
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Storefront Revamp"
            className={FIELD_CLASS}
          />
        </label>

        <label className="text-sm font-medium">
          Key
          <input
            required
            maxLength={16}
            value={key}
            onChange={(event) => setKey(event.target.value.toUpperCase())}
            placeholder="STO"
            className={`${FIELD_CLASS} font-mono`}
          />
          <span className="mt-1 block text-xs font-normal text-muted">
            2–16 letters or digits, shown beside the project name.
          </span>
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium">
        Description <span className="font-normal text-muted">(optional)</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Storefront platform development"
          className={FIELD_CLASS}
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={FIELD_CLASS}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          Starts <span className="font-normal text-muted">(optional)</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="text-sm font-medium">
          Ends <span className="font-normal text-muted">(optional)</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-muted">
        You will be added to the project as Project Manager, so it stays visible to you.
      </p>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={close} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || name.trim() === "" || key.trim() === ""}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
