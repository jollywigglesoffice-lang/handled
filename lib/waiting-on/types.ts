export const WAITING_ON_PRESETS = [
  "Accountant",
  "Lawyer",
  "Client",
  "Supplier",
  "School",
] as const;

export type WaitingOnPreset = (typeof WAITING_ON_PRESETS)[number];

export const FOLLOW_UP_PRESETS = [3, 7, 14] as const;

export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number];

export type WaitingOnExtras = {
  waitingOn?: string;
  followUpAfterDays?: number;
};
