import { redirect } from "next/navigation";

/** Kept so old links still land somewhere useful. */
export default function TimesheetsRedirect() {
  redirect("/projects");
}
