"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/components/ui/button";

/**
 * Ends the session.
 *
 * `className` and `icon` exist so the account menu can show it as a menu row
 * without a second copy of the sign-out logic.
 */
export function SignOutButton({
  className,
  icon,
  label = "Sign out",
}: {
  className?: string;
  icon?: React.ReactNode;
  label?: string;
} = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={className ?? buttonClass("secondary", "sm")}
    >
      {icon}
      {pending ? "Signing out…" : label}
    </button>
  );
}
