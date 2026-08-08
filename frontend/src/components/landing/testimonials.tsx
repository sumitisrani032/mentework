import { Container, SectionHeading } from "@/components/ui/section";
import { TESTIMONIALS } from "@/lib/content";

export function Testimonials() {
  return (
    <section className="border-b border-border py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Customers"
          title="What teams say after the switch"
          description="Quotes below are placeholders — replace them with real, attributable feedback."
        />

        <ul className="mt-14 grid gap-4 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <li
              key={testimonial.name}
              className="flex flex-col rounded-xl border border-border bg-surface p-6"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-7 fill-primary/25">
                <path d="M9.5 6C6.5 7.5 5 10 5 13v5h6v-6H8c0-2 .8-3.4 2.5-4.3L9.5 6Zm9 0C15.5 7.5 14 10 14 13v5h6v-6h-3c0-2 .8-3.4 2.5-4.3L18.5 6Z" />
              </svg>
              <blockquote className="mt-4 flex-1 leading-relaxed text-pretty">
                {testimonial.quote}
              </blockquote>
              <figcaption className="mt-6 border-t border-border pt-4 text-sm">
                <span className="font-semibold">{testimonial.name}</span>
                <span className="mt-0.5 block text-muted">
                  {testimonial.role}, {testimonial.company}
                </span>
              </figcaption>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
