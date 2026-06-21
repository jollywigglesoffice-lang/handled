import { redirect } from "next/navigation";

/** Waiting-on is internal workflow state — surfaced on the main inbox, not a separate tab. */
export default function WaitingOnPage() {
  redirect("/emails");
}
