import { redirect } from "next/navigation";

/** Server entry — client AuthResolutionProvider applies decideNextRoute(). */
export default function AppEntryPage() {
  redirect("/onboarding");
}
