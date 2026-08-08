import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { Container } from "@/components/ui/section";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Profile — Mentework",
  robots: { index: false, follow: false },
};

export default async function ProfileSettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="flex-1">
      <Container className="max-w-3xl py-12">
        <header>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-3 leading-relaxed text-muted">
            Your own account in {session.organization.name}.
          </p>
        </header>

        <div className="mt-10 space-y-6">
          <ProfileForm fullName={session.user.full_name} email={session.user.email} />
          <PasswordForm />
        </div>
      </Container>
    </main>
  );
}
