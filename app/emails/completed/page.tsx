import { redirect } from "next/navigation";

/** Completed history is internal workflow state — no dedicated inbox tab. */
export default function CompletedEmailsPage() {
  redirect("/emails");
}
