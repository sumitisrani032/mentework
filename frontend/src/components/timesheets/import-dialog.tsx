"use client";

import { useState } from "react";

import { ImportPanel } from "@/components/timesheets/import-panel";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Timesheet } from "@/lib/timesheets";

/** "Upload CSV" as a call to action rather than a panel taking up the page. */
export function ImportDialog({
  projectId,
  timesheet,
}: {
  projectId: number;
  timesheet: Timesheet;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass("secondary", "sm")}
      >
        Upload CSV
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Upload a month of time">
        <ImportPanel projectId={projectId} timesheet={timesheet} bare />
      </Dialog>
    </>
  );
}
