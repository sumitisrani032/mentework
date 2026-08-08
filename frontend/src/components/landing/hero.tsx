import Link from "next/link";

import { AppPreview } from "@/components/landing/app-preview";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

// This is the slot where review-site badges (G2, Capterra) normally sit. Those
// have to be earned and verified, so it carries factual product terms until
// there are real ratings to show.
const TRUST_POINTS = ["14-day free trial", "No card required", "Cancel anytime"];

function TrustStrip() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      {TRUST_POINTS.map((point) => (
        <li key={point} className="flex items-center gap-2 text-sm text-muted">
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className="size-4 fill-none stroke-primary stroke-[2.5]"
          >
            <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {point}
        </li>
      ))}
    </ul>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Soft brand wash behind the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_50%,var(--primary)_0%,transparent_70%)] opacity-[0.13]"
      />

      <Container className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted">
            <span className="size-1.5 rounded-full bg-primary" />
            Now with per-organisation workspaces
          </p>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            One place for your projects, teams and conversations
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted text-pretty">
            Mentework replaces the pile of tools your team switches between. Plan the work, do the
            work and talk about the work — without losing the thread.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClass("primary", "lg")}>
              Start your free trial
            </Link>
            <Link href="#features" className={buttonClass("secondary", "lg")}>
              Take the tour
            </Link>
          </div>

          <div className="mt-7">
            <TrustStrip />
          </div>
        </div>

        <div className="mt-14 sm:mt-20">
          <AppPreview />
        </div>
      </Container>
    </section>
  );
}
