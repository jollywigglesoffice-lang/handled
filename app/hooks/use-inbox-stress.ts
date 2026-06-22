"use client";

import { useEffect, useMemo, useState } from "react";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { AttentionSnapshot } from "@/lib/attention-calm";
import { deriveWorkStyleProfile } from "@/lib/emotional-memory/profile";
import { readEmotionalMemory } from "@/lib/emotional-memory/store";
import {
  CALM_MODE_CHANGED_EVENT,
  STRESS_SESSION_CHANGED_EVENT,
  calmModeActiveCopy,
  computeStressScore,
  getStressSessionSignals,
  readCalmModePersist,
  resolveCalmModeSettings,
  updateCalmModeLevel,
} from "@/lib/inbox-stress";

type UseInboxStressOptions = {
  locale: "en" | "it";
  snapshot: AttentionSnapshot;
  messages: GmailCardMessage[];
  unreadCount: number;
  enabled?: boolean;
};

function countUrgentMessages(messages: GmailCardMessage[]): number {
  return messages.filter((m) => {
    const impact = m.timeImpact?.kind;
    if (impact === "time_sensitive" || impact === "time_blocker") return true;
    if (m.category === "worth_your_attention" && m.actionIntelligence?.actionable) return true;
    return false;
  }).length;
}

export function useInboxStress({
  locale,
  snapshot,
  messages,
  unreadCount,
  enabled = true,
}: UseInboxStressOptions) {
  const [revision, setRevision] = useState(0);
  const [calmPersist, setCalmPersist] = useState(readCalmModePersist);

  useEffect(() => {
    const bump = () => setRevision((n) => n + 1);
    window.addEventListener(STRESS_SESSION_CHANGED_EVENT, bump);
    window.addEventListener(CALM_MODE_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener(STRESS_SESSION_CHANGED_EVENT, bump);
      window.removeEventListener(CALM_MODE_CHANGED_EVENT, bump);
    };
  }, []);

  const session = useMemo(() => getStressSessionSignals(), [revision]);
  const emotionalProfile = useMemo(
    () => deriveWorkStyleProfile(readEmotionalMemory()),
    [revision],
  );

  const urgentCount = useMemo(() => countUrgentMessages(messages), [messages]);

  const stressScore = useMemo(() => {
    if (!enabled) return 0;
    return computeStressScore({
      needsAttention: snapshot.needsAttention,
      totalVisible: snapshot.totalVisible,
      urgentCount,
      unreadCount,
      sessionSkips: session.skips,
      sessionQuickDones: session.quickDones,
      rapidNavCount: session.rapidNav,
      onboardingHesitation: session.onboardingHesitation,
      emotionalNeedsSpace: emotionalProfile.emotionalTone === "needs_space",
    });
  }, [enabled, snapshot, urgentCount, unreadCount, session, emotionalProfile.emotionalTone]);

  useEffect(() => {
    if (!enabled) return;
    setCalmPersist(updateCalmModeLevel(stressScore));
  }, [enabled, stressScore]);

  const calm = useMemo(
    () =>
      resolveCalmModeSettings(
        calmPersist.level,
        calmPersist.score,
        calmPersist.recoveryStreak,
      ),
    [calmPersist],
  );

  const copy = useMemo(
    () =>
      calmModeActiveCopy(
        locale,
        calm.level,
        calm.stressScore,
        calmPersist.recoveryStreak > 0,
      ),
    [locale, calm.level, calm.stressScore, calmPersist.recoveryStreak],
  );

  return {
    stressScore,
    calm,
    copy,
    recovering: calmPersist.recoveryStreak > 0,
  };
}
