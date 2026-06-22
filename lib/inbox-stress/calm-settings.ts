import type { CalmModeSettings, CalmModeLevel } from "@/lib/inbox-stress/types";

export function resolveCalmModeSettings(
  level: CalmModeLevel,
  stressScore: number,
  recoveryStreak: number,
): CalmModeSettings {
  const active = level === "calm";
  const recovering = active && recoveryStreak > 0;

  return {
    active,
    level,
    stressScore,
    focusPreviewCount: active ? 1 : 3,
    maxEmailsPerSection: active ? (recovering ? 4 : 3) : Infinity,
    hideClutterSection: active,
    hideTimeStrip: active,
    simplifyCardActions: active,
    priorityCategories: active
      ? (["worth_your_attention", "good_to_know"] as const)
      : [],
  };
}
