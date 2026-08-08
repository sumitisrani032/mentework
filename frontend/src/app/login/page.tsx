import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { fetchWorkspace, getSession } from "@/lib/session";
import { ROOT_DOMAIN, getTenantSlug } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Sign in — Mentework",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

export default async function LoginPage() {
  const slug = await getTenantSlug();

  // Sign-in only exists on a workspace subdomain.
  if (!slug) {
    return (
      <Shell>
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Choose your workspace</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Each organisation signs in on its own address. Go to{" "}
          <code className="font-mono text-xs">your-workspace.{ROOT_DOMAIN}</code> and sign in there.
        </p>
      </Shell>
    );
  }

  const workspace = await fetchWorkspace(slug);
  if (!workspace) {
    return (
      <Shell>
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Workspace not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          There is no workspace at{" "}
          <code className="font-mono text-xs">
            {slug}.{ROOT_DOMAIN}
          </code>
          . Check the address, or ask your administrator for the right link.
        </p>
      </Shell>
    );
  }

  // Already signed in on this subdomain.
  if (await getSession()) {
    redirect("/dashboard");
  }

  return (
    <Shell>
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">
        Sign in to {workspace.name}
      </h1>
      <p className="mt-2 text-sm text-muted">
        <code className="font-mono text-xs">
          {workspace.slug}.{ROOT_DOMAIN}
        </code>
      </p>

      <LoginForm />

      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        Accounts are created by your administrator. Contact them if you need access.
      </p>
    </Shell>
  );
}
