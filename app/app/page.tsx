import { redirect } from "next/navigation";

/** Server entry — client boot uses resolveStartRoute(). */
export default function AppEntryPage() {
  redirect("/onboarding");
}
