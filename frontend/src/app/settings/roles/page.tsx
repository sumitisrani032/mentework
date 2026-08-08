import type { Metadata } from "next";

import { PermissionMatrix } from "@/components/settings/permission-matrix";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/section";
import { fetchFirstOrganization, fetchRoleMatrix } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Roles and permissions — Mentework",
  description: "Control what each role can see and change.",
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
  const organization = await fetchFirstOrganization();
  const matrix = organization ? await fetchRoleMatrix(organization.id) : null;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Container className="py-12 sm:py-16">
          <header className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">Settings</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Roles and permissions</h1>
            <p className="mt-3 leading-relaxed text-muted">
              Choose what each role can do in every part of the workspace. Granting create, edit or
              delete turns on view automatically, because nobody can change what they cannot see.
            </p>
            {organization ? (
              <p className="mt-3 text-sm text-muted">
                Editing <span className="font-medium text-foreground">{organization.name}</span> (
                <code className="font-mono text-xs">{organization.slug}</code>)
              </p>
            ) : null}
          </header>

          <div className="mt-10">
            {!organization ? (
              <Notice title="No organisation found">
                Start the API with <code className="font-mono">npm run dev:api</code> and create a
                demo tenant with <code className="font-mono">npm run db:seed</code>.
              </Notice>
            ) : !matrix ? (
              <Notice title="Could not load roles">
                The API did not return a permission matrix for this organisation.
              </Notice>
            ) : (
              <PermissionMatrix matrix={matrix} />
            )}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
