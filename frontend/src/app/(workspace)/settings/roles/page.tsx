import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PermissionMatrix } from "@/components/settings/permission-matrix";
import { Logo } from "@/components/logo";
import { Container } from "@/components/ui/section";
import { fetchRoleMatrix } from "@/lib/roles-server";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Roles and permissions — Mentework",
  robots: { index: false, follow: false },
};

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export default async function RolesSettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const result = await fetchRoleMatrix();
  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  return (
    <>
      <header className="border-b border-border">
        <Container className="flex h-16 items-center gap-3">
          <Logo />
          <span className="hidden text-sm text-muted sm:inline">{session.organization.name}</span>
        </Container>
      </header>

      <main className="flex-1">
        <Container className="py-12">
          <header className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">Settings</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Roles and permissions</h1>
            <p className="mt-3 leading-relaxed text-muted">
              Choose what each role can do in every part of the workspace. Granting create, edit or
              delete turns on view automatically, because nobody can change what they cannot see.
            </p>
          </header>

          <div className="mt-10">
            {result.status === "forbidden" ? (
              <Notice title="You do not have access to this page">
                Managing roles needs the <code className="font-mono">roles</code> permission, which
                the Organization Admin role has by default. Ask an administrator to grant it.
              </Notice>
            ) : result.status === "unavailable" ? (
              <Notice title="Could not load roles">
                The API did not return a permission matrix. Check that it is running with{" "}
                <code className="font-mono">npm run dev:api</code>.
              </Notice>
            ) : (
              <PermissionMatrix matrix={result.matrix} />
            )}
          </div>
        </Container>
      </main>
    </>
  );
}
