import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type CalmModeLevel = "off" | "calm";

export type InboxStressInput = {
  needsAttention: number;
  totalVisible: number;
  urgentCount: number;
  unreadCount: number;
  sessionSkips: number;
  sessionQuickDones: number;
  rapidNavCount: number;
  onboardingHesitation: boolean;
  emotionalNeedsSpace: boolean;
};

export type CalmModeSettings = {
  active: boolean;
  level: CalmModeLevel;
  focusPreviewCount: number;
  maxEmailsPerSection: number;
  hideClutterSection: boolean;
  hideTimeStrip: boolean;
  simplifyCardActions: boolean;
  priorityCategories: InboxAiCategory[];
  stressScore: number;
};

export const CALM_MODE_STORAGE_KEY = "handled:calm-mode:v1";
export const STRESS_SESSION_KEY = "handled:stress-session:v1";
