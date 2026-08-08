import { Container, SectionHeading } from "@/components/ui/section";
import { SOLUTIONS } from "@/lib/content";

export function Solutions() {
  return (
    <section id="solutions" className="scroll-mt-20 border-b border-border py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Solutions"
          title="Built for the way each team works"
          description="Start from a setup that matches your department, then shape it to fit."
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOLUTIONS.map((solution) => (
            <li key={solution.title}>
              <a
                href="#features"
                className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-surface-strong"
              >
                <h3 className="font-semibold">{solution.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {solution.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Learn more
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 10h11m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
