import type { LoggedBy } from "@/lib/timesheets";

// Fixed, readable-on-dark hues. Picking by name keeps a person's colour stable
// across sessions without storing anything.
const HUES = [
  "bg-rose-500/20 text-rose-400",
  "bg-amber-500/20 text-amber-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-sky-500/20 text-sky-400",
  "bg-violet-500/20 text-violet-400",
  "bg-teal-500/20 text-teal-400",
];

function hueFor(seed: string): string {
  let total = 0;
  for (const character of seed) {
    total = (total + character.charCodeAt(0)) % HUES.length;
  }
  return HUES[total];
}

export function Avatar({ person }: { person: LoggedBy | null }) {
  const initials = person?.initials ?? "?";

  return (
    <span
      aria-hidden
      title={person?.full_name}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${hueFor(String(person?.id ?? ""))}`}
    >
      {initials}
    </span>
  );
}
