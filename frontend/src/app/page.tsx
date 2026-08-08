import { redirect } from "next/navigation";

import { Benefits } from "@/components/landing/benefits";
import { Cta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { FeatureTabs } from "@/components/landing/feature-tabs";
import { Hero } from "@/components/landing/hero";
import { Solutions } from "@/components/landing/solutions";
import { Testimonials } from "@/components/landing/testimonials";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";
import { getTenantSlug } from "@/lib/tenant";

export default async function Home() {
  // Signed in on a workspace address: the marketing page is not what you came
  // for — your projects are.
  if ((await getTenantSlug()) && (await getSession())) {
    redirect("/projects");
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
