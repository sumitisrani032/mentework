import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

export function Cta() {
  return (
    <section id="pricing" className="scroll-mt-20 py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_0%,var(--primary)_0%,transparent_70%)] opacity-[0.14]"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start delivering projects on time
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">
              Bring your team into one workspace today. Set up takes about ten minutes.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={buttonClass("primary", "lg")}>
                Start your free trial
              </Link>
              <Link href="/demo" className={buttonClass("secondary", "lg")}>
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
