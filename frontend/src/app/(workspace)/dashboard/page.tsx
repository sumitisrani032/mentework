import { redirect } from "next/navigation";

/** The Me page moved to the workspace root; kept so old links still land there. */
export default function DashboardRedirect() {
  redirect("/");
}
