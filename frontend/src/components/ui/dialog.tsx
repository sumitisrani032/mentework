"use client";

import { useEffect, useRef } from "react";

/**
 * A modal built on the native <dialog> element.
 *
 * Using the platform element rather than a div gives focus trapping, Escape to
 * close, inertness of the page behind and the right ARIA semantics without
 * reimplementing any of it.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // A click landing on the dialog itself is the backdrop; anything
        // inside the panel stops before it gets here.
        if (event.target === ref.current) onClose();
      }}
      aria-label={title}
      className="w-[min(48rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-0 text-foreground backdrop:bg-black/50 open:animate-none"
    >
      <div onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <svg viewBox="0 0 20 20" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </dialog>
  );
}
