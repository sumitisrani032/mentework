export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
  secondary: "border border-border text-foreground hover:bg-surface",
  ghost: "text-muted hover:text-foreground hover:bg-surface",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

/**
 * Shared button styling, usable on both `<button>` and `<Link>` so the two
 * never drift apart visually.
 */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap",
    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
  ].join(" ");
}
