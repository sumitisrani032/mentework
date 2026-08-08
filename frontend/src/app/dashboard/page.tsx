import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Container } from "@/components/ui/section";
import { ACTIONS, ACTION_LABELS } from "@/lib/rbac";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard — Mentework",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const visible = session.permissions.filter((permission) => permission.can_view);

  return (
    <>
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden text-sm text-muted sm:inline">
              {session.organization.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </Container>
      </header>

      <main className="flex-1">
        <Container className="py-12">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {session.user.full_name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as {session.user.email} · {session.organization.slug}
          </p>

          <section className="mt-10">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Your roles</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {session.roles.length > 0 ? (
                session.roles.map((role) => (
                  <li
                    key={role}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-sm"
                  >
                    {role}
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted">No roles assigned yet.</li>
              )}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
              What you can access
            </h2>
            <p className="mt-2 text-sm text-muted">
              Organisation-wide permissions. Project roles add access inside their own project.
            </p>

            {visible.length === 0 ? (
              <p className="mt-4 rounded-xl border border-border bg-surface p-5 text-sm text-muted">
                Your roles do not grant organisation-wide access to any area yet.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      <th scope="col" className="px-4 py-3 text-left font-semibold">
                        Feature
                      </th>
                      {ACTIONS.map((action) => (
                        <th key={action} scope="col" className="px-4 py-3 text-center font-semibold">
                          {ACTION_LABELS[action]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((permission) => (
                      <tr
                        key={permission.feature}
                        className="border-b border-border last:border-b-0"
                      >
                        <th scope="row" className="px-4 py-2.5 text-left font-medium capitalize">
                          {permission.feature.replace("_", " ")}
                        </th>
                        {ACTIONS.map((action) => (
                          <td key={action} className="px-4 py-2.5 text-center">
                            {permission[action] ? (
                              <span className="text-primary" aria-label="allowed">
                                ✓
                              </span>
                            ) : (
                              <span className="text-muted/40" aria-label="not allowed">
                                —
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="mt-10 flex flex-wrap gap-6 text-sm">
            <Link href="/projects" className="text-primary hover:underline">
              Projects →
            </Link>
            <Link href="/settings/roles" className="text-primary hover:underline">
              Manage roles and permissions →
            </Link>
          </div>
        </Container>
      </main>
    </>
  );
}
