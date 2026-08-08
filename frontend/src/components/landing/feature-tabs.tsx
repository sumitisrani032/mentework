"use client";

import { useState } from "react";

import { AppPreview } from "@/components/landing/app-preview";
import { Container, SectionHeading } from "@/components/ui/section";
import { FEATURES } from "@/lib/content";

export function FeatureTabs() {
  const [activeId, setActiveId] = useState<string>(FEATURES[0].id);
  const active = FEATURES.find((feature) => feature.id === activeId) ?? FEATURES[0];

  return (
    <section id="features" className="scroll-mt-20 border-b border-border py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Features"
          title="Everything the work needs, in one workspace"
          description="Switch between the views your team actually uses. Same data, different angle."
        />

        <div
          role="tablist"
          aria-label="Product features"
          className="mt-12 flex flex-wrap justify-center gap-2"
        >
          {FEATURES.map((feature) => {
            const isActive = feature.id === active.id;
            return (
              <button
                key={feature.id}
                type="button"
                role="tab"
                id={`tab-${feature.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${feature.id}`}
                onClick={() => setActiveId(feature.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {feature.name}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
        >
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {active.headline}
            </h3>
            <p className="mt-4 leading-relaxed text-muted text-pretty">{active.description}</p>
            <ul className="mt-6 space-y-3">
              {active.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm">
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 fill-none stroke-primary stroke-[2.5]"
                  >
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          <AppPreview />
        </div>
      </Container>
    </section>
  );
}
