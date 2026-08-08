import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/section";
import { fetchApiHealth } from "@/lib/api";

export const metadata: Metadata = {
  title: "System status — Mentework",
  description: "Live status of the Mentework API.",
};

export default async function StatusPage() {
  const health = await fetchApiHealth();
  const isOnline = health !== null;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Container className="py-16 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight">System status</h1>
            <p className="mt-2 text-muted">Checked when this page was requested.</p>

            <div className="mt-8 rounded-xl border border-border bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">API</h2>
                  <p className="mt-1 font-mono text-xs text-muted">GET /api/v1/health</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${isOnline ? "bg-primary" : "bg-red-500"}`}
                  />
                  {isOnline ? "operational" : "unreachable"}
                </span>
              </div>

              {health ? (
                <dl className="mt-5 flex gap-2 border-t border-border pt-4 text-sm">
                  <dt className="text-muted">environment</dt>
                  <dd className="font-mono">{health.environment}</dd>
                </dl>
              ) : (
                <p className="mt-5 border-t border-border pt-4 text-sm text-muted">
                  Start the backend with <code className="font-mono">npm run dev:api</code>, or the
                  whole stack with <code className="font-mono">npm run dev</code>.
                </p>
              )}
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
