import { passiveAwarenessLabel } from "@/lib/email-action-state-copy";

/** Subtle inbox/detail hint — no chip, no call to action. */
export function PassiveAwarenessLine({ locale }: { locale: "en" | "it" }) {
  return (
    <p className="text-xs text-gray-400 calm-fade-in">{passiveAwarenessLabel(locale)}</p>
  );
}
