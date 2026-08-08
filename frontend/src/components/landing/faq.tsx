import { Container, SectionHeading } from "@/components/ui/section";
import { FAQS } from "@/lib/content";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-b border-border bg-surface py-20 sm:py-24">
      <Container>
        <SectionHeading eyebrow="FAQ" title="Questions we get asked" />

        {/* <details> gives keyboard and screen-reader behaviour for free. */}
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium transition-colors hover:bg-surface">
                {faq.question}
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden
                  className="size-5 shrink-0 text-muted transition-transform group-open:rotate-45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="px-5 pb-5 leading-relaxed text-muted">{faq.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
