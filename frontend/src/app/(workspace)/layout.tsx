import { redirect } from "next/navigation";

import { WorkspaceFrame } from "@/components/shell/workspace-frame";
import { getSession } from "@/lib/session";

/**
 * The frame every signed-in page shares. Pages inside this group never render
 * their own rail, and a new page gets it for free by living here.
 */
export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <WorkspaceFrame session={session}>{children}</WorkspaceFrame>;
}
