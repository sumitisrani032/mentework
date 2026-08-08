import { Benefits } from "@/components/landing/benefits";
import { Cta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { FeatureTabs } from "@/components/landing/feature-tabs";
import { Hero } from "@/components/landing/hero";
import { Solutions } from "@/components/landing/solutions";
import { Testimonials } from "@/components/landing/testimonials";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
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
