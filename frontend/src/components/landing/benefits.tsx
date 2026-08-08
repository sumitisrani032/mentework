import { Container, SectionHeading } from "@/components/ui/section";
import { BENEFITS } from "@/lib/content";

export function Benefits() {
  return (
    <section id="why" className="scroll-mt-20 border-b border-border bg-surface py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Why Mentework"
          title="Fewer tools, clearer accountability"
          description="The point is not more features. It is knowing what is happening without asking."
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((benefit, index) => (
            <li
              key={benefit.title}
              className="rounded-xl border border-border bg-background p-6 sm:p-7"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/12 text-sm font-semibold text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{benefit.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{benefit.description}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
