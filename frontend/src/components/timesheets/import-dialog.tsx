"use client";

import { ImportPanel } from "@/components/timesheets/import-panel";
import { Dialog } from "@/components/ui/dialog";
import type { Timesheet } from "@/lib/timesheets";

/** The CSV upload in a dialog. The Add menu owns the button that opens it. */
export function ImportDialog({
  projectId,
  timesheet,
  open,
  onClose,
}: {
  projectId: string;
  timesheet: Timesheet;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Bulk upload time">
      <ImportPanel projectId={projectId} timesheet={timesheet} bare />
    </Dialog>
  );
}
