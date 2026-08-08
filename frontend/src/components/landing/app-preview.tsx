const COLUMNS = [
  {
    name: "To do",
    cards: [
      { title: "Q3 campaign brief", meta: "Marketing", accent: "bg-accent" },
      { title: "Update pricing page", meta: "Web", accent: "bg-primary" },
    ],
  },
  {
    name: "In progress",
    cards: [
      { title: "Onboarding email series", meta: "Lifecycle", accent: "bg-primary" },
      { title: "Brand photography", meta: "Creative", accent: "bg-accent" },
      { title: "API rate limits", meta: "Platform", accent: "bg-primary" },
    ],
  },
  {
    name: "Review",
    cards: [{ title: "Annual report layout", meta: "Design", accent: "bg-accent" }],
  },
];

/**
 * A stylised product mock rendered as markup rather than a screenshot, so it
 * follows the active theme and stays sharp at any size.
 */
export function AppPreview() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-xl border border-border bg-background shadow-2xl shadow-foreground/10"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="size-2.5 rounded-full bg-muted/40" />
        <span className="size-2.5 rounded-full bg-muted/40" />
        <span className="size-2.5 rounded-full bg-muted/40" />
        <div className="ml-3 h-5 flex-1 rounded bg-surface-strong" />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden w-40 shrink-0 border-r border-border bg-surface p-3 sm:block">
          <div className="h-6 w-24 rounded bg-surface-strong" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-primary/20" />
            <div className="h-4 w-4/5 rounded bg-surface-strong" />
            <div className="h-4 w-3/5 rounded bg-surface-strong" />
            <div className="h-4 w-4/6 rounded bg-surface-strong" />
          </div>
        </div>

        {/* Board */}
        <div className="grid flex-1 grid-cols-3 gap-3 p-3 sm:gap-4 sm:p-4">
          {COLUMNS.map((column) => (
            <div key={column.name} className="min-w-0">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="truncate text-[11px] font-semibold tracking-wide text-muted uppercase">
                  {column.name}
                </span>
                <span className="text-[11px] text-muted">{column.cards.length}</span>
              </div>
              <div className="space-y-2.5">
                {column.cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-lg border border-border bg-surface p-2.5 sm:p-3"
                  >
                    <span className={`block h-1 w-7 rounded-full ${card.accent}`} />
                    <p className="mt-2 truncate text-[11px] font-medium sm:text-xs">{card.title}</p>
                    <p className="mt-1 truncate text-[10px] text-muted sm:text-[11px]">
                      {card.meta}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
