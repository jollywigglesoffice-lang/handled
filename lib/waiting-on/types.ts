export const WAITING_ON_PRESETS = [
  "Accountant",
  "Supplier",
  "Client",
  "School",
] as const;

export type WaitingOnPreset = (typeof WAITING_ON_PRESETS)[number];

export const FOLLOW_UP_PRESETS = [3, 14, 30] as const;

export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number];

export type WaitingResolutionReason = "received_response" | "no_longer_waiting";

export type WaitingOnExtras = {
  waitingOn?: string;
  /** Stored for future reminders — not surfaced in UI yet. */
  followUpAfterDays?: number;
};
