import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MeHome } from "@/components/home/me-home";
import { Benefits } from "@/components/landing/benefits";
import { Cta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { FeatureTabs } from "@/components/landing/feature-tabs";
import { Hero } from "@/components/landing/hero";
import { Solutions } from "@/components/landing/solutions";
import { Testimonials } from "@/components/landing/testimonials";
import { WorkspaceFrame } from "@/components/shell/workspace-frame";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";
import { getTenantSlug } from "@/lib/tenant";

/** The root is two different pages, so it needs two different titles. */
export async function generateMetadata(): Promise<Metadata> {
  if ((await getTenantSlug()) && (await getSession())) {
    return { title: "Me — Mentework", robots: { index: false, follow: false } };
  }
  return {};
}

/**
 * One address, two pages: a workspace address is the Me page of whoever is
 * signed in, and the root domain is the marketing site.
 *
 * A workspace address never shows marketing — someone arriving at
 * acme.mentework.com came for their workspace, so they are sent to sign in.
 */
export default async function Home() {
  if (await getTenantSlug()) {
    const session = await getSession();
    if (!session) {
      redirect("/login");
    }
    return (
      <WorkspaceFrame session={session}>
        <MeHome session={session} />
      </WorkspaceFrame>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Solutions />
        <FeatureTabs />
        <Benefits />
        <Testimonials />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
