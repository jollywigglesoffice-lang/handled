import type { AutopilotSummary } from "@/lib/autopilot/types";
import { isAutopilotInboxVisible } from "@/lib/autopilot";

/** Memory-informed inbox visibility — aggressive mode hides assisted suggestions. */
export function isEmotionalInboxVisible(
  autopilot: AutopilotSummary | undefined,
  aggressive: boolean,
): boolean {
  if (!aggressive) return isAutopilotInboxVisible(autopilot);
  if (!autopilot) return true;
  return autopilot.state === "worth_your_attention";
}
