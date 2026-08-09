"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

/** False while rendering on the server and through hydration, true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type IconProps = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function SunIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2m0 15v2M4.6 4.6 6 6m12 12 1.4 1.4M2.5 12h2m15 0h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function SystemIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...STROKE}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </svg>
  );
}

const MODES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: SystemIcon },
];

/**
 * Light / Dark / System as one control, so the current choice is visible
 * rather than something you infer from what the last click did.
 *
 * The active mode is only marked after mount: the server cannot know which one
 * is stored in the browser, and rendering a guess would be a hydration
 * mismatch.
 */
export function ThemeModes() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div role="group" aria-label="Theme" className="flex gap-1 px-1.5 py-1">
      {MODES.map((mode) => {
        const active = hydrated && theme === mode.value;
        const Icon = mode.icon;

        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => setTheme(mode.value)}
            aria-pressed={active}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] transition-colors ${
              active
                ? "bg-primary/15 font-medium text-primary hover:bg-primary/25"
                : "text-muted hover:bg-surface-strong hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
